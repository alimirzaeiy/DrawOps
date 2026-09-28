import React, { useState } from 'react';
import { FileNode } from '../types';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, FileCode } from 'lucide-react';

interface FileTreeItemProps {
  node: FileNode;
  onOpenFile: (filePath: string) => void;
  onCreateInDir: (parentPath: string) => void;
  onSelectFolder?: (folderPath: string) => void;
  selectedFolderPath?: string;
  depth?: number;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  onOpenFile,
  onCreateInDir,
  onSelectFolder,
  selectedFolderPath,
  depth = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isDirectory = node.type === 'directory';
  const isSelected = isDirectory && selectedFolderPath === node.path;

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="text-xs select-none">
      <div
        className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer group transition ${
          isSelected
            ? 'bg-term-green/15 border border-term-green/40 text-term-green'
            : 'hover:bg-white/5 text-gray-300'
        } ${depth > 0 ? 'ml-3 border-l border-gray-800' : ''}`}
        onClick={() => {
          if (isDirectory) {
            setIsOpen(!isOpen);
            if (onSelectFolder) {
              onSelectFolder(node.path);
            }
          } else {
            onOpenFile(node.path);
          }
        }}
      >
        <div className="flex items-center space-x-1.5 overflow-hidden text-ellipsis">
          {isDirectory ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(!isOpen);
                }}
                className="text-gray-400 hover:text-white"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-term-green" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {isOpen ? (
                <FolderOpen className="w-4 h-4 text-term-yellow shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-term-yellow shrink-0" />
              )}
            </>
          ) : (
            <>
              <span className="w-3.5 inline-block" />
              {node.name.endsWith('.yml') || node.name.endsWith('.yaml') || node.name.includes('docker') ? (
                <FileCode className="w-4 h-4 text-term-cyan shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              )}
            </>
          )}

          <span className={`font-mono truncate ${isDirectory ? 'text-gray-200 font-semibold' : 'text-gray-300'}`}>
            {node.name}
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {!isDirectory && node.size !== undefined && (
            <span className="text-[10px] text-gray-500 font-mono">{formatSize(node.size)}</span>
          )}

          {/* Create new item inside directory */}
          {isDirectory && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateInDir(node.path);
              }}
              title="Add file or folder inside"
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-term-green/20 text-term-green transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isDirectory && isOpen && (
        <div className="pl-2">
          {node.children && node.children.length > 0 ? (
            node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                onOpenFile={onOpenFile}
                onCreateInDir={onCreateInDir}
                onSelectFolder={onSelectFolder}
                selectedFolderPath={selectedFolderPath}
                depth={depth + 1}
              />
            ))
          ) : (
            <div className="ml-6 py-1 text-[11px] text-gray-600 italic font-mono">
              [empty directory]
            </div>
          )}
        </div>
      )}
    </div>
  );
};
