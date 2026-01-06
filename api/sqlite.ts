import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface KVItem { key: string; value: string }

let db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (db) return db;
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'pisowifi.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      macAddress TEXT,
      startTime TEXT,
      endTime TEXT,
      pesos INTEGER,
      minutes INTEGER,
      active INTEGER,
      ipAddress TEXT
    );
  `);
  return db;
}

export function closeDB(): void {
  if (db) {
    try { db.close(); } catch {}
    db = null;
  }
}

export function kvSet(key: string, value: any): void {
  const dbi = getDB();
  const stmt = dbi.prepare('INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  stmt.run(key, val);
}

export function kvGet<T = any>(key: string, fallback?: T): T {
  const dbi = getDB();
  const row = dbi.prepare('SELECT value FROM kv WHERE key=?').get(key) as KVItem | undefined;
  if (!row) return fallback as T;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return row.value as unknown as T;
  }
}

export function kvAll(): KVItem[] {
  const dbi = getDB();
  return dbi.prepare('SELECT key,value FROM kv').all() as KVItem[];
}

export function sessionsInsert(session: any): void {
  const dbi = getDB();
  dbi.prepare(`
    INSERT INTO sessions(macAddress,startTime,endTime,pesos,minutes,active,ipAddress)
    VALUES(@macAddress,@startTime,@endTime,@pesos,@minutes,@active,@ipAddress)
  `).run({
    ...session,
    active: session.active ? 1 : 0
  });
}

export function sessionsUpdate(macAddress: string, updates: Partial<any>): void {
  const dbi = getDB();
  const existing = dbi.prepare('SELECT * FROM sessions WHERE macAddress=? ORDER BY startTime DESC LIMIT 1').get(macAddress) as any;
  if (!existing) return;
  const next = { ...existing, ...updates };
  dbi.prepare('DELETE FROM sessions WHERE macAddress=? AND startTime=?').run(macAddress, existing.startTime);
  sessionsInsert(next);
}

export function sessionsRemove(macAddress: string): void {
  const dbi = getDB();
  dbi.prepare('DELETE FROM sessions WHERE macAddress=?').run(macAddress);
}

export function sessionsAll(): any[] {
  const dbi = getDB();
  const rows = dbi.prepare('SELECT * FROM sessions').all() as any[];
  return rows.map(r => ({ ...r, active: !!r.active }));
}

export function sessionsActive(): any[] {
  const dbi = getDB();
  const rows = dbi.prepare('SELECT * FROM sessions WHERE active=1').all() as any[];
  return rows.map(r => ({ ...r, active: true }));
}

export function sessionsCleanupExpired(): void {
  const dbi = getDB();
  const now = new Date().toISOString();
  dbi.prepare('DELETE FROM sessions WHERE endTime < ?').run(now);
}
