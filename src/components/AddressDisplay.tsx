import { useState, useCallback, useRef } from 'react';
import type { AddressLabel, AddressColorMap, IdlConfig } from '../types';
import { HIGHLIGHT_COLORS } from '../types';
import { getKnownProgramName, getAddressLabel } from '../utils/addressResolver';

interface AddressDisplayProps {
  address: string;
  label?: string;
  addressLabels: AddressLabel[];
  onAddLabel?: (address: string, label: string) => void;
  className?: string;
  showFull?: boolean;
  // 颜色高亮相关
  addressColors?: AddressColorMap;
  onSetAddressColor?: (address: string, color: string | null) => void;
  // IDL 配置（用于自动标签）
  idlConfigs?: IdlConfig[];
}

export function AddressDisplay({
  address,
  label,
  addressLabels,
  onAddLabel,
  className = '',
  showFull = true,
  addressColors,
  onSetAddressColor,
  idlConfigs,
}: AddressDisplayProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // 用于延迟隐藏颜色选择器
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 获取当前地址的高亮颜色
  const currentColor = addressColors?.get(address);
  const currentColorClass = currentColor
    ? HIGHLIGHT_COLORS.find(c => c.bg === currentColor)?.bg
    : undefined;

  // 显示颜色选择器
  const handleShowColorPicker = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (onSetAddressColor) {
      setShowColorPicker(true);
    }
  }, [onSetAddressColor]);

  // 延迟隐藏颜色选择器
  const handleHideColorPicker = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowColorPicker(false);
    }, 150); // 150ms 延迟，给用户时间移动鼠标到选择器
  }, []);

  // 获取已有标签或已知程序名称
  // 优先级: 传入的 label > 用户自定义标签 > IDL programId 标签 > 已知程序名称
  const resolvedLabel = getAddressLabel(address, addressLabels, idlConfigs);
  const knownName = getKnownProgramName(address);
  const displayLabel = label || resolvedLabel || knownName;
  const existingLabel = addressLabels.find((l) => l.address === address)?.label;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    setShowMenu(false);
  }, [address]);

  const handleAddLabel = useCallback(() => {
    if (labelInput.trim() && onAddLabel) {
      onAddLabel(address, labelInput.trim());
      setLabelInput('');
      setShowLabelInput(false);
      setShowMenu(false);
    }
  }, [address, labelInput, onAddLabel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddLabel();
    } else if (e.key === 'Escape') {
      setShowLabelInput(false);
      setShowMenu(false);
    }
  };

  const handleColorSelect = (colorBg: string) => {
    if (onSetAddressColor) {
      // 如果点击的是已选中的颜色，则取消高亮
      if (currentColor === colorBg) {
        onSetAddressColor(address, null);
      } else {
        onSetAddressColor(address, colorBg);
      }
    }
    setShowColorPicker(false);
  };

  return (
    <div
      className={`relative inline-flex items-center gap-1 group ${className}`}
      onMouseEnter={handleShowColorPicker}
      onMouseLeave={handleHideColorPicker}
    >
      {/* 颜色选择器 - 悬浮显示 */}
      {showColorPicker && onSetAddressColor && (
        <div
          className="absolute -top-7 left-0 flex items-center gap-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg px-1 py-0.5 z-30"
          onMouseEnter={handleShowColorPicker}
          onMouseLeave={handleHideColorPicker}
        >
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={(e) => {
                e.stopPropagation();
                handleColorSelect(color.bg);
              }}
              className={`w-4 h-4 rounded-sm border transition-transform hover:scale-110 ${
                currentColor === color.bg
                  ? 'border-gray-800 dark:border-white ring-1 ring-gray-400'
                  : 'border-gray-300 dark:border-gray-500'
              }`}
              style={{ backgroundColor: color.color }}
              title={color.name}
            />
          ))}
          {/* 清除颜色按钮 */}
          {currentColor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetAddressColor(address, null);
                setShowColorPicker(false);
              }}
              className="w-4 h-4 rounded-sm border border-gray-300 dark:border-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
              title="清除颜色"
            >
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* 标签显示 */}
      {displayLabel && (
        <span className={`text-purple-600 dark:text-purple-400 font-medium ${currentColorClass || ''} ${currentColor ? 'px-1 rounded' : ''}`}>
          {displayLabel}
        </span>
      )}

      {/* 地址显示 */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`font-mono text-xs hover:bg-gray-200 dark:hover:bg-gray-600 px-1 py-0.5 rounded transition-colors ${
          currentColorClass || ''
        } ${
          displayLabel ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'
        }`}
        title="点击操作"
      >
        {showFull ? address : `${address.slice(0, 4)}...${address.slice(-4)}`}
      </button>

      {/* 下拉菜单 */}
      {showMenu && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setShowMenu(false);
              setShowLabelInput(false);
            }}
          />

          {/* 菜单 */}
          <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-[160px]">
            {/* 复制按钮 */}
            <button
              onClick={handleCopy}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  已复制
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制地址
                </>
              )}
            </button>

            {/* 添加标签 */}
            {onAddLabel && (
              <>
                {showLabelInput ? (
                  <div className="px-3 py-2">
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="输入标签名称"
                      className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      autoFocus
                    />
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={handleAddLabel}
                        disabled={!labelInput.trim()}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setShowLabelInput(false)}
                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLabelInput(true)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {existingLabel ? '修改标签' : '添加标签'}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
