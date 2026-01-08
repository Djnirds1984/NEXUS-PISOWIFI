import React, { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Edit, Save, Pause, Play } from 'lucide-react';

interface Device {
  macAddress: string;
  ipAddress?: string;
  hostname?: string;
  firstSeen?: string;
  lastSeen?: string;
  connected?: boolean;
  timeLimitMinutes?: number;
  usageSeconds?: number;
  notes?: string;
  bandwidthCapKbps?: number;
  priority?: number;
}

const DevicesTab: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState<{ macAddress: string; timeLimitMinutes: number }>({ macAddress: '', timeLimitMinutes: 0 });
  const [editing, setEditing] = useState<Record<string, Device>>({});
  const [countdown, setCountdown] = useState<Record<string, number>>({});
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      if (!res.ok) throw new Error('Failed to load devices');
      const data = await res.json();
      const list: Device[] = data.data || [];
      setDevices(list);
      try {
        const sres = await fetch('/api/session/active');
        if (sres.ok) {
          const sdata = await sres.json();
          const active = (sdata.data || []) as Array<{ macAddress: string; timeRemaining: number; paused?: boolean }>;
          const map: Record<string, number> = {};
          const pmap: Record<string, boolean> = {};
          for (const s of active) {
            map[s.macAddress] = s.timeRemaining || 0;
            pmap[s.macAddress] = !!s.paused;
          }
          setCountdown(map);
          setPaused(pmap);
        }
      } catch {
        setCountdown(prev => prev);
        setPaused(prev => prev);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const t = setInterval(fetchDevices, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        const next: Record<string, number> = {};
        for (const k of Object.keys(prev)) {
          const isPaused = paused[k];
          next[k] = Math.max(0, (prev[k] || 0) - (isPaused ? 0 : 1));
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [paused]);

  const setActionBusy = (mac: string, busy: boolean) => {
    setActionLoading(prev => ({ ...prev, [mac]: busy }));
  };

  const handlePause = async (mac: string) => {
    try {
      setError(null);
      setActionBusy(mac, true);
      setPaused(prev => ({ ...prev, [mac]: true }));
      const res = await fetch('/api/portal/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: mac })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPaused(prev => ({ ...prev, [mac]: false }));
        throw new Error(data.error || 'Failed to pause session');
      }
      await fetchDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error pausing session');
    } finally {
      setActionBusy(mac, false);
    }
  };

  const handleResume = async (mac: string) => {
    try {
      setError(null);
      setActionBusy(mac, true);
      setPaused(prev => ({ ...prev, [mac]: false }));
      const res = await fetch('/api/portal/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: mac })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPaused(prev => ({ ...prev, [mac]: true }));
        throw new Error(data.error || 'Failed to resume session');
      }
      await fetchDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error resuming session');
    } finally {
      setActionBusy(mac, false);
    }
  };

  const handleAdd = async () => {
    try {
      if (!newDevice.macAddress) return;
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: newDevice.macAddress, timeLimitMinutes: newDevice.timeLimitMinutes })
      });
      if (!res.ok) throw new Error('Failed to add device');
      setNewDevice({ macAddress: '', timeLimitMinutes: 0 });
      fetchDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const startEdit = (d: Device) => {
    setEditing({ ...editing, [d.macAddress]: { ...d } });
  };

  const saveEdit = async (mac: string) => {
    try {
      const payload = editing[mac];
      const res = await fetch(`/api/devices/${mac}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update device');
      const next = { ...editing };
      delete next[mac];
      setEditing(next);
      fetchDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleDelete = async (mac: string) => {
    try {
      const res = await fetch(`/api/devices/${mac}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Devices
          </h3>
          <button
            onClick={fetchDevices}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md"
          >
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input
            value={newDevice.macAddress}
            onChange={(e) => setNewDevice({ ...newDevice, macAddress: e.target.value })}
            placeholder="MAC address"
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
          <input
            type="number"
            value={newDevice.timeLimitMinutes}
            onChange={(e) => setNewDevice({ ...newDevice, timeLimitMinutes: parseInt(e.target.value || '0', 10) })}
            placeholder="Time limit (minutes)"
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={handleAdd}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
          {error && <div className="text-red-600">{error}</div>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">MAC</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">IP</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Hostname</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Connected</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time Limit</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time Remaining</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">First Seen</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Last Seen</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Bandwidth Cap</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {devices.map(d => {
                const edit = editing[d.macAddress];
                return (
                  <tr key={d.macAddress}>
                    <td className="px-4 py-2 text-sm">{d.macAddress}</td>
                    <td className="px-4 py-2 text-sm">{edit ? edit.ipAddress : d.ipAddress}</td>
                    <td className="px-4 py-2 text-sm">
                      {edit ? (
                        <input
                          value={edit.hostname || ''}
                          onChange={(e) => setEditing({ ...editing, [d.macAddress]: { ...edit, hostname: e.target.value } })}
                          className="px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        d.hostname || ''
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-1 rounded ${d.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {d.connected ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {edit ? (
                        <input
                          type="number"
                          value={edit.timeLimitMinutes || 0}
                          onChange={(e) => setEditing({ ...editing, [d.macAddress]: { ...edit, timeLimitMinutes: parseInt(e.target.value || '0', 10) } })}
                          className="px-2 py-1 border border-gray-300 rounded w-24"
                        />
                      ) : (
                        d.timeLimitMinutes || 0
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`font-mono ${((countdown[d.macAddress] || 0) > 5) ? 'text-green-700' : 'text-red-700'}`}>
                        {(() => {
                          const s = Math.max(0, countdown[d.macAddress] || 0);
                          const h = Math.floor(s / 3600);
                          const m = Math.floor((s % 3600) / 60);
                          const sec = s % 60;
                          const hh = h.toString().padStart(2, '0');
                          const mm = m.toString().padStart(2, '0');
                          const ss = sec.toString().padStart(2, '0');
                          return `${hh}:${mm}:${ss}`;
                        })()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-1 rounded ${paused[d.macAddress] ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {paused[d.macAddress] ? 'Paused' : 'Running'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">{d.firstSeen ? new Date(d.firstSeen).toLocaleString() : ''}</td>
                    <td className="px-4 py-2 text-sm">{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : ''}</td>
                    <td className="px-4 py-2 text-sm">
                      {edit ? (
                        <input
                          type="number"
                          value={edit.bandwidthCapKbps || 0}
                          onChange={(e) => setEditing({ ...editing, [d.macAddress]: { ...edit, bandwidthCapKbps: parseInt(e.target.value || '0', 10) } })}
                          className="px-2 py-1 border border-gray-300 rounded w-24"
                        />
                      ) : (
                        d.bandwidthCapKbps || 0
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {edit ? (
                        <button
                          onClick={() => saveEdit(d.macAddress)}
                          className="px-3 py-1 bg-green-600 text-white rounded-md flex items-center space-x-2"
                        >
                          <Save className="h-4 w-4" />
                          <span>Save</span>
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => startEdit(d)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md flex items-center space-x-2"
                          >
                            <Edit className="h-4 w-4" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => (paused[d.macAddress] ? handleResume(d.macAddress) : handlePause(d.macAddress))}
                            disabled={actionLoading[d.macAddress] || (countdown[d.macAddress] || 0) <= 0}
                            title={paused[d.macAddress] ? 'Resume internet access for this device' : 'Pause internet access and freeze session time'}
                            className={`px-3 py-1 ${paused[d.macAddress] ? 'bg-green-600' : 'bg-yellow-600'} text-white rounded-md flex items-center space-x-2 disabled:opacity-50`}
                          >
                            {paused[d.macAddress] ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                            <span>{paused[d.macAddress] ? 'Resume' : 'Pause'}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(d.macAddress)}
                            className="px-3 py-1 bg-red-600 text-white rounded-md flex items-center space-x-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DevicesTab;
