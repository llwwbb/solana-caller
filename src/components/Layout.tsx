import { useState } from 'react';
import type { IdlConfig, AddressLabel } from '../types';
import { RpcConfig } from './RpcConfig';
import { IdlManager } from './IdlManager';
import { AddressLabels } from './AddressLabels';

interface LayoutProps {
  rpcUrl: string;
  onRpcUrlChange: (url: string) => void;
  onTestConnection: () => Promise<boolean>;
  idlConfigs: IdlConfig[];
  onIdlConfigsChange: (configs: IdlConfig[]) => void;
  addressLabels: AddressLabel[];
  onAddressLabelsChange: (labels: AddressLabel[]) => void;
  children: React.ReactNode;
}

type Tab = 'transaction' | 'account';

export function Layout({
  rpcUrl,
  onRpcUrlChange,
  onTestConnection,
  idlConfigs,
  onIdlConfigsChange,
  addressLabels,
  onAddressLabelsChange,
  children,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>('rpc');

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 flex overflow-hidden">
      {/* 侧边栏 - 固定高度为屏幕高度 */}
      <aside
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 h-screen`}
      >
        <div className="w-80 h-full flex flex-col">
          {/* 侧边栏头部 */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200">
              Solana RPC Caller
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              交易解析与账户查询工具
            </p>
          </div>

          {/* 配置区域 - 占满剩余空间 */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* RPC 配置 */}
            <div className={`border-b border-gray-200 dark:border-gray-700 flex-shrink-0 ${activeSection === 'rpc' ? 'flex-1 flex flex-col min-h-0' : ''}`}>
              <button
                onClick={() => toggleSection('rpc')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 flex-shrink-0"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  RPC 配置
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    activeSection === 'rpc' ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {activeSection === 'rpc' && (
                <div className="px-4 pb-4 flex-1 overflow-y-auto">
                  <RpcConfig
                    rpcUrl={rpcUrl}
                    onRpcUrlChange={onRpcUrlChange}
                    onTestConnection={onTestConnection}
                  />
                </div>
              )}
            </div>

            {/* IDL 管理 */}
            <div className={`border-b border-gray-200 dark:border-gray-700 flex-shrink-0 ${activeSection === 'idl' ? 'flex-1 flex flex-col min-h-0' : ''}`}>
              <button
                onClick={() => toggleSection('idl')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 flex-shrink-0"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  IDL 管理
                  {idlConfigs.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                      {idlConfigs.length}
                    </span>
                  )}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    activeSection === 'idl' ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {activeSection === 'idl' && (
                <div className="px-4 pb-4 flex-1 overflow-y-auto">
                  <IdlManager
                    idlConfigs={idlConfigs}
                    onIdlConfigsChange={onIdlConfigsChange}
                  />
                </div>
              )}
            </div>

            {/* 地址标签 */}
            <div className={`border-b border-gray-200 dark:border-gray-700 flex-shrink-0 ${activeSection === 'labels' ? 'flex-1 flex flex-col min-h-0' : ''}`}>
              <button
                onClick={() => toggleSection('labels')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 flex-shrink-0"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  地址标签
                  {addressLabels.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                      {addressLabels.length}
                    </span>
                  )}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    activeSection === 'labels' ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {activeSection === 'labels' && (
                <div className="px-4 pb-4 flex-1 overflow-y-auto">
                  <AddressLabels
                    labels={addressLabels}
                    onLabelsChange={onAddressLabelsChange}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 侧边栏底部 */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            <div>数据存储于本地 localStorage</div>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col min-w-0 h-screen">
        {/* 顶部工具栏 */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div className="flex-1" />

          {/* RPC 状态指示 */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="hidden sm:inline truncate max-w-xs" title={rpcUrl}>
              {rpcUrl.replace(/^https?:\/\//, '').split('/')[0]}
            </span>
          </div>
        </header>

        {/* 内容区域 - 独立滚动 */}
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
