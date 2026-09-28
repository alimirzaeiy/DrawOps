import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  applyNodeChanges,
  NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Server, FileNode, DockerContainer } from './types';
import { ServerNode } from './components/ServerNode';
import { FileCanvasNode } from './components/FileCanvasNode';
import { GroupCanvasNode } from './components/GroupCanvasNode';
import { ServerDetailsDrawer } from './components/ServerDetailsDrawer';
import { MonacoEditorModal } from './components/MonacoEditorModal';
import { TerminalDrawer } from './components/TerminalDrawer';
import { AddServerModal } from './components/AddServerModal';
import { NewItemModal } from './components/NewItemModal';
import { SudoPasswordModal } from './components/SudoPasswordModal';
import { DockerLogsModal } from './components/DockerLogsModal';

import {
  Plus,
  RefreshCw,
  ShieldCheck,
  Layers,
  Terminal,
  Server as ServerIcon,
  LayoutGrid,
} from 'lucide-react';

const API_BASE = '/api';

// Vibrant macOS terminal palette for distinct product group bounding boxes
const GROUP_PALETTE = [
  '#27c93f', // Neon Green (Term Green)
  '#06b6d4', // Bright Cyan
  '#a855f7', // Electric Purple
  '#eab308', // Amber / Gold
  '#f43f5e', // Rose / Red-Pink
  '#3b82f6', // Bright Blue
  '#f97316', // Orange
  '#10b981', // Emerald
  '#ec4899', // Hot Pink
  '#14b8a6', // Teal
];

export const getGroupColor = (groupName: string): string => {
  if (!groupName) return '#a855f7';
  if (groupName.toLowerCase() === 'general') return '#a855f7'; // Signature purple for General
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash = (hash << 5) - hash + groupName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % GROUP_PALETTE.length;
  return GROUP_PALETTE[index];
};

export default function App() {
  const [servers, setServers] = useState<Server[]>([]);
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  // Active product group tab filter ('ALL' or specific product group)
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  // List of all created product groups (persisted in SQLite product_groups table)
  const [groupsList, setGroupsList] = useState<string[]>([]);

  // Preselected group when opening AddServerModal
  const [modalInitialGroup, setModalInitialGroup] = useState<string>('General');

  // Expanded folders on canvas: serverId -> Set of expanded directory paths
  // If expandedFolders has serverId, the root /srv is visible.
  const [expandedFolders, setExpandedFolders] = useState<Record<string, string[]>>({});

  // Selected server for /srv and docker details drawer
  const [inspectServer, setInspectServer] = useState<Server | null>(null);

  // Active terminal drawer server
  const [terminalServer, setTerminalServer] = useState<Server | null>(null);

  // Whether the opened terminal drawer should prompt to close once sync finishes
  const [promptTerminalClose, setPromptTerminalClose] = useState(false);

  // Monaco editor state
  const [editorState, setEditorState] = useState<{
    server: Server;
    filePath: string;
    content: string;
    source: 'live' | 'cached';
  } | null>(null);

  // Create item modal state
  const [createItemState, setCreateItemState] = useState<{
    server: Server;
    parentPath: string;
  } | null>(null);

  // Add server modal
  const [showAddServerModal, setShowAddServerModal] = useState(false);

  // Sudo password prompt state (RAM only)
  const [sudoPromptServer, setSudoPromptServer] = useState<Server | null>(null);

  // Docker container logs modal state
  const [dockerLogsState, setDockerLogsState] = useState<{
    server: Server;
    container: DockerContainer;
  } | null>(null);

  // Session stored passwords
  const [sessionPasswords, setSessionPasswords] = useState<Record<string, string>>({});

  // Dynamic positions for empty groups on canvas
  const [emptyGroupPositions, setEmptyGroupPositions] = useState<Record<string, { x: number; y: number }>>({});

  const saveSessionPassword = (serverId: string, pass: string) => {
    setSessionPasswords((prev) => ({ ...prev, [serverId]: pass }));
  };

  // Fetch servers from backend SQLite DB (offline cached state included)
  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/servers`);
      const data = await res.json();
      if (data.success) {
        setServers(data.servers);
        // Sync inspectServer if open
        setInspectServer((current) => {
          if (!current) return null;
          const fresh = (data.servers as Server[]).find((s) => s.id === current.id);
          return fresh || current;
        });
        // Sync terminalServer if open
        setTerminalServer((current) => {
          if (!current) return null;
          const fresh = (data.servers as Server[]).find((s) => s.id === current.id);
          return fresh || current;
        });
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch product groups list from backend SQLite DB
  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/groups`);
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroupsList(data.groups);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  }, []);

  // Node types for React Flow
  const nodeTypes = useMemo(() => ({
    serverNode: ServerNode,
    fileNode: FileCanvasNode,
    groupNode: GroupCanvasNode,
  }), []);

  // Toggle server root /srv expansion on canvas
  const handleToggleServerSrv = useCallback((server: Server) => {
    setExpandedFolders((prev) => {
      const current = prev[server.id] || [];
      if (current.includes('__ROOT__')) {
        // Close entire tree on canvas
        const next = { ...prev };
        delete next[server.id];
        return next;
      } else {
        // Open root /srv
        return {
          ...prev,
          [server.id]: ['__ROOT__'],
        };
      }
    });
  }, []);

  // Toggle subfolder expansion on canvas
  const handleToggleFolderExpand = useCallback((serverId: string, folderPath: string) => {
    setExpandedFolders((prev) => {
      const current = prev[serverId] || ['__ROOT__'];
      let nextPaths: string[];
      if (current.includes(folderPath)) {
        // Collapse this folder and any sub-paths under it
        nextPaths = current.filter((p) => p !== folderPath && !p.startsWith(folderPath + '/'));
      } else {
        nextPaths = [...current, folderPath];
      }
      return {
        ...prev,
        [serverId]: nextPaths,
      };
    });
  }, []);

  // Delete a server from the local manager panel
  const handleDeleteServer = useCallback(async (server: Server) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${server.name}" (${server.host}) from your Server Manager panel?\n\nNote: This removes it from this local dashboard only. Nothing will be deleted from the remote server.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/servers/${server.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove server');
      }

      // Close drawers if this server was open
      if (inspectServer?.id === server.id) setInspectServer(null);
      if (terminalServer?.id === server.id) setTerminalServer(null);

      // Clean up expanded canvas folders
      setExpandedFolders((prev) => {
        const next = { ...prev };
        delete next[server.id];
        return next;
      });

      await fetchServers();
    } catch (err: any) {
      alert(`Error removing server: ${err.message}`);
    }
  }, [inspectServer, terminalServer]);

  // Change server product group
  const handleChangeServerGroup = useCallback(async (server: Server, newGroup: string) => {
    try {
      const res = await fetch(`${API_BASE}/servers/${server.id}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_group: newGroup }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update server group');
      }

      setServers((prev) =>
        prev.map((s) => (s.id === server.id ? { ...s, product_group: newGroup } : s))
      );

      // Keep inspectServer in sync if it is currently open in the details drawer
      setInspectServer((prev) =>
        prev && prev.id === server.id ? { ...prev, product_group: newGroup } : prev
      );
    } catch (err: any) {
      alert(`Error updating group: ${err.message}`);
    }
  }, []);

  // Delete an empty product group
  const handleDeleteGroup = useCallback(async (groupName: string) => {
    if (groupName === 'General') return;
    const confirmed = window.confirm(`Are you sure you want to remove the empty group "${groupName}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/groups/${encodeURIComponent(groupName)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove group');
      }

      setGroupsList((prev) => prev.filter((g) => g !== groupName));
      if (selectedGroup === groupName) {
        setSelectedGroup('ALL');
      }
      await fetchServers();
    } catch (err: any) {
      alert(`Error deleting group: ${err.message}`);
    }
  }, [selectedGroup, fetchServers]);

  // Connect & sync server (FIDO2 / ECDSA-SK hardware key support + Sudo Docker support)
  const handleSyncServer = useCallback(async (server: Server, explicitSudoPassword?: string) => {
    try {
      const sudoPassword = explicitSudoPassword || sessionPasswords[server.id];
      const res = await fetch(`${API_BASE}/servers/${server.id}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sudoPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.requiresTerminal) {
          // If no active SSH session exists, automatically launch terminal session for passphrase/key touch
          setPromptTerminalClose(true);
          setTerminalServer(server);
          return;
        }
        throw new Error(data.error || 'Connection failed');
      }

      // Check if docker permission was denied and we don't have a working sudo password yet
      if (data.dockerPermissionDenied) {
        setSudoPromptServer(server);
      }

      // Refresh state
      await fetchServers();
      setInspectServer((prev) => (prev && prev.id === server.id ? { ...prev, state: data.state, isMasterActive: true } : prev));
    } catch (err: any) {
      // If network or authentication error mentions terminal / key, launch terminal
      if (err.message && (err.message.includes('Authentication') || err.message.includes('Terminal') || err.message.includes('Permission denied'))) {
        setPromptTerminalClose(true);
        setTerminalServer(server);
      } else {
        alert(`Sync error: ${err.message}`);
      }
    }
  }, [sessionPasswords, fetchServers]);

  // Build canvas nodes & edges (including group bounding boxes, server nodes and step-by-step expanded /srv tree)
  const buildFlowElements = useCallback((
    serverList: Server[],
    expandedMap: Record<string, string[]>,
    activeFilterGroup: string,
    allKnownGroups: string[]
  ) => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // Filter servers if a specific product group tab is selected
    const visibleServers = activeFilterGroup === 'ALL'
      ? serverList
      : serverList.filter((s) => (s.product_group || 'General') === activeFilterGroup);

    // Group visible servers by product group
    const groups: Record<string, Server[]> = {};
    
    // Ensure all relevant groups are present in the map
    if (activeFilterGroup === 'ALL') {
      allKnownGroups.forEach((g) => {
        groups[g] = [];
      });
    } else {
      groups[activeFilterGroup] = [];
    }

    visibleServers.forEach((s) => {
      const g = s.product_group || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });

    // 1. Generate group dashed frames (GroupCanvasNode) for both populated and empty groups
    let emptyGroupOffsetIndex = 0;
    Object.entries(groups).forEach(([groupName, groupServers]) => {
      // If group has no servers (e.g. empty General or other empty custom groups)
      if (groupServers.length === 0) {
        // In ALL tab, only show empty groups if they exist or if specifically filtered
        const boxWidth = 380;
        const boxHeight = 240;
        
        // Find a suitable initial spot if not moved yet
        const colIndex = emptyGroupOffsetIndex++;
        const defaultBoxX = 80 + colIndex * 420;
        // Position below or alongside existing servers
        const maxServerY = serverList.length > 0 
          ? Math.max(...serverList.map(s => s.position_y)) + 300 
          : 80;
        const defaultBoxY = activeFilterGroup === 'ALL' ? maxServerY : 80;

        const pos = emptyGroupPositions[groupName] || { x: defaultBoxX, y: defaultBoxY };
        const groupColor = getGroupColor(groupName);

        flowNodes.push({
          id: `group:${groupName}`,
          type: 'groupNode',
          position: pos,
          selectable: true,
          draggable: true,
          dragHandle: '.group-drag-handle',
          zIndex: -1,
          data: {
            label: groupName,
            serverCount: 0,
            width: boxWidth,
            height: boxHeight,
            color: groupColor,
            onAddServer: (g: string) => {
              setModalInitialGroup(g);
              setShowAddServerModal(true);
            },
            onDeleteGroup: (g: string) => handleDeleteGroup(g),
          },
        });
        return;
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      groupServers.forEach((srv) => {
        minX = Math.min(minX, srv.position_x);
        minY = Math.min(minY, srv.position_y);
        // Server node width is ~336 (w-84), height is ~240
        maxX = Math.max(maxX, srv.position_x + 350);
        maxY = Math.max(maxY, srv.position_y + 250);

        // Account for expanded srv canvas tree extending to the right
        const exp = expandedMap[srv.id];
        if (exp && exp.includes('__ROOT__')) {
          maxX = Math.max(maxX, srv.position_x + 750);
        }
      });

      const padding = 30;
      const boxX = minX - padding;
      const boxY = minY - padding - 35; // extra room for header tag
      const boxWidth = (maxX - minX) + padding * 2;
      const boxHeight = (maxY - minY) + padding * 2 + 35;

      const groupColor = getGroupColor(groupName);

      // Group bounding box node (rendered behind servers with zIndex -1)
      flowNodes.push({
        id: `group:${groupName}`,
        type: 'groupNode',
        position: { x: boxX, y: boxY },
        selectable: true,
        draggable: true,
        dragHandle: '.group-drag-handle',
        zIndex: -1,
        data: {
          label: groupName,
          serverCount: groupServers.length,
          width: boxWidth,
          height: boxHeight,
          color: groupColor,
          onAddServer: (g: string) => {
            setModalInitialGroup(g);
            setShowAddServerModal(true);
          },
          onDeleteGroup: (g: string) => handleDeleteGroup(g),
        },
      });
    });

    // 2. Map each visible server
    visibleServers.forEach((srv) => {
      // Server node
      flowNodes.push({
        id: srv.id,
        type: 'serverNode',
        position: { x: srv.position_x, y: srv.position_y },
        data: {
          server: srv,
          onExplore: () => handleToggleServerSrv(srv),
          onOpenDrawer: (s: Server) => setInspectServer(s),
          onOpenTerminal: (s: Server) => setTerminalServer(s),
          onSync: async (s: Server) => handleSyncServer(s),
          onDelete: (s: Server) => handleDeleteServer(s),
          onChangeGroup: (s: Server, newGroup: string) => handleChangeServerGroup(s, newGroup),
          availableGroups: allKnownGroups,
        },
      });

      // Check if /srv tree is expanded on canvas for this server
      const expandedPaths = expandedMap[srv.id];
      if (expandedPaths && expandedPaths.includes('__ROOT__') && srv.state?.srvTree && srv.state.srvTree.length > 0) {
        const rootItems = srv.state.srvTree;
        const col1X = srv.position_x + 390; // Just to the right of the server node
        const startY = srv.position_y;
        const itemSpacingY = 70;

        // Recursive generator for child nodes and edges
        const renderTreeLevel = (
          items: FileNode[],
          parentId: string,
          parentSourceHandle: string | undefined,
          startX: number,
          baseY: number
        ): number => {
          let currentY = baseY;

          items.forEach((item) => {
            const nodeId = `${srv.id}:${item.path}`;
            const isDir = item.type === 'directory';
            const isExpanded = isDir && expandedPaths.includes(item.path);
            const hasChildren = isDir && Array.isArray(item.children) && item.children.length > 0;

            const itemY = currentY;

            flowNodes.push({
              id: nodeId,
              type: 'fileNode',
              position: { x: startX, y: itemY },
              data: {
                node: item,
                serverId: srv.id,
                isExpanded,
                hasChildren,
                onToggleExpand: (path: string) => handleToggleFolderExpand(srv.id, path),
                onOpenFile: (filePath: string) => handleOpenFile(srv, filePath),
              },
            });

            // Edge from parent to this node
            flowEdges.push({
              id: `edge:${parentId}->${nodeId}`,
              source: parentId,
              sourceHandle: parentSourceHandle,
              target: nodeId,
              animated: true,
              style: { stroke: isDir ? '#f59e0b' : '#27c93f', strokeWidth: 2 },
            });

            currentY += itemSpacingY;

            // If folder is expanded, render its children in next column
            if (isDir && isExpanded && item.children && item.children.length > 0) {
              const childEndY = renderTreeLevel(
                item.children,
                nodeId,
                undefined,
                startX + 280, // Step horizontally to the right
                itemY
              );
              if (childEndY > currentY) {
                currentY = childEndY;
              }
            }
          });

          return currentY;
        };

        renderTreeLevel(rootItems, srv.id, 'right-out', col1X, startY);
      }
    });

    return { flowNodes, flowEdges };
  }, [handleToggleServerSrv, handleToggleFolderExpand, handleDeleteServer, handleChangeServerGroup, handleDeleteGroup, handleSyncServer, emptyGroupPositions]);

  // Compute all unique known product groups (union of DB groups and servers)
  const allKnownGroups = useMemo(() => {
    const set = new Set<string>(groupsList.filter(g => g !== 'General'));
    servers.forEach((s) => {
      if (s.product_group) set.add(s.product_group);
    });
    // If no groups exist at all, fallback to General
    if (set.size === 0) set.add('General');
    return Array.from(set);
  }, [groupsList, servers]);

  // Update nodes and edges whenever servers, expandedFolders, selectedGroup or allKnownGroups change
  useEffect(() => {
    const { flowNodes, flowEdges } = buildFlowElements(servers, expandedFolders, selectedGroup, allKnownGroups);
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [servers, expandedFolders, selectedGroup, allKnownGroups, buildFlowElements, setNodes, setEdges]);

  useEffect(() => {
    fetchServers();
    fetchGroups();
  }, [fetchServers, fetchGroups]);

  // Handle creating a new empty product group
  const handleCreateGroup = async () => {
    const groupName = window.prompt('Enter new Product / Project Group name:');
    if (!groupName || !groupName.trim()) return;
    const cleanName = groupName.trim();

    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create group');
      }

      setGroupsList((prev) => Array.from(new Set([...prev, cleanName])));
      setSelectedGroup(cleanName);
    } catch (err: any) {
      alert(`Error creating group: ${err.message}`);
    }
  };

  // Auto-arrange servers neatly grouped by product
  const handleAutoArrange = async () => {
    const spacingY = 260;
    const groupSpacingX = 460;
    const startX = 80;
    const startY = 80;

    // Group servers by product group
    const groups: Record<string, Server[]> = {};
    servers.forEach((s) => {
      const g = s.product_group || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });

    const updated: Server[] = [];
    let groupIndex = 0;

    Object.entries(groups).forEach(([, groupServers]) => {
      const colX = startX + groupIndex * groupSpacingX;
      groupServers.forEach((srv, rowIdx) => {
        updated.push({
          ...srv,
          position_x: colX,
          position_y: startY + rowIdx * spacingY,
        });
      });
      groupIndex++;
    });

    setServers(updated);

    // Persist new positions to backend SQLite
    await Promise.all(
      updated.map((srv) =>
        fetch(`${API_BASE}/servers/${srv.id}/position`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: srv.position_x, y: srv.position_y }),
        }).catch(console.error)
      )
    );
  };

  // Handle node position drag end -> persist to SQLite DB
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      setNodes((nds) => {
        let updatedNds = applyNodeChanges(changes, nds);

        for (const change of changes) {
          if (change.type === 'position' && change.position && change.id) {
            // Case 1: Dragging a product group node -> shift all servers in this group by (dx, dy)
            if (change.id.startsWith('group:')) {
              const groupName = change.id.replace('group:', '');
              const oldGroupNode = nds.find((n) => n.id === change.id);

              if (oldGroupNode && oldGroupNode.position) {
                const dx = change.position.x - oldGroupNode.position.x;
                const dy = change.position.y - oldGroupNode.position.y;

                if (dx !== 0 || dy !== 0) {
                  // If group has no servers, persist position in emptyGroupPositions state
                  const groupServers = servers.filter((s) => (s.product_group || 'General') === groupName);
                  if (groupServers.length === 0) {
                    setEmptyGroupPositions((prev) => ({
                      ...prev,
                      [groupName]: { x: change.position!.x, y: change.position!.y },
                    }));
                  } else {
                    // Update servers belonging to this group
                    setServers((prevServers) => {
                      const nextServers = prevServers.map((s) => {
                        if ((s.product_group || 'General') === groupName) {
                          const newX = s.position_x + dx;
                          const newY = s.position_y + dy;

                          // Persist new position to SQLite backend
                          fetch(`${API_BASE}/servers/${s.id}/position`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ x: newX, y: newY }),
                          }).catch(console.error);

                          return {
                            ...s,
                            position_x: newX,
                            position_y: newY,
                          };
                        }
                        return s;
                      });
                      return nextServers;
                    });
                  }
                }
              }
            }
            // Case 2: Dragging a server node directly
            else if (!change.id.includes(':')) {
              fetch(`${API_BASE}/servers/${change.id}/position`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  x: change.position.x,
                  y: change.position.y,
                }),
              }).catch(console.error);

              // Update in local servers state
              setServers((prev) =>
                prev.map((s) =>
                  s.id === change.id
                    ? { ...s, position_x: change.position!.x, position_y: change.position!.y }
                    : s
                )
              );
            }
          }
        }

        return updatedNds;
      });
    },
    [setNodes, servers]
  );

  // Open file in Monaco Editor
  const handleOpenFile = async (server: Server, filePath: string) => {
    try {
      const password = sessionPasswords[server.id];
      const headers: Record<string, string> = {};
      if (password) headers['x-ssh-password'] = password;

      const res = await fetch(`${API_BASE}/servers/${server.id}/file?path=${encodeURIComponent(filePath)}`, {
        headers,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to read file');
        return;
      }

      setEditorState({
        server,
        filePath,
        content: data.content,
        source: data.source,
      });
    } catch (err: any) {
      alert(`Error opening file: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-term-bg text-term-text font-mono select-none overflow-hidden">
      
      {/* Top macOS Terminal Title Bar (exact match to user screenshot) */}
      <header className="h-11 bg-[#1e1e24] border-b-2 border-term-borderMuted px-4 flex items-center justify-between z-30 shadow-md">
        <div className="flex items-center space-x-3">
          {/* macOS window traffic light buttons */}
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm"></div>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm"></div>
          </div>

          {/* oh-my-zsh Apple theme prompt representation */}
          <div className="flex items-center space-x-2 pl-2 text-xs">
            <span className="text-term-apple font-bold text-sm"></span>
            <span className="text-gray-300 font-mono">~/drawops/</span>
            <span className="text-purple-400 font-bold font-mono">[master+]</span>
            <span className="text-term-green font-bold pl-1">draw.io canvas</span>
          </div>
        </div>

        {/* Center / Security Status */}
        <div className="hidden md:flex items-center space-x-3 text-[11px] text-gray-400">
          <div className="flex items-center space-x-1.5 bg-[#121214] px-3 py-1 rounded-full border border-term-green/40 text-term-green">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-semibold">Zero-Delete Policy Active</span>
          </div>
          <div className="flex items-center space-x-1 bg-[#121214] px-2.5 py-1 rounded-full border border-gray-800 text-gray-300">
            <span>Backup Folder:</span>
            <span className="text-term-cyan font-bold">/home</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAutoArrange}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#121214] hover:bg-gray-800 text-gray-300 border border-gray-700 rounded-xl text-xs transition"
            title="Auto-arrange servers neatly on canvas"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-term-cyan" />
            <span>Auto Layout</span>
          </button>

          <button
            onClick={() => fetchServers()}
            className="flex items-center space-x-1 px-3 py-1.5 bg-[#121214] hover:bg-gray-800 text-gray-300 border border-gray-700 rounded-xl text-xs transition"
            title="Reload servers and offline cache"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>

          <button
            onClick={() => setShowAddServerModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-term-green hover:bg-green-400 text-black font-bold text-xs rounded-xl transition shadow-term-glow"
          >
            <Plus className="w-4 h-4" />
            <span>Add Server</span>
          </button>
        </div>
      </header>

      {/* Chrome-style Product Group Tabs Bar */}
      <div className="h-10 bg-[#16161a] border-b border-gray-800 px-4 flex items-center space-x-1 overflow-x-auto z-20 select-none">
        <span className="text-[11px] text-gray-500 font-mono pr-2 flex items-center space-x-1 shrink-0">
          <Layers className="w-3.5 h-3.5 text-term-apple" />
          <span>GROUPS:</span>
        </span>

        {/* 'ALL' Tab */}
        <button
          onClick={() => setSelectedGroup('ALL')}
          className={`px-3 py-1.5 rounded-t-xl text-xs font-mono font-bold transition flex items-center space-x-1.5 shrink-0 border-t-2 ${
            selectedGroup === 'ALL'
              ? 'bg-[#1e1e24] text-term-green border-term-green shadow-sm'
              : 'bg-transparent text-gray-400 hover:text-gray-200 border-transparent hover:bg-white/5'
          }`}
        >
          <span>All Servers</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-800 text-gray-300">
            {servers.length}
          </span>
        </button>

        {/* Dynamic Product Group Tabs */}
        {allKnownGroups.map((group) => {
          const count = servers.filter((s) => (s.product_group || 'General') === group).length;
          const isActive = selectedGroup === group;
          const gColor = getGroupColor(group);

          return (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              style={
                isActive
                  ? {
                      borderColor: gColor,
                      color: gColor,
                    }
                  : undefined
              }
              className={`px-3 py-1.5 rounded-t-xl text-xs font-mono font-bold transition flex items-center space-x-1.5 shrink-0 border-t-2 ${
                isActive
                  ? 'bg-[#1e1e24] shadow-sm'
                  : 'bg-transparent text-gray-400 hover:text-gray-200 border-transparent hover:bg-white/5'
              }`}
            >
              <span>{group}</span>
              <span
                style={
                  isActive
                    ? {
                        backgroundColor: `${gColor}20`,
                        color: gColor,
                        borderColor: `${gColor}55`,
                      }
                    : undefined
                }
                className={`text-[10px] px-1.5 py-0.2 rounded-full border ${
                  isActive ? '' : 'bg-gray-800 text-gray-300 border-transparent'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        {/* Quick Add Group Button */}
        <button
          onClick={handleCreateGroup}
          className="px-2.5 py-1 text-[11px] font-mono text-gray-400 hover:text-term-green hover:bg-white/5 rounded-lg transition flex items-center space-x-1 shrink-0 ml-1 border border-dashed border-gray-700 hover:border-term-green/60 cursor-pointer"
          title="Create a new empty product group"
        >
          <Plus className="w-3 h-3" />
          <span>New Group</span>
        </button>
      </div>

      {/* Main Draw.io Canvas */}
      <main className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          className="bg-[#0f0f12]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="#27c93f22"
          />
          <Controls className="!bg-[#18181c] !border-term-green/50 !rounded-xl overflow-hidden" />
        </ReactFlow>

        {/* Empty state hint if no servers */}
        {servers.length === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="p-6 bg-term-card/90 border border-term-green/40 rounded-xl text-center space-y-3 pointer-events-auto shadow-term-glow">
              <ServerIcon className="w-10 h-10 text-term-green mx-auto" />
              <div className="text-sm font-bold text-white">No Servers Added Yet</div>
              <p className="text-xs text-gray-400 max-w-sm">
                Add your servers to render them as interactive terminal nodes on this canvas.
              </p>
              <button
                onClick={() => setShowAddServerModal(true)}
                className="px-4 py-2 bg-term-green text-black font-bold text-xs rounded hover:bg-green-400 transition"
              >
                Add Your First Server
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modals and Drawers */}

      {/* 1. Server /srv & Docker Details Drawer */}
      {inspectServer && (
        <ServerDetailsDrawer
          server={inspectServer}
          sudoPassword={sessionPasswords[inspectServer.id]}
          onClose={() => setInspectServer(null)}
          onOpenFile={(filePath) => handleOpenFile(inspectServer, filePath)}
          onCreateItem={(parentPath) => setCreateItemState({ server: inspectServer, parentPath })}
          onOpenTerminal={() => setTerminalServer(inspectServer)}
          onSync={() => handleSyncServer(inspectServer)}
          onRequestSudoDocker={() => setSudoPromptServer(inspectServer)}
          onOpenLogs={(container) => setDockerLogsState({ server: inspectServer, container })}
          onDeleteServer={(s) => handleDeleteServer(s)}
          onChangeGroup={(s, newGroup) => handleChangeServerGroup(s, newGroup)}
          availableGroups={allKnownGroups}
        />
      )}

      {/* Sudo Password Elevation Modal (RAM only) */}
      {sudoPromptServer && (
        <SudoPasswordModal
          serverName={sudoPromptServer.name}
          host={sudoPromptServer.host}
          initialPassword={sessionPasswords[sudoPromptServer.id] || ''}
          onClose={() => setSudoPromptServer(null)}
          onSubmit={async (enteredPassword) => {
            saveSessionPassword(sudoPromptServer.id, enteredPassword);
            const targetServer = sudoPromptServer;
            setSudoPromptServer(null);
            await handleSyncServer(targetServer, enteredPassword);
          }}
        />
      )}

      {/* Docker Container Logs Modal */}
      {dockerLogsState && (
        <DockerLogsModal
          server={dockerLogsState.server}
          container={dockerLogsState.container}
          sudoPassword={sessionPasswords[dockerLogsState.server.id]}
          onClose={() => setDockerLogsState(null)}
        />
      )}

      {/* 2. Monaco Editor (VS Code Web) Modal */}
      {editorState && (
        <MonacoEditorModal
          serverId={editorState.server.id}
          serverName={editorState.server.name}
          filePath={editorState.filePath}
          initialContent={editorState.content}
          source={editorState.source}
          savedPassword={sessionPasswords[editorState.server.id]}
          onClose={() => setEditorState(null)}
          onSaved={(backupPath) => {
            console.log(`Saved and backed up to ${backupPath}`);
          }}
        />
      )}

      {/* 3. Interactive SSH Terminal Drawer (xterm.js) */}
      {terminalServer && (
        <TerminalDrawer
          server={terminalServer}
          promptCloseOnSync={promptTerminalClose}
          onClose={() => {
            setTerminalServer(null);
            setPromptTerminalClose(false);
            fetchServers();
          }}
          onConnected={() => {
            fetchServers();
          }}
          onMasterReady={() => {
            // Once hardware key touch/authentication is confirmed, immediately sync /srv & Docker!
            if (terminalServer) {
              handleSyncServer(terminalServer);
            }
          }}
        />
      )}

      {/* 4. Add Server Modal */}
      {showAddServerModal && (
        <AddServerModal
          onClose={() => setShowAddServerModal(false)}
          initialGroup={modalInitialGroup !== 'General' ? modalInitialGroup : (selectedGroup !== 'ALL' ? selectedGroup : 'General')}
          availableGroups={allKnownGroups}
          onAdded={async (newServer) => {
            await fetchServers();
            // Automatically launch terminal session so the user is prompted for private key passphrase & hardware key touch
            setTerminalServer(newServer);
          }}
        />
      )}

      {/* 5. Create Item (/srv) Modal */}
      {createItemState && (
        <NewItemModal
          serverId={createItemState.server.id}
          parentPath={createItemState.parentPath}
          savedPassword={sessionPasswords[createItemState.server.id]}
          onClose={() => setCreateItemState(null)}
          onCreated={() => {
            fetchServers();
            if (inspectServer) {
              handleSyncServer(inspectServer);
            }
          }}
        />
      )}
    </div>
  );
}
