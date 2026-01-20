import type { Idl } from '@coral-xyz/anchor';
import type { IdlVersion } from '../types';

// 旧版 IDL 账户格式
interface LegacyIdlAccount {
  name: string;
  isMut?: boolean;
  isSigner?: boolean;
  isOptional?: boolean;
  docs?: string[];
  pda?: unknown;
}

// 旧版 IDL 指令格式
interface LegacyIdlInstruction {
  name: string;
  accounts: LegacyIdlAccount[];
  args: unknown[];
  docs?: string[];
}

/**
 * 检测 IDL 版本
 * 旧版 (≤0.29) 使用 isMut/isSigner
 * 新版 (≥0.30) 使用 writable/signer
 */
export function detectIdlVersion(idl: unknown): IdlVersion {
  const idlObj = idl as Record<string, unknown>;
  const instructions = idlObj.instructions as LegacyIdlInstruction[] | undefined;
  
  if (!instructions?.length) {
    return 'modern';
  }

  // 递归检查账户
  const checkAccounts = (accounts: unknown[]): boolean => {
    for (const acc of accounts) {
      const account = acc as Record<string, unknown>;
      if ('isMut' in account || 'isSigner' in account) {
        return true;
      }
      // 检查嵌套账户组
      if ('accounts' in account && Array.isArray(account.accounts)) {
        if (checkAccounts(account.accounts)) {
          return true;
        }
      }
    }
    return false;
  };

  for (const ix of instructions) {
    if (ix.accounts && checkAccounts(ix.accounts)) {
      return 'legacy';
    }
  }

  return 'modern';
}

/**
 * 转换旧版账户格式为新版
 */
function normalizeAccounts(accounts: LegacyIdlAccount[]): unknown[] {
  return accounts.map((acc) => {
    // 处理嵌套账户组
    if ('accounts' in acc && Array.isArray((acc as unknown as Record<string, unknown>).accounts)) {
      const nested = acc as unknown as { name: string; accounts: LegacyIdlAccount[] };
      return {
        name: nested.name,
        accounts: normalizeAccounts(nested.accounts),
      };
    }

    const normalized: Record<string, unknown> = {
      name: acc.name,
    };

    if (acc.isMut) {
      normalized.writable = true;
    }
    if (acc.isSigner) {
      normalized.signer = true;
    }
    if (acc.isOptional) {
      normalized.optional = true;
    }
    if (acc.docs) {
      normalized.docs = acc.docs;
    }
    if (acc.pda) {
      normalized.pda = acc.pda;
    }

    return normalized;
  });
}

/**
 * 将旧版 IDL 转换为新版格式
 */
export function normalizeIdl(idl: unknown): Idl {
  const version = detectIdlVersion(idl);
  
  if (version === 'modern') {
    return idl as Idl;
  }

  const oldIdl = idl as Record<string, unknown>;
  const instructions = oldIdl.instructions as LegacyIdlInstruction[] | undefined;

  const normalized: Record<string, unknown> = {
    ...oldIdl,
  };

  // 转换指令中的账户格式
  if (instructions) {
    normalized.instructions = instructions.map((ix) => ({
      ...ix,
      accounts: normalizeAccounts(ix.accounts),
    }));
  }

  return normalized as Idl;
}

/**
 * 验证 IDL 是否有效
 */
export function validateIdl(idl: unknown): { valid: boolean; error?: string } {
  if (!idl || typeof idl !== 'object') {
    return { valid: false, error: 'IDL 必须是一个对象' };
  }

  const idlObj = idl as Record<string, unknown>;

  if (!idlObj.instructions || !Array.isArray(idlObj.instructions)) {
    return { valid: false, error: 'IDL 缺少 instructions 字段' };
  }

  if (!idlObj.name && !idlObj.metadata) {
    return { valid: false, error: 'IDL 缺少 name 或 metadata 字段' };
  }

  return { valid: true };
}

/**
 * 获取 IDL 名称
 */
export function getIdlName(idl: unknown): string {
  const idlObj = idl as Record<string, unknown>;
  
  if (typeof idlObj.name === 'string') {
    return idlObj.name;
  }
  
  if (idlObj.metadata && typeof idlObj.metadata === 'object') {
    const metadata = idlObj.metadata as Record<string, unknown>;
    if (typeof metadata.name === 'string') {
      return metadata.name;
    }
  }

  return 'Unknown Program';
}
