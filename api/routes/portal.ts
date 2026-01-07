import express from 'express';
import { getSettings } from '../database.js';
import { sessionManager } from '../sessionManager.js';
import { resolveMACByIP } from '../utils/network.js';
import { networkManager } from '../networkManager.js';
import { hardwareManager } from '../hardwareManager.js';

import { voucherManager } from '../voucherManager.js';

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

// Device info for current client
router.get('/device-info', async (req, res) => {
  try {
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');
    const mac = await resolveMACByIP(ip);
    const list = await networkManager.listActiveDevices().catch(() => []);
    const fromList = list.find(d => d.ipAddress === ip || (mac && d.macAddress === mac));
    const hostname = fromList?.hostname || '';
    const macOut = (mac || '').toUpperCase();
    if (!ip) {
      return res.status(400).json({ success: false, error: 'IP not found' });
    }
    res.json({
      success: true,
      data: {
        ip,
        mac: macOut,
        deviceName: hostname || '',
        refreshedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get device info' });
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
    let ip = (req.ip || '').replace('::ffff:', '');
    
    // Attempt resolution if MAC is missing
    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    // Fallback: If no MAC found, or if session check by MAC fails, try checking by IP
    let session = macAddress ? sessionManager.getSession(macAddress) : undefined;
    
    if (!session && ip) {
       // Try finding session by IP
       session = sessionManager.getSessionByIp(ip);
       if (session) {
         // Found session by IP! Update our working MAC
         macAddress = session.macAddress;
         // Also ensure IP mapping is fresh
         sessionManager.updateIpMapping(macAddress, ip);
       }
    }

    // If still no session, and we have a MAC, check simple active status
    if (macAddress && !session) {
       // Maybe it's active but getSession returned undefined? (Unlikely with current implementation but good for safety)
    }

    // Final MAC validation before returning response (only if we have one)
    if (macAddress) {
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(macAddress)) {
         // If we found a session by IP, we trust that session's MAC. 
         // If we resolved a bad MAC from system, we might be in trouble.
         // But let's be lenient: if we found a session, use it.
         if (!session) {
             return res.status(400).json({
               success: false,
               error: 'Invalid MAC address format'
             });
         }
      }
    } else {
       // No MAC, No Session found by IP
       return res.json({
         success: true,
         data: {
           connected: false,
           session: null,
           timeRemaining: 0,
           hasSession: false,
           ip // useful for debugging
         }
       });
    }

    const isActive = session ? session.active : (macAddress ? sessionManager.isSessionActive(macAddress) : false);
    const timeRemaining = session ? sessionManager.getSessionTimeRemaining(session.macAddress) : 0;

    res.json({
      success: true,
      data: {
        connected: isActive,
        session: session || null,
        timeRemaining: isActive ? timeRemaining : 0,
        hasSession: !!session,
        macAddress // Return resolved MAC
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
    const ip = (req.ip || '').replace('::ffff:', '');

    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    // Fallback: If no MAC, can we find an existing session by IP?
    if (!macAddress && ip) {
       const existingSession = sessionManager.getSessionByIp(ip);
       if (existingSession) {
         macAddress = existingSession.macAddress;
       }
    }

    // Check for active coin session (server-side verified credits)
    if (macAddress) {
      const coinSession = hardwareManager.getCoinSession(macAddress);
      if (coinSession && coinSession.amount > 0) {
        console.log(`Using coin session for ${macAddress}: ${coinSession.amount} pesos`);
        pesos = coinSession.amount;
        // We will clear the session after successful start
      }
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
    const session = await sessionManager.startSession(macAddress, pesos, ip);

    // Clear coin session if it was used
    if (hardwareManager.getCoinSession(macAddress)) {
      hardwareManager.clearCoinSession();
    }

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
    
    // Clear coin session if it was used
    if (hardwareManager.getCoinSession(macAddress)) {
      hardwareManager.clearCoinSession();
    }

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

// Redeem voucher
router.post('/redeem-voucher', async (req, res) => {
  try {
    let { macAddress, code } = req.body;

    if (!macAddress) {
      const ip = (req.ip || '').replace('::ffff:', '');
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    if (!macAddress || !code) {
      return res.status(400).json({
        success: false,
        error: 'MAC address and voucher code are required'
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

    const result = await voucherManager.redeemVoucher(code, macAddress);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          session: result.session,
          timeRemaining: sessionManager.getSessionTimeRemaining(macAddress)
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error redeeming voucher:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to redeem voucher'
    });
  }
});

// Check server internet connectivity
router.get('/check-internet', async (req, res) => {
  try {
    const isConnected = await networkManager.checkInternetConnection();
    res.json({
      success: true,
      connected: isConnected
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      connected: false,
      error: 'Failed to check internet connection'
    });
  }
});

export default router;
