import { spawn, exec } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { promisify } from 'node:util';
import { SecurityGuardian } from './securityGuardian.js';
import { db } from './db.js';
import { WebSocket } from 'ws';

const execAsync = promisify(exec);

export interface SSHConfig {
  id?: string;
  host: string;
  port?: number;
  username: string;
  password?: string;
}

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

export class SSHService {
  private static SOCKET_DIR = path.join(os.homedir(), '.ssh', 'sockets');

  private static ensureSocketDir(): void {
    if (!fs.existsSync(this.SOCKET_DIR)) {
      fs.mkdirSync(this.SOCKET_DIR, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Helper to format SSH target string (e.g. "deploy@web-prod" or just "web-prod")
   */
  public static getTarget(config: SSHConfig): string {
    if (config.host.includes('@')) {
      return config.host;
    }
    if (config.username && config.username !== 'root') {
      return `${config.username}@${config.host}`;
    }
    return config.host;
  }

  /**
   * Check if an active ControlMaster socket is currently alive
   */
  public static async isMasterActive(config: SSHConfig): Promise<boolean> {
    this.ensureSocketDir();
    const target = this.getTarget(config);
    const portArg = config.port && config.port !== 22 ? `-p ${config.port}` : '';
    const checkCmd = `ssh -O check -o ControlPath="${this.SOCKET_DIR}/%r@%h:%p" ${portArg} "${target}" 2>&1`;
    try {
      const { stdout, stderr } = await execAsync(checkCmd);
      const combined = (stdout + stderr).toLowerCase();
      return combined.includes('master running');
    } catch {
      return false;
    }
  }

  /**
   * Safe native OpenSSH command execution (re-using ControlMaster socket)
   */
  public static async execCommand(config: SSHConfig, cmd: string): Promise<string> {
    SecurityGuardian.assertNoDelete(cmd);
    this.ensureSocketDir();

    const target = this.getTarget(config);
    const portArg = config.port && config.port !== 22 ? `-p ${config.port}` : '';
    const sshArgs = [
      '-o', 'ControlMaster=auto',
      '-o', `ControlPath=${this.SOCKET_DIR}/%r@%h:%p`,
      '-o', 'ControlPersist=10m',
      '-o', 'BatchMode=yes', // Fail fast if hardware touch / passphrase not yet active
    ];

    if (config.port && config.port !== 22) {
      sshArgs.push('-p', String(config.port));
    }

    sshArgs.push(target, cmd);

    return new Promise((resolve, reject) => {
      const proc = spawn('ssh', sshArgs);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => {
        stdout += d.toString();
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          if (stderr.includes('Permission denied') || stderr.includes('publickey') || stderr.includes('BatchMode')) {
            return reject(
              new Error(
                `SSH Authentication required for ${target}. Please launch the Terminal to touch your hardware key or enter passphrase.`
              )
            );
          }
          return reject(new Error(stderr.trim() || `Command failed with code ${code}`));
        }
        resolve(stdout);
      });
    });
  }

  /**
   * Scan /srv recursively and Docker containers
   */
  public static async scanServer(
    serverId: string,
    config: SSHConfig,
    sudoPassword?: string
  ): Promise<{
    srvTree: FileNode[];
    dockerContainers: DockerContainer[];
    dockerPermissionDenied?: boolean;
  }> {
    // 0. Ensure SSH connection / ControlMaster is alive
    const isMaster = await this.isMasterActive(config);
    if (!isMaster) {
      // Test a quick batch command to see if ssh keys without master can connect immediately
      try {
        await this.execCommand(config, 'echo 1');
      } catch (err: any) {
        throw new Error(
          `SSH Authentication required for ${this.getTarget(config)}. Please launch the Terminal to touch your hardware key or enter passphrase.`
        );
      }
    }

    // 1. Scan Docker containers
    let dockerContainers: DockerContainer[] = [];
    let dockerPermissionDenied = false;

    const parseDockerOutput = (rawOutput: string) => {
      return rawOutput
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          try {
            const parsed = JSON.parse(l.trim());
            const isRunning = parsed.status.toLowerCase().startsWith('up');
            return {
              ...parsed,
              state: isRunning ? 'running' : 'exited',
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as DockerContainer[];
    };

    const dockerFormatCmd = `docker ps -a --format '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","ports":"{{.Ports}}"}'`;

    try {
      const dockerOut = await this.execCommand(config, dockerFormatCmd);
      dockerContainers = parseDockerOutput(dockerOut);
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      const isPermissionDenied = errMsg.includes('permission denied') || errMsg.includes('docker.sock');

      if (isPermissionDenied) {
        dockerPermissionDenied = true;
        if (sudoPassword) {
          try {
            const sudoDockerCmd = `echo '${sudoPassword.replace(/'/g, "'\\''")}' | sudo -S ${dockerFormatCmd}`;
            const sudoOut = await this.execCommand(config, sudoDockerCmd);
            dockerContainers = parseDockerOutput(sudoOut);
            dockerPermissionDenied = false; // Successfully retrieved with sudo!
          } catch (sudoErr: any) {
            console.warn(`[SSH Scan] Docker sudo scan failed on ${config.host}: ${sudoErr.message}`);
          }
        } else {
          console.warn(`[SSH Scan] Docker permission denied on ${config.host}. Sudo password required.`);
        }
      } else {
        console.warn(`[SSH Scan] Docker scan notice on ${config.host}: ${err.message}`);
      }
    }

    // 2. Scan /srv tree recursively
    const treeScanCmd = `
      python3 -c "
import os, json

def scan_dir(path, depth=0, max_depth=6):
    if depth > max_depth or not os.path.exists(path):
        return []
    items = []
    try:
        entries = sorted(os.scandir(path), key=lambda e: (not e.is_dir(), e.name.lower()))
        for entry in entries:
            try:
                stat = entry.stat()
                is_dir = entry.is_dir()
                node = {
                    'name': entry.name,
                    'path': entry.path,
                    'type': 'directory' if is_dir else 'file',
                    'size': stat.st_size if not is_dir else 0,
                    'updatedAt': int(stat.st_mtime * 1000)
                }
                if is_dir:
                    node['children'] = scan_dir(entry.path, depth + 1, max_depth)
                items.append(node)
            except Exception:
                continue
    except Exception:
        pass
    return items

print(json.dumps(scan_dir('/srv')) if os.path.exists('/srv') else '[]')
" 2>/dev/null || find /srv -maxdepth 5 2>/dev/null
    `;

    let srvTree: FileNode[] = [];
    try {
      const treeOut = await this.execCommand(config, treeScanCmd);
      const trimmed = treeOut.trim();
      if (trimmed.startsWith('[')) {
        srvTree = JSON.parse(trimmed);
      } else {
        srvTree = this.parseFindOutput(trimmed);
      }
    } catch (err: any) {
      console.warn(`[SSH Scan] /srv scan notice on ${config.host}: ${err.message}`);
    }

    // Update server state in SQLite DB
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO server_state (server_id, srv_tree, docker_containers, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(server_id) DO UPDATE SET
        srv_tree = excluded.srv_tree,
        docker_containers = excluded.docker_containers,
        updated_at = excluded.updated_at
    `).run(serverId, JSON.stringify(srvTree), JSON.stringify(dockerContainers), now);

    db.prepare(`
      UPDATE servers SET status = 'online', last_connected = ? WHERE id = ?
    `).run(now, serverId);

    return { srvTree, dockerContainers, dockerPermissionDenied };
  }

  private static parseFindOutput(rawLines: string): FileNode[] {
    const lines = rawLines.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('/srv') && l !== '/srv');
    const rootNodes: FileNode[] = [];
    const map = new Map<string, FileNode>();

    for (const p of lines) {
      const parts = p.split('/').filter(Boolean);
      const name = parts[parts.length - 1];
      const isLikelyDir = !name.includes('.');
      const node: FileNode = {
        name,
        path: p,
        type: isLikelyDir ? 'directory' : 'file',
        children: isLikelyDir ? [] : undefined,
      };
      map.set(p, node);

      const parentPath = '/' + parts.slice(0, -1).join('/');
      if (map.has(parentPath)) {
        map.get(parentPath)!.children?.push(node);
      } else {
        rootNodes.push(node);
      }
    }
    return rootNodes;
  }

  /**
   * Read file content safely and cache in SQLite
   */
  public static async readFile(serverId: string, config: SSHConfig, filePath: string): Promise<string> {
    SecurityGuardian.sanitizePath(filePath);
    SecurityGuardian.assertNoDelete(filePath);

    // Read base64 to avoid corrupting binary or special UTF-8 characters
    const stdout = await this.execCommand(config, `base64 < "${filePath}"`);
    const content = Buffer.from(stdout.replace(/\s+/g, ''), 'base64').toString('utf-8');

    // Cache in SQLite
    const id = `${serverId}:${filePath}`;
    const ext = filePath.split('.').pop() || 'txt';
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO file_cache (id, server_id, file_path, content, language, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(server_id, file_path) DO UPDATE SET
        content = excluded.content,
        updated_at = excluded.updated_at
    `).run(id, serverId, filePath, content, ext, now);

    return content;
  }

  /**
   * Write file with MANDATORY /home BACKUP before saving
   */
  public static async writeFileWithBackup(
    serverId: string,
    config: SSHConfig,
    filePath: string,
    newContent: string,
    sudoPassword?: string
  ): Promise<{ backupPath: string }> {
    SecurityGuardian.sanitizePath(filePath);
    SecurityGuardian.assertNoDelete(filePath);

    // 1. Back up original file if exists
    let originalContent: string | null = null;
    try {
      originalContent = await this.readFile(serverId, config, filePath);
    } catch {
      // New file
    }

    let backupPath = '';
    if (originalContent !== null) {
      backupPath = SecurityGuardian.generateBackupPath(config.username || 'root', filePath);
      const backupDir = backupPath.substring(0, backupPath.lastIndexOf('/'));

      // Create backup directory
      await this.execCommand(config, `mkdir -p "${backupDir}"`);

      // Write backup copy
      const backupB64 = Buffer.from(originalContent).toString('base64');
      await this.execCommand(config, `echo "${backupB64}" | base64 -d > "${backupPath}"`);

      // Log in SQLite
      const backupId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      db.prepare(`
        INSERT INTO backup_logs (id, server_id, original_path, backup_path, timestamp, status)
        VALUES (?, ?, ?, ?, ?, 'success')
      `).run(backupId, serverId, filePath, backupPath, new Date().toISOString());

      console.log(`[BACKUP CREATED] ${filePath} -> ${backupPath}`);
    }

    // 2. Write new content
    const contentB64 = Buffer.from(newContent).toString('base64');
    try {
      await this.execCommand(config, `echo "${contentB64}" | base64 -d > "${filePath}"`);
    } catch (err: any) {
      if (sudoPassword) {
        await this.execCommand(
          config,
          `echo '${sudoPassword}' | sudo -S sh -c 'echo "${contentB64}" | base64 -d > "${filePath}"'`
        );
      } else {
        throw new Error(`Permission denied writing to ${filePath}. Sudo password required.`);
      }
    }

    // Update SQLite cache
    const id = `${serverId}:${filePath}`;
    const ext = filePath.split('.').pop() || 'txt';
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO file_cache (id, server_id, file_path, content, language, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(server_id, file_path) DO UPDATE SET
        content = excluded.content,
        updated_at = excluded.updated_at
    `).run(id, serverId, filePath, newContent, ext, now);

    return { backupPath };
  }

  /**
   * Scan Docker containers for a specific folder using `docker compose ps`
   */
  public static async getComposeContainers(
    config: SSHConfig,
    dirPath: string,
    sudoPassword?: string
  ): Promise<{
    containers: DockerContainer[];
    hasCompose: boolean;
    dockerPermissionDenied?: boolean;
    error?: string;
  }> {
    SecurityGuardian.sanitizePath(dirPath);
    SecurityGuardian.assertNoDelete(dirPath);

    const parseDockerOutput = (rawOutput: string) => {
      return rawOutput
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          try {
            const parsed = JSON.parse(l.trim());
            const isRunning = (parsed.status || '').toLowerCase().startsWith('up');
            return {
              id: parsed.id || parsed.ID || '',
              name: parsed.name || parsed.Name || parsed.Names || '',
              image: parsed.image || parsed.Image || '',
              status: parsed.status || parsed.Status || '',
              ports: parsed.ports || parsed.Ports || '',
              state: isRunning ? 'running' : 'exited',
            } as DockerContainer;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as DockerContainer[];
    };

    // First check if docker-compose.yml or compose.yml exists in the directory
    const checkFileCmd = `(test -f "${dirPath}/docker-compose.yml" || test -f "${dirPath}/docker-compose.yaml" || test -f "${dirPath}/compose.yml" || test -f "${dirPath}/compose.yaml") && echo 1 || echo 0`;
    let hasCompose = false;
    try {
      const checkOut = await this.execCommand(config, checkFileCmd);
      hasCompose = checkOut.trim() === '1';
    } catch {
      hasCompose = false;
    }

    if (!hasCompose) {
      return { containers: [], hasCompose: false };
    }

    const composeCmd = `cd "${dirPath}" && docker compose ps -a --format '{"id":"{{.ID}}","name":"{{.Name}}","image":"{{.Image}}","status":"{{.Status}}","ports":"{{.Ports}}"}' 2>&1 || (cd "${dirPath}" && docker-compose ps -a 2>&1)`;

    try {
      const out = await this.execCommand(config, composeCmd);
      const trimmed = out.trim();
      if (trimmed.startsWith('{')) {
        const containers = parseDockerOutput(trimmed);
        return { containers, hasCompose: true };
      }
      return { containers: [], hasCompose: true };
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      const isPermissionDenied = errMsg.includes('permission denied') || errMsg.includes('docker.sock');

      if (isPermissionDenied) {
        if (sudoPassword) {
          try {
            const sudoComposeCmd = `echo '${sudoPassword.replace(/'/g, "'\\''")}' | sudo -S sh -c 'cd "${dirPath}" && (docker compose ps -a --format \\'{"id":"{{.ID}}","name":"{{.Name}}","image":"{{.Image}}","status":"{{.Status}}","ports":"{{.Ports}}"}\\' 2>/dev/null || docker-compose ps -a 2>/dev/null)'`;
            const sudoOut = await this.execCommand(config, sudoComposeCmd);
            const containers = parseDockerOutput(sudoOut.trim());
            return { containers, hasCompose: true };
          } catch (sudoErr: any) {
            return { containers: [], hasCompose: true, error: sudoErr.message };
          }
        }
        return { containers: [], hasCompose: true, dockerPermissionDenied: true };
      }

      return { containers: [], hasCompose: true, error: err.message };
    }
  }

  /**
   * Fetch logs for a specific Docker container
   */
  public static async getContainerLogs(
    config: SSHConfig,
    containerId: string,
    tailLines = 250,
    sudoPassword?: string
  ): Promise<{ logs: string; dockerPermissionDenied?: boolean }> {
    // Sanitize containerId (only alphanumeric, dashes, underscores)
    const cleanId = containerId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId) {
      throw new Error('Invalid container ID');
    }

    const logCmd = `docker logs --tail ${tailLines} "${cleanId}" 2>&1`;
    try {
      const logs = await this.execCommand(config, logCmd);
      return { logs };
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      const isPermissionDenied = errMsg.includes('permission denied') || errMsg.includes('docker.sock');

      if (isPermissionDenied) {
        if (sudoPassword) {
          const sudoCmd = `echo '${sudoPassword.replace(/'/g, "'\\''")}' | sudo -S docker logs --tail ${tailLines} "${cleanId}" 2>&1`;
          const logs = await this.execCommand(config, sudoCmd);
          return { logs };
        }
        return { logs: '', dockerPermissionDenied: true };
      }
      return { logs: `Error fetching logs: ${err.message}` };
    }
  }

  /**
   * Create new item in /srv
   */
  public static async createItem(
    config: SSHConfig,
    targetPath: string,
    type: 'file' | 'directory',
    sudoPassword?: string
  ): Promise<void> {
    SecurityGuardian.sanitizePath(targetPath);
    SecurityGuardian.assertNoDelete(targetPath);

    const baseCmd = type === 'directory' ? `mkdir -p "${targetPath}"` : `touch "${targetPath}"`;
    try {
      await this.execCommand(config, baseCmd);
    } catch (err) {
      if (sudoPassword) {
        await this.execCommand(config, `echo '${sudoPassword}' | sudo -S ${baseCmd}`);
      } else {
        throw new Error(`Permission denied creating ${type}. Sudo password required.`);
      }
    }
  }

  /**
   * Attach native OpenSSH session to WebSocket with unbuffered Python PTY bridge
   * Supports ECDSA-SK hardware keys, passphrase, and ~/.ssh/config aliases!
   */
  public static attachTerminal(ws: WebSocket, config: SSHConfig): void {
    this.ensureSocketDir();
    const target = this.getTarget(config);
    const bridgePath = path.resolve(process.cwd(), 'src', 'pty_bridge.py');

    const sshArgs = [
      '-u',
      bridgePath,
      'ssh',
      '-o', 'ControlMaster=auto',
      '-o', `ControlPath=${this.SOCKET_DIR}/%r@%h:%p`,
      '-o', 'ControlPersist=10m',
    ];

    if (config.port && config.port !== 22) {
      sshArgs.push('-p', String(config.port));
    }

    sshArgs.push(target);

    const proc = spawn('python3', sshArgs, {
      cwd: process.env.HOME || process.cwd(),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        TERM: 'xterm-256color',
        COLUMNS: '80',
        LINES: '24',
      },
    });

    ws.send(JSON.stringify({ type: 'connected', message: `Launching OpenSSH session for ${target}...` }));

    proc.stdout.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data: data.toString('utf-8') }));
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data: data.toString('utf-8') }));
      }
    });

    // Monitor ControlMaster socket creation in background so the frontend can immediately trigger sync
    let socketCheckInterval: NodeJS.Timeout | null = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) {
        if (socketCheckInterval) clearInterval(socketCheckInterval);
        return;
      }
      const active = await SSHService.isMasterActive(config);
      if (active) {
        if (socketCheckInterval) {
          clearInterval(socketCheckInterval);
          socketCheckInterval = null;
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'master_ready', message: 'SSH ControlMaster multiplex socket established' }));
        }
      }
    }, 1000);

    proc.on('close', () => {
      if (socketCheckInterval) {
        clearInterval(socketCheckInterval);
        socketCheckInterval = null;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'disconnected' }));
        ws.close();
      }
    });

    ws.on('message', (msg: string) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'input') {
          proc.stdin.write(parsed.data);
        } else if (parsed.type === 'resize') {
          // Send resize control packet to pty_bridge
          proc.stdin.write(`__RESIZE__:${parsed.rows || 24}:${parsed.cols || 80}\n`);
        }
      } catch {
        proc.stdin.write(msg.toString());
      }
    });

    ws.on('close', () => {
      if (socketCheckInterval) {
        clearInterval(socketCheckInterval);
        socketCheckInterval = null;
      }
      try {
        proc.kill('SIGHUP');
      } catch {
        // Process already terminated
      }
    });
  }
}
