import type { AddressLabel, IdlConfig } from '../types';

/**
 * 根据地址获取标签
 * 优先级: 用户自定义标签 > IDL programId 标签 > 已知程序名称
 */
export function getAddressLabel(
  address: string,
  labels: AddressLabel[],
  idlConfigs?: IdlConfig[]
): string | undefined {
  // 1. 先查找用户自定义标签
  const found = labels.find((l) => l.address === address);
  if (found) {
    return found.label;
  }
  
  // 2. 再查找 IDL 配置中的 programId
  if (idlConfigs) {
    const idlConfig = idlConfigs.find((config) => 
      config.programIds.includes(address)
    );
    if (idlConfig) {
      return idlConfig.name;
    }
  }
  
  return undefined;
}

/**
 * 格式化地址显示
 * 如果有标签则显示标签，否则显示缩略地址
 */
export function formatAddress(
  address: string,
  labels: AddressLabel[],
  truncate: boolean = true,
  idlConfigs?: IdlConfig[]
): string {
  const label = getAddressLabel(address, labels, idlConfigs);
  if (label) {
    return label;
  }
  
  if (truncate && address.length > 12) {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }
  
  return address;
}

/**
 * 检查地址是否为有效的 Solana 地址
 */
export function isValidSolanaAddress(address: string): boolean {
  // Base58 字符集
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * 常见程序地址映射
 */
export const KNOWN_PROGRAMS: Record<string, string> = {
  '11111111111111111111111111111111': 'System Program',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token Program',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': 'Token-2022',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Program',
  'ComputeBudget111111111111111111111111111111': 'Compute Budget',
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': 'Memo Program',
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo': 'Memo Program (Legacy)',
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'Metaplex Token Metadata',
  'vau1zxA2LbssAUEF7Gpw91zMM1LvXrvpzJtmZ58rPsn': 'Vault Program',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter v6',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpool',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium CLAMM',
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'Meteora DLMM',
};

/**
 * 获取已知程序名称
 */
export function getKnownProgramName(programId: string): string | undefined {
  return KNOWN_PROGRAMS[programId];
}
