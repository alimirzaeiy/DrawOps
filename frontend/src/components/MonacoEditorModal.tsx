import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { X, Save, ShieldCheck, CheckCircle2, AlertTriangle, Key } from 'lucide-react';

interface MonacoEditorModalProps {
  serverId: string;
  serverName: string;
  filePath: string;
  initialContent: string;
  source: 'live' | 'cached';
  savedPassword?: string;
  onClose: () => void;
  onSaved: (backupPath: string) => void;
}

export const MonacoEditorModal: React.FC<MonacoEditorModalProps> = ({
  serverId,
  serverName,
  filePath,
  initialContent,
  source,
  savedPassword,
  onClose,
  onSaved,
}) => {
  const [content, setContent] = useState(initialContent);
  const [password, setPassword] = useState(savedPassword || '');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // Determine Monaco language mode from file extension
  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    if (ext === 'yml' || ext === 'yaml') return 'yaml';
    if (ext === 'json') return 'json';
    if (ext === 'sh' || ext === 'bash') return 'shell';
    if (ext === 'py') return 'python';
    if (ext === 'js' || ext === 'ts') return 'javascript';
    if (ext === 'conf' || ext === 'cfg' || ext === 'ini') return 'ini';
    if (path.toLowerCase().includes('dockerfile')) return 'dockerfile';
    return 'plaintext';
  };

  const handleSave = async (authPass?: string) => {
    const passToUse = authPass || password;
    if (!passToUse) {
      setShowPasswordPrompt(true);
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    try {
      const res = await fetch(`http://localhost:3001/api/servers/${serverId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          content,
          password: passToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save file');
      }

      setSaveStatus({
        type: 'success',
        message: `Saved successfully! Backup created at: ${data.backupPath}`,
      });
      setShowPasswordPrompt(false);
      onSaved(data.backupPath);
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err.message,
      });
      if (err.message.toLowerCase().includes('password') || err.message.toLowerCase().includes('denied')) {
        setShowPasswordPrompt(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl h-[85vh] flex flex-col rounded-2xl overflow-hidden bg-term-card border-2 border-term-green shadow-term-glow-strong">
        
        {/* macOS Terminal Title Bar */}
        <div className="bg-[#212126] px-4 py-2.5 border-b border-term-borderMuted flex items-center justify-between select-none">
          <div className="flex items-center space-x-2.5">
            <button onClick={onClose} className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] inline-block hover:opacity-80 transition" />
            <span className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] inline-block opacity-80" />
            <span className="w-3.5 h-3.5 rounded-full bg-[#27c93f] inline-block opacity-80" />
            
            <div className="flex items-center space-x-2 ml-3 font-mono text-xs text-gray-300">
              <span className="text-term-apple font-bold text-sm"></span>
              <span className="text-purple-400 font-bold">{serverName}:</span>
              <span className="text-term-green font-semibold">{filePath}</span>
              {source === 'cached' && (
                <span className="text-[10px] bg-yellow-950/60 text-yellow-400 px-2 py-0.5 rounded-lg border border-yellow-800">
                  [CACHED OFFLINE]
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-[11px] text-gray-400 bg-[#121214] px-2.5 py-1 rounded-xl border border-gray-800">
              <ShieldCheck className="w-3.5 h-3.5 text-term-green" />
              <span>Auto-Backup to <strong className="text-term-cyan font-mono">/home</strong> Active</span>
            </div>

            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="flex items-center space-x-1.5 px-3 py-1 bg-term-green hover:bg-green-400 text-black font-bold font-mono text-xs rounded-xl transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save & Backup'}</span>
            </button>

            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status notice banner */}
        {saveStatus && (
          <div
            className={`px-4 py-2 font-mono text-xs flex items-center space-x-2 ${
              saveStatus.type === 'success'
                ? 'bg-green-950/70 text-term-green border-b border-term-green/30'
                : 'bg-red-950/70 text-red-300 border-b border-red-800'
            }`}
          >
            {saveStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-all">{saveStatus.message}</span>
          </div>
        )}

        {/* Password Prompt Drawer if needed */}
        {showPasswordPrompt && (
          <div className="bg-[#1e1e24] p-3 border-b border-term-borderMuted flex items-center justify-between font-mono text-xs">
            <div className="flex items-center space-x-2 text-yellow-300">
              <Key className="w-4 h-4" />
              <span>Enter SSH / Sudo Password to verify write & backup permission:</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="password"
                placeholder="Server password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave(password)}
                className="bg-[#121214] border border-gray-700 px-2 py-1 rounded text-white text-xs w-56 focus:outline-none focus:border-term-green"
              />
              <button
                onClick={() => handleSave(password)}
                className="px-3 py-1 bg-term-green text-black font-bold rounded hover:bg-green-400 transition"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        )}

        {/* Monaco Editor Container */}
        <div className="flex-1 w-full bg-[#1e1e1e] overflow-hidden">
          <Editor
            height="100%"
            language={getLanguage(filePath)}
            theme="vs-dark"
            value={content}
            onChange={(val) => setContent(val || '')}
            options={{
              fontSize: 13,
              fontFamily: 'Menlo, Monaco, Consolas, monospace',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              automaticLayout: true,
            }}
          />
        </div>

        {/* Bottom Status bar */}
        <div className="bg-[#141418] px-4 py-1.5 border-t border-gray-800 flex items-center justify-between text-[11px] font-mono text-gray-500">
          <div>Mode: <span className="text-term-cyan uppercase">{getLanguage(filePath)}</span></div>
          <div className="text-gray-400">Strict Safety: Deletions Permanently Blocked</div>
        </div>
      </div>
    </div>
  );
};
