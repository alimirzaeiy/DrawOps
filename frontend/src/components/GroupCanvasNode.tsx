import React from 'react';
import { Layers, Plus, Server as ServerIcon, Trash2, Move } from 'lucide-react';

interface GroupCanvasNodeProps {
  data: {
    label: string;
    serverCount: number;
    width: number;
    height: number;
    color?: string;
    onAddServer?: (groupName: string) => void;
    onDeleteGroup?: (groupName: string) => void;
  };
}

export const GroupCanvasNode: React.FC<GroupCanvasNodeProps> = ({ data }) => {
  const { label, serverCount, width, height, color = '#27c93f', onAddServer, onDeleteGroup } = data;

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderColor: color,
      }}
      className="rounded-3xl border-2 border-dashed bg-[#151518]/60 backdrop-blur-[2px] p-4 pointer-events-none relative transition-all duration-300 shadow-2xl flex flex-col justify-between"
    >
      {/* Group Header Badge (Acts as drag handle for the entire group) */}
      <div className="flex items-center justify-between w-full select-none">
        <div
          style={{ borderColor: `${color}66` }}
          className="group-drag-handle inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#212126] border shadow-md pointer-events-auto cursor-grab active:cursor-grabbing hover:border-gray-500 transition"
          title={`Drag to move entire "${label}" group`}
        >
          <Move className="w-3 h-3 text-gray-400 group-hover:text-white" />
          <span className="text-term-apple font-bold text-xs"></span>
          <Layers className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-xs font-bold font-mono tracking-wide" style={{ color }}>{label}</span>
          <span
            style={{
              backgroundColor: `${color}20`,
              color: color,
              borderColor: `${color}55`,
            }}
            className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border"
          >
            {serverCount} {serverCount === 1 ? 'server' : 'servers'}
          </span>
        </div>

        {/* Group Actions */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          {onAddServer && (
            <button
              onClick={() => onAddServer(label)}
              style={{
                borderColor: `${color}66`,
                color: color,
              }}
              className="flex items-center space-x-1 px-2.5 py-1 bg-[#212126] hover:bg-white/10 text-[11px] font-mono font-bold border rounded-xl transition shadow-sm cursor-pointer"
              title={`Add new server directly to ${label}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Server</span>
            </button>
          )}

          {onDeleteGroup && serverCount === 0 && label !== 'General' && (
            <button
              onClick={() => onDeleteGroup(label)}
              className="p-1.5 bg-[#212126] hover:bg-red-500/20 text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-500/40 rounded-xl transition cursor-pointer"
              title="Remove empty group"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Empty Group State Placeholder inside bounding box */}
      {serverCount === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center pointer-events-auto py-6">
          <div className="p-4 rounded-2xl bg-[#1a1a20]/80 border border-dashed border-gray-700 text-center space-y-2 max-w-[280px]">
            <ServerIcon className="w-7 h-7 text-gray-500 mx-auto opacity-70" />
            <div className="text-xs font-mono text-gray-300 font-bold">Group is Empty</div>
            <p className="text-[10px] text-gray-500 font-mono">
              Assign existing servers to this group via their badge, or add a new server.
            </p>
            {onAddServer && (
              <button
                onClick={() => onAddServer(label)}
                style={{
                  backgroundColor: `${color}20`,
                  color: color,
                  borderColor: `${color}66`,
                }}
                className="mt-1 inline-flex items-center space-x-1 px-3 py-1 hover:bg-white/10 border rounded-lg text-xs font-mono font-bold transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Server Here</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
