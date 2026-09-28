import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal, RefreshCw, Copy, Check, ArrowDown } from 'lucide-react';
import { DockerContainer, Server } from '../types';

interface DockerLogsModalProps {
  server: Server;
  container: DockerContainer;
  sudoPassword?: string;
  onClose: () => void;
}

export const DockerLogsModal: React.FC<DockerLogsModalProps> = ({
  server,
  container,
  sudoPassword,
  onClose,
}) => {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tailLines, setTailLines] = useState<number>(250);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logsContainerRef = useRef<HTMLPreElement>(null);

  const fetchLogs = async (tail = tailLines) => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (sudoPassword) {
        headers['x-sudo-password'] = sudoPassword;
      }

      const res = await fetch(
        `http://localhost:3001/api/servers/${server.id}/docker/containers/${container.id}/logs?tail=${tail}`,
        { headers }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch container logs');
      }

      setLogs(data.logs || '[No log output returned]');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [container.id, tailLines]);

  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#121214] border border-term-borderMuted rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden text-gray-200 font-mono">
        {/* macOS Terminal Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#18181c] border-b border-gray-800 select-none shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block hover:opacity-80 transition"
            />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block opacity-80" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block opacity-80" />

            <div className="flex items-center space-x-2 ml-3 text-xs">
              <Terminal className="w-3.5 h-3.5 text-term-green" />
              <span className="font-bold text-white">{container.name}</span>
              <span className="text-gray-500 text-[11px]">({container.image})</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                  container.state === 'running'
                    ? 'bg-term-green/20 text-term-green border border-term-green/40'
                    : 'bg-red-950/60 text-red-400 border border-red-800'
                }`}
              >
                {container.status}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tail lines selector */}
            <select
              value={tailLines}
              onChange={(e) => setTailLines(Number(e.target.value))}
              className="bg-[#0c0c0e] border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded focus:outline-none focus:border-term-green"
            >
              <option value={100}>Tail 100</option>
              <option value={250}>Tail 250</option>
              <option value={500}>Tail 500</option>
              <option value={1000}>Tail 1000</option>
            </select>

            {/* Refresh button */}
            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              title="Refresh logs"
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-term-green' : ''}`} />
            </button>

            {/* Copy button */}
            <button
              onClick={handleCopyLogs}
              title="Copy all logs"
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-term-green" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition p-1 rounded hover:bg-gray-800 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subheader info bar */}
        <div className="bg-[#141418] px-4 py-1.5 border-b border-gray-800 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
          <div className="flex items-center space-x-3">
            <span>Container ID: <code className="text-gray-300">{container.id}</code></span>
            {container.ports && <span>Ports: <code className="text-term-yellow">{container.ports}</code></span>}
          </div>
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-3 h-3 text-term-green rounded bg-[#0c0c0e] border-gray-700 focus:ring-0"
              />
              <span className="text-[10px] text-gray-400">Auto-scroll</span>
            </label>
            <button
              onClick={() => {
                if (logsContainerRef.current) {
                  logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
                }
              }}
              className="p-0.5 text-gray-400 hover:text-term-green transition"
              title="Scroll to bottom"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Logs Output Area */}
        <div className="flex-1 p-3 overflow-hidden bg-[#0c0c0e] flex flex-col">
          {error ? (
            <div className="p-4 bg-red-950/30 border border-red-800 rounded-lg text-red-400 text-xs">
              <strong>Error fetching logs:</strong> {error}
            </div>
          ) : (
            <pre
              ref={logsContainerRef}
              className="flex-1 overflow-y-auto font-mono text-[11.5px] leading-relaxed p-2 text-gray-300 whitespace-pre-wrap select-text terminal-scrollbar selection:bg-term-green/30 selection:text-white"
            >
              {loading && !logs ? (
                <div className="flex items-center space-x-2 text-gray-500 py-4">
                  <RefreshCw className="w-4 h-4 animate-spin text-term-green" />
                  <span>Streaming logs from {server.name}...</span>
                </div>
              ) : (
                logs
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
