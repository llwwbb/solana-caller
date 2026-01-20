import { BorshCoder, BN } from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import type {
  IdlConfig,
  AddressLabel,
  DecodedInstruction,
  DecodedAccount,
} from '../types';
import { formatAddress, getKnownProgramName } from './addressResolver';

/**
 * 根据 programId 查找匹配的 IDL
 */
export function findIdlByProgramId(
  programId: string,
  idlConfigs: IdlConfig[]
): IdlConfig | undefined {
  return idlConfigs.find((config) => config.programIds.includes(programId));
}

/**
 * 解码指令数据返回类型
 */
interface DecodeResult {
  name: string | null;
  data: Record<string, unknown> | null;
  rawData: string;
  decodeError?: string;
  hasIdl: boolean;
}

/**
 * 解码指令数据
 * @param data - base58 编码的指令数据
 */
export function decodeInstructionData(
  programId: string,
  data: string,
  idlConfigs: IdlConfig[]
): DecodeResult {
  // 从 base58 解码
  let dataBuffer: Buffer;
  const rawData = data; // base58 编码的原始数据
  
  try {
    dataBuffer = Buffer.from(bs58.decode(data));
  } catch {
    return { name: null, data: null, rawData, hasIdl: false, decodeError: 'Base58 解码失败' };
  }

  // 查找匹配的 IDL
  const idlConfig = findIdlByProgramId(programId, idlConfigs);
  
  if (!idlConfig) {
    return { name: null, data: null, rawData, hasIdl: false };
  }

  // 获取 IDL 中所有指令的 discriminator 用于对比
  const getIdlDiscriminators = (): string => {
    const idl = idlConfig.idl as Idl & { instructions?: Array<{ name: string; discriminator?: number[] }> };
    if (!idl.instructions) return '';
    
    const discriminators = idl.instructions
      .filter(ix => ix.discriminator)
      .map(ix => {
        const hex = Buffer.from(ix.discriminator!).toString('hex');
        return `${ix.name}: 0x${hex}`;
      })
      .slice(0, 5); // 只显示前5个
    
    if (discriminators.length === 0) return '';
    const more = idl.instructions.length > 5 ? ` ... (共 ${idl.instructions.length} 个指令)` : '';
    return `\n\nIDL 可用指令:\n${discriminators.join('\n')}${more}`;
  };

  try {
    const coder = new BorshCoder(idlConfig.idl as Idl);
    const decoded = coder.instruction.decode(dataBuffer);
    
    if (decoded) {
      return {
        name: decoded.name,
        data: decoded.data as Record<string, unknown>,
        rawData,
        hasIdl: true,
      };
    } else {
      const discriminator = dataBuffer.slice(0, 8);
      const discriminatorHex = discriminator.toString('hex');
      const idlInfo = getIdlDiscriminators();
      return {
        name: null,
        data: null,
        rawData,
        hasIdl: true,
        decodeError: `Discriminator 不匹配\n实际值: 0x${discriminatorHex}\n在 IDL "${idlConfig.name}" 中未找到匹配的指令${idlInfo}`,
      };
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    const discriminator = dataBuffer.slice(0, 8);
    const discriminatorHex = discriminator.toString('hex');
    const idlInfo = getIdlDiscriminators();
    
    // 提取有用的错误信息
    let friendlyError = '解析失败';
    if (errorMsg.includes('Invalid instruction discriminator') || errorMsg.includes('discriminator')) {
      friendlyError = `Discriminator 不匹配\n实际值: 0x${discriminatorHex}\n在 IDL "${idlConfig.name}" 中未找到匹配的指令${idlInfo}`;
    } else if (errorMsg.includes('Unexpected end of buffer')) {
      friendlyError = `数据长度不足，无法完整解析\nDiscriminator: 0x${discriminatorHex}`;
    } else if (errorMsg.includes('out of range')) {
      friendlyError = '数据超出有效范围';
    } else {
      friendlyError = `解析错误: ${errorMsg.slice(0, 100)}`;
    }
    
    return {
      name: null,
      data: null,
      rawData,
      hasIdl: true,
      decodeError: friendlyError,
    };
  }
}

/**
 * 解码账户数据
 */
export function decodeAccountData(
  owner: string,
  data: Buffer | Uint8Array,
  idlConfigs: IdlConfig[]
): { accountType: string | null; data: Record<string, unknown> | null } {
  const idlConfig = findIdlByProgramId(owner, idlConfigs);
  
  if (!idlConfig) {
    return { accountType: null, data: null };
  }

  try {
    const coder = new BorshCoder(idlConfig.idl as Idl);
    const dataBuffer = Buffer.from(data);
    
    // 尝试解码为每种账户类型
    const idl = idlConfig.idl as Idl;
    if (idl.accounts) {
      for (const accountDef of idl.accounts) {
        try {
          const decoded = coder.accounts.decode(accountDef.name, dataBuffer);
          if (decoded) {
            return {
              accountType: accountDef.name,
              data: decoded as Record<string, unknown>,
            };
          }
        } catch {
          // 继续尝试其他账户类型
        }
      }
    }
  } catch (e) {
    console.warn('Failed to decode account data:', e);
  }

  return { accountType: null, data: null };
}

/**
 * 解析交易中的指令
 */
export function parseInstruction(
  programId: string,
  data: string,
  accountKeys: string[],
  accountIndexes: number[],
  idlConfigs: IdlConfig[],
  addressLabels: AddressLabel[]
): DecodedInstruction {
  const decoded = decodeInstructionData(programId, data, idlConfigs);
  const idlConfig = findIdlByProgramId(programId, idlConfigs);

  // 解析账户
  const accounts: DecodedAccount[] = accountIndexes.map((index, i) => {
    const pubkey = accountKeys[index] || `Unknown (${index})`;
    const label = formatAddress(pubkey, addressLabels, false, idlConfigs);
    
    // 尝试从 IDL 获取账户元信息
    let accountMeta: { name?: string; isSigner?: boolean; isWritable?: boolean } = {};
    if (idlConfig && decoded.name) {
      const idl = idlConfig.idl as Idl;
      const ixDef = idl.instructions?.find((ix) => ix.name === decoded.name);
      if (ixDef?.accounts && i < ixDef.accounts.length) {
        const accDef = ixDef.accounts[i] as Record<string, unknown>;
        accountMeta = {
          name: typeof accDef.name === 'string' ? accDef.name : undefined,
          isSigner: accDef.signer === true,
          isWritable: accDef.writable === true,
        };
      }
    }

    return {
      pubkey,
      label: label !== pubkey ? label : undefined,
      ...accountMeta,
    };
  });

  // 获取程序名称
  const knownName = getKnownProgramName(programId);
  const programLabel = idlConfig?.name || knownName;

  return {
    programId,
    name: decoded.name || (decoded.hasIdl ? null : programLabel) || null,
    data: decoded.data,
    accounts,
    rawData: decoded.rawData,
    decodeError: decoded.decodeError,
    hasIdl: decoded.hasIdl,
  };
}

/**
 * 检测对象是否是 PublicKey 类型（包括 duck-typed）
 */
function isPublicKeyLike(obj: unknown): obj is PublicKey {
  if (obj instanceof PublicKey) {
    return true;
  }
  // Duck-type 检测：有 _bn 属性且有 toBase58 方法
  if (
    obj &&
    typeof obj === 'object' &&
    '_bn' in obj &&
    'toBase58' in obj &&
    typeof (obj as { toBase58: unknown }).toBase58 === 'function'
  ) {
    return true;
  }
  return false;
}

/**
 * 将 BigInt、BN 和 PublicKey 转换为可序列化格式
 */
export function serializeBigInt(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  // 处理 PublicKey 对象 - 转换为 base58 字符串
  if (isPublicKeyLike(obj)) {
    try {
      return obj.toBase58();
    } catch {
      // 如果 toBase58 失败，尝试从 _bn 构建
      const bnValue = (obj as { _bn?: BN })._bn;
      if (bnValue instanceof BN) {
        try {
          // 将 BN 转为 32 字节的 buffer，再转 base58
          const bytes = bnValue.toArrayLike(Buffer, 'le', 32);
          return bs58.encode(bytes);
        } catch {
          return bnValue.toString();
        }
      }
    }
  }
  
  // 处理 BN (Big Number) 对象
  if (obj instanceof BN) {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    // 检测可能是 PublicKey 但没有 toBase58 方法的对象（纯 JSON 结构）
    const objRecord = obj as Record<string, unknown>;
    if (
      '_bn' in objRecord &&
      Object.keys(objRecord).length === 1 &&
      objRecord._bn instanceof BN
    ) {
      // 这是一个只有 _bn 属性的对象，很可能是 PublicKey 的内部结构
      try {
        const bytes = (objRecord._bn as BN).toArrayLike(Buffer, 'le', 32);
        return bs58.encode(bytes);
      } catch {
        return (objRecord._bn as BN).toString();
      }
    }
    
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  
  return obj;
}
