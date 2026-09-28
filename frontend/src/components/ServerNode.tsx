import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Server } from '../types';
import { getGroupColor } from '../App';
import { Terminal, FolderTree, RefreshCw, Cpu, Layers, KeyRound, Zap } from 'lucide-react';

interface ServerNodeProps {
  data: {
    server: Server;
    onExplore: (server: Server) => void;
    onOpenDrawer: (server: Server) => void;
    onOpenTerminal: (server: Server) => void;
    onSync: (server: Server) => void;
    onDelete?: (server: Server) => void;
    onChangeGroup?: (server: Server, newGroup: string) => void;
    availableGroups?: string[];
  };
}

export const ServerNode: React.FC<ServerNodeProps> = ({ data }) => {
  const { server, onExplore, onOpenDrawer, onOpenTerminal, onSync, onDelete, onChangeGroup, availableGroups = [] } = data;
  const [editingGroup, setEditingGroup] = React.useState(false);
  const [groupInput, setGroupInput] = React.useState(server.product_group || 'General');
  const [syncing, setSyncing] = React.useState(false);
  const dockerCount = server.state?.dockerContainers?.length || 0;
  const runningDocker = server.state?.dockerContainers?.filter(c => c.state === 'running').length || 0;
  const srvItemsCount = server.state?.srvTree?.length || 0;

  const isOnline = server.status === 'online';
  const isMasterActive = server.isMasterActive;

  const handleSyncClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    try {
      await onSync(server);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(server);
    }
  };

  return (
    <div className="w-84 rounded-2xl overflow-hidden bg-term-card border-2 border-term-green shadow-term-glow transition-all duration-200 hover:shadow-term-glow-strong">
      <Handle type="target" position={Position.Top} className="!bg-term-green !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="right-out" className="!bg-term-green !w-3 !h-3" />
      
      {/* macOS Terminal Title Bar */}
      <div className="bg-[#212126] px-3.5 py-2.5 border-b border-term-borderMuted flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          {/* macOS window control dots */}
          <button
            onClick={handleDeleteClick}
            title={`Remove ${server.name} from panel`}
            className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm hover:opacity-80 transition cursor-pointer flex items-center justify-center group"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-black font-bold">×</span>
          </button>
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm"></div>
          <div className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm"></div>
          
          {/* Magenta Apple symbol and path from oh-my-zsh theme */}
          <span className="text-term-apple font-bold text-xs ml-2"></span>
          <span className="text-xs text-gray-300 font-mono truncate max-w-[130px]" title={server.name}>~/{server.name}</span>
          <span className="text-[10px] text-purple-400 font-mono">[master+]</span>
        </div>
        
        {/* Status / Socket Indicator */}
        <div className="flex items-center space-x-1">
          {isMasterActive ? (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-term-green/20 text-term-green border border-term-green/50 flex items-center space-x-1"
              title="OpenSSH ControlMaster active (Key authenticated)"
            >
              <Zap className="w-2.5 h-2.5 fill-term-green" />
              <span>LIVE</span>
            </span>
          ) : (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                isOnline ? 'bg-term-green/20 text-term-green border border-term-green/50' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              {isOnline ? 'ONLINE' : 'CACHED'}
            </span>
          )}
        </div>
      </div>

      {/* Terminal Info Body */}
      <div className="p-3.5 space-y-3 font-mono text-xs">
        <div className="text-gray-400 space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500">SSH Target:</span>
            <span className="text-term-cyan font-bold truncate max-w-[190px]" title={`${server.username}@${server.host}`}>
              {server.username}@{server.host}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500">Auth Method:</span>
            <span className="text-term-yellow flex items-center space-x-1">
              <KeyRound className="w-3 h-3" />
              <span>Physical Key (ECDSA-SK)</span>
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px] relative">
            <span className="text-gray-500">Group:</span>
            {editingGroup ? (
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  list={`groups-list-${server.id}`}
                  value={groupInput}
                  onChange={(e) => setGroupInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (onChangeGroup) onChangeGroup(server, groupInput.trim() || 'General');
                      setEditingGroup(false);
                    } else if (e.key === 'Escape') {
                      setEditingGroup(false);
                    }
                  }}
                  autoFocus
                  placeholder="Group name"
                  className="bg-[#121214] border border-term-yellow text-term-yellow px-1.5 py-0.5 rounded text-[10px] w-28 focus:outline-none font-bold"
                />
                <datalist id={`groups-list-${server.id}`}>
                  {availableGroups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                <button
                  onClick={() => {
                    if (onChangeGroup) onChangeGroup(server, groupInput.trim() || 'General');
                    setEditingGroup(false);
                  }}
                  className="px-1 py-0.5 bg-term-green text-black font-bold text-[9px] rounded cursor-pointer"
                >
                  ✓
                </button>
                <button
                  onClick={() => setEditingGroup(false)}
                  className="px-1 py-0.5 bg-gray-800 text-gray-300 text-[9px] rounded cursor-pointer"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingGroup(true);
                  setGroupInput(server.product_group || 'General');
                }}
                style={{
                  color: getGroupColor(server.product_group || 'General'),
                  borderColor: `${getGroupColor(server.product_group || 'General')}55`,
                  backgroundColor: `${getGroupColor(server.product_group || 'General')}18`,
                }}
                title="Click to reassign to another group"
                className="font-bold px-2 py-0.5 rounded-md border text-[10px] transition cursor-pointer flex items-center space-x-1 hover:brightness-125"
              >
                <span>{server.product_group || 'General'}</span>
                <span className="text-[9px] opacity-60">✎</span>
              </button>
            )}
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500">Last Synced:</span>
            <span className="text-gray-300">
              {server.state?.updatedAt ? new Date(server.state.updatedAt).toLocaleTimeString() : 'Never'}
            </span>
          </div>
        </div>

        {/* Badges / Metrics */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-800">
          <div
            onClick={() => onOpenDrawer(server)}
            className="bg-[#121214] p-2.5 rounded-xl border border-gray-800 hover:border-gray-700 cursor-pointer flex items-center space-x-2 transition"
            title="Click to open Docker services in drawer"
          >
            <Cpu className="w-4 h-4 text-term-cyan shrink-0" />
            <div>
              <div className="text-[10px] text-gray-500">DOCKER</div>
              <div className="text-xs font-bold text-term-text">{runningDocker}/{dockerCount} Up</div>
            </div>
          </div>
          <div
            onClick={() => onOpenDrawer(server)}
            className="bg-[#121214] p-2.5 rounded-xl border border-gray-800 hover:border-term-green/40 cursor-pointer flex items-center space-x-2 transition"
            title="Click to open /srv file explorer drawer"
          >
            <Layers className="w-4 h-4 text-term-green shrink-0" />
            <div>
              <div className="text-[10px] text-gray-500">/srv TREE</div>
              <div className="text-xs font-bold text-term-text">{srvItemsCount} Root Items</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-1 pt-1">
          <button
            onClick={() => onExplore(server)}
            className="flex flex-col items-center justify-center py-1.5 px-1 bg-yellow-950/30 hover:bg-yellow-900/40 text-term-yellow border border-yellow-800/40 rounded-xl transition"
            title="Expand / collapse /srv tree nodes on the canvas"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold mt-0.5">Canvas</span>
          </button>

          <button
            onClick={() => onOpenDrawer(server)}
            className="flex flex-col items-center justify-center py-1.5 px-1 bg-term-green/10 hover:bg-term-green/20 text-term-green border border-term-green/40 rounded-xl transition"
            title="Open side panel / drawer file tree explorer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold mt-0.5">Drawer</span>
          </button>

          <button
            onClick={() => onOpenTerminal(server)}
            className="flex flex-col items-center justify-center py-1.5 px-1 bg-cyan-950/40 hover:bg-cyan-900/50 text-term-cyan border border-term-cyan/40 rounded-xl transition"
            title="Open Interactive SSH Terminal (Touch key to authenticate)"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold mt-0.5">Term</span>
          </button>

          <button
            onClick={handleSyncClick}
            disabled={syncing}
            className="flex flex-col items-center justify-center py-1.5 px-1 bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Sync /srv and Docker State"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-term-green' : ''}`} />
            <span className="text-[10px] font-bold mt-0.5">{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-term-green !w-3 !h-3" />
    </div>
  );
};
