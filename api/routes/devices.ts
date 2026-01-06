import express from 'express';
import { upsertDevice, getDevices, getDevice, updateDevice, deleteDevice } from '../database.js';
import { networkManager } from '../networkManager.js';
import { getSettings } from '../database.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let discovered: Array<{ macAddress: string; ipAddress?: string; hostname?: string }> = [];
    try {
      discovered = await networkManager.listActiveDevices();
    } catch {}

    const now = new Date().toISOString();
    for (const d of discovered) {
      const existing = getDevice(d.macAddress);
      upsertDevice({
        macAddress: d.macAddress,
        ipAddress: d.ipAddress,
        hostname: d.hostname || existing?.hostname || '',
        firstSeen: existing?.firstSeen || now,
        lastSeen: now,
        connected: true,
        timeLimitMinutes: existing?.timeLimitMinutes || 0,
        usageSeconds: existing?.usageSeconds || 0,
        notes: existing?.notes || '',
        bandwidthCapKbps: existing?.bandwidthCapKbps || 0,
        priority: existing?.priority || 0,
      });
    }

    const all = getDevices().map(d => {
      const isActive = discovered.some(x => x.macAddress.toLowerCase() === d.macAddress.toLowerCase());
      return { ...d, connected: isActive || !!d.connected };
    });

    res.json({ success: true, data: all });
  } catch {
    try {
      const list = getDevices();
      res.json({ success: true, data: list });
    } catch {
      res.json({ success: true, data: [] });
    }
  }
});

router.post('/', async (req, res) => {
  try {
    const { macAddress, ipAddress, hostname, timeLimitMinutes, notes } = req.body;
    if (!macAddress) {
      return res.status(400).json({ success: false, error: 'macAddress is required' });
    }
    const now = new Date().toISOString();
    upsertDevice({
      macAddress,
      ipAddress,
      hostname,
      timeLimitMinutes: timeLimitMinutes || 0,
      notes: notes || '',
      firstSeen: now,
      lastSeen: now,
      connected: false
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to create device' });
  }
});

router.put('/:mac', async (req, res) => {
  try {
    const mac = req.params.mac;
    const device = getDevice(mac);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    updateDevice(mac, req.body || {});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update device' });
  }
});

router.delete('/:mac', async (req, res) => {
  try {
    const mac = req.params.mac;
    deleteDevice(mac);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to delete device' });
  }
});

router.get('/usage', async (req, res) => {
  try {
    const { ip } = req.query as any;
    if (!ip) {
      return res.status(400).json({ success: false, error: 'ip is required' });
    }
    const settings = getSettings();
    const iface = settings.network.lanInterface;
    const usage = await networkManager.getDeviceUsage(iface, String(ip));
    res.json({ success: true, data: usage });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to get usage' });
  }
});

router.post('/cap', async (req, res) => {
  try {
    const { ip, capKbps } = req.body;
    if (!ip || !capKbps) {
      return res.status(400).json({ success: false, error: 'ip and capKbps are required' });
    }
    const settings = getSettings();
    const iface = settings.network.lanInterface;
    await networkManager.setDeviceBandwidthCap(iface, ip, Number(capKbps));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to set bandwidth cap' });
  }
});

export default router;
