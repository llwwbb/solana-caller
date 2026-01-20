import { useState } from 'react';
import type { DecodedInstruction, AddressLabel, TokenAccountMarkers, AddressColorMap, IdlConfig } from '../types';
import { getKnownProgramName, getAddressLabel } from '../utils/addressResolver';
import { AddressDisplay } from './AddressDisplay';

interface InstructionCardProps {
  instruction: DecodedInstruction;
  index: number;
  addressLabels: AddressLabel[];
  onAddLabel?: (address: string, label: string) => void;
  isInner?: boolean;
  innerIndex?: number;
  tokenMarkers?: TokenAccountMarkers;
  // 颜色高亮相关
  addressColors?: AddressColorMap;
  onSetAddressColor?: (address: string, color: string | null) => void;
  // IDL 配置（用于自动标签）
  idlConfigs?: IdlConfig[];
}

// 可折叠的 JSON 值组件
function JsonValue({
  label,
  value,
  addressLabels,
  onAddLabel,
  defaultExpanded = true,
  addressColors,
  onSetAddressColor,
  idlConfigs,
}: {
  label?: string;
  value: unknown;
  addressLabels: AddressLabel[];
  onAddLabel?: (address: string, label: string) => void;
  defaultExpanded?: boolean;
  addressColors?: AddressColorMap;
  onSetAddressColor?: (address: string, color: string | null) => void;
  idlConfigs?: IdlConfig[];
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // 判断是否是可折叠的类型（对象或数组）
  const isExpandable = (val: unknown): boolean => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return false;
  };

  // 获取预览文本
  const getPreview = (val: unknown): string => {
    if (Array.isArray(val)) {
      // 检查是否是字节数组
      if (val.every((v) => typeof v === 'number' && v >= 0 && v <= 255)) {
        return `[bytes: ${val.length}]`;
      }
      return `[${val.length} items]`;
    }
    if (typeof val === 'object' && val !== null) {
      const keys = Object.keys(val);
      return `{${keys.length} ${keys.length === 1 ? 'item' : 'items'}}`;
    }
    return '';
  };

  // 渲染简单值
  const renderSimpleValue = (val: unknown): React.ReactNode => {
    if (val === null || val === undefined) {
      return <span className="text-gray-400">null</span>;
    }
    if (typeof val === 'boolean') {
      return <span className={val ? 'text-green-500' : 'text-red-500'}>{val.toString()}</span>;
    }
    if (typeof val === 'number' || typeof val === 'bigint') {
      return <span className="text-blue-400">{val.toString()}</span>;
    }
    if (typeof val === 'string') {
      // 检查是否是地址
      if (val.length >= 32 && val.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(val)) {
        return (
          <AddressDisplay
            address={val}
            addressLabels={addressLabels}
            onAddLabel={onAddLabel}
            showFull={true}
            addressColors={addressColors}
            onSetAddressColor={onSetAddressColor}
            idlConfigs={idlConfigs}
          />
        );
      }
      return <span className="text-green-400">"{val}"</span>;
    }
    return <span>{String(val)}</span>;
  };

  // 如果不是可展开的类型，直接渲染值
  if (!isExpandable(value)) {
    return (
      <div className="flex items-start gap-2">
        {label && <span className="text-gray-400">{label}:</span>}
        {renderSimpleValue(value)}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [i.toString(), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  return (
    <div>
      <div
        className="flex items-center gap-1 cursor-pointer hover:bg-gray-700/50 rounded px-1 -ml-1"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {label && <span className="text-gray-400">{label}:</span>}
        <span className="text-yellow-500">{isArray ? '[' : '{'}</span>
        {!expanded && (
          <span className="text-gray-500 text-xs ml-1">{getPreview(value)}</span>
        )}
        {!expanded && <span className="text-yellow-500">{isArray ? ']' : '}'}</span>}
      </div>
      
      {expanded && (
        <div className="ml-4 border-l border-gray-600 pl-2">
          {entries.map(([key, val], i) => (
            <JsonValue
              key={key}
              label={isArray ? key : key}
              value={val}
              addressLabels={addressLabels}
              onAddLabel={onAddLabel}
              defaultExpanded={false}
              addressColors={addressColors}
              onSetAddressColor={onSetAddressColor}
              idlConfigs={idlConfigs}
            />
          ))}
        </div>
      )}
      {expanded && <span className="text-yellow-500 ml-4">{isArray ? ']' : '}'}</span>}
    </div>
  );
}

export function InstructionCard({
  instruction,
  index,
  addressLabels,
  onAddLabel,
  isInner = false,
  innerIndex,
  tokenMarkers,
  addressColors,
  onSetAddressColor,
  idlConfigs,
}: InstructionCardProps) {
  const [expanded, setExpanded] = useState(!isInner);
  const [showRawData, setShowRawData] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);

  // 优先级: 用户自定义标签 > IDL programId 标签 > 已知程序名称
  const resolvedLabel = getAddressLabel(instruction.programId, addressLabels, idlConfigs);
  const knownName = getKnownProgramName(instruction.programId);
  const programLabel = resolvedLabel || knownName;

  // 账户显示数量限制
  const ACCOUNT_DISPLAY_LIMIT = 5;
  const hasMoreAccounts = instruction.accounts.length > ACCOUNT_DISPLAY_LIMIT;
  const displayedAccounts = showAllAccounts
    ? instruction.accounts
    : instruction.accounts.slice(0, ACCOUNT_DISPLAY_LIMIT);

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        isInner
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
          isInner ? 'bg-gray-100 dark:bg-gray-700/30' : 'bg-gray-50 dark:bg-gray-700'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <span className="text-xs text-gray-500 font-mono flex-shrink-0">
          {isInner ? `${index}.${innerIndex}` : `#${index}`}
        </span>

        {instruction.name && (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded flex-shrink-0">
            {instruction.name}
          </span>
        )}

        <span className="text-xs text-gray-600 dark:text-gray-400 truncate" title={instruction.programId}>
          {programLabel || `${instruction.programId.slice(0, 8)}...`}
        </span>

        {!instruction.data && !instruction.name && (
          <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded flex-shrink-0">
            未解析
          </span>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
          {/* Program ID */}
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Program ID
            </div>
            <div className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1.5 rounded">
              <AddressDisplay
                address={instruction.programId}
                addressLabels={addressLabels}
                onAddLabel={onAddLabel}
                showFull={true}
                addressColors={addressColors}
                onSetAddressColor={onSetAddressColor}
                idlConfigs={idlConfigs}
              />
            </div>
          </div>

          {/* Accounts */}
          {instruction.accounts.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Accounts ({instruction.accounts.length})
              </div>
              <div className="space-y-1">
                {displayedAccounts.map((acc, i) => {
                  const isMint = tokenMarkers?.mints.has(acc.pubkey);
                  const isTokenAccount = tokenMarkers?.tokenAccounts.has(acc.pubkey);
                  
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1.5 rounded"
                    >
                      <span className="text-gray-400 w-6 flex-shrink-0">#{i}</span>
                      {acc.name && (
                        <span className="text-blue-600 dark:text-blue-400 font-medium flex-shrink-0 max-w-[120px] truncate" title={acc.name}>
                          {acc.name}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <AddressDisplay
                          address={acc.pubkey}
                          label={acc.label}
                          addressLabels={addressLabels}
                          onAddLabel={onAddLabel}
                          showFull={true}
                          addressColors={addressColors}
                          onSetAddressColor={onSetAddressColor}
                          idlConfigs={idlConfigs}
                        />
                      </div>
                      {isMint && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded flex-shrink-0">
                          MINT
                        </span>
                      )}
                      {isTokenAccount && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded flex-shrink-0">
                          TOKEN
                        </span>
                      )}
                      {acc.isSigner && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded flex-shrink-0">
                          SIGNER
                        </span>
                      )}
                      {acc.isWritable && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded flex-shrink-0">
                          WRITABLE
                        </span>
                      )}
                    </div>
                  );
                })}
                
                {/* 展开更多账户按钮 */}
                {hasMoreAccounts && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllAccounts(!showAllAccounts);
                    }}
                    className="w-full py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                  >
                    {showAllAccounts
                      ? '收起'
                      : `Show more (${instruction.accounts.length - ACCOUNT_DISPLAY_LIMIT} more)`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Instruction Data */}
          {instruction.data && (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Instruction Data
              </div>
              <div className="text-xs bg-gray-900 text-gray-100 p-3 rounded max-h-64 overflow-y-auto font-mono">
                <JsonValue
                  value={instruction.data}
                  addressLabels={addressLabels}
                  onAddLabel={onAddLabel}
                  defaultExpanded={true}
                  addressColors={addressColors}
                  onSetAddressColor={onSetAddressColor}
                  idlConfigs={idlConfigs}
                />
              </div>
            </div>
          )}

          {/* 解析失败提示 */}
          {!instruction.data && instruction.decodeError && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                    指令解析失败
                  </div>
                  <pre className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 whitespace-pre-wrap font-mono">
                    {instruction.decodeError}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* 无 IDL 提示 */}
          {!instruction.data && !instruction.decodeError && !instruction.hasIdl && (
            <div className="p-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                未配置该 Program 的 IDL，无法解析指令数据
              </div>
            </div>
          )}

          {/* Raw Data */}
          {instruction.rawData && (
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRawData(!showRawData);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showRawData ? 'Hide Raw Data' : 'Show Raw Data'}
              </button>
              {showRawData && (
                <div className="mt-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1.5 rounded break-all max-h-32 overflow-y-auto">
                  {instruction.rawData}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
