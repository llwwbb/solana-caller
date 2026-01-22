import { BorshCoder, BN } from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import type {
  IdlConfig,
  AddressLabel,
  DecodedInstruction,
  DecodedAccount,
  DecodedEvent,
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
 * 根据 discriminator 查找匹配的指令名称
 */
function findInstructionNameByDiscriminator(
  discriminatorHex: string,
  idl: Idl & { instructions?: Array<{ name: string; discriminator?: number[] }> }
): string | null {
  if (!idl.instructions) return null;
  
  for (const ix of idl.instructions) {
    if (ix.discriminator) {
      const ixDiscriminatorHex = Buffer.from(ix.discriminator).toString('hex');
      if (ixDiscriminatorHex === discriminatorHex) {
        return ix.name;
      }
    }
  }
  return null;
}

/**
 * 根据 discriminator 查找匹配的事件名称
 */
function findEventNameByDiscriminator(
  discriminatorHex: string,
  idl: Idl & { events?: Array<{ name: string; discriminator?: number[] }> }
): string | null {
  if (!idl.events) return null;
  
  for (const evt of idl.events) {
    if (evt.discriminator) {
      const evtDiscriminatorHex = Buffer.from(evt.discriminator).toString('hex');
      if (evtDiscriminatorHex === discriminatorHex) {
        return evt.name;
      }
    }
  }
  return null;
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

  const idl = idlConfig.idl as Idl & { 
    instructions?: Array<{ name: string; discriminator?: number[] }>;
    events?: Array<{ name: string; discriminator?: number[] }>;
  };

  // 获取 discriminator (前8字节)
  const discriminator = dataBuffer.slice(0, 8);
  const discriminatorHex = discriminator.toString('hex');

  // 获取 IDL 中所有指令的 discriminator 用于对比
  const getIdlDiscriminators = (): string => {
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
      // 尝试通过 discriminator 查找指令名称
      const matchedName = findInstructionNameByDiscriminator(discriminatorHex, idl);
      const idlInfo = getIdlDiscriminators();
      
      if (matchedName) {
        return {
          name: matchedName,
          data: null,
          rawData,
          hasIdl: true,
          decodeError: `指令 "${matchedName}" 的 Discriminator 匹配，但参数解析失败\nDiscriminator: 0x${discriminatorHex}`,
        };
      }
      
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
    
    // 尝试通过 discriminator 查找指令名称
    const matchedName = findInstructionNameByDiscriminator(discriminatorHex, idl);
    
    // 提取有用的错误信息
    let friendlyError = '解析失败';
    if (errorMsg.includes('Invalid instruction discriminator') || errorMsg.includes('discriminator')) {
      const idlInfo = getIdlDiscriminators();
      if (matchedName) {
        friendlyError = `指令 "${matchedName}" 的 Discriminator 匹配，但参数解析失败\nDiscriminator: 0x${discriminatorHex}\n原始错误: ${errorMsg.slice(0, 100)}`;
      } else {
        friendlyError = `Discriminator 不匹配\n实际值: 0x${discriminatorHex}\n在 IDL "${idlConfig.name}" 中未找到匹配的指令${idlInfo}`;
      }
    } else if (errorMsg.includes('Unexpected end of buffer')) {
      if (matchedName) {
        friendlyError = `指令 "${matchedName}" 的 Discriminator 匹配，但数据长度不足，无法完整解析\nDiscriminator: 0x${discriminatorHex}`;
      } else {
        friendlyError = `数据长度不足，无法完整解析\nDiscriminator: 0x${discriminatorHex}`;
      }
    } else if (errorMsg.includes('out of range')) {
      if (matchedName) {
        friendlyError = `指令 "${matchedName}" 的 Discriminator 匹配，但数据超出有效范围`;
      } else {
        friendlyError = '数据超出有效范围';
      }
    } else {
      if (matchedName) {
        friendlyError = `指令 "${matchedName}" 的 Discriminator 匹配，但解析失败: ${errorMsg.slice(0, 100)}`;
      } else {
        friendlyError = `解析错误: ${errorMsg.slice(0, 100)}`;
      }
    }
    
    return {
      name: matchedName,
      data: null,
      rawData,
      hasIdl: true,
      decodeError: friendlyError,
    };
  }
}

/**
 * 尝试将 CPI 指令数据解析为事件
 * CPI 事件的数据格式：前 8 字节是指令 discriminator，需要跳过，后面才是事件数据
 * @param programId - 程序 ID
 * @param dataBase58 - base58 编码的数据
 * @param idlConfigs - IDL 配置列表
 * @returns 解析结果，如果不是事件则返回 null
 */
export function tryDecodeCpiEvent(
  programId: string,
  dataBase58: string,
  idlConfigs: IdlConfig[]
): { name: string | null; data: Record<string, unknown> | null; decodeError?: string } | null {
  // 从 base58 解码
  let dataBuffer: Buffer;
  try {
    dataBuffer = Buffer.from(bs58.decode(dataBase58));
  } catch {
    return null;
  }

  // CPI 事件需要至少 16 字节（8 字节指令 discriminator + 8 字节事件 discriminator）
  if (dataBuffer.length < 16) {
    return null;
  }

  // 查找匹配的 IDL
  const idlConfig = findIdlByProgramId(programId, idlConfigs);
  if (!idlConfig) {
    return null;
  }

  const idl = idlConfig.idl as Idl & { events?: Array<{ name: string; discriminator?: number[] }> };
  if (!idl.events || idl.events.length === 0) {
    return null;
  }

  // CPI 事件：跳过前 8 字节（指令 discriminator），后面是事件数据
  const eventDataBuffer = dataBuffer.subarray(8);
  const eventDiscriminator = eventDataBuffer.slice(0, 8);
  const eventDiscriminatorHex = eventDiscriminator.toString('hex');

  // 检查事件 discriminator 是否匹配任何事件
  const eventName = findEventNameByDiscriminator(eventDiscriminatorHex, idl);
  if (!eventName) {
    return null; // discriminator 不匹配任何事件
  }

  // 尝试用 BorshCoder 解析事件
  try {
    const coder = new BorshCoder(idlConfig.idl as Idl);
    // 转为 base64 给 events.decode（使用跳过前 8 字节后的数据）
    const base64Data = eventDataBuffer.toString('base64');
    const decoded = coder.events.decode(base64Data);
    
    if (decoded) {
      return {
        name: decoded.name,
        data: decoded.data as Record<string, unknown>,
      };
    }
  } catch {
    // 解析失败
  }

  // Discriminator 匹配但解析失败
  return {
    name: eventName,
    data: null,
    decodeError: `事件 "${eventName}" 的 Discriminator 匹配，但参数解析失败\nDiscriminator: 0x${eventDiscriminatorHex}`,
  };
}

/**
 * 从交易日志中提取并解析事件
 * @param logs - 交易日志
 * @param idlConfigs - IDL 配置列表
 */
export function parseEventsFromLogs(
  logs: string[],
  idlConfigs: IdlConfig[]
): DecodedEvent[] {
  const events: DecodedEvent[] = [];
  let currentProgramId: string | null = null;
  let instructionIndex = 0;
  
  // 用于跟踪程序调用栈
  const programStack: string[] = [];
  
  for (const log of logs) {
    // 检测 Program invoke
    const invokeMatch = log.match(/^Program (\w+) invoke/);
    if (invokeMatch) {
      currentProgramId = invokeMatch[1];
      programStack.push(currentProgramId);
      continue;
    }
    
    // 检测 Program success/failed (弹出调用栈)
    const completeMatch = log.match(/^Program (\w+) (success|failed)/);
    if (completeMatch) {
      programStack.pop();
      currentProgramId = programStack.length > 0 ? programStack[programStack.length - 1] : null;
      if (completeMatch[2] === 'success' && programStack.length === 0) {
        instructionIndex++;
      }
      continue;
    }
    
    // 检测 Program data (事件数据)
    const dataMatch = log.match(/^Program data: (.+)$/);
    if (dataMatch && currentProgramId) {
      const base64Data = dataMatch[1];
      
      try {
        // base64 解码
        const dataBuffer = Buffer.from(base64Data, 'base64');
        
        // 查找匹配的 IDL
        const idlConfig = findIdlByProgramId(currentProgramId, idlConfigs);
        
        if (idlConfig) {
          const idl = idlConfig.idl as Idl & { events?: Array<{ name: string; discriminator?: number[] }> };
          const discriminator = dataBuffer.slice(0, 8);
          const discriminatorHex = discriminator.toString('hex');
          
          // 尝试解析事件
          try {
            const coder = new BorshCoder(idlConfig.idl as Idl);
            const decoded = coder.events.decode(base64Data);
            
            if (decoded) {
              events.push({
                programId: currentProgramId,
                name: decoded.name,
                data: decoded.data as Record<string, unknown>,
                rawData: base64Data,
                instructionIndex: instructionIndex,
                isCpi: false,
              });
              continue;
            }
          } catch {
            // 解析失败，尝试通过 discriminator 找到事件名称
          }
          
          // 通过 discriminator 查找事件名称
          const eventName = findEventNameByDiscriminator(discriminatorHex, idl);
          
          if (eventName) {
            events.push({
              programId: currentProgramId,
              name: eventName,
              data: null,
              rawData: base64Data,
              decodeError: `事件 "${eventName}" 的 Discriminator 匹配，但参数解析失败\nDiscriminator: 0x${discriminatorHex}`,
              instructionIndex: instructionIndex,
              isCpi: false,
            });
          } else {
            // 有 IDL 但未找到匹配的事件
            events.push({
              programId: currentProgramId,
              name: null,
              data: null,
              rawData: base64Data,
              decodeError: `在 IDL "${idlConfig.name}" 中未找到匹配的事件\nDiscriminator: 0x${discriminatorHex}`,
              instructionIndex: instructionIndex,
              isCpi: false,
            });
          }
        } else {
          // 无 IDL，仍然记录事件数据
          events.push({
            programId: currentProgramId,
            name: null,
            data: null,
            rawData: base64Data,
            instructionIndex: instructionIndex,
            isCpi: false,
          });
        }
      } catch {
        // Base64 解码失败
        events.push({
          programId: currentProgramId,
          name: null,
          data: null,
          rawData: base64Data,
          decodeError: 'Base64 解码失败',
          instructionIndex: instructionIndex,
          isCpi: false,
        });
      }
    }
  }
  
  return events;
}

/**
 * 从内部指令中解析 CPI 事件
 * Anchor 的 emit_cpi! 会生成一个内部指令来记录事件
 * CPI 事件格式：前 8 字节是指令 discriminator，后面是事件数据
 * @param innerInstructions - 内部指令
 * @param accountKeys - 账户地址列表
 * @param idlConfigs - IDL 配置列表
 */
export function parseCpiEventsFromInnerInstructions(
  innerInstructions: Array<{
    index: number;
    instructions: Array<{
      programIdIndex: number;
      accounts: number[];
      data: string;
    }>;
  }>,
  accountKeys: string[],
  idlConfigs: IdlConfig[]
): DecodedEvent[] {
  const events: DecodedEvent[] = [];

  for (const inner of innerInstructions) {
    for (const ix of inner.instructions) {
      const programId = accountKeys[ix.programIdIndex];
      if (!programId) continue;

      // 尝试将指令数据解析为 CPI 事件（需要跳过前 8 字节）
      const eventResult = tryDecodeCpiEvent(programId, ix.data, idlConfigs);
      
      if (eventResult) {
        events.push({
          programId,
          name: eventResult.name,
          data: eventResult.data,
          rawData: ix.data,
          decodeError: eventResult.decodeError,
          instructionIndex: inner.index,
          isCpi: true,
        });
      }
    }
  }

  return events;
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
 * @param tryParseAsEvent - 是否尝试解析为 CPI 事件（用于内部指令）
 */
export function parseInstruction(
  programId: string,
  data: string,
  accountKeys: string[],
  accountIndexes: number[],
  idlConfigs: IdlConfig[],
  addressLabels: AddressLabel[],
  tryParseAsEvent: boolean = false
): DecodedInstruction {
  // 如果指定了尝试解析为事件，先尝试 CPI 事件解析
  if (tryParseAsEvent) {
    const eventResult = tryDecodeCpiEvent(programId, data, idlConfigs);
    if (eventResult) {
      // 解析账户
      const accounts: DecodedAccount[] = accountIndexes.map((index) => {
        const pubkey = accountKeys[index] || `Unknown (${index})`;
        const label = formatAddress(pubkey, addressLabels, false, idlConfigs);
        return {
          pubkey,
          label: label !== pubkey ? label : undefined,
        };
      });

      return {
        programId,
        name: eventResult.name,
        data: eventResult.data,
        accounts,
        rawData: data,
        decodeError: eventResult.decodeError,
        hasIdl: true,
        isEvent: true,
      };
    }
  }

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
