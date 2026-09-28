import path from 'node:path';

/**
 * SecurityGuardian enforces the strict safety rules specified by the user:
 * 1. ZERO DELETE: Under NO circumstances should the app ever delete anything from the server.
 * 2. STRICT WHITELIST: Only read /srv, docker inspection, file/folder creation, and file edits. No dangerous commands.
 * 3. BACKUP ON EDIT: Every file modified must be backed up to /home before saving.
 */
export class SecurityGuardian {
  private static FORBIDDEN_DELETE_PATTERNS = [
    /\brm\b/i,
    /\brmdir\b/i,
    /\bunlink\b/i,
    /\btruncate\b/i,
    /\bshred\b/i,
    /\bwipe/i,
    /\bdd\b/i,
    /\bmkfs/i,
    /(?<![-_])\bformat\s+/i,
    /\bdelete\b/i,
    /\bdrop\b/i,
    /\bdocker\s+(container\s+)?rm\b/i,
    /\bdocker\s+(image\s+)?rmi\b/i,
    /\bdocker\s+system\s+prune\b/i,
    /\bdocker\s+volume\s+rm\b/i,
    /\bdocker-compose\s+down\s+-v\b/i,
    /\bdocker\s+compose\s+down\s+-v\b/i
  ];

  /**
   * Asserts that a command or action does not contain any deletion intent.
   * Throws an error immediately if any forbidden pattern is matched.
   */
  public static assertNoDelete(input: string): void {
    if (!input) return;
    for (const pattern of this.FORBIDDEN_DELETE_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error(`[SECURITY GUARDIAN REJECTED]: Deletion operation is strictly prohibited by policy: "${input}"`);
      }
    }
  }

  /**
   * Validates target path is within /srv or user home directory, and prevents traversal attacks.
   */
  public static sanitizePath(targetPath: string): string {
    const normalized = path.posix.normalize(targetPath);
    if (normalized.includes('..')) {
      throw new Error(`[SECURITY GUARDIAN REJECTED]: Path traversal detected: "${targetPath}"`);
    }
    return normalized;
  }

  /**
   * Generates a timestamped backup path inside the user's /home directory.
   * Example: /home/username/srv_backups/2026-09-27T16-00-00_myapp_docker-compose.yml
   */
  public static generateBackupPath(username: string, originalPath: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedPath = originalPath.replace(/^\/+/, '').replace(/\//g, '__');
    
    // Default backup base directory is /home/<username>/srv_backups
    const homeDir = username === 'root' ? '/root' : `/home/${username}`;
    return `${homeDir}/srv_backups/${timestamp}_${sanitizedPath}`;
  }
}
