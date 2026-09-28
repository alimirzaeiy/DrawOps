import { Router, Request, Response } from 'express';
import { db } from './db.js';
import { SSHService } from './sshService.js';
import { SSHConfigService } from './sshConfigService.js';
import { SecurityGuardian } from './securityGuardian.js';

export const router = Router();

// GET all available hosts from ~/.ssh/config and ~/.ssh/config.d/*/*
router.get('/ssh/hosts', (req: Request, res: Response) => {
  try {
    const hosts = SSHConfigService.getAvailableHosts();
    res.json({ success: true, hosts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET resolve a specific host alias
router.get('/ssh/resolve', async (req: Request, res: Response) => {
  try {
    const alias = req.query.alias as string;
    if (!alias) {
      return res.status(400).json({ success: false, error: 'Alias is required' });
    }
    const resolved = await SSHConfigService.resolveHost(alias);
    res.json({ success: true, config: resolved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all product groups (merging explicitly saved groups with groups from servers)
router.get('/groups', (req: Request, res: Response) => {
  try {
    const savedGroups = db.prepare('SELECT name FROM product_groups ORDER BY created_at ASC').all() as any[];
    const serverGroups = db.prepare('SELECT DISTINCT product_group FROM servers').all() as any[];

    const groupSet = new Set<string>();
    groupSet.add('General');
    savedGroups.forEach((g) => {
      if (g.name) groupSet.add(g.name);
    });
    serverGroups.forEach((g) => {
      if (g.product_group) groupSet.add(g.product_group);
    });

    res.json({ success: true, groups: Array.from(groupSet) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create a new empty product group
router.post('/groups', (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Group name is required' });
    }
    const cleanName = name.trim();
    const now = new Date().toISOString();
    db.prepare('INSERT OR IGNORE INTO product_groups (name, created_at) VALUES (?, ?)').run(cleanName, now);
    res.json({ success: true, group: cleanName });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE remove an empty product group from the local manager
router.delete('/groups/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    if (name === 'General') {
      return res.status(400).json({ success: false, error: 'Cannot remove default General group' });
    }
    // Delete from product_groups table
    db.prepare('DELETE FROM product_groups WHERE name = ?').run(name);
    // Move any existing servers in this group to 'General'
    db.prepare('UPDATE servers SET product_group = ? WHERE product_group = ?').run('General', name);
    res.json({ success: true, message: `Group "${name}" removed` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all servers with cached state
router.get('/servers', async (req: Request, res: Response) => {
  try {
    const servers = db.prepare('SELECT * FROM servers ORDER BY created_at ASC').all() as any[];
    const result = await Promise.all(
      servers.map(async (server) => {
        const state = db.prepare('SELECT * FROM server_state WHERE server_id = ?').get(server.id) as any;
        const isMaster = await SSHService.isMasterActive({
          host: server.host,
          username: server.username,
          port: server.port,
        });

        return {
          ...server,
          isMasterActive: isMaster,
          status: isMaster ? 'online' : server.status,
          state: state
            ? {
                srvTree: JSON.parse(state.srv_tree || '[]'),
                dockerContainers: JSON.parse(state.docker_containers || '[]'),
                updatedAt: state.updated_at,
              }
            : null,
        };
      })
    );
    res.json({ success: true, servers: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST add a new server (supports ~/.ssh/config alias)
router.post('/servers', async (req: Request, res: Response) => {
  try {
    let { name, host, port = 22, username = 'root', position_x = 150, position_y = 150, product_group = 'General' } = req.body;
    if (!host) {
      return res.status(400).json({ success: false, error: 'Host or SSH Alias is required' });
    }

    // Try resolving from ~/.ssh/config if not manually overridden
    try {
      const resolved = await SSHConfigService.resolveHost(host);
      if (!name) name = host;
      if (!req.body.username && resolved.user) username = resolved.user;
      if (!req.body.port && resolved.port) port = resolved.port;
    } catch {
      if (!name) name = host;
    }

    // Calculate auto-arranged position if default or not provided
    if (!req.body.position_x || !req.body.position_y) {
      const serverCountRow = db.prepare('SELECT COUNT(*) as count FROM servers').get() as { count: number };
      const index = serverCountRow?.count || 0;
      // Arrange vertically in a clean column with generous spacing for tree expansion
      position_x = 80;
      position_y = 60 + index * 270;
    }

    const id = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO servers (id, name, host, port, username, auth_type, position_x, position_y, status, product_group, created_at)
      VALUES (?, ?, ?, ?, ?, 'hardware_key', ?, ?, 'offline', ?, ?)
    `).run(id, name, host, port, username, position_x, position_y, product_group || 'General', now);

    const newServer = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as any;

    res.json({
      success: true,
      serverId: id,
      server: {
        ...newServer,
        isMasterActive: false,
        state: null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update server product group
router.put('/servers/:id/group', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { product_group } = req.body;
    db.prepare('UPDATE servers SET product_group = ? WHERE id = ?').run(product_group || 'General', id);
    res.json({ success: true, message: 'Server group updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE remove a server from the local manager panel
router.delete('/servers/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM server_state WHERE server_id = ?').run(id);
    db.prepare('DELETE FROM file_cache WHERE server_id = ?').run(id);
    db.prepare('DELETE FROM backup_logs WHERE server_id = ?').run(id);
    db.prepare('DELETE FROM servers WHERE id = ?').run(id);
    res.json({ success: true, message: 'Server removed from panel' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update server node position on canvas
router.put('/servers/:id/position', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { x, y } = req.body;
    db.prepare('UPDATE servers SET position_x = ?, position_y = ? WHERE id = ?').run(x, y, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST connect & sync server (/srv + Docker)
router.post('/servers/:id/connect', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sudoPassword = (req.body?.sudoPassword as string) || (req.headers['x-sudo-password'] as string) || undefined;
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as any;
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const scanResult = await SSHService.scanServer(
      id,
      {
        id,
        host: server.host,
        port: server.port,
        username: server.username,
      },
      sudoPassword
    );

    res.json({
      success: true,
      message: `Successfully connected to ${server.name} and synced state`,
      dockerPermissionDenied: scanResult.dockerPermissionDenied || false,
      state: {
        srvTree: scanResult.srvTree,
        dockerContainers: scanResult.dockerContainers,
        dockerPermissionDenied: scanResult.dockerPermissionDenied || false,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      requiresTerminal: err.message.includes('Authentication required') || err.message.includes('Permission denied'),
    });
  }
});

// GET file content (live via OpenSSH or cached in SQLite)
router.get('/servers/:id/file', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'File path required' });
    }

    SecurityGuardian.sanitizePath(filePath);
    SecurityGuardian.assertNoDelete(filePath);

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as any;
    if (server) {
      try {
        const content = await SSHService.readFile(id, {
          host: server.host,
          port: server.port,
          username: server.username,
        }, filePath);
        return res.json({ success: true, content, source: 'live' });
      } catch (sshErr: any) {
        console.warn(`[File Read] Live read error, falling back to cache: ${sshErr.message}`);
      }
    }

    // Fallback to SQLite cached content
    const cached = db.prepare('SELECT * FROM file_cache WHERE server_id = ? AND file_path = ?').get(id, filePath) as any;
    if (cached) {
      return res.json({ success: true, content: cached.content, source: 'cached', updatedAt: cached.updated_at });
    }

    res.status(404).json({
      success: false,
      error: 'File not found in local cache. Launch the terminal to authenticate and fetch this file.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST save file content with MANDATORY /home BACKUP
router.post('/servers/:id/file', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { filePath, content, sudoPassword } = req.body;

    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: 'File path and content are required' });
    }

    SecurityGuardian.sanitizePath(filePath);
    SecurityGuardian.assertNoDelete(filePath);

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as any;
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const { backupPath } = await SSHService.writeFileWithBackup(
      id,
      {
        host: server.host,
        port: server.port,
        username: server.username,
      },
      filePath,
      content,
      sudoPassword
    );

    res.json({
      success: true,
      message: 'File saved successfully with backup created in /home',
      backupPath,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create new item in /srv
router.post('/servers/:id/create', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetPath, type, sudoPassword } = req.body;

    if (!targetPath || !type) {
      return res.status(400).json({ success: false, error: 'Target path and type are required' });
    }

    SecurityGuardian.sanitizePath(targetPath);
    SecurityGuardian.assertNoDelete(targetPath);

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as any;
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    await SSHService.createItem(
      {
        host: server.host,
        port: server.port,
        username: server.username,
      },
      targetPath,
      type,
      sudoPassword
    );

    res.json({ success: true, message: `${type === 'directory' ? 'Directory' : 'File'} created successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET backups list for a server
router.get('/servers/:id/backups', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const backups = db.prepare('SELECT * FROM backup_logs WHERE server_id = ? ORDER BY timestamp DESC').all(id);
    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET docker compose containers for a specific folder
router.get('/servers/:id/docker/compose', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dirPath = (req.query.path as string) || '/srv';
    const sudoPassword = (req.headers['x-sudo-password'] as string) || (req.query.sudoPassword as string) || undefined;

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as any;
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const result = await SSHService.getComposeContainers(
      {
        host: server.host,
        port: server.port,
        username: server.username,
      },
      dirPath,
      sudoPassword
    );

    res.json({
      success: true,
      dirPath,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET container logs
router.get('/servers/:id/docker/containers/:containerId/logs', async (req: Request, res: Response) => {
  try {
    const { id, containerId } = req.params;
    const tailLines = req.query.tail ? parseInt(req.query.tail as string, 10) : 250;
    const sudoPassword = (req.headers['x-sudo-password'] as string) || (req.query.sudoPassword as string) || undefined;

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as any;
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const result = await SSHService.getContainerLogs(
      {
        host: server.host,
        port: server.port,
        username: server.username,
      },
      containerId,
      tailLines,
      sudoPassword
    );

    res.json({
      success: true,
      containerId,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
