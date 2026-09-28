import React, { useState, useEffect } from 'react';
import { X, Plus, KeyRound, Search, Check, Sparkles } from 'lucide-react';

import { Server } from '../types';

interface AddServerModalProps {
  onClose: () => void;
  onAdded: (server: Server) => void;
  initialGroup?: string;
  availableGroups?: string[];
}

export const AddServerModal: React.FC<AddServerModalProps> = ({
  onClose,
  onAdded,
  initialGroup = 'General',
  availableGroups = [],
}) => {
  const [availableHosts, setAvailableHosts] = useState<string[]>([]);
  const [hostSearch, setHostSearch] = useState('');
  const [selectedAlias, setSelectedAlias] = useState('');

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [productGroup, setProductGroup] = useState(initialGroup || 'General');

  // Keep productGroup synced if initialGroup prop changes when modal is opened
  useEffect(() => {
    if (initialGroup) {
      setProductGroup(initialGroup);
    }
  }, [initialGroup]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all host aliases from ~/.ssh/config
  useEffect(() => {
    fetch('/api/ssh/hosts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.hosts)) {
          setAvailableHosts(data.hosts);
        }
      })
      .catch((err) => console.warn('Could not load ssh hosts:', err));
  }, []);

  const handleSelectAlias = async (alias: string) => {
    setSelectedAlias(alias);
    setName(alias);
    setHost(alias);

    // Resolve details using backend ssh -G
    try {
      const res = await fetch(`/api/ssh/resolve?alias=${encodeURIComponent(alias)}`);
      const data = await res.json();
      if (data.success && data.config) {
        if (data.config.user) setUsername(data.config.user);
        if (data.config.port) setPort(data.config.port);
      }
    } catch {
      // Fallback
    }
  };

  const filteredHosts = availableHosts.filter((h) =>
    h.toLowerCase().includes(hostSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host) {
      setError('Please specify a Host or SSH config alias.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || host,
          host,
          port: Number(port),
          username: username || 'root',
          product_group: productGroup.trim() || 'General',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add server');
      }

      onAdded(data.server);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl overflow-hidden bg-term-card border-2 border-term-green shadow-term-glow-strong font-mono">
        
        {/* macOS Terminal Title Bar */}
        <div className="bg-[#212126] px-4 py-2.5 border-b border-term-borderMuted flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <button onClick={onClose} className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] inline-block hover:opacity-80" />
            <span className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] inline-block opacity-80" />
            <span className="w-3.5 h-3.5 rounded-full bg-[#27c93f] inline-block opacity-80" />

            <div className="flex items-center space-x-2 ml-3 text-xs text-gray-300">
              <span className="text-term-apple font-bold text-sm"></span>
              <span className="text-purple-400 font-bold">add-server</span>
              <span className="text-term-green">[~/.ssh/config & hardware key]</span>
            </div>
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-red-950/70 border border-red-800 text-red-300 rounded">
              {error}
            </div>
          )}

          {/* SSH Config Host Selector */}
          {availableHosts.length > 0 && (
            <div className="space-y-1.5 bg-[#141418] p-3 rounded-lg border border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-term-green font-bold flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-term-apple" />
                  <span>Discovered ~/.ssh/config Hosts ({availableHosts.length} found):</span>
                </span>
                <span className="text-[10px] text-gray-500">Click to select alias</span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter ssh aliases (e.g. web, staging, db)..."
                  value={hostSearch}
                  onChange={(e) => setHostSearch(e.target.value)}
                  className="w-full bg-[#0e0e11] border border-gray-700 pl-8 pr-3 py-1.5 rounded text-white text-xs focus:outline-none focus:border-term-green"
                />
              </div>

              <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5 pt-1">
                {filteredHosts.slice(0, 30).map((alias) => (
                  <button
                    key={alias}
                    type="button"
                    onClick={() => handleSelectAlias(alias)}
                    className={`px-2 py-1 rounded text-[11px] border transition flex items-center space-x-1 ${
                      selectedAlias === alias
                        ? 'bg-term-green text-black font-bold border-term-green'
                        : 'bg-[#1a1a20] text-gray-300 border-gray-700 hover:border-term-green/60'
                    }`}
                  >
                    <span>{alias}</span>
                    {selectedAlias === alias && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-gray-400">Host / SSH Alias:</label>
              <input
                type="text"
                placeholder="e.g. my-server or 192.168.1.100"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-[#121214] border border-gray-700 px-3 py-2 rounded text-white focus:outline-none focus:border-term-green font-bold text-term-cyan"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-400">Display Label:</label>
              <input
                type="text"
                placeholder="e.g. Production Web"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#121214] border border-gray-700 px-3 py-2 rounded text-white focus:outline-none focus:border-term-green"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-gray-400">SSH Username (override if needed):</label>
              <input
                type="text"
                placeholder="deploy or root"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#121214] border border-gray-700 px-3 py-2 rounded text-white focus:outline-none focus:border-term-green"
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-400">Port:</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-[#121214] border border-gray-700 px-3 py-2 rounded text-white focus:outline-none focus:border-term-green"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-400">Product / Project Group:</label>
            <input
              type="text"
              list="product-group-suggestions"
              placeholder="e.g. Web Services, Database, Monitoring, General"
              value={productGroup}
              onChange={(e) => setProductGroup(e.target.value)}
              className="w-full bg-[#121214] border border-gray-700 px-3 py-2 rounded text-white focus:outline-none focus:border-term-green font-semibold text-term-yellow"
            />
            <datalist id="product-group-suggestions">
              {availableGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>

            {availableGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-gray-500 py-0.5">Existing:</span>
                {availableGroups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setProductGroup(g)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition ${
                      productGroup === g
                        ? 'bg-term-yellow text-black font-bold border-term-yellow'
                        : 'bg-[#1a1a20] text-gray-400 border-gray-700 hover:border-term-yellow/50'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
            <span className="text-[10px] text-gray-500 block">
              Servers in the same group appear together inside a bounding box and under the same product tab.
            </span>
          </div>

          <div className="p-3 bg-term-green/10 border border-term-green/30 rounded-lg text-[11px] text-gray-300 flex items-center space-x-2">
            <KeyRound className="w-4 h-4 text-term-green shrink-0" />
            <span>
              <strong>FIDO2 / ECDSA-SK Physical Key Supported:</strong> Uses native macOS OpenSSH.
              Hardware touch and passphrase will be confirmed via interactive terminal.
            </span>
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
              <span>{loading ? 'Adding...' : 'Add to Canvas'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
