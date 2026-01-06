import express from 'express';
import { sessionManager } from '../sessionManager.js';

const router = express.Router();

// Start a new session
router.post('/start', async (req, res) => {
  try {
    const { macAddress, pesos } = req.body;

    if (!macAddress || !pesos) {
      return res.status(400).json({
        success: false,
        error: 'macAddress and pesos are required'
      });
    }

    if (typeof pesos !== 'number' || pesos <= 0) {
      return res.status(400).json({
        success: false,
        error: 'pesos must be a positive number'
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

    const session = await sessionManager.startSession(macAddress, pesos);

    res.json({
      success: true,
      data: session,
      message: `Session started for ${pesos} pesos`
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start session'
    });
  }
});

// End a session
router.delete('/:macAddress', async (req, res) => {
  try {
    const { macAddress } = req.params;

    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'macAddress is required'
      });
    }

    await sessionManager.endSession(macAddress);

    res.json({
      success: true,
      message: `Session ended for ${macAddress}`
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session'
    });
  }
});

// Get active sessions
router.get('/active', async (req, res) => {
  try {
    const sessions = sessionManager.getAllActiveSessions();
    
    // Add time remaining for each session
    const sessionsWithTimeRemaining = sessions.map(session => ({
      ...session,
      timeRemaining: sessionManager.getSessionTimeRemaining(session.macAddress)
    }));

    res.json({
      success: true,
      data: sessionsWithTimeRemaining
    });
  } catch (error) {
    console.error('Error getting active sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active sessions'
    });
  }
});

// Get specific session
router.get('/:macAddress', async (req, res) => {
  try {
    const { macAddress } = req.params;

    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'macAddress is required'
      });
    }

    const session = sessionManager.getSession(macAddress);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...session,
        timeRemaining: sessionManager.getSessionTimeRemaining(macAddress)
      }
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

// Extend session
router.post('/:macAddress/extend', async (req, res) => {
  try {
    const { macAddress } = req.params;
    const { additionalMinutes } = req.body;

    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'macAddress is required'
      });
    }

    if (!additionalMinutes || typeof additionalMinutes !== 'number' || additionalMinutes <= 0) {
      return res.status(400).json({
        success: false,
        error: 'additionalMinutes must be a positive number'
      });
    }

    await sessionManager.extendSession(macAddress, additionalMinutes);

    res.json({
      success: true,
      message: `Session extended by ${additionalMinutes} minutes`
    });
  } catch (error) {
    console.error('Error extending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extend session'
    });
  }
});

// Get session statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = sessionManager.getSessionStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting session statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session statistics'
    });
  }
});

// Handle coin detection (this will be called by the hardware manager)
router.post('/coin/detected', async (req, res) => {
  try {
    const { macAddress } = req.body;

    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'macAddress is required'
      });
    }

    // Check if user already has an active session
    const existingSession = sessionManager.getSession(macAddress);
    
    if (existingSession && existingSession.active) {
      // Extend existing session by 30 minutes (1 peso)
      await sessionManager.extendSession(macAddress, 30);
      
      res.json({
        success: true,
        message: 'Session extended by 30 minutes',
        action: 'extended'
      });
    } else {
      // Start new session with 1 peso (30 minutes)
      const session = await sessionManager.startSession(macAddress, 1);
      
      res.json({
        success: true,
        message: 'New session started: 30 minutes',
        action: 'started',
        data: session
      });
    }
  } catch (error) {
    console.error('Error handling coin detection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle coin detection'
    });
  }
});

export default router;