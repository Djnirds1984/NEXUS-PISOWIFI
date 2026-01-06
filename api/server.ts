/**
 * local server entry file, for local development
 */
import app from './app.js';
import { initializeDatabase } from './database.js';
import { hardwareManager } from './hardwareManager.js';
import { sessionManager } from './sessionManager.js';
import { networkManager } from './networkManager.js';
import path from 'path';
import fs from 'fs';

// Create data directory if it doesn't exist
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

// Initialize PISOWIFI system
async function initializePisoWiFi() {
  try {
    console.log('Initializing PisoWiFi system...');
    
    // Initialize database
    await initializeDatabase();
    console.log('✓ Database initialized');
    
    // Initialize hardware manager
    await hardwareManager.initialize();
    console.log('✓ Hardware manager initialized');
    
    // Set up coin detection callback
    hardwareManager.setupCoinDetection((pin: number) => {
      console.log(`Coin detected on pin ${pin}`);
      // Handle coin detection - this could trigger session creation
      // For now, we'll just log it
    });
    
    // Ensure captive portal rules are enabled
    try {
      await networkManager.enableCaptivePortal();
      console.log('✓ Captive portal enabled');
    } catch (e) {
      console.warn('Captive portal enable failed (will require proper network config):', e instanceof Error ? e.message : e);
    }
    
    // Initialize session manager (restores sessions and firewall rules)
    // Must run AFTER captive portal rules are set (to avoid flushing restored rules)
    try {
      await sessionManager.initialize();
      console.log('✓ Session manager initialized');
    } catch (e) {
      console.error('Failed to initialize session manager:', e);
    }
    
    try {
      const settings = (await import('./database.js')).getSettings();
      const net = settings.network;
      const auto = process.env.AUTOSTART_HOTSPOT !== 'false';
      if (auto) {
        await networkManager.setupHotspot({
          interface: net.lanInterface,
          ssid: net.ssid || 'PisoWiFi-Hotspot',
          password: net.security === 'open' ? '' : (net.password || 'pisowifi123'),
          security: net.security || 'wpa2',
          channel: net.channel || 6,
          ipAddress: net.gateway,
          dhcpRange: net.dhcpRange
        });
        console.log('✓ Hotspot autostart applied');
      }
    } catch (e) {
      console.warn('Hotspot autostart failed:', e instanceof Error ? e.message : e);
    }
    
    console.log('✓ PisoWiFi system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize PisoWiFi system:', error);
    process.exit(1);
  }
}

// Start server after initialization
initializePisoWiFi().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 PisoWiFi Server ready on port ${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`🌐 User Portal: http://localhost:${PORT}/portal`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received');
    sessionManager.cleanup();
    hardwareManager.cleanup();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received');
    sessionManager.cleanup();
    hardwareManager.cleanup();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
