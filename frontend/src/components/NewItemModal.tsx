import React, { useState } from 'react';
import { X, Plus, FolderPlus, FilePlus } from 'lucide-react';

interface NewItemModalProps {
  serverId: string;
  parentPath: string;
  savedPassword?: string;
  onClose: () => void;
  onCreated: () => void;
}

export const NewItemModal: React.FC<NewItemModalProps> = ({
  serverId,
  parentPath,
  savedPassword,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'file' | 'directory'>('file');
  const [password, setPassword] = useState(savedPassword || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setLoading(true);
    setError(null);

    const targetPath = `${parentPath.replace(/\/$/, '')}/${name.trim()}`;

    try {
      const res = await fetch(`http://localhost:3001/api/servers/${serverId}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPath,
          type,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to create ${type}`);
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl overflow-hidden bg-term-card border-2 border-term-green shadow-term-glow-strong font-mono">
        
        {/* macOS Terminal Title Bar */}
        <div className="bg-[#212126] px-4 py-2.5 border-b border-term-borderMuted flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <button onClick={onClose} className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] inline-block hover:opacity-80" />
            <span className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] inline-block opacity-80" />
            <span className="w-3.5 h-3.5 rounded-full bg-[#27c93f] inline-block opacity-80" />

            <div className="flex items-center space-x-2 ml-3 text-xs text-gray-300">
              <span className="text-term-apple font-bold text-sm"></span>
              <span className="text-purple-400 font-bold">create</span>
              <span className="text-term-green">[{type}]</span>
            </div>
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-red-950/70 border border-red-800 text-red-300 rounded break-all">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-gray-400">Target Parent Directory:</label>
            <div className="p-2 bg-[#121214] border border-gray-800 rounded text-term-cyan font-bold break-all">
              {parentPath}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-gray-400">Item Type:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('file')}
                className={`flex items-center justify-center space-x-2 py-2 rounded border transition ${
                  type === 'file'
                    ? 'bg-term-green/20 border-term-green text-term-green font-bold'
                    : 'bg-[#121214] border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                <FilePlus className="w-4 h-4" />
                <span>File</span>
              </button>
              <button
                type="button"
                onClick={() => setType('directory')}
                className={`flex items-center justify-center space-x-2 py-2 rounded border transition ${
                  type === 'directory'
                    ? 'bg-term-green/20 border-term-green text-term-green font-bold'
                    : 'bg-[#121214] border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                <FolderPlus className="w-4 h-4" />
                <span>Folder / Directory</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-gray-400">{type === 'file' ? 'File Name (e.g. docker-compose.yml):' : 'Folder Name:'}</label>
            <input
              type="text"
              placeholder={type === 'file' ? 'docker-compose.yml' : 'my-service'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#121214] border border-gray-700 px-3 py-2 rounded text-white focus:outline-none focus:border-term-green"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-gray-400">SSH / Sudo Password (required for remote creation):</label>
            <input
              type="password"
              placeholder="Enter server password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#121214] border border-gray-700 px-3 py-2 rounded text-white focus:outline-none focus:border-term-green"
              required
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-1.5 px-4 py-2 bg-term-green text-black font-bold rounded hover:bg-green-400 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Creating...' : `Create ${type}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
