import { useState } from 'react';
import type { IdlConfig } from '../types';
import {
  detectIdlVersion,
  normalizeIdl,
  validateIdl,
  getIdlName,
} from '../utils/idlNormalizer';
import { isValidSolanaAddress } from '../utils/addressResolver';

interface IdlManagerProps {
  idlConfigs: IdlConfig[];
  onIdlConfigsChange: (configs: IdlConfig[]) => void;
}

export function IdlManager({ idlConfigs, onIdlConfigsChange }: IdlManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [idlInput, setIdlInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [programIdsInput, setProgramIdsInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detectedVersion, setDetectedVersion] = useState<string | null>(null);

  const resetForm = () => {
    setIdlInput('');
    setNameInput('');
    setProgramIdsInput('');
    setError(null);
    setDetectedVersion(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleIdlInputChange = (value: string) => {
    setIdlInput(value);
    setError(null);
    setDetectedVersion(null);

    if (!value.trim()) return;

    try {
      const parsed = JSON.parse(value);
      const validation = validateIdl(parsed);
      
      if (!validation.valid) {
        setError(validation.error || '无效的 IDL');
        return;
      }

      const version = detectIdlVersion(parsed);
      setDetectedVersion(version === 'legacy' ? '旧版 (≤0.29)' : '新版 (≥0.30)');
      
      // 自动填充名称
      if (!nameInput) {
        setNameInput(getIdlName(parsed));
      }

      // 自动填充 Program 地址（从 IDL 的 address 或 metadata.address 字段）
      if (!programIdsInput) {
        const addresses: string[] = [];
        
        // 检查顶层 address 字段（新版 Anchor IDL）
        if (typeof parsed.address === 'string' && isValidSolanaAddress(parsed.address)) {
          addresses.push(parsed.address);
        }
        
        // 检查 metadata.address 字段
        if (parsed.metadata && typeof parsed.metadata.address === 'string' && isValidSolanaAddress(parsed.metadata.address)) {
          if (!addresses.includes(parsed.metadata.address)) {
            addresses.push(parsed.metadata.address);
          }
        }

        if (addresses.length > 0) {
          setProgramIdsInput(addresses.join('\n'));
        }
      }
    } catch {
      setError('JSON 格式错误');
    }
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(idlInput);
      const validation = validateIdl(parsed);
      
      if (!validation.valid) {
        setError(validation.error || '无效的 IDL');
        return;
      }

      // 解析 Program IDs
      const programIds = programIdsInput
        .split(/[,\n]/)
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      // 验证地址格式
      const invalidAddresses = programIds.filter((id) => !isValidSolanaAddress(id));
      if (invalidAddresses.length > 0) {
        setError(`无效的地址: ${invalidAddresses.join(', ')}`);
        return;
      }

      if (programIds.length === 0) {
        setError('请至少添加一个 Program 地址');
        return;
      }

      const version = detectIdlVersion(parsed);
      const normalizedIdl = normalizeIdl(parsed);

      if (editingId) {
        // 编辑模式
        const updated = idlConfigs.map((config) =>
          config.id === editingId
            ? {
                ...config,
                name: nameInput || getIdlName(parsed),
                idl: normalizedIdl,
                originalVersion: version,
                programIds,
              }
            : config
        );
        onIdlConfigsChange(updated);
      } else {
        // 新增模式
        const newConfig: IdlConfig = {
          id: Date.now().toString(),
          name: nameInput || getIdlName(parsed),
          idl: normalizedIdl,
          originalVersion: version,
          programIds,
        };
        onIdlConfigsChange([...idlConfigs, newConfig]);
      }

      resetForm();
    } catch {
      setError('保存失败，请检查输入');
    }
  };

  const handleEdit = (config: IdlConfig) => {
    setEditingId(config.id);
    setIdlInput(JSON.stringify(config.idl, null, 2));
    setNameInput(config.name);
    setProgramIdsInput(config.programIds.join('\n'));
    setDetectedVersion(
      config.originalVersion === 'legacy' ? '旧版 (≤0.29)' : '新版 (≥0.30)'
    );
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个 IDL 配置吗？')) {
      onIdlConfigsChange(idlConfigs.filter((c) => c.id !== id));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          IDL 管理
        </h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            + 添加 IDL
          </button>
        )}
      </div>

      {/* IDL 列表 */}
      {idlConfigs.length > 0 && !isAdding && (
        <div className="space-y-2">
          {idlConfigs.map((config) => (
            <div
              key={config.id}
              className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{config.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div>版本: {config.originalVersion === 'legacy' ? '旧版' : '新版'}</div>
                <div>关联地址 ({config.programIds.length}):</div>
                <div className="pl-2 space-y-0.5">
                  {config.programIds.map((id) => (
                    <div key={id} className="font-mono text-xs truncate" title={id}>
                      {id.slice(0, 8)}...{id.slice(-8)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑表单 */}
      {isAdding && (
        <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              名称
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Program 名称"
              className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              IDL JSON
              {detectedVersion && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  检测到: {detectedVersion}
                </span>
              )}
            </label>
            <textarea
              value={idlInput}
              onChange={(e) => handleIdlInputChange(e.target.value)}
              placeholder="粘贴 IDL JSON..."
              rows={6}
              className="w-full px-2 py-1.5 text-xs font-mono border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Program 地址 (每行一个)
            </label>
            <textarea
              value={programIdsInput}
              onChange={(e) => setProgramIdsInput(e.target.value)}
              placeholder="输入 Program 地址，每行一个..."
              rows={3}
              className="w-full px-2 py-1.5 text-xs font-mono border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 resize-y"
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
              {editingId ? '更新' : '添加'}
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

      {idlConfigs.length === 0 && !isAdding && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
          暂无 IDL 配置，点击上方按钮添加
        </div>
      )}
    </div>
  );
}
