import React, { useEffect, useState } from 'react';
import { Database, Save, RefreshCw, Download } from 'lucide-react';

export default function DatabaseTab() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/db/settings');
      const data = await res.json();
      setSettings(data.data);
      setError(null);
    } catch (e) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveNetwork() {
    setSaving(true);
    try {
      const res = await fetch('/api/db/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network: settings.network })
      });
      if (!res.ok) throw new Error('Save failed');
      alert('Settings saved');
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function downloadBackup() {
    const res = await fetch('/api/db/export');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pisowifi.db';
    a.click();
    window.URL.revokeObjectURL(url);
  }
  
  async function resetDefaults() {
    if (!confirm('Reset all settings to defaults?')) return;
    const res = await fetch('/api/db/reset', { method: 'POST' });
    if (res.ok) {
      await fetchSettings();
      alert('Settings reset to defaults.');
    } else {
      alert('Failed to reset settings.');
    }
  }

  async function restoreFromBackup(file: File) {
    setRestoring(true);
    try {
      const form = new FormData();
      form.append('db', file);
      const res = await fetch('/api/db/restore', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Restore failed');
      await fetchSettings();
      alert('Database restored.');
    } catch {
      alert('Failed to restore database.');
    } finally {
      setRestoring(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Database className="h-6 w-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Database</p>
            <p className="text-2xl font-bold text-gray-900">SQLite</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={fetchSettings} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
              <RefreshCw className="h-4 w-4 inline mr-1" /> Refresh
            </button>
            <button onClick={downloadBackup} className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              <Download className="h-4 w-4 inline mr-1" /> Backup
            </button>
            <button onClick={resetDefaults} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
              Reset Defaults
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Network Settings</h3>
            <div className="space-y-3">
              <input className="w-full border rounded p-2" value={settings.network.lanInterface} onChange={e => setSettings({ ...settings, network: { ...settings.network, lanInterface: e.target.value }})} placeholder="LAN Interface" />
              <input className="w-full border rounded p-2" value={settings.network.gateway} onChange={e => setSettings({ ...settings, network: { ...settings.network, gateway: e.target.value }})} placeholder="Gateway" />
              <input className="w-full border rounded p-2" value={settings.network.dhcpRange} onChange={e => setSettings({ ...settings, network: { ...settings.network, dhcpRange: e.target.value }})} placeholder="DHCP Range" />
              <input className="w-full border rounded p-2" value={settings.network.ssid || ''} onChange={e => setSettings({ ...settings, network: { ...settings.network, ssid: e.target.value }})} placeholder="SSID" />
              <select className="w-full border rounded p-2" value={settings.network.security || 'wpa2'} onChange={e => setSettings({ ...settings, network: { ...settings.network, security: e.target.value }})}>
                <option value="wpa2">wpa2</option>
                <option value="open">open</option>
              </select>
              <input className="w-full border rounded p-2" type="password" value={settings.network.password || ''} onChange={e => setSettings({ ...settings, network: { ...settings.network, password: e.target.value }})} placeholder="Password" />
              <input className="w-full border rounded p-2" type="number" value={settings.network.channel || 6} onChange={e => setSettings({ ...settings, network: { ...settings.network, channel: parseInt(e.target.value) }})} placeholder="Channel" />
              <button disabled={saving} onClick={saveNetwork} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                <Save className="h-4 w-4 inline mr-1" /> Save
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">All Settings</h3>
            <pre className="text-xs bg-gray-50 border rounded p-3 overflow-auto h-72">{JSON.stringify(settings, null, 2)}</pre>
            <div className="mt-3">
              <label className="block text-sm font-medium mb-2">Restore from backup (.db)</label>
              <input type="file" accept=".db" onChange={e => e.target.files && e.target.files[0] && restoreFromBackup(e.target.files[0])} />
              {restoring && <p className="text-xs text-gray-500 mt-2">Restoring...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
