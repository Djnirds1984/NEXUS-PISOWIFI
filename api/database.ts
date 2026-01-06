import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

// Define the database schema
interface HardwareSettings {
  coinSlotPin: number;
  statusLEDPin: number;
  platform: 'auto-detect' | 'raspberry-pi' | 'orange-pi' | 'ubuntu-x64';
  mockMode: boolean;
}

interface NetworkSettings {
  wanInterface: string;
  lanInterface: string;
  gateway: string;
  dhcpRange: string;
  vlanInterfaces: Array<{
    parent: string;
    vlanId: number;
    name: string;
  }>;
}

interface Rate {
  pesos: number;
  minutes: number;
}

interface RatesSettings {
  timePerPeso: number;
  rates: Rate[];
}

interface PortalSettings {
  title: string;
  backgroundImage: string;
  welcomeMessage: string;
}

interface Session {
  macAddress: string;
  startTime: string;
  endTime: string;
  pesos: number;
  minutes: number;
  active: boolean;
  ipAddress?: string;
}

interface DatabaseSchema {
  settings: {
    hardware: HardwareSettings;
    network: NetworkSettings;
    rates: RatesSettings;
    portal: PortalSettings;
  };
  sessions: Session[];
}

// Default database schema
const defaultData: DatabaseSchema = {
  settings: {
    hardware: {
      coinSlotPin: 15,
      statusLEDPin: 16,
      platform: 'auto-detect',
      mockMode: false
    },
    network: {
      wanInterface: 'eth0',
      lanInterface: 'wlan0',
      gateway: '10.0.0.1',
      dhcpRange: '10.0.0.10-10.0.0.250',
      vlanInterfaces: []
    },
    rates: {
      timePerPeso: 30,
      rates: [
        { pesos: 1, minutes: 30 },
        { pesos: 5, minutes: 240 },
        { pesos: 10, minutes: 600 }
      ]
    },
    portal: {
      title: 'Welcome to PisoWiFi',
      backgroundImage: '/assets/default-bg.jpg',
      welcomeMessage: 'Insert coin to start browsing'
    }
  },
  sessions: []
};

// Initialize database
const dbPath = path.join(process.cwd(), 'data', 'pisowifi.json');
const adapter = new JSONFile<DatabaseSchema>(dbPath);
export const db = new Low<DatabaseSchema>(adapter, defaultData);

// Initialize database
export async function initializeDatabase() {
  try {
    await db.read();
    
    // If database is empty, write default data
    if (!db.data) {
      db.data = defaultData;
      await db.write();
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Database helper functions
export function getSettings() {
  return db.data.settings;
}

export function updateSettings(settings: Partial<DatabaseSchema['settings']>) {
  db.data.settings = { ...db.data.settings, ...settings };
  db.write();
}

export function getSessions() {
  return db.data.sessions;
}

export function addSession(session: Session) {
  db.data.sessions.push(session);
  db.write();
}

export function updateSession(macAddress: string, updates: Partial<Session>) {
  const session = db.data.sessions.find(s => s.macAddress === macAddress);
  if (session) {
    Object.assign(session, updates);
    db.write();
  }
}

export function removeSession(macAddress: string) {
  db.data.sessions = db.data.sessions.filter(s => s.macAddress !== macAddress);
  db.write();
}

export function getActiveSessions() {
  return db.data.sessions.filter(s => s.active);
}

export function cleanupExpiredSessions() {
  const now = new Date().toISOString();
  db.data.sessions = db.data.sessions.filter(s => {
    if (s.endTime < now) {
      return false; // Remove expired sessions
    }
    return true;
  });
  db.write();
}