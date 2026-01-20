import { useState, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useRpc } from './hooks/useRpc';
import { Layout } from './components/Layout';
import { TransactionViewer } from './components/TransactionViewer';
import { AccountViewer } from './components/AccountViewer';
import type { IdlConfig, AddressLabel } from './types';
import { DEFAULT_CONFIG } from './types';

type Tab = 'transaction' | 'account';

// 查询历史类型
interface QueryHistory {
  transactions: string[];
  accounts: string[];
}

const MAX_HISTORY = 20;

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('transaction');

  // 持久化存储
  const [rpcUrl, setRpcUrl] = useLocalStorage('solana-rpc-url', DEFAULT_CONFIG.rpcUrl);
  const [idlConfigs, setIdlConfigs] = useLocalStorage<IdlConfig[]>('solana-idl-configs', []);
  const [addressLabels, setAddressLabels] = useLocalStorage<AddressLabel[]>('solana-address-labels', []);
  const [queryHistory, setQueryHistory] = useLocalStorage<QueryHistory>('solana-query-history', {
    transactions: [],
    accounts: [],
  });

  // RPC Hook
  const { loading, error, getTransaction, getAccountInfo, testConnection } = useRpc({
    rpcUrl,
    idlConfigs,
    addressLabels,
  });

  // 添加/更新地址标签
  const handleAddLabel = useCallback((address: string, label: string) => {
    setAddressLabels((prev) => {
      const existing = prev.findIndex((l) => l.address === address);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { address, label };
        return updated;
      }
      return [...prev, { address, label }];
    });
  }, [setAddressLabels]);

  // 添加交易历史
  const addTransactionHistory = useCallback((signature: string) => {
    setQueryHistory((prev) => {
      const filtered = prev.transactions.filter((s) => s !== signature);
      return {
        ...prev,
        transactions: [signature, ...filtered].slice(0, MAX_HISTORY),
      };
    });
  }, [setQueryHistory]);

  // 添加账户历史
  const addAccountHistory = useCallback((address: string) => {
    setQueryHistory((prev) => {
      const filtered = prev.accounts.filter((a) => a !== address);
      return {
        ...prev,
        accounts: [address, ...filtered].slice(0, MAX_HISTORY),
      };
    });
  }, [setQueryHistory]);

  // 清除历史
  const clearTransactionHistory = useCallback(() => {
    setQueryHistory((prev) => ({ ...prev, transactions: [] }));
  }, [setQueryHistory]);

  const clearAccountHistory = useCallback(() => {
    setQueryHistory((prev) => ({ ...prev, accounts: [] }));
  }, [setQueryHistory]);

  return (
    <Layout
      rpcUrl={rpcUrl}
      onRpcUrlChange={setRpcUrl}
      onTestConnection={testConnection}
      idlConfigs={idlConfigs}
      onIdlConfigsChange={setIdlConfigs}
      addressLabels={addressLabels}
      onAddressLabelsChange={setAddressLabels}
    >
      {/* Tab 切换 */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('transaction')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'transaction'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            交易查询
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'account'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            账户查询
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      {activeTab === 'transaction' ? (
        <TransactionViewer
          onQuery={getTransaction}
          loading={loading}
          error={error}
          addressLabels={addressLabels}
          onAddLabel={handleAddLabel}
          idlConfigs={idlConfigs}
          history={queryHistory.transactions}
          onAddHistory={addTransactionHistory}
          onClearHistory={clearTransactionHistory}
        />
      ) : (
        <AccountViewer
          onQuery={getAccountInfo}
          loading={loading}
          error={error}
          addressLabels={addressLabels}
          onAddLabel={handleAddLabel}
          idlConfigs={idlConfigs}
          history={queryHistory.accounts}
          onAddHistory={addAccountHistory}
          onClearHistory={clearAccountHistory}
        />
      )}
    </Layout>
  );
}

export default App;
