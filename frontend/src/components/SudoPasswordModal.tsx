import React, { useState } from 'react';
import { X, ShieldAlert, KeyRound, Check } from 'lucide-react';

interface SudoPasswordModalProps {
  serverName: string;
  host: string;
  initialPassword?: string;
  onClose: () => void;
  onSubmit: (password: string) => void;
}

export const SudoPasswordModal: React.FC<SudoPasswordModalProps> = ({
  serverName,
  host,
  initialPassword = '',
  onClose,
  onSubmit,
}) => {
  const [password, setPassword] = useState(initialPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#121214] border border-amber-500/50 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-gray-200 font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#18181c] border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 mr-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block" />
            </div>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-400">SUDO PRIVILEGES REQUIRED</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-1 rounded hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-xs space-y-2">
            <div className="flex items-center space-x-2 text-amber-300 font-semibold">
              <span>Docker Daemon Access Restricted</span>
            </div>
            <p className="text-gray-300 leading-relaxed text-[11px]">
              Accessing Docker containers on <strong className="text-white">{serverName}</strong> (<span className="text-term-cyan">{host}</span>) requires elevated privileges (<code className="text-amber-300">unix:///var/run/docker.sock</code>).
            </p>
            <div className="flex items-center space-x-1 text-[10px] text-gray-400">
              <KeyRound className="w-3 h-3 text-term-green" />
              <span>Password is stored strictly in memory for this session (never saved to disk).</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Sudo Password for <span className="text-term-green">{serverName}</span>
            </label>
            <input
              type="password"
              required
              autoFocus
              placeholder="Enter sudo password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c0c0e] border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-amber-500 text-black font-bold text-xs rounded hover:bg-amber-400 transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Authorize & Sync Docker</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
