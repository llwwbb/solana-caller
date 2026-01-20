import { useState } from 'react';
import { RPC_PRESETS } from '../types';

interface RpcConfigProps {
  rpcUrl: string;
  onRpcUrlChange: (url: string) => void;
  onTestConnection: () => Promise<boolean>;
}

export function RpcConfig({
  rpcUrl,
  onRpcUrlChange,
  onTestConnection,
}: RpcConfigProps) {
  const [inputValue, setInputValue] = useState(rpcUrl);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSave = () => {
    onRpcUrlChange(inputValue);
    setStatus('idle');
  };

  const handleTest = async () => {
    setTesting(true);
    const success = await onTestConnection();
    setStatus(success ? 'success' : 'error');
    setTesting(false);
  };

  const handlePresetSelect = (url: string) => {
    setInputValue(url);
    onRpcUrlChange(url);
    setStatus('idle');
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        RPC 配置
      </h3>

      {/* 预设选择 */}
      <div className="flex flex-wrap gap-2">
        {RPC_PRESETS.map((preset) => (
          <button
            key={preset.url}
            onClick={() => handlePresetSelect(preset.url)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              rpcUrl === preset.url
                ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* URL 输入 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="输入 RPC URL..."
          className="flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={inputValue === rpcUrl}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          保存
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {testing ? '测试中...' : '测试连接'}
        </button>

        {/* 状态指示 */}
        {status === 'success' && (
          <span className="flex items-center text-sm text-green-600 dark:text-green-400">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            连接成功
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center text-sm text-red-600 dark:text-red-400">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            连接失败
          </span>
        )}
      </div>
    </div>
  );
}
