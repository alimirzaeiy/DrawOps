import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileNode } from '../types';
import { Folder, FolderOpen, FileCode, FileText, ChevronRight } from 'lucide-react';

interface FileCanvasNodeProps {
  data: {
    node: FileNode;
    serverId: string;
    isExpanded?: boolean;
    hasChildren?: boolean;
    onToggleExpand?: (path: string) => void;
    onOpenFile?: (filePath: string) => void;
  };
}

export const FileCanvasNode: React.FC<FileCanvasNodeProps> = ({ data }) => {
  const { node, isExpanded, hasChildren, onToggleExpand, onOpenFile } = data;
  const isDirectory = node.type === 'directory';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      if (onToggleExpand) onToggleExpand(node.path);
    } else {
      if (onOpenFile) onOpenFile(node.path);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isConfigOrCompose =
    node.name.endsWith('.yml') ||
    node.name.endsWith('.yaml') ||
    node.name.includes('docker') ||
    node.name.endsWith('.conf') ||
    node.name.endsWith('.env');

  return (
    <div
      onClick={handleClick}
      className={`min-w-56 max-w-72 rounded-2xl p-2.5 bg-[#18181c] border-2 transition-all duration-200 cursor-pointer select-none shadow-lg ${
        isDirectory
          ? isExpanded
            ? 'border-term-yellow shadow-term-glow bg-[#1f1d17]'
            : 'border-gray-700 hover:border-term-yellow/80 hover:bg-[#1f1f26]'
          : 'border-gray-800 hover:border-term-cyan hover:bg-[#151c22]'
      }`}
    >
      {/* Target handle connecting from parent */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-term-green !w-3 !h-3 !border-2 !border-black"
      />

      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-2 overflow-hidden">
          {isDirectory ? (
            <div className="p-1 rounded-xl bg-yellow-950/40 text-term-yellow shrink-0">
              {isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
            </div>
          ) : (
            <div className="p-1 rounded-xl bg-cyan-950/40 text-term-cyan shrink-0">
              {isConfigOrCompose ? <FileCode className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
          )}

          <div className="truncate">
            <div className={`text-xs font-mono truncate font-bold ${isDirectory ? 'text-term-yellow' : 'text-gray-200'}`}>
              {node.name}
            </div>
            <div className="text-[10px] text-gray-500 font-mono truncate">
              {isDirectory ? (hasChildren ? 'Directory' : 'Empty folder') : (formatSize(node.size) || 'File')}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center space-x-1">
          {isDirectory && hasChildren && (
            <span
              className={`p-1 rounded-full text-xs transition-transform duration-200 ${
                isExpanded ? 'rotate-90 text-term-yellow' : 'text-gray-500'
              }`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          )}

          {!isDirectory && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-term-cyan/10 text-term-cyan border border-term-cyan/30">
              view
            </span>
          )}
        </div>
      </div>

      {/* Source handle connecting to child nodes when expanded */}
      {isDirectory && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-term-yellow !w-3 !h-3 !border-2 !border-black"
        />
      )}
    </div>
  );
};
