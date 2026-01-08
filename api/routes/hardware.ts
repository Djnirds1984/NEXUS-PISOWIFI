import express from 'express';
import { hardwareManager } from '../hardwareManager.js';
import { resolveMACByIP } from '../utils/network.js';
import { coinEvents } from '../coinEvents.js';

const router = express.Router();

// Get hardware status
router.get('/status', async (req, res) => {
  try {
    const status = hardwareManager.getHardwareStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting hardware status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get hardware status'
    });
  }
});

// Get available GPIO pins
router.get('/pins', async (req, res) => {
  try {
    const pins = hardwareManager.getAvailablePins();
    res.json({
      success: true,
      data: pins
    });
  } catch (error) {
    console.error('Error getting available pins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available pins'
    });
  }
});

// Update hardware configuration
router.post('/config', async (req, res) => {
  try {
    const { coinSlotPin, statusLEDPin } = req.body;

    if (!coinSlotPin || !statusLEDPin) {
      return res.status(400).json({
        success: false,
        error: 'coinSlotPin and statusLEDPin are required'
      });
    }

    if (coinSlotPin === statusLEDPin) {
      return res.status(400).json({
        success: false,
        error: 'coinSlotPin and statusLEDPin cannot be the same'
      });
    }

    hardwareManager.updatePinConfiguration(coinSlotPin, statusLEDPin);

    res.json({
      success: true,
      message: 'Hardware configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating hardware configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update hardware configuration'
    });
  }
});

// Control status LED
router.post('/led', async (req, res) => {
  try {
    const { state } = req.body;

    if (typeof state !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'state must be a boolean'
      });
    }

    hardwareManager.setStatusLED(state);

    res.json({
      success: true,
      message: `Status LED ${state ? 'turned on' : 'turned off'}`
    });
  } catch (error) {
    console.error('Error controlling status LED:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to control status LED'
    });
  }
});

// Blink status LED
router.post('/led/blink', async (req, res) => {
  try {
    const { duration = 500 } = req.body;

    if (typeof duration !== 'number' || duration < 100 || duration > 5000) {
      return res.status(400).json({
        success: false,
        error: 'duration must be a number between 100 and 5000 milliseconds'
      });
    }

    hardwareManager.blinkStatusLED(duration);

    res.json({
      success: true,
      message: `Status LED blinking for ${duration}ms`
    });
  } catch (error) {
    console.error('Error blinking status LED:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to blink status LED'
    });
  }
});

// Toggle mock mode
router.post('/mock-mode', async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean'
      });
    }

    hardwareManager.setMockMode(enabled);
    const status = hardwareManager.getHardwareStatus();

    res.json({
      success: true,
      message: `Mock mode ${enabled ? 'enabled' : 'disabled'}`,
      data: status
    });
  } catch (error) {
    console.error('Error toggling mock mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle mock mode'
    });
  }
});

// Simulate coin pulse (for testing/mock mode)
router.post('/simulate-coin', async (req, res) => {
  try {
    const { pin = 3 } = req.body;
    hardwareManager.handleCoinPulse(pin);
    
    res.json({
      success: true,
      message: `Simulated coin pulse on pin ${pin}`
    });
  } catch (error) {
    console.error('Error simulating coin pulse:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate coin pulse'
    });
  }
});

// Start coin session
router.post('/start-coin-session', async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '').replace('::ffff:', '');
    let { macAddress } = req.body;

    if (!macAddress) {
      macAddress = await resolveMACByIP(ip);
    }

    if (!macAddress && hardwareManager.getHardwareStatus().mockMode) {
       // In mock mode, allow random MAC if not found (for testing on localhost)
       macAddress = '00:00:00:00:00:00';
    }

    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'Could not resolve MAC address'
      });
    }

    const success = hardwareManager.startCoinSession(macAddress, ip);

    if (success) {
      res.json({
        success: true,
        message: 'Coin session started'
      });
    } else {
      res.status(409).json({
        success: false,
        error: 'Coin slot is busy. Please try again in a moment.'
      });
    }
  } catch (error) {
    console.error('Error starting coin session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start coin session'
    });
  }
});

// Get current coin session
router.get('/coin-session', async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '').replace('::ffff:', '');
    let { macAddress } = req.query;

    if (!macAddress) {
      macAddress = await resolveMACByIP(ip);
    }
    
    if (!macAddress && hardwareManager.getHardwareStatus().mockMode) {
       macAddress = '00:00:00:00:00:00';
    }

    if (!macAddress) {
       return res.json({ success: true, data: null });
    }

    const session = hardwareManager.getCoinSession(macAddress as string);
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error getting coin session' });
  }
});

export default router;
 
// Server-Sent Events: coin stream
router.get('/coin/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 25000);

  const listener = (payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  coinEvents.on('coin', listener);

  req.on('close', () => {
    clearInterval(heartbeat);
    coinEvents.off('coin', listener);
  });
});
