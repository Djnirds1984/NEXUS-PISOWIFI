import express from 'express';
import { getSettings } from '../database.js';
import { sessionManager } from '../sessionManager.js';
import { resolveMACByIP } from '../utils/network.js';

const router = express.Router();

// Get portal configuration
router.get('/config', async (req, res) => {
  try {
    const settings = getSettings();
    
    res.json({
      success: true,
      data: {
        title: settings.portal.title,
        backgroundImage: settings.portal.backgroundImage,
        welcomeMessage: settings.portal.welcomeMessage,
        rates: settings.rates.rates
      }
    });
  } catch (error) {
    console.error('Error getting portal config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get portal configuration'
    });
  }
});

// Backward-compatible settings endpoint
router.get('/settings', async (req, res) => {
  try {
    const settings = getSettings();
    res.json({
      title: settings.portal.title,
      backgroundImage: settings.portal.backgroundImage,
      welcomeMessage: settings.portal.welcomeMessage,
      theme: 'light'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get portal settings' });
  }
});

// Check connection status
router.get('/status', async (req, res) => {
  try {
    let macAddress = (req.query.mac as string) || '';
    
    if (!macAddress) {
      const ip = (req.ip || '').replace('::ffff:', '');
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    const session = sessionManager.getSession(macAddress);
    const isActive = sessionManager.isSessionActive(macAddress);
    const timeRemaining = sessionManager.getSessionTimeRemaining(macAddress);

    res.json({
      success: true,
      data: {
        connected: isActive,
        session: session || null,
        timeRemaining: isActive ? timeRemaining : 0,
        hasSession: !!session
      }
    });
  } catch (error) {
    console.error('Error checking connection status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check connection status'
    });
  }
});

// Connect to WiFi (start session)
router.post('/connect', async (req, res) => {
  try {
    let { macAddress, pesos } = req.body;

    if (!macAddress) {
      const ip = (req.ip || '').replace('::ffff:', '');
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    if (!macAddress || !pesos) {
      return res.status(400).json({
        success: false,
        error: 'MAC address and pesos are required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    if (typeof pesos !== 'number' || pesos <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Pesos must be a positive number'
      });
    }

    // Check if user already has an active session
    const existingSession = sessionManager.getSession(macAddress);
    if (existingSession && existingSession.active) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active session'
      });
    }

    // Start new session
    const session = await sessionManager.startSession(macAddress, pesos);
    const timeRemaining = sessionManager.getSessionTimeRemaining(macAddress);

    res.json({
      success: true,
      message: `Connected successfully! Your session will last ${session.minutes} minutes.`,
      data: {
        session,
        timeRemaining
      }
    });
  } catch (error) {
    console.error('Error connecting to WiFi:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to WiFi'
    });
  }
});

// Extend session
router.post('/extend', async (req, res) => {
  try {
    let { macAddress, pesos } = req.body;

    if (!macAddress) {
      const ip = (req.ip || '').replace('::ffff:', '');
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    if (!macAddress || !pesos) {
      return res.status(400).json({
        success: false,
        error: 'MAC address and pesos are required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    if (typeof pesos !== 'number' || pesos <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Pesos must be a positive number'
      });
    }

    // Check if user has an active session
    const existingSession = sessionManager.getSession(macAddress);
    if (!existingSession || !existingSession.active) {
      return res.status(400).json({
        success: false,
        error: 'No active session found'
      });
    }

    // Calculate additional minutes based on pesos
    const settings = getSettings();
    const rate = settings.rates.rates.find(r => r.pesos === pesos);
    const additionalMinutes = rate ? rate.minutes : pesos * settings.rates.timePerPeso;

    // Extend session
    await sessionManager.extendSession(macAddress, additionalMinutes);
    const timeRemaining = sessionManager.getSessionTimeRemaining(macAddress);

    res.json({
      success: true,
      message: `Session extended by ${additionalMinutes} minutes!`,
      data: {
        timeRemaining
      }
    });
  } catch (error) {
    console.error('Error extending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extend session'
    });
  }
});

// Get available rates
router.get('/rates', async (req, res) => {
  try {
    const settings = getSettings();
    
    res.json({
      success: true,
      data: settings.rates.rates
    });
  } catch (error) {
    console.error('Error getting rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rates'
    });
  }
});

// Disconnect from WiFi (end session)
router.post('/disconnect', async (req, res) => {
  try {
    let { macAddress } = req.body;

    if (!macAddress) {
      const ip = (req.ip || '').replace('::ffff:', '');
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'MAC address is required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    // Check if user has an active session
    const session = sessionManager.getSession(macAddress);
    if (!session || !session.active) {
      return res.status(400).json({
        success: false,
        error: 'No active session found'
      });
    }

    // End session
    await sessionManager.endSession(macAddress);

    res.json({
      success: true,
      message: 'Disconnected successfully. Thank you for using PisoWiFi!'
    });
  } catch (error) {
    console.error('Error disconnecting from WiFi:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect from WiFi'
    });
  }
});

export default router;
