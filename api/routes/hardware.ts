import express from 'express';
import { hardwareManager } from '../hardwareManager.js';

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

// Simulate coin pulse (for testing)
router.post('/coin/simulate', async (req, res) => {
  try {
    // This is a testing endpoint to simulate coin detection
    // In production, this should be disabled or require authentication
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Coin simulation is not available in production'
      });
    }

    // Simulate a coin pulse
    if (hardwareManager.getHardwareStatus().mockMode) {
      // In mock mode, trigger the coin detection callback
      const status = hardwareManager.getHardwareStatus();
      // @ts-ignore - accessing private property for testing
      hardwareManager['handleCoinPulse'](status.coinSlotPin);
    }

    res.json({
      success: true,
      message: 'Coin pulse simulated'
    });
  } catch (error) {
    console.error('Error simulating coin pulse:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate coin pulse'
    });
  }
});

export default router;