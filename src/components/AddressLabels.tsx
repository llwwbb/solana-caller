import { useState } from 'react';
import type { AddressLabel } from '../types';
import { isValidSolanaAddress } from '../utils/addressResolver';

interface AddressLabelsProps {
  labels: AddressLabel[];
  onLabelsChange: (labels: AddressLabel[]) => void;
}

export function AddressLabels({ labels, onLabelsChange }: AddressLabelsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setAddressInput('');
    setLabelInput('');
    setError(null);
    setIsAdding(false);
    setEditingAddress(null);
  };

  const handleSave = () => {
    const address = addressInput.trim();
    const label = labelInput.trim();

    if (!address) {
      setError('请输入地址');
      return;
    }

    if (!isValidSolanaAddress(address)) {
      setError('无效的 Solana 地址');
      return;
    }

    if (!label) {
      setError('请输入标签名称');
      return;
    }

    // 检查地址是否已存在（编辑时排除当前项）
    const exists = labels.some(
      (l) => l.address === address && l.address !== editingAddress
    );
    if (exists) {
      setError('该地址已存在');
      return;
    }

    if (editingAddress) {
      // 编辑模式
      const updated = labels.map((l) =>
        l.address === editingAddress ? { address, label } : l
      );
      onLabelsChange(updated);
    } else {
      // 新增模式
      onLabelsChange([...labels, { address, label }]);
    }

    resetForm();
  };

  const handleEdit = (item: AddressLabel) => {
    setEditingAddress(item.address);
    setAddressInput(item.address);
    setLabelInput(item.label);
    setIsAdding(true);
  };

  const handleDelete = (address: string) => {
    onLabelsChange(labels.filter((l) => l.address !== address));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          地址标签
        </h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            + 添加标签
          </button>
        )}
      </div>

      {/* 标签列表 */}
      {labels.length > 0 && !isAdding && (
        <div className="space-y-1">
          {labels.map((item) => (
            <div
              key={item.address}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.label}</div>
                <div
                  className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate"
                  title={item.address}
                >
                  {item.address.slice(0, 12)}...{item.address.slice(-8)}
                </div>
              </div>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(item.address)}
                  className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑表单 */}
      {isAdding && (
        <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              地址
            </label>
            <input
              type="text"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                setError(null);
              }}
              placeholder="Solana 地址"
              className="w-full px-2 py-1.5 text-xs font-mono border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              标签名称
            </label>
            <input
              type="text"
              value={labelInput}
              onChange={(e) => {
                setLabelInput(e.target.value);
                setError(null);
              }}
              placeholder="例如: My Wallet、USDC Mint"
              className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {editingAddress ? '更新' : '添加'}
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {labels.length === 0 && !isAdding && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
          暂无地址标签
        </div>
      )}
    </div>
  );
}
