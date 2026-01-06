import { execSync } from 'child_process';
import fs from 'fs';
import { getSettings, updateSettings } from './database.js';
import { coinEvents } from './coinEvents.js';

export interface HardwareStatus {
  platform: string;
  gpioAvailable: boolean;
  coinSlotPin: number;
  statusLEDPin: number;
  mockMode: boolean;
  rpioLoaded: boolean;
  lastCoinPulse: Date | null;
  totalCoinsToday: number;
}

export interface PlatformInfo {
  type: 'raspberry-pi' | 'orange-pi' | 'ubuntu-x64' | 'unknown';
  gpioSupported: boolean;
  description: string;
}

export class HardwareManager {
  private rpio: any = null;
  private coinCallback: ((pin: number) => void) | null = null;
  private status: HardwareStatus;
  private coinPulseCount: number = 0;
  private lastPulseReset: Date = new Date();

  constructor() {
    this.status = {
      platform: 'unknown',
      gpioAvailable: false,
      coinSlotPin: 15,
      statusLEDPin: 16,
      mockMode: false,
      rpioLoaded: false,
      lastCoinPulse: null,
      totalCoinsToday: 0
    };
  }

  async initialize(): Promise<void> {
    try {
      // Load settings from database
      const settings = getSettings();
      this.status.coinSlotPin = settings.hardware.coinSlotPin;
      this.status.statusLEDPin = settings.hardware.statusLEDPin;
      this.status.mockMode = settings.hardware.mockMode;

      // Detect platform
      const platform = this.detectPlatform();
      this.status.platform = platform.type;
      this.status.gpioAvailable = platform.gpioSupported;

      // Initialize GPIO if available
      if (platform.gpioSupported && !this.status.mockMode) {
        await this.initializeGPIO();
      } else {
        console.log('Running in mock mode - GPIO operations will be simulated');
        this.status.mockMode = true;
      }

      // Update settings with detected platform
      updateSettings({
        hardware: {
          ...settings.hardware,
          platform: platform.type as any,
          mockMode: this.status.mockMode
        }
      });

      console.log(`Hardware manager initialized: ${platform.description}`);
      console.log(`GPIO Available: ${this.status.gpioAvailable}, Mock Mode: ${this.status.mockMode}`);

    } catch (error) {
      console.error('Error initializing hardware manager:', error);
      throw error;
    }
  }

  detectPlatform(): PlatformInfo {
    try {
      // Check for Raspberry Pi
      try {
        const modelPath = '/proc/device-tree/model';
        if (fs.existsSync(modelPath)) {
          const model = fs.readFileSync(modelPath, 'utf8').toLowerCase();
          if (model.includes('raspberry pi')) {
            return {
              type: 'raspberry-pi',
              gpioSupported: true,
              description: 'Raspberry Pi detected',
            };
          }
          if (model.includes('orange pi')) {
            return {
              type: 'orange-pi',
              gpioSupported: true,
              description: 'Orange Pi detected',
            };
          }
        }
        // Fallback: check cpuinfo for Broadcom chips
        const cpuInfo = execSync('cat /proc/cpuinfo', { encoding: 'utf8' });
        if (cpuInfo.includes('BCM2835') || cpuInfo.includes('BCM2837') || cpuInfo.includes('BCM2711')) {
          return {
            type: 'raspberry-pi',
            gpioSupported: true,
            description: 'Raspberry Pi detected'
          };
        }
      } catch (error) {
        // Not a Raspberry Pi or can't read cpuinfo
      }

      // Check for Orange Pi
      try {
        const boardInfo = execSync('cat /etc/armbian-release', { encoding: 'utf8' });
        if (boardInfo.includes('orangepi')) {
          return {
            type: 'orange-pi',
            gpioSupported: true,
            description: 'Orange Pi (Armbian) detected'
          };
        }
      } catch (error) {
        // Not an Orange Pi or can't read armbian-release
      }

      // Check for Allwinner chipset (Orange Pi)
      try {
        const sunxiInfo = execSync('cat /proc/cpuinfo | grep sunxi', { encoding: 'utf8' });
        if (sunxiInfo.includes('sunxi')) {
          return {
            type: 'orange-pi',
            gpioSupported: true,
            description: 'Allwinner chipset (Orange Pi family) detected'
          };
        }
      } catch (error) {
        // Not an Allwinner chipset
      }

      // Check if running on Ubuntu x64
      try {
        const osInfo = execSync('uname -m', { encoding: 'utf8' });
        if (osInfo.includes('x86_64') || osInfo.includes('amd64')) {
          return {
            type: 'ubuntu-x64',
            gpioSupported: false,
            description: 'Ubuntu x64 system detected (development mode)'
          };
        }
      } catch (error) {
        // Can't determine architecture
      }

      return {
        type: 'unknown',
        gpioSupported: false,
        description: 'Unknown platform - running in mock mode'
      };

    } catch (error) {
      return {
        type: 'unknown',
        gpioSupported: false,
        description: 'Error detecting platform - running in mock mode'
      };
    }
  }

  async initializeGPIO(): Promise<void> {
    try {
      // Try to load rpio library
      this.rpio = await import('rpio');
      this.status.rpioLoaded = true;
      // Use physical pin mapping so numbers match board silkscreen
      this.rpio.init({ gpiomem: true, mapping: 'physical' });

      // Initialize GPIO pins
      this.rpio.open(this.status.coinSlotPin, this.rpio.INPUT, this.rpio.PULL_UP);
      this.rpio.open(this.status.statusLEDPin, this.rpio.OUTPUT, this.rpio.LOW);

      console.log('GPIO initialized successfully');

    } catch (error) {
      console.warn('Failed to initialize GPIO, falling back to mock mode:', error);
      this.status.mockMode = true;
      this.status.rpioLoaded = false;
    }
  }

  setupCoinDetection(callback: (pin: number) => void): void {
    this.coinCallback = callback;

    if (this.status.mockMode || !this.rpio) {
      console.log('Coin detection running in mock mode (simulation disabled)');
      return;
    }

    try {
      // Set up interrupt-based coin detection
      this.rpio.poll(this.status.coinSlotPin, (pin: number) => {
        if (this.rpio.read(pin) === 0) { // Pulse detected (active low)
          this.handleCoinPulse(pin);
        }
      }, this.rpio.POLL_LOW);

      console.log(`Coin detection set up on pin ${this.status.coinSlotPin}`);

    } catch (error) {
      console.error('Error setting up coin detection:', error);
      this.status.mockMode = true;
    }
  }

  private handleCoinPulse(pin: number): void {
    const now = new Date();
    this.status.lastCoinPulse = now;
    this.coinPulseCount++;

    // Reset daily counter if it's a new day
    if (now.getDate() !== this.lastPulseReset.getDate()) {
      this.status.totalCoinsToday = 0;
      this.lastPulseReset = now;
    }

    this.status.totalCoinsToday++;

    console.log(`Coin pulse detected on pin ${pin} (${this.coinPulseCount} total, ${this.status.totalCoinsToday} today)`);

    // Trigger callback
    if (this.coinCallback) {
      this.coinCallback(pin);
    }
    // Emit global coin event for subscribers
    coinEvents.emit('coin', { pin, timestamp: now.toISOString() });

    // Visual feedback - blink status LED
    this.blinkStatusLED(200);
  }

  blinkStatusLED(duration: number = 500): void {
    if (this.status.mockMode || !this.rpio) {
      console.log(`[MOCK] Status LED blink for ${duration}ms`);
      return;
    }

    try {
      this.rpio.write(this.status.statusLEDPin, this.rpio.HIGH);
      setTimeout(() => {
        this.rpio.write(this.status.statusLEDPin, this.rpio.LOW);
      }, duration);
    } catch (error) {
      console.error('Error blinking status LED:', error);
    }
  }

  setStatusLED(state: boolean): void {
    if (this.status.mockMode || !this.rpio) {
      console.log(`[MOCK] Status LED ${state ? 'ON' : 'OFF'}`);
      return;
    }

    try {
      this.rpio.write(this.status.statusLEDPin, state ? this.rpio.HIGH : this.rpio.LOW);
    } catch (error) {
      console.error('Error setting status LED:', error);
    }
  }

  updatePinConfiguration(coinSlotPin: number, statusLEDPin: number): void {
    // Clean up existing pins if GPIO is active
    if (!this.status.mockMode && this.rpio) {
      try {
        this.rpio.close(this.status.coinSlotPin);
        this.rpio.close(this.status.statusLEDPin);
      } catch (error) {
        console.warn('Error closing existing pins:', error);
      }
    }

    // Update configuration
    this.status.coinSlotPin = coinSlotPin;
    this.status.statusLEDPin = statusLEDPin;

    // Reinitialize pins if GPIO is active
    if (!this.status.mockMode && this.rpio) {
      this.initializeGPIO();
      if (this.coinCallback) {
        this.setupCoinDetection(this.coinCallback);
      }
    }

    // Update database
    const settings = getSettings();
    updateSettings({
      hardware: {
        ...settings.hardware,
        coinSlotPin,
        statusLEDPin
      }
    });

    console.log(`Pin configuration updated - Coin: ${coinSlotPin}, LED: ${statusLEDPin}`);
  }

  getHardwareStatus(): HardwareStatus {
    return { ...this.status };
  }

  getAvailablePins(): number[] {
    // Return available GPIO pins for the current platform
    const platform = this.status.platform;
    
    if (platform === 'raspberry-pi') {
      // Raspberry Pi GPIO pins (physical pin numbers)
      return [3, 5, 7, 8, 10, 11, 12, 13, 15, 16, 18, 19, 21, 22, 23, 24, 26, 29, 31, 32, 33, 35, 36, 37, 38, 40];
    } else if (platform === 'orange-pi') {
      // Orange Pi GPIO pins (may vary by model)
      return [3, 5, 7, 8, 10, 11, 12, 13, 15, 16, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29, 31, 32, 33, 35, 36, 37, 38, 40];
    } else {
      // Mock mode - return common pins
      return [3, 5, 7, 8, 10, 11, 12, 13, 15, 16, 18, 19, 21, 22, 23, 24, 26, 29, 31, 32, 33, 35, 36, 37, 38, 40];
    }
  }

  cleanup(): void {
    if (!this.status.mockMode && this.rpio) {
      try {
        this.rpio.close(this.status.coinSlotPin);
        this.rpio.close(this.status.statusLEDPin);
        console.log('GPIO pins cleaned up');
      } catch (error) {
        console.error('Error cleaning up GPIO pins:', error);
      }
    }
  }

  setMockMode(enabled: boolean): boolean {
    const prev = this.status.mockMode;
    this.status.mockMode = enabled;

    const settings = getSettings();
    updateSettings({
      hardware: {
        ...settings.hardware,
        mockMode: enabled
      }
    });

    if (!enabled) {
      try {
        const platform = this.detectPlatform();
        this.status.platform = platform.type;
        this.status.gpioAvailable = platform.gpioSupported;
        if (platform.gpioSupported) {
          this.initializeGPIO();
          if (this.coinCallback) {
            this.setupCoinDetection(this.coinCallback);
          }
        }
      } catch (e) {
        this.status.mockMode = true;
      }
    } else {
      if (this.rpio) {
        try {
          this.rpio.close(this.status.coinSlotPin);
          this.rpio.close(this.status.statusLEDPin);
        } catch {}
        this.rpio = null;
        this.status.rpioLoaded = false;
      }
    }

    return prev !== this.status.mockMode;
  }
}

// Export singleton instance
export const hardwareManager = new HardwareManager();
