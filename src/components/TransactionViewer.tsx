import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ParsedTransaction, AddressLabel, IdlConfig, TokenAccountMarkers, AddressColorMap } from '../types';
import { InstructionCard } from './InstructionCard';
import { EventCard } from './EventCard';
import { AddressDisplay } from './AddressDisplay';

interface TransactionViewerProps {
  onQuery: (signature: string) => Promise<ParsedTransaction | null>;
  loading: boolean;
  error: string | null;
  addressLabels: AddressLabel[];
  onAddLabel?: (address: string, label: string) => void;
  idlConfigs: IdlConfig[];
  history: string[];
  onAddHistory: (signature: string) => void;
  onClearHistory: () => void;
}

export function TransactionViewer({
  onQuery,
  loading,
  error,
  addressLabels,
  onAddLabel,
  idlConfigs,
  history,
  onAddHistory,
  onClearHistory,
}: TransactionViewerProps) {
  const [signature, setSignature] = useState('');
  const [transaction, setTransaction] = useState<ParsedTransaction | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBalances, setShowBalances] = useState(false);
  const [showTokenBalances, setShowTokenBalances] = useState(false);
  
  // 地址颜色高亮状态
  const [addressColors, setAddressColors] = useState<AddressColorMap>(new Map());
  
  // 保存当前查询的签名，用于 IDL 变化时重新解析
  const currentSignatureRef = useRef<string | null>(null);
  const prevIdlConfigsLengthRef = useRef(idlConfigs.length);

  // 设置地址颜色的回调
  const handleSetAddressColor = useCallback((address: string, color: string | null) => {
    setAddressColors(prev => {
      const next = new Map(prev);
      if (color === null) {
        next.delete(address);
      } else {
        next.set(address, color);
      }
      return next;
    });
  }, []);

  // 清除所有颜色高亮
  const handleClearAllColors = useCallback(() => {
    setAddressColors(new Map());
  }, []);

  // 当 IDL 配置变化时，自动重新解析当前交易
  useEffect(() => {
    // 只在 IDL 数量增加时触发重新解析（新添加了 IDL）
    if (idlConfigs.length > prevIdlConfigsLengthRef.current && currentSignatureRef.current && !loading) {
      const sig = currentSignatureRef.current;
      onQuery(sig).then((result) => {
        if (result) {
          setTransaction(result);
        }
      });
    }
    prevIdlConfigsLengthRef.current = idlConfigs.length;
  }, [idlConfigs.length, onQuery, loading]);

  const handleQuery = async () => {
    if (!signature.trim()) return;
    const sig = signature.trim();
    currentSignatureRef.current = sig;
    // 查询新交易时清除颜色高亮
    setAddressColors(new Map());
    const result = await onQuery(sig);
    setTransaction(result);
    if (result) {
      onAddHistory(sig);
    }
  };

  const handleSelectHistory = async (sig: string) => {
    setSignature(sig);
    setShowHistory(false);
    currentSignatureRef.current = sig;
    const result = await onQuery(sig);
    setTransaction(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuery();
    }
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  };

  // 从 token balances 中提取 mint 和 token account 标记
  const tokenMarkers = useMemo((): TokenAccountMarkers => {
    const mints = new Set<string>();
    const tokenAccounts = new Set<string>();
    const mintToTokenAccounts = new Map<string, string[]>();

    if (!transaction) {
      return { mints, tokenAccounts, mintToTokenAccounts };
    }

    const allTokenBalances = [
      ...transaction.preTokenBalances,
      ...transaction.postTokenBalances,
    ];

    for (const tb of allTokenBalances) {
      mints.add(tb.mint);
      const tokenAccount = transaction.accountKeys[tb.accountIndex];
      if (tokenAccount) {
        tokenAccounts.add(tokenAccount);
        
        // 建立 mint -> token accounts 映射
        const existing = mintToTokenAccounts.get(tb.mint) || [];
        if (!existing.includes(tokenAccount)) {
          mintToTokenAccounts.set(tb.mint, [...existing, tokenAccount]);
        }
      }
    }

    return { mints, tokenAccounts, mintToTokenAccounts };
  }, [transaction]);

  // 格式化 SOL 余额
  const formatSol = (lamports: number) => {
    return (lamports / 1e9).toFixed(9);
  };

  // 计算余额变化
  const getBalanceChange = (pre: number, post: number) => {
    const change = post - pre;
    if (change === 0) return null;
    const changeStr = (change / 1e9).toFixed(9);
    return change > 0 ? `+${changeStr}` : changeStr;
  };

  // 计算 token 余额变化
  const getTokenBalanceChange = (preAmount: string, postAmount: string, decimals: number) => {
    const pre = BigInt(preAmount);
    const post = BigInt(postAmount);
    const change = post - pre;
    if (change === 0n) return null;
    const divisor = 10n ** BigInt(decimals);
    const intPart = change / divisor;
    const fracPart = (change < 0n ? -change : change) % divisor;
    const fracStr = fracPart.toString().padStart(decimals, '0');
    const sign = change > 0n ? '+' : '';
    return `${sign}${intPart}.${fracStr}`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        交易查询
      </h2>

      {/* 查询输入 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入交易签名..."
            className="w-full px-3 py-2 text-sm font-mono border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          
          {/* 历史记录下拉 */}
          {showHistory && history.length > 0 && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowHistory(false)}
              />
              <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">查询历史</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearHistory();
                      setShowHistory(false);
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    清除
                  </button>
                </div>
                {history.map((sig) => (
                  <button
                    key={sig}
                    onClick={() => handleSelectHistory(sig)}
                    className="w-full px-3 py-2 text-left text-xs font-mono hover:bg-gray-100 dark:hover:bg-gray-700 truncate"
                  >
                    {sig}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 历史记录按钮 */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          disabled={history.length === 0}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative"
          title="查询历史"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {history.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {history.length > 9 ? '9+' : history.length}
            </span>
          )}
        </button>

        <button
          onClick={handleQuery}
          disabled={loading || !signature.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '查询中...' : '查询'}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* 交易结果 */}
      {transaction && (
        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                交易信息
              </h3>
              {addressColors.size > 0 && (
                <button
                  onClick={handleClearAllColors}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="清除所有地址高亮"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  清除高亮 ({addressColors.size})
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">状态:</span>
                <span
                  className={`ml-2 ${
                    transaction.success
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {transaction.success ? '成功' : '失败'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Slot:</span>
                <span className="ml-2 font-mono">{transaction.slot}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">时间:</span>
                <span className="ml-2">{formatTime(transaction.blockTime)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">手续费:</span>
                <span className="ml-2 font-mono">
                  {(transaction.fee / 1e9).toFixed(9)} SOL
                </span>
              </div>
            </div>
          </div>

          {/* SOL 余额变化 */}
          {transaction.preBalances.length > 0 && (
            <div>
              <button
                onClick={() => setShowBalances(!showBalances)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showBalances ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                SOL 余额变化 ({transaction.preBalances.length} 账户)
              </button>

              {showBalances && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">#</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">账户</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">交易前 (SOL)</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">交易后 (SOL)</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">变化</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {transaction.preBalances.map((pre, idx) => {
                        const post = transaction.postBalances[idx];
                        const change = getBalanceChange(pre, post);
                        const account = transaction.accountKeys[idx];
                        return (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-2 py-1.5 text-gray-400">{idx}</td>
                            <td className="px-2 py-1.5">
                            <AddressDisplay
                              address={account}
                              addressLabels={addressLabels}
                              onAddLabel={onAddLabel}
                              addressColors={addressColors}
                              onSetAddressColor={handleSetAddressColor}
                              idlConfigs={idlConfigs}
                            />
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">{formatSol(pre)}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{formatSol(post)}</td>
                            <td className={`px-2 py-1.5 text-right font-mono ${
                              change && change.startsWith('+')
                                ? 'text-green-600 dark:text-green-400'
                                : change
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-400'
                            }`}>
                              {change || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Token 余额变化 */}
          {(transaction.preTokenBalances.length > 0 || transaction.postTokenBalances.length > 0) && (
            <div>
              <button
                onClick={() => setShowTokenBalances(!showTokenBalances)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showTokenBalances ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Token 余额变化 ({new Set([...transaction.preTokenBalances, ...transaction.postTokenBalances].map(t => `${t.accountIndex}-${t.mint}`)).size} 条记录)
              </button>

              {showTokenBalances && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Token Account</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Mint</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-300">Owner</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">交易前</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">交易后</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">变化</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(() => {
                        // 合并 pre 和 post token balances
                        const balanceMap = new Map<string, { pre?: typeof transaction.preTokenBalances[0], post?: typeof transaction.postTokenBalances[0] }>();
                        
                        for (const tb of transaction.preTokenBalances) {
                          const key = `${tb.accountIndex}-${tb.mint}`;
                          balanceMap.set(key, { ...balanceMap.get(key), pre: tb });
                        }
                        for (const tb of transaction.postTokenBalances) {
                          const key = `${tb.accountIndex}-${tb.mint}`;
                          balanceMap.set(key, { ...balanceMap.get(key), post: tb });
                        }

                        return Array.from(balanceMap.entries()).map(([key, { pre, post }]) => {
                          const tb = pre || post!;
                          const preAmount = pre?.uiTokenAmount.amount || '0';
                          const postAmount = post?.uiTokenAmount.amount || '0';
                          const decimals = tb.uiTokenAmount.decimals;
                          const change = getTokenBalanceChange(preAmount, postAmount, decimals);
                          const tokenAccount = transaction.accountKeys[tb.accountIndex];

                          return (
                            <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                  <span className="px-1 py-0.5 text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                                    TOKEN
                                  </span>
                                  <AddressDisplay
                                    address={tokenAccount}
                                    addressLabels={addressLabels}
                                    onAddLabel={onAddLabel}
                                    addressColors={addressColors}
                                    onSetAddressColor={handleSetAddressColor}
                                    idlConfigs={idlConfigs}
                                  />
                                </div>
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                  <span className="px-1 py-0.5 text-[10px] bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded">
                                    MINT
                                  </span>
                                  <AddressDisplay
                                    address={tb.mint}
                                    addressLabels={addressLabels}
                                    onAddLabel={onAddLabel}
                                    addressColors={addressColors}
                                    onSetAddressColor={handleSetAddressColor}
                                    idlConfigs={idlConfigs}
                                  />
                                </div>
                              </td>
                              <td className="px-2 py-1.5">
                                {tb.owner ? (
                                  <AddressDisplay
                                    address={tb.owner}
                                    addressLabels={addressLabels}
                                    onAddLabel={onAddLabel}
                                    addressColors={addressColors}
                                    onSetAddressColor={handleSetAddressColor}
                                    idlConfigs={idlConfigs}
                                  />
                                ) : '-'}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">
                                {pre?.uiTokenAmount.uiAmountString || '0'}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">
                                {post?.uiTokenAmount.uiAmountString || '0'}
                              </td>
                              <td className={`px-2 py-1.5 text-right font-mono ${
                                change && change.startsWith('+')
                                  ? 'text-green-600 dark:text-green-400'
                                  : change
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-400'
                              }`}>
                                {change || '-'}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 指令列表 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              指令 ({transaction.instructions.length})
            </h3>
            <div className="space-y-2">
              {transaction.instructions.map((ix, index) => {
                // 查找对应的内部指令
                const innerIxs = transaction.innerInstructions.find(
                  (inner) => inner.index === index
                );

                return (
                  <div key={index} className="space-y-2">
                    <InstructionCard
                      instruction={ix}
                      index={index}
                      addressLabels={addressLabels}
                      onAddLabel={onAddLabel}
                      tokenMarkers={tokenMarkers}
                      addressColors={addressColors}
                      onSetAddressColor={handleSetAddressColor}
                      idlConfigs={idlConfigs}
                    />

                    {/* 内部指令 */}
                    {innerIxs && innerIxs.instructions.length > 0 && (
                      <div className="ml-6 space-y-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          内部指令 ({innerIxs.instructions.length})
                        </div>
                        {innerIxs.instructions.map((innerIx, innerIndex) => (
                          <InstructionCard
                            key={innerIndex}
                            instruction={innerIx}
                            index={index}
                            innerIndex={innerIndex}
                            addressLabels={addressLabels}
                            onAddLabel={onAddLabel}
                            tokenMarkers={tokenMarkers}
                            isInner
                            addressColors={addressColors}
                            onSetAddressColor={handleSetAddressColor}
                            idlConfigs={idlConfigs}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 事件列表 */}
          {transaction.events && transaction.events.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                事件 ({transaction.events.length})
              </h3>
              <div className="space-y-2">
                {transaction.events.map((event, index) => (
                  <EventCard
                    key={index}
                    event={event}
                    index={index}
                    addressLabels={addressLabels}
                    onAddLabel={onAddLabel}
                    addressColors={addressColors}
                    onSetAddressColor={handleSetAddressColor}
                    idlConfigs={idlConfigs}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 日志 */}
          {transaction.logs.length > 0 && (
            <div>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${
                    showLogs ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                日志 ({transaction.logs.length})
              </button>

              {showLogs && (
                <div className="mt-2 p-3 bg-gray-900 rounded-lg overflow-x-auto">
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                    {transaction.logs.map((log, i) => (
                      <div
                        key={i}
                        className={`${
                          log.includes('Error') || log.includes('failed')
                            ? 'text-red-400'
                            : log.includes('success')
                            ? 'text-green-400'
                            : ''
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 空状态 */}
      {!transaction && !error && !loading && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          输入交易签名开始查询
        </div>
      )}
    </div>
  );
}
