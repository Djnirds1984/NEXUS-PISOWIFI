import React, { useState, useEffect } from 'react';
import { Wifi, Network, Settings, Plus, Trash2, RefreshCw, Shield } from 'lucide-react';

interface NetworkInterface {
  name: string;
  type: 'ethernet' | 'wireless' | 'vlan' | 'bridge';
  status: 'up' | 'down' | 'unknown';
  ipAddress?: string;
  macAddress?: string;
  gateway?: string;
  vlanId?: number;
  parent?: string;
}

interface NetworkStatus {
  interfaces: NetworkInterface[];
  defaultGateway: string;
  dnsServers: string[];
  internetConnected: boolean;
  hotspotActive: boolean;
  captivePortalActive: boolean;
}

const NetworkTab: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVLANForm, setShowVLANForm] = useState(false);
  const [showHotspotForm, setShowHotspotForm] = useState(false);
  const [vlanForm, setVLANForm] = useState({ parentInterface: '', vlanId: '' });
  const [hotspotForm, setHotspotForm] = useState({
    interface: '',
    ssid: 'PisoWiFi-Hotspot',
    password: 'pisowifi123',
    channel: '6',
    security: 'wpa2' as 'wpa2' | 'open'
  });

  useEffect(() => {
    fetchNetworkStatus();
    const interval = setInterval(fetchNetworkStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchNetworkStatus = async () => {
    try {
      const response = await fetch('/api/network/status');
      if (!response.ok) {
        throw new Error('Failed to fetch network status');
      }
      const result = await response.json();
      setNetworkStatus(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVLAN = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/network/vlan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentInterface: vlanForm.parentInterface,
          vlanId: parseInt(vlanForm.vlanId)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create VLAN');
      }

      await fetchNetworkStatus();
      setShowVLANForm(false);
      setVLANForm({ parentInterface: '', vlanId: '' });
      alert('VLAN created successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create VLAN');
    }
  };

  const handleDeleteVLAN = async (vlanName: string) => {
    if (!confirm(`Are you sure you want to delete VLAN ${vlanName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/network/vlan/${vlanName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete VLAN');
      }

      await fetchNetworkStatus();
      alert('VLAN deleted successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete VLAN');
    }
  };

  const handleSetupHotspot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/network/hotspot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interface: hotspotForm.interface,
          ssid: hotspotForm.ssid,
          password: hotspotForm.security === 'open' ? '' : hotspotForm.password,
          security: hotspotForm.security,
          channel: parseInt(hotspotForm.channel)
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const msg = data?.error || 'Failed to setup hotspot';
        throw new Error(msg);
      }

      await fetchNetworkStatus();
      setShowHotspotForm(false);
      alert('Hotspot configured successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to setup hotspot');
    }
  };

  const handleToggleCaptivePortal = async (enable: boolean) => {
    try {
      const endpoint = enable ? '/api/network/captive/enable' : '/api/network/captive/disable';
      const response = await fetch(endpoint, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to toggle captive portal');
      }

      await fetchNetworkStatus();
      alert(`Captive portal ${enable ? 'enabled' : 'disabled'} successfully!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle captive portal');
    }
  };

  const handleRestartNetworking = async () => {
    if (!confirm('Are you sure you want to restart networking services? This may temporarily disconnect users.')) {
      return;
    }

    try {
      const response = await fetch('/api/network/restart', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to restart networking');
      }

      alert('Networking services restarted successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restart networking');
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

  if (!networkStatus) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Network Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Network className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Network Interfaces</p>
              <p className="text-2xl font-bold text-gray-900">{networkStatus.interfaces.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${networkStatus.internetConnected ? 'bg-green-100' : 'bg-red-100'}`}>
              <Wifi className={`h-6 w-6 ${networkStatus.internetConnected ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Internet</p>
              <p className="text-lg font-bold text-gray-900">
                {networkStatus.internetConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${networkStatus.hotspotActive ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Wifi className={`h-6 w-6 ${networkStatus.hotspotActive ? 'text-green-600' : 'text-gray-600'}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Hotspot</p>
              <p className="text-lg font-bold text-gray-900">
                {networkStatus.hotspotActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${networkStatus.captivePortalActive ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Shield className={`h-6 w-6 ${networkStatus.captivePortalActive ? 'text-green-600' : 'text-gray-600'}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Captive Portal</p>
              <p className="text-lg font-bold text-gray-900">
                {networkStatus.captivePortalActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Network Interfaces */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Network className="h-5 w-5 mr-2 text-blue-600" />
            Network Interfaces
          </h3>
          <button
            onClick={fetchNetworkStatus}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
        <div className="space-y-4">
          {networkStatus.interfaces.map((iface) => (
            <div key={iface.name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">{iface.name}</h4>
                  <p className="text-sm text-gray-600 capitalize">{iface.type} Interface</p>
                  {iface.vlanId && (
                    <p className="text-sm text-gray-600">VLAN ID: {iface.vlanId}</p>
                  )}
                  {iface.parent && (
                    <p className="text-sm text-gray-600">Parent: {iface.parent}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    iface.status === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {iface.status.toUpperCase()}
                  </span>
                  {iface.type === 'vlan' && (
                    <button
                      onClick={() => handleDeleteVLAN(iface.name)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {iface.ipAddress && (
                  <div>
                    <span className="text-gray-600">IP Address:</span>
                    <p className="font-medium text-gray-900">{iface.ipAddress}</p>
                  </div>
                )}
                {iface.macAddress && (
                  <div>
                    <span className="text-gray-600">MAC Address:</span>
                    <p className="font-medium text-gray-900">{iface.macAddress}</p>
                  </div>
                )}
                {iface.gateway && (
                  <div>
                    <span className="text-gray-600">Gateway:</span>
                    <p className="font-medium text-gray-900">{iface.gateway}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2 text-blue-600" />
          Network Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => setShowVLANForm(true)}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4" />
            <span>Create VLAN</span>
          </button>

          <button
            onClick={() => setShowHotspotForm(true)}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <Wifi className="h-4 w-4" />
            <span>Setup Hotspot</span>
          </button>

          <button
            onClick={() => handleToggleCaptivePortal(!networkStatus.captivePortalActive)}
            className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-md focus:outline-none focus:ring-2 ${
              networkStatus.captivePortalActive
                ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>{networkStatus.captivePortalActive ? 'Disable' : 'Enable'} Captive Portal</span>
          </button>

          <button
            onClick={handleRestartNetworking}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Restart Networking</span>
          </button>
        </div>
      </div>

      {/* VLAN Form Modal */}
      {showVLANForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create VLAN</h3>
            <form onSubmit={handleCreateVLAN}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Interface
                  </label>
                  <select
                    value={vlanForm.parentInterface}
                    onChange={(e) => setVLANForm({ ...vlanForm, parentInterface: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select parent interface</option>
                    {networkStatus.interfaces
                      .filter(iface => iface.type === 'ethernet')
                      .map(iface => (
                        <option key={iface.name} value={iface.name}>{iface.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    VLAN ID
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4094"
                    value={vlanForm.vlanId}
                    onChange={(e) => setVLANForm({ ...vlanForm, vlanId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter VLAN ID (1-4094)"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowVLANForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Create VLAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hotspot Form Modal */}
      {showHotspotForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Setup Hotspot</h3>
            <form onSubmit={handleSetupHotspot}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interface
                  </label>
                  <select
                    value={hotspotForm.interface}
                    onChange={(e) => setHotspotForm({ ...hotspotForm, interface: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select wireless interface</option>
                    {networkStatus.interfaces
                      .filter(iface => iface.type === 'wireless')
                      .map(iface => (
                        <option key={iface.name} value={iface.name}>{iface.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SSID (Network Name)
                  </label>
                  <input
                    type="text"
                    value={hotspotForm.ssid}
                    onChange={(e) => setHotspotForm({ ...hotspotForm, ssid: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter network name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Security
                  </label>
                  <select
                    value={hotspotForm.security}
                    onChange={(e) => setHotspotForm({ ...hotspotForm, security: e.target.value as 'wpa2' | 'open' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="wpa2">WPA2-PSK</option>
                    <option value="open">Open (no password)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={hotspotForm.password}
                    onChange={(e) => setHotspotForm({ ...hotspotForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                    disabled={hotspotForm.security === 'open'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Channel
                  </label>
                  <select
                    value={hotspotForm.channel}
                    onChange={(e) => setHotspotForm({ ...hotspotForm, channel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[1, 6, 11].map(channel => (
                      <option key={channel} value={channel}>Channel {channel}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowHotspotForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Setup Hotspot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkTab;
