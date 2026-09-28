import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface SSHHostConfig {
  alias: string;
  hostName?: string;
  user?: string;
  port?: number;
  identityFile?: string;
}

export class SSHConfigService {
  /**
   * Scan ~/.ssh/config and included config files to extract all host aliases
   */
  public static getAvailableHosts(): string[] {
    const home = os.homedir();
    const configPaths = [
      path.join(home, '.ssh', 'config'),
    ];

    // Find any files in ~/.ssh/config.d
    const configD = path.join(home, '.ssh', 'config.d');
    if (fs.existsSync(configD)) {
      this.collectFilesRecursively(configD, configPaths);
    }

    const seen = new Set<string>();
    const hosts: string[] = [];

    for (const cfg of configPaths) {
      if (fs.existsSync(cfg) && fs.statSync(cfg).isFile()) {
        try {
          const content = fs.readFileSync(cfg, 'utf-8');
          const lines = content.split('\n');
          for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;
            if (line.startsWith('Host ')) {
              const raw = line.substring(5).split('#')[0].split('//')[0];
              const parts = raw.split(/\s+/);
              for (const p of parts) {
                const h = p.trim();
                if (h && !h.includes('*') && !h.includes('?') && !seen.has(h)) {
                  seen.add(h);
                  hosts.push(h);
                }
              }
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    return hosts.sort((a, b) => a.localeCompare(b));
  }

  private static collectFilesRecursively(dir: string, list: string[]): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.collectFilesRecursively(fullPath, list);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          list.push(fullPath);
        }
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Resolve effective SSH configuration for a given host alias using ssh -G
   */
  public static async resolveHost(alias: string): Promise<SSHHostConfig> {
    try {
      const { stdout } = await execAsync(`ssh -G "${alias}"`, { timeout: 3000 });
      const lines = stdout.split('\n');
      const conf: Record<string, string> = {};
      for (const line of lines) {
        const [k, ...v] = line.trim().split(' ');
        if (k) conf[k.toLowerCase()] = v.join(' ');
      }

      return {
        alias,
        hostName: conf['hostname'] || alias,
        user: conf['user'] || 'root',
        port: conf['port'] ? parseInt(conf['port'], 10) : 22,
        identityFile: conf['identityfile'],
      };
    } catch {
      return {
        alias,
        hostName: alias,
        user: 'root',
        port: 22,
      };
    }
  }
}
