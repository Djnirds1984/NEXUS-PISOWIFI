import React, { useState, useEffect } from 'react';
import { Settings, Zap, Circle, Play, Square } from 'lucide-react';

interface HardwareStatus {
  platform: string;
  gpioAvailable: boolean;
  coinSlotPin: number;
  statusLEDPin: number;
  mockMode: boolean;
  rpioLoaded: boolean;
  lastCoinPulse: string | null;
  totalCoinsToday: number;
}

const HardwareTab: React.FC = () => {
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatus | null>(null);
  const [availablePins, setAvailablePins] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState({ coinSlotPin: 15, statusLEDPin: 16 });
  const [saving, setSaving] = useState(false);
  const [ledState, setLedState] = useState(false);

  useEffect(() => {
    fetchHardwareStatus();
    fetchAvailablePins();
    const interval = setInterval(fetchHardwareStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchHardwareStatus = async () => {
    try {
      const response = await fetch('/api/hardware/status');
      if (!response.ok) {
        throw new Error('Failed to fetch hardware status');
      }
      const result = await response.json();
      setHardwareStatus(result.data);
      if (result.data) {
        setConfig({
          coinSlotPin: result.data.coinSlotPin,
          statusLEDPin: result.data.statusLEDPin
        });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePins = async () => {
    try {
      const response = await fetch('/api/hardware/pins');
      if (!response.ok) {
        throw new Error('Failed to fetch available pins');
      }
      const result = await response.json();
      setAvailablePins(result.data);
    } catch (err) {
      console.error('Error fetching available pins:', err);
    }
  };

  const handleConfigUpdate = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/hardware/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to update hardware configuration');
      }

      await fetchHardwareStatus();
      alert('Hardware configuration updated successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleLEDControl = async (state: boolean) => {
    try {
      const response = await fetch('/api/hardware/led', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state }),
      });

      if (!response.ok) {
        throw new Error('Failed to control LED');
      }

      setLedState(state);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to control LED');
    }
  };

  const handleLEDBlink = async () => {
    try {
      const response = await fetch('/api/hardware/led/blink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ duration: 1000 }),
      });

      if (!response.ok) {
        throw new Error('Failed to blink LED');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to blink LED');
    }
  };

  const simulateCoinPulse = async () => {
    try {
      const response = await fetch('/api/hardware/coin/simulate', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to simulate coin pulse');
      }

      alert('Coin pulse simulated!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to simulate coin pulse');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-400">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hardwareStatus) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Hardware Status */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="h-5 w-5 mr-2 text-blue-600" />
          Hardware Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Platform</div>
            <div className="text-lg font-semibold text-gray-900 capitalize">{hardwareStatus.platform}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">GPIO Available</div>
            <div className={`text-lg font-semibold ${hardwareStatus.gpioAvailable ? 'text-green-600' : 'text-red-600'}`}>
              {hardwareStatus.gpioAvailable ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Mock Mode</div>
            <div className={`text-lg font-semibold ${hardwareStatus.mockMode ? 'text-yellow-600' : 'text-green-600'}`}>
              {hardwareStatus.mockMode ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Coins Today</div>
            <div className="text-lg font-semibold text-gray-900">{hardwareStatus.totalCoinsToday}</div>
          </div>
        </div>
        {hardwareStatus.lastCoinPulse && (
          <div className="mt-4 text-sm text-gray-600">
            Last coin pulse: {new Date(hardwareStatus.lastCoinPulse).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* GPIO Configuration */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2 text-blue-600" />
          GPIO Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coin Slot Pin
            </label>
            <select
              value={config.coinSlotPin}
              onChange={(e) => setConfig({ ...config, coinSlotPin: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availablePins.map(pin => (
                <option key={pin} value={pin}>Pin {pin}</option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">Physical pin number for coin slot input</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status LED Pin
            </label>
            <select
              value={config.statusLEDPin}
              onChange={(e) => setConfig({ ...config, statusLEDPin: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availablePins.map(pin => (
                <option key={pin} value={pin}>Pin {pin}</option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">Physical pin number for status LED</p>
          </div>
        </div>
        <div className="mt-6">
          <button
            onClick={handleConfigUpdate}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Update Configuration'}
          </button>
        </div>
      </div>

      {/* LED Control */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Circle className="h-5 w-5 mr-2 text-blue-600" />
          Status LED Control
        </h3>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => handleLEDControl(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <Play className="h-4 w-4" />
            <span>Turn On</span>
          </button>
          <button
            onClick={() => handleLEDControl(false)}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <Square className="h-4 w-4" />
            <span>Turn Off</span>
          </button>
          <button
            onClick={handleLEDBlink}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Circle className="h-4 w-4" />
            <span>Blink (1s)</span>
          </button>
        </div>
        <div className="mt-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${ledState ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="text-sm text-gray-600">LED Status: {ledState ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      </div>

      {/* Testing */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Testing</h3>
        <div className="space-y-4">
          <div>
            <button
              onClick={simulateCoinPulse}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              Simulate Coin Pulse
            </button>
            <p className="text-sm text-gray-500 mt-2">
              This will simulate a coin detection event for testing purposes.
            </p>
          </div>
          {process.env.NODE_ENV === 'production' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="text-yellow-400">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Testing features are disabled in production mode.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HardwareTab;