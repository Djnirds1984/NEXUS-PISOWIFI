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
    const settings = getSettings();
    const preferred = settings.network.wanInterface;
    let iface = preferred;
    try {
      const status = await networkManager.getNetworkStatus();
      const prefer = status.interfaces.find(i => i.name === preferred && i.status === 'up');
      const fallback = status.interfaces.find(i => i.status === 'up' && (i.type === 'ethernet' || i.type === 'wireless'));
      iface = (prefer?.name || fallback?.name || preferred);
    } catch {}
    await networkManager.enableCakeQoS({ interface: String(iface), bandwidthKbps: Number(bandwidthKbps), diffserv });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to enable CAKE' });
  }
});

router.post('/cake/disable', async (req, res) => {
  try {
    const settings = getSettings();
    const preferred = settings.network.wanInterface;
    let iface = preferred;
    try {
      const status = await networkManager.getNetworkStatus();
      const prefer = status.interfaces.find(i => i.name === preferred && i.status === 'up');
      const fallback = status.interfaces.find(i => i.status === 'up' && (i.type === 'ethernet' || i.type === 'wireless'));
      iface = (prefer?.name || fallback?.name || preferred);
    } catch {}
    await networkManager.disableCakeQoS(String(iface));
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to disable CAKE' });
  }
});

export default router;
