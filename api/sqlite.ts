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
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS devices (
      macAddress TEXT PRIMARY KEY,
      ipAddress TEXT,
      hostname TEXT,
      firstSeen TEXT,
      lastSeen TEXT,
      connected INTEGER,
      timeLimitMinutes INTEGER,
      usageSeconds INTEGER,
      notes TEXT,
      bandwidthCapKbps INTEGER,
      priority INTEGER
    );
    CREATE TABLE IF NOT EXISTS vouchers (
      code TEXT PRIMARY KEY,
      amount INTEGER,
      isUsed INTEGER,
      dateGenerated TEXT,
      dateUsed TEXT
    );
  `);
  
  // Create sessions table with new schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      macAddress TEXT,
      startTime TEXT,
      endTime TEXT,
      pesos INTEGER,
      minutes INTEGER,
      active INTEGER,
      ipAddress TEXT,
      paused INTEGER DEFAULT 0,
      pausedAt TEXT,
      pausedDuration INTEGER DEFAULT 0
    );
  `);
  
  // Check if we need to migrate the sessions table
  try {
    const tableInfo = db.prepare('PRAGMA table_info(sessions)').all();
    const hasPausedColumn = tableInfo.some((column: any) => column.name === 'paused');
    
    if (!hasPausedColumn) {
      console.log('🔧 Migrating sessions table to add pause functionality...');
      
      // Create a new table with the correct schema
      db.exec(`
        CREATE TABLE sessions_new (
          macAddress TEXT,
          startTime TEXT,
          endTime TEXT,
          pesos INTEGER,
          minutes INTEGER,
          active INTEGER,
          ipAddress TEXT,
          paused INTEGER DEFAULT 0,
          pausedAt TEXT,
          pausedDuration INTEGER DEFAULT 0
        );
      `);
      
      // Copy data from old table to new table
      db.exec(`
        INSERT INTO sessions_new (macAddress, startTime, endTime, pesos, minutes, active, ipAddress)
        SELECT macAddress, startTime, endTime, pesos, minutes, active, ipAddress FROM sessions;
      `);
      
      // Drop old table and rename new table
      db.exec('DROP TABLE sessions;');
      db.exec('ALTER TABLE sessions_new RENAME TO sessions;');
      
      console.log('✅ Sessions table migration completed successfully!');
    }
  } catch (error) {
    console.error('❌ Error during sessions table migration:', error);
    throw error;
  }
  
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
    INSERT INTO sessions(macAddress,startTime,endTime,pesos,minutes,active,ipAddress,paused,pausedAt,pausedDuration)
    VALUES(@macAddress,@startTime,@endTime,@pesos,@minutes,@active,@ipAddress,@paused,@pausedAt,@pausedDuration)
  `).run({
    ...session,
    active: session.active ? 1 : 0,
    ipAddress: session.ipAddress || null,
    paused: session.paused ? 1 : 0,
    pausedAt: session.pausedAt || null,
    pausedDuration: session.pausedDuration || 0
  });
}

export function sessionsUpdate(macAddress: string, updates: Partial<any>): void {
  const dbi = getDB();
  const existing = dbi.prepare('SELECT * FROM sessions WHERE macAddress=? ORDER BY startTime DESC LIMIT 1').get(macAddress) as any;
  if (!existing) return;
  
  const next = { ...existing, ...updates };
  
  // Use proper UPDATE instead of DELETE+INSERT for atomicity
  const fields = Object.keys(updates).map(key => `${key}=@${key}`).join(', ');
  if (!fields) return;

  dbi.prepare(`
    UPDATE sessions SET 
      ${fields}
    WHERE macAddress=@macAddress AND startTime=@originalStartTime
  `).run({
    ...updates,
    macAddress,
    originalStartTime: existing.startTime,
    active: next.active ? 1 : 0,
    paused: next.paused ? 1 : 0,
    pausedAt: next.pausedAt || null,
    pausedDuration: next.pausedDuration || 0
  });
}

export function sessionsRemove(macAddress: string): void {
  const dbi = getDB();
  dbi.prepare('DELETE FROM sessions WHERE macAddress=?').run(macAddress);
}

export function sessionsAll(): any[] {
  const dbi = getDB();
  const rows = dbi.prepare('SELECT * FROM sessions').all() as any[];
  return rows.map(r => ({ 
    ...r, 
    active: !!r.active,
    paused: !!r.paused
  }));
}

export function sessionsActive(): any[] {
  const dbi = getDB();
  const rows = dbi.prepare('SELECT * FROM sessions WHERE active=1').all() as any[];
  return rows.map(r => ({ 
    ...r, 
    active: true,
    paused: !!r.paused
  }));
}

export function sessionsCleanupExpired(): void {
  const dbi = getDB();
  const now = new Date().toISOString();
  dbi.prepare('DELETE FROM sessions WHERE endTime < ?').run(now);
}

export function devicesUpsert(device: any): void {
  const dbi = getDB();
  const existing = dbi.prepare('SELECT macAddress FROM devices WHERE macAddress=?').get(device.macAddress) as any;
  
  const safeDevice = {
    macAddress: device.macAddress,
    ipAddress: device.ipAddress || null,
    hostname: device.hostname || '',
    firstSeen: device.firstSeen || new Date().toISOString(),
    lastSeen: device.lastSeen || new Date().toISOString(),
    connected: device.connected ? 1 : 0,
    timeLimitMinutes: device.timeLimitMinutes || 0,
    usageSeconds: device.usageSeconds || 0,
    notes: device.notes || '',
    bandwidthCapKbps: device.bandwidthCapKbps || 0,
    priority: device.priority || 0
  };

  if (existing) {
    dbi.prepare(`
      UPDATE devices SET
        ipAddress=@ipAddress,
        hostname=@hostname,
        firstSeen=@firstSeen,
        lastSeen=@lastSeen,
        connected=@connected,
        timeLimitMinutes=@timeLimitMinutes,
        usageSeconds=@usageSeconds,
        notes=@notes,
        bandwidthCapKbps=@bandwidthCapKbps,
        priority=@priority
      WHERE macAddress=@macAddress
    `).run(safeDevice);
  } else {
    dbi.prepare(`
      INSERT INTO devices(macAddress,ipAddress,hostname,firstSeen,lastSeen,connected,timeLimitMinutes,usageSeconds,notes,bandwidthCapKbps,priority)
      VALUES(@macAddress,@ipAddress,@hostname,@firstSeen,@lastSeen,@connected,@timeLimitMinutes,@usageSeconds,@notes,@bandwidthCapKbps,@priority)
    `).run(safeDevice);
  }
}

export function devicesGet(macAddress: string): any | null {
  const dbi = getDB();
  const row = dbi.prepare('SELECT * FROM devices WHERE macAddress=?').get(macAddress) as any;
  if (!row) return null;
  return { ...row, connected: !!row.connected };
}

export function devicesAll(): any[] {
  const dbi = getDB();
  const rows = dbi.prepare('SELECT * FROM devices').all() as any[];
  return rows.map(r => ({ ...r, connected: !!r.connected }));
}

export function devicesDelete(macAddress: string): void {
  const dbi = getDB();
  dbi.prepare('DELETE FROM devices WHERE macAddress=?').run(macAddress);
}

export function devicesUpdate(macAddress: string, updates: Partial<any>): void {
  const existing = devicesGet(macAddress);
  if (!existing) return;
  devicesUpsert({ ...existing, ...updates, macAddress });
}

export function vouchersInsert(voucher: any): void {
  const dbi = getDB();
  dbi.prepare(`
    INSERT INTO vouchers(code,amount,isUsed,dateGenerated,dateUsed)
    VALUES(@code,@amount,@isUsed,@dateGenerated,@dateUsed)
  `).run({
    ...voucher,
    isUsed: voucher.isUsed ? 1 : 0,
    dateUsed: voucher.dateUsed || null
  });
}

export function vouchersGet(code: string): any | null {
  const dbi = getDB();
  const row = dbi.prepare('SELECT * FROM vouchers WHERE code=?').get(code) as any;
  if (!row) return null;
  return { ...row, isUsed: !!row.isUsed };
}

export function vouchersUpdate(code: string, updates: Partial<any>): void {
  const dbi = getDB();
  const existing = vouchersGet(code);
  if (!existing) return;
  
  const next = { ...existing, ...updates };
  dbi.prepare(`
    UPDATE vouchers SET
      amount=@amount,
      isUsed=@isUsed,
      dateGenerated=@dateGenerated,
      dateUsed=@dateUsed
    WHERE code=@code
  `).run({
    ...next,
    isUsed: next.isUsed ? 1 : 0
  });
}

export function vouchersDelete(code: string): void {
  const dbi = getDB();
  dbi.prepare('DELETE FROM vouchers WHERE code=?').run(code);
}

export function vouchersAll(): any[] {
  const dbi = getDB();
  const rows = dbi.prepare('SELECT * FROM vouchers').all() as any[];
  return rows.map(r => ({ ...r, isUsed: !!r.isUsed }));
}
