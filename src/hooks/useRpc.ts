import { useState, useCallback, useMemo, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import type {
  IdlConfig,
  AddressLabel,
  ParsedTransaction,
  ParsedAccountData,
  DecodedInnerInstruction,
  TokenBalance,
} from '../types';
import {
  parseInstruction,
  decodeAccountData,
  serializeBigInt,
  parseEventsFromLogs,
} from '../utils/instructionDecoder';

interface UseRpcOptions {
  rpcUrl: string;
  idlConfigs: IdlConfig[];
  addressLabels: AddressLabel[];
}

interface UseRpcReturn {
  connection: Connection | null;
  loading: boolean;
  error: string | null;
  getTransaction: (signature: string) => Promise<ParsedTransaction | null>;
  getAccountInfo: (address: string) => Promise<ParsedAccountData | null>;
  testConnection: () => Promise<boolean>;
}

export function useRpc({
  rpcUrl,
  idlConfigs,
  addressLabels,
}: UseRpcOptions): UseRpcReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 ref 存储配置，避免回调函数重建
  const idlConfigsRef = useRef(idlConfigs);
  const addressLabelsRef = useRef(addressLabels);
  idlConfigsRef.current = idlConfigs;
  addressLabelsRef.current = addressLabels;

  const connection = useMemo(() => {
    if (!rpcUrl) return null;
    try {
      return new Connection(rpcUrl, 'confirmed');
    } catch {
      return null;
    }
  }, [rpcUrl]);

  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!connection) {
      setError('未配置 RPC 地址');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await connection.getSlot();
      return true;
    } catch (e) {
      setError(`连接失败: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const getTransaction = useCallback(
    async (signature: string): Promise<ParsedTransaction | null> => {
      if (!connection) {
        setError('未配置 RPC 地址');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx) {
          setError('交易不存在');
          return null;
        }

        // 获取账户密钥列表
        const message = tx.transaction.message;
        const accountKeys: string[] = [];

        // 静态账户
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = message as any;
        if ('staticAccountKeys' in message) {
          const staticKeys = msg.staticAccountKeys as PublicKey[];
          accountKeys.push(...staticKeys.map((k: PublicKey) => k.toBase58()));
        } else if ('accountKeys' in message) {
          const keys = msg.accountKeys as PublicKey[];
          accountKeys.push(...keys.map((k: PublicKey) => k.toBase58()));
        }

        // 地址查找表账户（v0 交易）
        if (tx.meta?.loadedAddresses) {
          accountKeys.push(
            ...tx.meta.loadedAddresses.writable.map((k) => k.toBase58()),
            ...tx.meta.loadedAddresses.readonly.map((k) => k.toBase58())
          );
        }

        // 解析指令
        // compiledInstructions 的 data 是 Uint8Array，需要转成 base58
        const instructions = message.compiledInstructions.map((ix) => {
          const programId = accountKeys[ix.programIdIndex];
          // 将 Uint8Array 编码为 base58
          const dataBase58 = bs58.encode(ix.data);
          return parseInstruction(
            programId,
            dataBase58,
            accountKeys,
            ix.accountKeyIndexes,
            idlConfigsRef.current,
            addressLabelsRef.current
          );
        });

        // 解析内部指令
        // innerInstructions 的 data 已经是 base58 字符串
        // 对于内部指令，尝试解析为 CPI 事件
        const innerInstructions: DecodedInnerInstruction[] = [];
        if (tx.meta?.innerInstructions) {
          for (const inner of tx.meta.innerInstructions) {
            const parsedInner: DecodedInnerInstruction = {
              index: inner.index,
              instructions: inner.instructions.map((ix) => {
                const programId = accountKeys[ix.programIdIndex];
                // ix.data 已经是 base58 字符串，直接使用
                // 传入 tryParseAsEvent: true 以尝试解析为 CPI 事件
                return parseInstruction(
                  programId,
                  ix.data as string,
                  accountKeys,
                  ix.accounts,
                  idlConfigsRef.current,
                  addressLabelsRef.current,
                  true // tryParseAsEvent
                );
              }),
            };
            innerInstructions.push(parsedInner);
          }
        }

        // 提取 token balances
        const preTokenBalances: TokenBalance[] = (tx.meta?.preTokenBalances || []).map((tb) => ({
          accountIndex: tb.accountIndex,
          mint: tb.mint,
          owner: tb.owner,
          programId: tb.programId,
          uiTokenAmount: {
            amount: tb.uiTokenAmount.amount,
            decimals: tb.uiTokenAmount.decimals,
            uiAmount: tb.uiTokenAmount.uiAmount,
            uiAmountString: tb.uiTokenAmount.uiAmountString,
          },
        }));

        const postTokenBalances: TokenBalance[] = (tx.meta?.postTokenBalances || []).map((tb) => ({
          accountIndex: tb.accountIndex,
          mint: tb.mint,
          owner: tb.owner,
          programId: tb.programId,
          uiTokenAmount: {
            amount: tb.uiTokenAmount.amount,
            decimals: tb.uiTokenAmount.decimals,
            uiAmount: tb.uiTokenAmount.uiAmount,
            uiAmountString: tb.uiTokenAmount.uiAmountString,
          },
        }));

        // 从日志中解析事件（CPI 事件已在内部指令解析时处理）
        const logMessages = tx.meta?.logMessages || [];
        const events = parseEventsFromLogs(logMessages, idlConfigsRef.current);

        const result: ParsedTransaction = {
          signature,
          slot: tx.slot,
          blockTime: tx.blockTime ?? null,
          success: tx.meta?.err === null,
          fee: tx.meta?.fee || 0,
          instructions,
          innerInstructions,
          events,
          logs: logMessages,
          preBalances: tx.meta?.preBalances || [],
          postBalances: tx.meta?.postBalances || [],
          preTokenBalances,
          postTokenBalances,
          accountKeys,
        };

        return serializeBigInt(result) as ParsedTransaction;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`获取交易失败: ${msg}`);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connection]
  );

  const getAccountInfo = useCallback(
    async (address: string): Promise<ParsedAccountData | null> => {
      if (!connection) {
        setError('未配置 RPC 地址');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const pubkey = new PublicKey(address);
        const accountInfo = await connection.getAccountInfo(pubkey);

        if (!accountInfo) {
          setError('账户不存在');
          return null;
        }

        const owner = accountInfo.owner.toBase58();
        const { accountType, data: parsedData } = decodeAccountData(
          owner,
          accountInfo.data,
          idlConfigsRef.current
        );

        const result: ParsedAccountData = {
          address,
          owner,
          lamports: accountInfo.lamports,
          executable: accountInfo.executable,
          rentEpoch: accountInfo.rentEpoch !== undefined ? Number(accountInfo.rentEpoch) : null,
          dataSize: accountInfo.data.length,
          accountType,
          parsedData: parsedData
            ? (serializeBigInt(parsedData) as Record<string, unknown>)
            : null,
          rawData: accountInfo.data.toString('base64'),
        };

        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`获取账户失败: ${msg}`);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connection]
  );

  return {
    connection,
    loading,
    error,
    getTransaction,
    getAccountInfo,
    testConnection,
  };
}
