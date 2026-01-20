import { useRef, useState } from 'react';
import type { IdlConfig, AddressLabel } from '../types';

// 导出的配置数据格式
export interface ExportedConfig {
  version: number;
  exportedAt: string;
  rpcUrl?: string;
  idlConfigs?: IdlConfig[];
  addressLabels?: AddressLabel[];
}

interface ConfigImportExportProps {
  rpcUrl: string;
  onRpcUrlChange: (url: string) => void;
  idlConfigs: IdlConfig[];
  onIdlConfigsChange: (configs: IdlConfig[]) => void;
  addressLabels: AddressLabel[];
  onAddressLabelsChange: (labels: AddressLabel[]) => void;
}

type ImportMode = 'merge' | 'replace';

interface ImportOptions {
  rpcUrl: boolean;
  idlConfigs: boolean;
  addressLabels: boolean;
  mode: ImportMode;
}

export function ConfigImportExport({
  rpcUrl,
  onRpcUrlChange,
  idlConfigs,
  onIdlConfigsChange,
  addressLabels,
  onAddressLabelsChange,
}: ConfigImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<ExportedConfig | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    rpcUrl: true,
    idlConfigs: true,
    addressLabels: true,
    mode: 'merge',
  });
  const [exportOptions, setExportOptions] = useState({
    rpcUrl: true,
    idlConfigs: true,
    addressLabels: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 导出配置
  const handleExport = () => {
    const config: ExportedConfig = {
      version: 1,
      exportedAt: new Date().toISOString(),
    };

    if (exportOptions.rpcUrl) {
      config.rpcUrl = rpcUrl;
    }
    if (exportOptions.idlConfigs && idlConfigs.length > 0) {
      config.idlConfigs = idlConfigs;
    }
    if (exportOptions.addressLabels && addressLabels.length > 0) {
      config.addressLabels = addressLabels;
    }

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solana-caller-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
    setMessage({ type: 'success', text: '配置已导出' });
    setTimeout(() => setMessage(null), 3000);
  };

  // 选择导入文件
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as ExportedConfig;
        
        // 验证数据格式
        if (!data.version || typeof data.version !== 'number') {
          setMessage({ type: 'error', text: '无效的配置文件格式' });
          return;
        }

        setImportData(data);
        setImportOptions({
          rpcUrl: !!data.rpcUrl,
          idlConfigs: !!data.idlConfigs && data.idlConfigs.length > 0,
          addressLabels: !!data.addressLabels && data.addressLabels.length > 0,
          mode: 'merge',
        });
        setShowImportModal(true);
      } catch {
        setMessage({ type: 'error', text: '无法解析配置文件' });
      }
    };
    reader.readAsText(file);
    
    // 重置 input 以允许重复选择同一文件
    e.target.value = '';
  };

  // 执行导入
  const handleImport = () => {
    if (!importData) return;

    try {
      // 导入 RPC URL
      if (importOptions.rpcUrl && importData.rpcUrl) {
        onRpcUrlChange(importData.rpcUrl);
      }

      // 导入 IDL 配置
      if (importOptions.idlConfigs && importData.idlConfigs) {
        if (importOptions.mode === 'replace') {
          onIdlConfigsChange(importData.idlConfigs);
        } else {
          // 合并模式：基于 ID 去重
          const existingIds = new Set(idlConfigs.map((c) => c.id));
          const newConfigs = importData.idlConfigs.filter((c) => !existingIds.has(c.id));
          onIdlConfigsChange([...idlConfigs, ...newConfigs]);
        }
      }

      // 导入地址标签
      if (importOptions.addressLabels && importData.addressLabels) {
        if (importOptions.mode === 'replace') {
          onAddressLabelsChange(importData.addressLabels);
        } else {
          // 合并模式：基于地址去重
          const existingAddresses = new Set(addressLabels.map((l) => l.address));
          const newLabels = importData.addressLabels.filter((l) => !existingAddresses.has(l.address));
          onAddressLabelsChange([...addressLabels, ...newLabels]);
        }
      }

      setShowImportModal(false);
      setImportData(null);
      setMessage({ type: 'success', text: '配置已导入' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '导入配置失败' });
    }
  };

  return (
    <>
      {/* 导入/导出按钮 */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowExportModal(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          导出配置
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导入配置
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* 提示消息 */}
      {message && (
        <div
          className={`mt-2 px-3 py-2 text-xs rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 导出配置弹窗 */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium">导出配置</h3>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                选择要导出的配置项：
              </p>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.rpcUrl}
                  onChange={(e) => setExportOptions({ ...exportOptions, rpcUrl: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm">RPC URL</span>
                <span className="text-xs text-gray-500">({rpcUrl.slice(0, 30)}...)</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.idlConfigs}
                  onChange={(e) => setExportOptions({ ...exportOptions, idlConfigs: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm">IDL 配置</span>
                <span className="text-xs text-gray-500">({idlConfigs.length} 个)</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.addressLabels}
                  onChange={(e) => setExportOptions({ ...exportOptions, addressLabels: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm">地址标签</span>
                <span className="text-xs text-gray-500">({addressLabels.length} 个)</span>
              </label>
            </div>
            
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={!exportOptions.rpcUrl && !exportOptions.idlConfigs && !exportOptions.addressLabels}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                导出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入配置弹窗 */}
      {showImportModal && importData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium">导入配置</h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                导出时间: {new Date(importData.exportedAt).toLocaleString()}
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  选择要导入的配置项：
                </p>
                
                {importData.rpcUrl && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importOptions.rpcUrl}
                      onChange={(e) => setImportOptions({ ...importOptions, rpcUrl: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm">RPC URL</span>
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">
                      ({importData.rpcUrl})
                    </span>
                  </label>
                )}
                
                {importData.idlConfigs && importData.idlConfigs.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importOptions.idlConfigs}
                      onChange={(e) => setImportOptions({ ...importOptions, idlConfigs: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm">IDL 配置</span>
                    <span className="text-xs text-gray-500">({importData.idlConfigs.length} 个)</span>
                  </label>
                )}
                
                {importData.addressLabels && importData.addressLabels.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importOptions.addressLabels}
                      onChange={(e) => setImportOptions({ ...importOptions, addressLabels: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm">地址标签</span>
                    <span className="text-xs text-gray-500">({importData.addressLabels.length} 个)</span>
                  </label>
                )}
              </div>
              
              {/* 导入模式 */}
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">导入模式：</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importOptions.mode === 'merge'}
                      onChange={() => setImportOptions({ ...importOptions, mode: 'merge' })}
                      className="border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm">合并</span>
                    <span className="text-xs text-gray-500">(保留现有配置)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importOptions.mode === 'replace'}
                      onChange={() => setImportOptions({ ...importOptions, mode: 'replace' })}
                      className="border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm">替换</span>
                    <span className="text-xs text-gray-500">(覆盖现有配置)</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!importOptions.rpcUrl && !importOptions.idlConfigs && !importOptions.addressLabels}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
