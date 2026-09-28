export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: number;
  children?: FileNode[];
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  state: 'running' | 'exited' | 'restarting' | 'unknown';
}

export interface ServerState {
  srvTree: FileNode[];
  dockerContainers: DockerContainer[];
  dockerPermissionDenied?: boolean;
  updatedAt: string;
}

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: string;
  position_x: number;
  position_y: number;
  last_connected?: string;
  status: 'online' | 'offline' | 'cached';
  product_group?: string;
  created_at: string;
  isMasterActive?: boolean;
  state?: ServerState | null;
}

export interface BackupLog {
  id: string;
  server_id: string;
  original_path: string;
  backup_path: string;
  timestamp: string;
  status: string;
}
