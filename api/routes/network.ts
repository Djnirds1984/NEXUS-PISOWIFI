import express from 'express';
import { networkManager } from '../networkManager.js';

const router = express.Router();

// Get network status
router.get('/status', async (req, res) => {
  try {
    const status = await networkManager.getNetworkStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting network status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get network status'
    });
  }
});

// Configure WAN interface
router.post('/wan', async (req, res) => {
  try {
    const { interfaceName, type, ipAddress, netmask, gateway, dns } = req.body;

    if (!interfaceName || !type) {
      return res.status(400).json({
        success: false,
        error: 'interfaceName and type are required'
      });
    }

    if (type === 'static' && (!ipAddress || !netmask)) {
      return res.status(400).json({
        success: false,
        error: 'ipAddress and netmask are required for static configuration'
      });
    }

    const config = {
      type: type as 'dhcp' | 'static',
      ipAddress,
      netmask,
      gateway,
      dns: dns || ['8.8.8.8', '8.8.4.4']
    };

    await networkManager.configureWAN(interfaceName, config);

    res.json({
      success: true,
      message: `WAN interface ${interfaceName} configured successfully`
    });
  } catch (error) {
    console.error('Error configuring WAN:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure WAN interface'
    });
  }
});

// Create VLAN
router.post('/vlan', async (req, res) => {
  try {
    const { parentInterface, vlanId } = req.body;

    if (!parentInterface || !vlanId) {
      return res.status(400).json({
        success: false,
        error: 'parentInterface and vlanId are required'
      });
    }

    if (vlanId < 1 || vlanId > 4094) {
      return res.status(400).json({
        success: false,
        error: 'vlanId must be between 1 and 4094'
      });
    }

    await networkManager.createVLAN(parentInterface, vlanId);

    res.json({
      success: true,
      message: `VLAN ${vlanId} created on ${parentInterface}`
    });
  } catch (error) {
    console.error('Error creating VLAN:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create VLAN'
    });
  }
});

// Remove VLAN
router.delete('/vlan/:vlanName', async (req, res) => {
  try {
    const { vlanName } = req.params;

    if (!vlanName) {
      return res.status(400).json({
        success: false,
        error: 'vlanName is required'
      });
    }

    await networkManager.removeVLAN(vlanName);

    res.json({
      success: true,
      message: `VLAN ${vlanName} removed successfully`
    });
  } catch (error) {
    console.error('Error removing VLAN:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove VLAN'
    });
  }
});

// Setup hotspot
router.post('/hotspot', async (req, res) => {
  try {
    const { interface: interfaceName, ssid, password, channel, ipAddress, dhcpRange, security } = req.body;

    if (!interfaceName || !ssid) {
      return res.status(400).json({
        success: false,
        error: 'interface and ssid are required'
      });
    }

    const config = {
      interface: interfaceName,
      ssid,
      password,
      security: (security === 'open' ? 'open' : 'wpa2') as 'open' | 'wpa2',
      channel: channel || 6,
      ipAddress: ipAddress || '10.0.0.1',
      dhcpRange: dhcpRange || '10.0.0.10-10.0.0.250'
    };

    await networkManager.setupHotspot(config);

    res.json({
      success: true,
      message: `Hotspot "${ssid}" configured successfully`
    });
  } catch (error) {
    console.error('Error setting up hotspot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup hotspot'
    });
  }
});

// Enable captive portal
router.post('/captive/enable', async (req, res) => {
  try {
    await networkManager.enableCaptivePortal();

    res.json({
      success: true,
      message: 'Captive portal enabled successfully'
    });
  } catch (error) {
    console.error('Error enabling captive portal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable captive portal'
    });
  }
});

// Disable captive portal
router.post('/captive/disable', async (req, res) => {
  try {
    await networkManager.disableCaptivePortal();

    res.json({
      success: true,
      message: 'Captive portal disabled successfully'
    });
  } catch (error) {
    console.error('Error disabling captive portal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable captive portal'
    });
  }
});

// Get iptables rules
router.get('/iptables', async (req, res) => {
  try {
    const rules = await networkManager.getIptablesRules();
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error getting iptables rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get iptables rules'
    });
  }
});

// Restart networking services
router.post('/restart', async (req, res) => {
  try {
    await networkManager.restartNetworking();

    res.json({
      success: true,
      message: 'Networking services restarted successfully'
    });
  } catch (error) {
    console.error('Error restarting networking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart networking services'
    });
  }
});

export default router;
