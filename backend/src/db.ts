import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'server_manager.db');
export const db = new DatabaseSync(DB_PATH);

// Initialize database schema
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT NOT NULL,
      auth_type TEXT NOT NULL DEFAULT 'password',
      key_path TEXT,
      position_x REAL NOT NULL DEFAULT 100,
      position_y REAL NOT NULL DEFAULT 100,
      last_connected TEXT,
      status TEXT NOT NULL DEFAULT 'offline',
      product_group TEXT NOT NULL DEFAULT 'General',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS server_state (
      server_id TEXT PRIMARY KEY,
      srv_tree TEXT,
      docker_containers TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS file_cache (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content TEXT,
      language TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(server_id, file_path),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backup_logs (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      original_path TEXT NOT NULL,
      backup_path TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_groups (
      name TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
  `);

  // Safely ensure product_group column exists in existing servers table
  try {
    const tableInfo = db.prepare("PRAGMA table_info(servers)").all() as any[];
    const hasGroup = tableInfo.some((col: any) => col.name === 'product_group');
    if (!hasGroup) {
      db.exec("ALTER TABLE servers ADD COLUMN product_group TEXT NOT NULL DEFAULT 'General'");
    }
  } catch (err) {
    console.error('Migration error for product_group:', err);
  }
}
