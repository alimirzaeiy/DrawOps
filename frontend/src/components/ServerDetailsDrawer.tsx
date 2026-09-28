import React, { useState } from 'react';
import { Server, BackupLog } from '../types';
import { FileTreeItem } from './FileTreeItem';
import {
  X,
  FolderTree,
  Cpu,
  ShieldCheck,
  RefreshCw,
  Plus,
  Clock,
  Terminal,
  KeyRound,
  Zap,
  Layers,
  Folder,
  FileCode,
  FileText,
} from 'lucide-react';
import { DockerContainer } from '../types';

interface ServerDetailsDrawerProps {
  server: Server;
  sudoPassword?: string;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
  onCreateItem: (parentPath: string) => void;
  onOpenTerminal: () => void;
  onSync: () => Promise<void>;
  onRequestSudoDocker?: () => void;
  onOpenLogs?: (container: DockerContainer) => void;
  onDeleteServer?: (server: Server) => void;
  onChangeGroup?: (server: Server, newGroup: string) => void;
  availableGroups?: string[];
}

export const ServerDetailsDrawer: React.FC<ServerDetailsDrawerProps> = ({
  server,
  sudoPassword,
  onClose,
  onOpenFile,
  onCreateItem,
  onOpenTerminal,
  onSync,
  onRequestSudoDocker,
  onOpenLogs,
  onDeleteServer,
  onChangeGroup,
  availableGroups = [],
}) => {
  const [activeTab, setActiveTab] = useState<'srv' | 'docker' | 'backups'>('srv');
  const [syncing, setSyncing] = useState(false);
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // Folder-based compose state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [composeContainers, setComposeContainers] = useState<DockerContainer[] | null>(null);
  const [hasComposeFile, setHasComposeFile] = useState<boolean | null>(null);
  const [loadingCompose, setLoadingCompose] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const srvTree = server.state?.srvTree || [];
  const allDockerContainers = server.state?.dockerContainers || [];
  const dockerPermissionDenied = server.state?.dockerPermissionDenied;

  // Active containers to show: folder compose if folder selected, otherwise global docker containers
  const displayedContainers = selectedFolder && composeContainers !== null
    ? composeContainers
    : allDockerContainers;

  const fetchFolderCompose = async (folderPath: string) => {
    setLoadingCompose(true);
    setComposeError(null);
    try {
      const headers: Record<string, string> = {};
      if (sudoPassword) headers['x-sudo-password'] = sudoPassword;

      const res = await fetch(
        `http://localhost:3001/api/servers/${server.id}/docker/compose?path=${encodeURIComponent(folderPath)}`,
        { headers }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to check docker compose');
      }

      setHasComposeFile(data.hasCompose);
      setComposeContainers(data.containers || []);
    } catch (err: any) {
      setComposeError(err.message);
      setComposeContainers([]);
    } finally {
      setLoadingCompose(false);
    }
  };

  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolder(folderPath);
    fetchFolderCompose(folderPath);
  };

  const handleClearFolderFilter = () => {
    setSelectedFolder(null);
    setComposeContainers(null);
    setHasComposeFile(null);
  };

  const handleSyncClick = async () => {
    setSyncing(true);
    try {
      await onSync();
    } catch (err: any) {
      if (err.message.includes('Authentication required') || err.message.includes('Terminal')) {
        onOpenTerminal();
      } else {
        alert(err.message);
      }
    } finally {
      setSyncing(false);
    }
  };

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch(`http://localhost:3001/api/servers/${server.id}/backups`);
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBackups(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl z-40 bg-term-card border-l-2 border-term-green shadow-term-glow flex flex-col animate-in slide-in-from-right duration-200">
      
      {/* macOS Terminal Title Bar */}
      <div className="bg-[#212126] px-4 py-2.5 border-b border-term-borderMuted flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <button onClick={onClose} className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] inline-block hover:opacity-80" />
          <span className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] inline-block opacity-80" />
          <span className="w-3.5 h-3.5 rounded-full bg-[#27c93f] inline-block opacity-80" />

          <div className="flex items-center space-x-2 ml-3 font-mono text-xs text-gray-300">
            <span className="text-term-apple font-bold text-sm"></span>
            <span className="text-purple-400 font-bold">{server.name}</span>
            <span className="text-gray-500 font-mono">({server.username}@{server.host})</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onDeleteServer && (
            <button
              onClick={() => onDeleteServer(server)}
              className="text-xs px-2.5 py-1 bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-800/60 rounded-lg transition flex items-center space-x-1"
              title="Remove server from manager panel"
            >
              <span>Remove from Panel</span>
            </button>
          )}

          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hardware Key & Group Control Bar */}
      <div className="bg-[#18181f] px-3 py-2 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#101014] border border-gray-800 rounded text-term-cyan">
            <KeyRound className="w-3.5 h-3.5 text-term-yellow" />
            <span>Hardware Key (ECDSA-SK)</span>
            {server.isMasterActive && (
              <span className="text-[10px] bg-term-green/20 text-term-green px-1.5 py-0.2 rounded border border-term-green/40 flex items-center space-x-0.5">
                <Zap className="w-2.5 h-2.5" />
                <span>Connected</span>
              </span>
            )}
          </div>

          {/* Group Selector */}
          <div className="flex items-center space-x-1 px-2.5 py-1 bg-[#101014] border border-gray-800 rounded">
            <Layers className="w-3.5 h-3.5 text-term-yellow" />
            <span className="text-gray-500 text-[11px]">Group:</span>
            {onChangeGroup ? (
              <select
                value={server.product_group || 'General'}
                onChange={(e) => onChangeGroup(server, e.target.value)}
                className="bg-transparent text-term-yellow font-bold text-xs focus:outline-none cursor-pointer"
              >
                {availableGroups.map((g) => (
                  <option key={g} value={g} className="bg-[#18181c] text-white">
                    {g}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-term-yellow font-bold text-xs">{server.product_group || 'General'}</span>
            )}
          </div>

          <button
            onClick={handleSyncClick}
            disabled={syncing}
            className="flex items-center space-x-1 px-3 py-1 bg-term-green/20 hover:bg-term-green/30 text-term-green border border-term-green/40 rounded transition font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>

        <button
          onClick={onOpenTerminal}
          className="flex items-center space-x-1.5 px-3 py-1 bg-cyan-950/40 hover:bg-cyan-900/50 text-term-cyan border border-cyan-800 rounded transition font-bold"
          title="Open Terminal to enter passphrase and touch hardware key"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Open Terminal</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-800 bg-[#141418] px-3 font-mono text-xs">
        <button
          onClick={() => setActiveTab('srv')}
          className={`flex items-center space-x-1.5 py-2.5 px-4 border-b-2 font-semibold transition ${
            activeTab === 'srv'
              ? 'border-term-green text-term-green bg-term-green/5'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>/srv File Tree ({srvTree.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('docker')}
          className={`flex items-center space-x-1.5 py-2.5 px-4 border-b-2 font-semibold transition ${
            activeTab === 'docker'
              ? 'border-term-green text-term-green bg-term-green/5'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>
            {selectedFolder
              ? `Folder Compose (${displayedContainers.length})`
              : `Docker Services (${displayedContainers.length})`}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('backups');
            loadBackups();
          }}
          className={`flex items-center space-x-1.5 py-2.5 px-4 border-b-2 font-semibold transition ${
            activeTab === 'backups'
              ? 'border-term-green text-term-green bg-term-green/5'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>/home Backups</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Tab 1: /srv File Tree */}
        {activeTab === 'srv' && (
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <span className="text-xs text-gray-400">
                Browse, select a folder to scope Docker, open in Monaco, or create files:
              </span>
              <button
                onClick={() => onCreateItem(selectedFolder || '/srv')}
                className="flex items-center space-x-1 text-xs px-2.5 py-1 bg-term-green text-black font-bold rounded hover:bg-green-400 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{selectedFolder ? 'New in Selected' : 'New in /srv'}</span>
              </button>
            </div>

            {selectedFolder && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#121216] border border-term-green/30 rounded-lg text-xs">
                <div className="flex items-center space-x-2 truncate">
                  <Folder className="w-3.5 h-3.5 text-term-yellow shrink-0" />
                  <span className="text-gray-400 text-[11px]">Selected:</span>
                  <span className="text-term-green font-bold truncate">{selectedFolder}</span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => setActiveTab('docker')}
                    className="flex items-center space-x-1 px-2 py-0.5 bg-term-green/20 hover:bg-term-green/30 text-term-green rounded text-[11px] font-bold border border-term-green/40 transition"
                  >
                    <Cpu className="w-3 h-3" />
                    <span>View Docker Compose</span>
                  </button>
                  <button
                    onClick={handleClearFolderFilter}
                    className="text-gray-500 hover:text-gray-300 text-xs px-1"
                    title="Clear folder selection"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {srvTree.length === 0 ? (
              <div className="py-12 text-center text-gray-500 space-y-2">
                <FolderTree className="w-8 h-8 mx-auto text-gray-600" />
                <p>No cached /srv structure yet.</p>
                <p className="text-[11px] text-gray-600">
                  Open terminal to confirm user presence on your hardware key, then click <strong>Sync Now</strong>.
                </p>
              </div>
            ) : (
              <div className="bg-[#121214] p-3 rounded-lg border border-gray-800 space-y-1">
                {srvTree.map((node) => (
                  <FileTreeItem
                    key={node.path}
                    node={node}
                    onOpenFile={onOpenFile}
                    onCreateInDir={onCreateItem}
                    onSelectFolder={handleFolderSelect}
                    selectedFolderPath={selectedFolder || undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Docker Services */}
        {activeTab === 'docker' && (
          <div className="space-y-3 font-mono">
            {/* Active Folder Filter Header */}
            {selectedFolder ? (
              <div className="flex items-center justify-between p-2.5 bg-[#14141a] border border-term-green/40 rounded-lg text-xs">
                <div className="flex items-center space-x-2 truncate">
                  <Folder className="w-4 h-4 text-term-yellow shrink-0" />
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-gray-400 text-[11px]">Docker Compose directory:</span>
                      <span className="text-term-green font-bold truncate">{selectedFolder}</span>
                    </div>
                    {hasComposeFile === false && (
                      <span className="text-[10px] text-amber-400">No docker-compose.yml found in this folder.</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => fetchFolderCompose(selectedFolder)}
                    disabled={loadingCompose}
                    title="Refresh folder compose"
                    className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingCompose ? 'animate-spin text-term-green' : ''}`} />
                  </button>
                  <button
                    onClick={handleClearFolderFilter}
                    className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[11px] transition"
                  >
                    Show All Server Containers
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-[#141418] border border-gray-800 rounded-lg text-xs text-gray-400">
                <span>Showing all containers on server. Select a folder in <strong>/srv File Tree</strong> to view its specific compose stack.</span>
              </div>
            )}

            {dockerPermissionDenied && (
              <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-amber-300">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Docker requires sudo privileges (<code className="text-amber-200">docker.sock</code> permission denied)</span>
                </div>
                {onRequestSudoDocker && (
                  <button
                    onClick={onRequestSudoDocker}
                    className="ml-3 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded transition whitespace-nowrap"
                  >
                    Enter Sudo Password
                  </button>
                )}
              </div>
            )}

            {loadingCompose ? (
              <div className="py-12 text-center text-gray-500 space-y-2">
                <RefreshCw className="w-6 h-6 mx-auto text-term-green animate-spin" />
                <p className="text-xs">Querying Docker Compose for {selectedFolder}...</p>
              </div>
            ) : displayedContainers.length === 0 ? (
              <div className="py-12 text-center text-gray-500 space-y-2">
                <Cpu className="w-8 h-8 mx-auto text-gray-600" />
                <p>
                  {selectedFolder
                    ? `No containers active for compose in "${selectedFolder}".`
                    : 'No Docker containers discovered or Docker not running.'}
                </p>
                <p className="text-[11px] text-gray-600">
                  Click on any container card to inspect live container logs.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                  <span>{displayedContainers.length} container(s) found</span>
                  <span>Click container to view logs</span>
                </div>
                {displayedContainers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onOpenLogs && onOpenLogs(c)}
                    className="p-3 bg-[#121214] border border-gray-800 rounded-lg hover:border-term-green/60 hover:bg-[#15151a] cursor-pointer transition space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            c.state === 'running' ? 'bg-term-green shadow-term-glow' : 'bg-red-500'
                          }`}
                        />
                        <span className="font-bold text-white text-xs group-hover:text-term-green transition">{c.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-term-cyan/80 group-hover:text-term-cyan underline">View Logs</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            c.state === 'running'
                              ? 'bg-term-green/20 text-term-green border border-term-green/40'
                              : 'bg-red-950/60 text-red-400 border border-red-800'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-400 space-y-1">
                      <div><span className="text-gray-500">Image:</span> <span className="text-term-cyan">{c.image}</span></div>
                      {c.ports && <div><span className="text-gray-500">Ports:</span> <span className="text-term-yellow">{c.ports}</span></div>}
                      <div><span className="text-gray-500">Container ID:</span> <span className="text-gray-400">{c.id}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: /home Backups Log */}
        {activeTab === 'backups' && (
          <div className="space-y-3 font-mono">
            <div className="p-3 bg-term-green/10 border border-term-green/30 rounded-lg text-xs space-y-1">
              <div className="font-bold text-term-green flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Strict Security Guarantee & /home Backup History</span>
              </div>
              <p className="text-gray-400 text-[11px]">
                Every time a file is edited in this panel, a full copy is backed up to the server&apos;s{' '}
                <strong className="text-term-cyan font-mono">/home/{server.username}/srv_backups</strong> before saving.
                Deletion operations are permanently disabled.
              </p>
            </div>

            {loadingBackups ? (
              <div className="text-center py-8 text-gray-500 text-xs">Loading backup logs...</div>
            ) : backups.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs">
                No files have been modified yet. Backup logs will appear here.
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((b) => (
                  <div key={b.id} className="p-3 bg-[#121214] border border-gray-800 rounded-lg space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-term-cyan" />
                        <span>{new Date(b.timestamp).toLocaleString()}</span>
                      </div>
                      <span className="text-term-green font-bold uppercase">{b.status}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Original:</span>{' '}
                      <span className="text-gray-200 font-semibold">{b.original_path}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Backup in /home:</span>{' '}
                      <span className="text-term-cyan font-mono break-all">{b.backup_path}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Notice */}
      <div className="p-3 bg-[#121214] border-t border-gray-800 flex items-center justify-between text-[11px] font-mono text-gray-500">
        <span>Zero-Delete Enforced</span>
        <span>Last synced: {server.state?.updatedAt ? new Date(server.state.updatedAt).toLocaleTimeString() : 'Offline'}</span>
      </div>
    </div>
  );
};
