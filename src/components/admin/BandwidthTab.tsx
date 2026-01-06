import React, { useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';

const BandwidthTab: React.FC = () => {
  const [cakeEnabled, setCakeEnabled] = useState(false);
  const [bandwidthKbps, setBandwidthKbps] = useState(20000);
  const [error, setError] = useState<string | null>(null);

  const toggleCake = async () => {
    try {
      if (!cakeEnabled) {
        const res = await fetch('/api/qos/cake/enable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bandwidthKbps })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to enable CAKE');
        }
        setCakeEnabled(true);
      } else {
        const res = await fetch('/api/qos/cake/disable', { method: 'POST' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to disable CAKE');
        }
        setCakeEnabled(false);
      }
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
        <p className="text-sm text-gray-500 mb-4">
          Global bandwidth limiter (CAKE QoS). When enabled, this automatically manages bandwidth for all connected devices to ensure fair usage and low latency.
        </p>
        <div className="flex items-center space-x-3 mb-4">
          <input
            type="number"
            value={bandwidthKbps}
            onChange={(e) => setBandwidthKbps(parseInt(e.target.value || '0', 10))}
            className="px-3 py-2 border border-gray-300 rounded-md w-40"
            placeholder="Bandwidth (Kbps)"
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
      </div>
    </div>
  );
};

export default BandwidthTab;
