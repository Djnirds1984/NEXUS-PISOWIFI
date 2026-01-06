import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Device {
  macAddress: string;
  ipAddress?: string;
  hostname?: string;
  bandwidthCapKbps?: number;
  connected?: boolean;
}

const BandwidthTab: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [cakeEnabled, setCakeEnabled] = useState(false);
  const [bandwidthKbps, setBandwidthKbps] = useState(20000);
  const [usage, setUsage] = useState<Record<string, number[]>>({});
  const [error, setError] = useState<string | null>(null);

  const loadDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      setDevices(data.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  useEffect(() => {
    loadDevices();
    const t = setInterval(async () => {
      const list = devices.filter(d => d.ipAddress && d.connected);
      const next: Record<string, number[]> = { ...usage };
      for (const d of list) {
        const res = await fetch(`/api/devices/usage?ip=${encodeURIComponent(d.ipAddress!)}`);
        const json = await res.json();
        const arr = next[d.macAddress] || [];
        const bytes = (json.data?.bytes as number) || 0;
        next[d.macAddress] = [...arr.slice(-19), bytes];
      }
      setUsage(next);
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);

  const toggleCake = async () => {
    try {
      if (!cakeEnabled) {
        const res = await fetch('/api/qos/cake/enable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bandwidthKbps })
        });
        if (!res.ok) throw new Error('Failed to enable CAKE');
        setCakeEnabled(true);
      } else {
        const res = await fetch('/api/qos/cake/disable', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to disable CAKE');
        setCakeEnabled(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const setCap = async (ip: string, capKbps: number) => {
    try {
      const res = await fetch('/api/devices/cap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, capKbps })
      });
      if (!res.ok) throw new Error('Failed to set cap');
      loadDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="h-5 w-5 mr-2 text-blue-600" />
          Bandwidth Limiter
        </h3>
        <div className="flex items-center space-x-3 mb-4">
          <input
            type="number"
            value={bandwidthKbps}
            onChange={(e) => setBandwidthKbps(parseInt(e.target.value || '0', 10))}
            className="px-3 py-2 border border-gray-300 rounded-md w-40"
          />
          <button
            onClick={toggleCake}
            className={`px-4 py-2 rounded-md text-white ${cakeEnabled ? 'bg-red-600' : 'bg-green-600'}`}
          >
            {cakeEnabled ? 'Disable CAKE QoS' : 'Enable CAKE QoS'}
          </button>
          {error && (
            <div className="flex items-center text-red-600">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Device</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">IP</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Cap (kbps)</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Usage</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {devices.map(d => (
                <tr key={d.macAddress}>
                  <td className="px-4 py-2 text-sm">{d.hostname || d.macAddress}</td>
                  <td className="px-4 py-2 text-sm">{d.ipAddress || ''}</td>
                  <td className="px-4 py-2 text-sm">
                    <input
                      type="number"
                      defaultValue={d.bandwidthCapKbps || 0}
                      onBlur={(e) => d.ipAddress && setCap(d.ipAddress, parseInt(e.target.value || '0', 10))}
                      className="px-2 py-1 border border-gray-300 rounded w-24"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <div className="h-24 w-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={(usage[d.macAddress] || []).map((b, i) => ({ t: i, v: b }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="t" hide />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="v" stroke="#3b82f6" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-1 rounded ${d.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {d.connected ? 'Online' : 'Offline'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BandwidthTab;
