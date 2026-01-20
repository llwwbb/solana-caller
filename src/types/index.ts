import type { Idl } from '@coral-xyz/anchor';

// IDL 版本类型
export type IdlVersion = 'legacy' | 'modern';

// IDL 配置：一个 IDL 可对应多个 Program 地址
export interface IdlConfig {
  id: string;
  name: string;
  idl: Idl;
  originalVersion: IdlVersion;
  programIds: string[];
}

// 地址标签
export interface AddressLabel {
  address: string;
  label: string;
}

// 地址颜色高亮映射
export type AddressColorMap = Map<string, string>;

// 可选的高亮颜色
export const HIGHLIGHT_COLORS = [
  { name: '红色', bg: 'bg-red-200 dark:bg-red-900/50', color: '#fecaca' },
  { name: '橙色', bg: 'bg-orange-200 dark:bg-orange-900/50', color: '#fed7aa' },
  { name: '黄色', bg: 'bg-yellow-200 dark:bg-yellow-900/50', color: '#fef08a' },
  { name: '绿色', bg: 'bg-green-200 dark:bg-green-900/50', color: '#bbf7d0' },
  { name: '青色', bg: 'bg-cyan-200 dark:bg-cyan-900/50', color: '#a5f3fc' },
  { name: '蓝色', bg: 'bg-blue-200 dark:bg-blue-900/50', color: '#bfdbfe' },
  { name: '紫色', bg: 'bg-purple-200 dark:bg-purple-900/50', color: '#e9d5ff' },
  { name: '粉色', bg: 'bg-pink-200 dark:bg-pink-900/50', color: '#fbcfe8' },
] as const;

// 应用配置
export interface AppConfig {
  rpcUrl: string;
  idlConfigs: IdlConfig[];
  addressLabels: AddressLabel[];
}

// 解析后的指令
export interface DecodedInstruction {
  programId: string;
  name: string | null;
  data: Record<string, unknown> | null;
  accounts: DecodedAccount[];
  rawData?: string;
  decodeError?: string;  // 解析失败的原因
  hasIdl?: boolean;      // 是否有对应的 IDL
}

// 解析后的账户
export interface DecodedAccount {
  pubkey: string;
  name?: string;      // IDL 中定义的账户名称
  label?: string;
  isSigner?: boolean;
  isWritable?: boolean;
}

// 解析后的内部指令
export interface DecodedInnerInstruction {
  index: number;
  instructions: DecodedInstruction[];
}

// Token 余额信息
export interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  programId?: string;
  uiTokenAmount: {
    amount: string;
    decimals: number;
    uiAmount: number | null;
    uiAmountString: string;
  };
}

// Token 标记信息（用于标记账户角色）
export interface TokenAccountMarkers {
  mints: Set<string>;        // mint 地址集合
  tokenAccounts: Set<string>; // token account 地址集合
  mintToTokenAccounts: Map<string, string[]>; // mint -> token accounts 映射
}

// 交易解析结果
export interface ParsedTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  success: boolean;
  fee: number;
  instructions: DecodedInstruction[];
  innerInstructions: DecodedInnerInstruction[];
  logs: string[];
  // 余额变化
  preBalances: number[];
  postBalances: number[];
  preTokenBalances: TokenBalance[];
  postTokenBalances: TokenBalance[];
  // 账户列表（用于余额索引映射）
  accountKeys: string[];
}

// 解析后的账户数据
export interface ParsedAccountData {
  address: string;
  owner: string;
  lamports: number;
  executable: boolean;
  rentEpoch: number;
  dataSize: number;
  accountType: string | null;
  parsedData: Record<string, unknown> | null;
  rawData?: string;
}

// 默认配置
export const DEFAULT_CONFIG: AppConfig = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  idlConfigs: [],
  addressLabels: [],
};

// 常用 RPC 节点
export const RPC_PRESETS = [
  { name: 'Mainnet Beta', url: 'https://api.mainnet-beta.solana.com' },
  { name: 'Devnet', url: 'https://api.devnet.solana.com' },
  { name: 'Testnet', url: 'https://api.testnet.solana.com' },
];
