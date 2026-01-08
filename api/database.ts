import path from 'path';
import { kvGet, kvSet, kvAll, sessionsInsert, sessionsUpdate, sessionsRemove, sessionsActive, sessionsAll, sessionsCleanupExpired, getDB, devicesUpsert, devicesGet, devicesAll, devicesDelete, devicesUpdate, vouchersInsert, vouchersGet, vouchersUpdate, vouchersDelete, vouchersAll } from './sqlite.js';

export { getDB };

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
  ssid?: string;
  password?: string;
  security?: 'open' | 'wpa2';
  channel?: number;
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
  paused?: boolean;
  pausedAt?: string | null;
  pausedDuration?: number;
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

export interface Device {
  macAddress: string;
  ipAddress?: string;
  hostname?: string;
  firstSeen?: string;
  lastSeen?: string;
  connected?: boolean;
  timeLimitMinutes?: number;
  usageSeconds?: number;
  notes?: string;
  bandwidthCapKbps?: number;
  priority?: number;
}

// Default database schema
const defaultData: DatabaseSchema = {
  settings: {
    hardware: {
      coinSlotPin: 3,
      statusLEDPin: 16,
      platform: 'auto-detect',
      mockMode: false
    },
    network: {
      wanInterface: 'eth0',
      lanInterface: 'wlan0',
      gateway: '10.0.0.1',
      dhcpRange: '10.0.0.10-10.0.0.250',
      ssid: 'PisoWiFi-Hotspot',
      security: 'open', // Permanently set to open security (no password)
      channel: 6,
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

export const dbFilePath = path.join(process.cwd(), 'data', 'pisowifi.db');

// Initialize database
export async function initializeDatabase() {
  try {
    getDB();
    const existingHardware = kvGet('settings.hardware', null);
    const existingNetwork = kvGet('settings.network', null);
    const existingRates = kvGet('settings.rates', null);
    const existingPortal = kvGet('settings.portal', null);
    if (!existingHardware) kvSet('settings.hardware', defaultData.settings.hardware);
    if (!existingNetwork) kvSet('settings.network', defaultData.settings.network);
    if (!existingRates) kvSet('settings.rates', defaultData.settings.rates);
    if (!existingPortal) kvSet('settings.portal', defaultData.settings.portal);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export function getDefaultSettings(): DatabaseSchema['settings'] {
  return defaultData.settings;
}

// Database helper functions
export function getSettings() {
  const hardware = kvGet('settings.hardware', defaultData.settings.hardware);
  const network = kvGet('settings.network', defaultData.settings.network);
  const rates = kvGet('settings.rates', defaultData.settings.rates);
  const portal = kvGet('settings.portal', defaultData.settings.portal);
  return { hardware, network, rates, portal };
}

export function updateSettings(settings: Partial<DatabaseSchema['settings']>) {
  if (settings.hardware) kvSet('settings.hardware', settings.hardware);
  if (settings.network) kvSet('settings.network', settings.network);
  if (settings.rates) kvSet('settings.rates', settings.rates);
  if (settings.portal) kvSet('settings.portal', settings.portal);
}

export function getSessions() {
  return sessionsAll();
}

export function addSession(session: Session) {
  sessionsInsert(session);
}

export function updateSession(macAddress: string, updates: Partial<Session>) {
  sessionsUpdate(macAddress, updates);
}

export function removeSession(macAddress: string) {
  sessionsRemove(macAddress);
}

export function getActiveSessions() {
  return sessionsActive();
}

export function cleanupExpiredSessions() {
  sessionsCleanupExpired();
}

export function upsertDevice(device: Device) {
  devicesUpsert(device);
}

export function getDevice(macAddress: string): Device | null {
  return devicesGet(macAddress);
}

export function getDevices(): Device[] {
  return devicesAll();
}

export function updateDevice(macAddress: string, updates: Partial<Device>) {
  devicesUpdate(macAddress, updates);
}

export function deleteDevice(macAddress: string) {
  devicesDelete(macAddress);
}

export interface Voucher {
  code: string;
  amount: number;
  isUsed: boolean;
  dateGenerated: string;
  dateUsed?: string;
}

export function addVoucher(voucher: Voucher) {
  vouchersInsert(voucher);
}

export function getVoucher(code: string): Voucher | null {
  return vouchersGet(code);
}

export function updateVoucher(code: string, updates: Partial<Voucher>) {
  vouchersUpdate(code, updates);
}

export function deleteVoucher(code: string) {
  vouchersDelete(code);
}

export function getVouchers(): Voucher[] {
  return vouchersAll();
}
