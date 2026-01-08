import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getSettings, updateSettings } from '../database.js';
import { sessionManager } from '../sessionManager.js';
import { hardwareManager } from '../hardwareManager.js';
import { networkManager } from '../networkManager.js';
import { requireAdminAuth } from '../middleware/auth.js';

const execAsync = promisify(exec);
const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(requireAdminAuth);

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const sessionStats = sessionManager.getSessionStats();
    const hardwareStatus = hardwareManager.getHardwareStatus();
    let networkStatus;
    try {
      networkStatus = await networkManager.getNetworkStatus();
    } catch (e) {
      networkStatus = {
        interfaces: [],
        defaultGateway: '',
        dnsServers: [],
        internetConnected: false,
        hotspotActive: false,
        captivePortalActive: false,
      };
    }
    
    // Calculate today's revenue
    const today = new Date();
    const todayRevenue = sessionManager.getRevenueForDate(today);
    const todayActiveSessions = sessionManager.getActiveSessionsForDate(today);

    const mem = process.memoryUsage();
    const dashboardData = {
      sessions: {
        ...sessionStats,
        todayRevenue,
        todayActiveSessions
      },
      hardware: hardwareStatus,
      network: {
        interfaces: networkStatus.interfaces.length,
        internetConnected: networkStatus.internetConnected,
        hotspotActive: networkStatus.hotspotActive,
        captivePortalActive: networkStatus.captivePortalActive
      },
      system: {
        uptime: process.uptime(),
        memory: { used: mem.heapUsed, total: mem.heapTotal },
        timestamp: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
});

// Get current rates
router.get('/rates', async (req, res) => {
  try {
    const settings = getSettings();
    
    res.json({
      success: true,
      data: settings.rates
    });
  } catch (error) {
    console.error('Error getting rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rates'
    });
  }
});

// Update rates
router.post('/rates', async (req, res) => {
  try {
    const { timePerPeso, rates } = req.body;

    if (!timePerPeso || !rates || !Array.isArray(rates)) {
      return res.status(400).json({
        success: false,
        error: 'timePerPeso and rates array are required'
      });
    }

    if (typeof timePerPeso !== 'number' || timePerPeso <= 0) {
      return res.status(400).json({
        success: false,
        error: 'timePerPeso must be a positive number'
      });
    }

    // Validate rates array
    for (const rate of rates) {
      if (!rate.pesos || !rate.minutes || 
          typeof rate.pesos !== 'number' || 
          typeof rate.minutes !== 'number' ||
          rate.pesos <= 0 || 
          rate.minutes <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Each rate must have positive pesos and minutes values'
        });
      }
    }

    const newRates = {
      timePerPeso,
      rates
    };

    updateSettings({ rates: newRates });

    res.json({
      success: true,
      message: 'Rates updated successfully',
      data: newRates
    });
  } catch (error) {
    console.error('Error updating rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rates'
    });
  }
});

// Get portal settings
router.get('/portal', async (req, res) => {
  try {
    const settings = getSettings();
    
    res.json({
      success: true,
      data: settings.portal
    });
  } catch (error) {
    console.error('Error getting portal settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get portal settings'
    });
  }
});

// Update portal settings
router.post('/portal', async (req, res) => {
  try {
    const { title, backgroundImage, welcomeMessage } = req.body;

    if (!title || !welcomeMessage) {
      return res.status(400).json({
        success: false,
        error: 'title and welcomeMessage are required'
      });
    }

    const newPortalSettings = {
      title,
      backgroundImage: backgroundImage || '/assets/default-bg.jpg',
      welcomeMessage
    };

    updateSettings({ portal: newPortalSettings });

    res.json({
      success: true,
      message: 'Portal settings updated successfully',
      data: newPortalSettings
    });
  } catch (error) {
    console.error('Error updating portal settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update portal settings'
    });
  }
});

// Get system settings
router.get('/settings', async (req, res) => {
  try {
    const settings = getSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get settings'
    });
  }
});

// Update system settings
router.post('/settings', async (req, res) => {
  try {
    const { hardware, network, rates, portal } = req.body;

    if (!hardware && !network && !rates && !portal) {
      return res.status(400).json({
        success: false,
        error: 'At least one settings category is required'
      });
    }

    const currentSettings = getSettings();
    const newSettings = { ...currentSettings };

    if (hardware) {
      newSettings.hardware = { ...currentSettings.hardware, ...hardware };
    }
    if (network) {
      newSettings.network = { ...currentSettings.network, ...network };
    }
    if (rates) {
      newSettings.rates = { ...currentSettings.rates, ...rates };
    }
    if (portal) {
      newSettings.portal = { ...currentSettings.portal, ...portal };
    }

    updateSettings(newSettings);

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: newSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

// Get system logs
router.get('/logs', async (req, res) => {
  try {
    const service = (req.query.service as string) || 'dnsmasq';
    const lines = (req.query.lines as string) || '50';
    
    // Sanitize input to prevent command injection
    const allowedServices = ['dnsmasq', 'hostapd', 'pisowifi', 'nexus-pisowifi', 'dhcpcd', 'networking'];
    if (!allowedServices.includes(service)) {
      return res.status(400).json({ success: false, error: 'Invalid service name' });
    }
    
    const numLines = parseInt(lines, 10);
    if (isNaN(numLines) || numLines < 1 || numLines > 500) {
      return res.status(400).json({ success: false, error: 'Invalid line count (1-500)' });
    }

    if (process.platform === 'win32') {
      // Mock logs for Windows
      return res.json({
        success: true,
        data: `[MOCK LOGS for ${service}]\nWindows environment detected.\nLogs are not available via journalctl.\nTimestamp: ${new Date().toISOString()}`
      });
    }

    const { stdout } = await execAsync(`journalctl -u ${service} -n ${numLines} --no-pager`);
    res.json({
      success: true,
      data: stdout
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs'
    });
  }
});

// System maintenance operations
router.post('/maintenance', async (req, res) => {
  try {
    const { operation } = req.body;

    if (!operation) {
      return res.status(400).json({
        success: false,
        error: 'operation is required'
      });
    }

    let message = '';

    switch (operation) {
      case 'cleanup-sessions':
        // Clean up expired sessions
        sessionManager.getSessionStats(); // This triggers cleanup
        message = 'Expired sessions cleaned up';
        break;
      
      case 'restart-networking':
        await networkManager.restartNetworking();
        message = 'Networking services restarted';
        break;
      
      case 'clear-iptables':
        await networkManager.clearCaptivePortalRules();
        message = 'iptables rules cleared';
        break;
      
      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown operation'
        });
    }

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error performing maintenance operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform maintenance operation'
    });
  }
});

export default router;
