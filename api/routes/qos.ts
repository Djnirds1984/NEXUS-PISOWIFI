import express from 'express';
import { networkManager } from '../networkManager.js';
import { getSettings } from '../database.js';

const router = express.Router();

router.post('/cake/enable', async (req, res) => {
  try {
    const { bandwidthKbps, diffserv } = req.body;
    if (!bandwidthKbps) {
      return res.status(400).json({ success: false, error: 'bandwidthKbps is required' });
    }
    const iface = getSettings().network.wanInterface;
    await networkManager.enableCakeQoS({ interface: iface, bandwidthKbps: Number(bandwidthKbps), diffserv });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to enable CAKE' });
  }
});

router.post('/cake/disable', async (req, res) => {
  try {
    const iface = getSettings().network.wanInterface;
    await networkManager.disableCakeQoS(iface);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to disable CAKE' });
  }
});

export default router;
