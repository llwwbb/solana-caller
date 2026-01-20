import { useState, useEffect, useRef } from 'react';
import type { ParsedAccountData, AddressLabel, IdlConfig } from '../types';
import { AddressDisplay } from './AddressDisplay';

interface AccountViewerProps {
  onQuery: (address: string) => Promise<ParsedAccountData | null>;
  loading: boolean;
  error: string | null;
  addressLabels: AddressLabel[];
  onAddLabel?: (address: string, label: string) => void;
  idlConfigs: IdlConfig[];
  history: string[];
  onAddHistory: (address: string) => void;
  onClearHistory: () => void;
}

export function AccountViewer({
  onQuery,
  loading,
  error,
  addressLabels,
  onAddLabel,
  idlConfigs,
  history,
  onAddHistory,
  onClearHistory,
}: AccountViewerProps) {
  const [address, setAddress] = useState('');
  const [account, setAccount] = useState<ParsedAccountData | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // 保存当前查询的地址，用于 IDL 变化时重新解析
  const currentAddressRef = useRef<string | null>(null);
  const prevIdlConfigsLengthRef = useRef(idlConfigs.length);

  // 当 IDL 配置变化时，自动重新解析当前账户
  useEffect(() => {
    // 只在 IDL 数量增加时触发重新解析（新添加了 IDL）
    if (idlConfigs.length > prevIdlConfigsLengthRef.current && currentAddressRef.current && !loading) {
      const addr = currentAddressRef.current;
      onQuery(addr).then((result) => {
        if (result) {
          setAccount(result);
        }
      });
    }
    prevIdlConfigsLengthRef.current = idlConfigs.length;
  }, [idlConfigs.length, onQuery, loading]);

  const handleQuery = async () => {
    if (!address.trim()) return;
    const addr = address.trim();
    currentAddressRef.current = addr;
    const result = await onQuery(addr);
    setAccount(result);
    if (result) {
      onAddHistory(addr);
    }
  };

  const handleSelectHistory = async (addr: string) => {
    setAddress(addr);
    setShowHistory(false);
    currentAddressRef.current = addr;
    const result = await onQuery(addr);
    setAccount(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuery();
    }
  };

  const renderValue = (value: unknown, depth: number = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">null</span>;
    }

    if (typeof value === 'boolean') {
      return (
        <span className={value ? 'text-green-600' : 'text-red-600'}>
          {value.toString()}
        </span>
      );
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return <span className="text-blue-600">{value.toString()}</span>;
    }

    if (typeof value === 'string') {
      // 检查是否是地址
      if (value.length >= 32 && value.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) {
        return (
          <AddressDisplay
            address={value}
            addressLabels={addressLabels}
            onAddLabel={onAddLabel}
            showFull={true}
            idlConfigs={idlConfigs}
          />
        );
      }
      return <span className="text-green-700 dark:text-green-400">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400">[]</span>;
      }
      // 如果是字节数组，特殊处理
      if (value.every((v) => typeof v === 'number' && v >= 0 && v <= 255)) {
        if (value.length <= 32) {
          return (
            <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
              [bytes: {value.length}]
            </span>
          );
        }
        return (
          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
            [bytes: {value.length}] {value.slice(0, 8).join(', ')}...
          </span>
        );
      }
      return (
        <div className={depth > 0 ? 'ml-4' : ''}>
          <span className="text-gray-400">[</span>
          {value.slice(0, 50).map((item, i) => (
            <div key={i} className="ml-4">
              {renderValue(item, depth + 1)}
              {i < Math.min(value.length, 50) - 1 && <span className="text-gray-400">,</span>}
            </div>
          ))}
          {value.length > 50 && (
            <div className="ml-4 text-gray-400">... +{value.length - 50} more</div>
          )}
          <span className="text-gray-400">]</span>
        </div>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-gray-400">{'{}'}</span>;
      }
      return (
        <div className={depth > 0 ? 'ml-4' : ''}>
          {entries.map(([key, val], i) => (
            <div key={key} className="flex flex-wrap items-start gap-1">
              <span className="text-gray-500 dark:text-gray-400 mr-1">{key}:</span>
              {renderValue(val, depth + 1)}
              {i < entries.length - 1 && <span className="text-gray-400">,</span>}
            </div>
          ))}
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        账户查询
      </h2>

      {/* 查询输入 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入账户地址..."
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
                {history.map((addr) => (
                  <button
                    key={addr}
                    onClick={() => handleSelectHistory(addr)}
                    className="w-full px-3 py-2 text-left text-xs font-mono hover:bg-gray-100 dark:hover:bg-gray-700 truncate"
                  >
                    {addressLabels.find((l) => l.address === addr)?.label && (
                      <span className="text-purple-600 dark:text-purple-400 mr-2">
                        {addressLabels.find((l) => l.address === addr)?.label}
                      </span>
                    )}
                    {addr}
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
          disabled={loading || !address.trim()}
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

      {/* 账户结果 */}
      {account && (
        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              账户信息
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">地址:</span>
                <span className="ml-2">
                  <AddressDisplay
                    address={account.address}
                    addressLabels={addressLabels}
                    onAddLabel={onAddLabel}
                    showFull={true}
                    idlConfigs={idlConfigs}
                  />
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Owner:</span>
                <span className="ml-2">
                  <AddressDisplay
                    address={account.owner}
                    addressLabels={addressLabels}
                    onAddLabel={onAddLabel}
                    showFull={true}
                    idlConfigs={idlConfigs}
                  />
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">余额:</span>
                  <span className="ml-2 font-mono">
                    {(account.lamports / 1e9).toFixed(9)} SOL
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">数据大小:</span>
                  <span className="ml-2 font-mono">{account.dataSize} bytes</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">可执行:</span>
                  <span
                    className={`ml-2 ${
                      account.executable
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {account.executable ? '是' : '否'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Rent Epoch:</span>
                  <span className="ml-2 font-mono">{account.rentEpoch}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 解析后的数据 */}
          {account.parsedData && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                解析数据
                {account.accountType && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                    {account.accountType}
                  </span>
                )}
              </h3>
              <div className="text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto">
                {renderValue(account.parsedData)}
              </div>
            </div>
          )}

          {/* 原始数据 */}
          {account.rawData && (
            <div>
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showRawData ? '隐藏原始数据' : '显示原始数据 (Base64)'}
              </button>
              {showRawData && (
                <div className="mt-2 p-3 bg-gray-900 rounded-lg overflow-x-auto">
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
                    {account.rawData}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* 未解析提示 */}
          {!account.parsedData && account.dataSize > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
              未能解析账户数据。请添加对应的 IDL 配置（Owner: {account.owner.slice(0, 8)}...）
            </div>
          )}
        </div>
      )}

      {/* 空状态 */}
      {!account && !error && !loading && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          输入账户地址开始查询
        </div>
      )}
    </div>
  );
}
