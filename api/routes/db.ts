import express from 'express';
import { getSettings, updateSettings, getDefaultSettings, initializeDatabase } from '../database.js';
import { kvAll, kvGet, kvSet, closeDB } from '../sqlite.js';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/settings', async (req, res) => {
  const settings = getSettings();
  res.json({ success: true, data: settings });
});

router.post('/settings', async (req, res) => {
  const { hardware, network, rates, portal } = req.body || {};
  const current = getSettings();
  const next = {
    hardware: hardware ? { ...current.hardware, ...hardware } : undefined,
    network: network ? { ...current.network, ...network } : undefined,
    rates: rates ? { ...current.rates, ...rates } : undefined,
    portal: portal ? { ...current.portal, ...portal } : undefined,
  };
  updateSettings(next);
  res.json({ success: true, message: 'Settings updated' });
});

router.get('/kv', async (req, res) => {
  const all = kvAll();
  res.json({ success: true, data: all });
});

router.post('/kv', async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ success: false, error: 'key is required' });
  kvSet(key, value);
  res.json({ success: true, message: 'Key saved' });
});

router.get('/export', async (req, res) => {
  const dbPath = path.join(process.cwd(), 'data', 'pisowifi.db');
  if (!fs.existsSync(dbPath)) return res.status(404).json({ success: false, error: 'Database not found' });
  const data = fs.readFileSync(dbPath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename=\"pisowifi.db\"');
  res.send(data);
});

router.post('/reset', async (req, res) => {
  const defaults = getDefaultSettings();
  updateSettings(defaults);
  res.json({ success: true, message: 'Settings reset to defaults' });
});

router.post('/restore', upload.single('db'), async (req, res) => {
  try {
    const file = (req as any).file as any;
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const dbPath = path.join(process.cwd(), 'data', 'pisowifi.db');
    const backupPath = path.join(process.cwd(), 'data', `pisowifi.backup.${Date.now()}.db`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }
    closeDB();
    fs.writeFileSync(dbPath, file.buffer);
    await initializeDatabase();
    res.json({ success: true, message: 'Database restored from backup' });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;
