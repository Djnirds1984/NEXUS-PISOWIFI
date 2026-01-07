import React, { useState, useEffect } from 'react';
import { RefreshCw, FileText, AlertCircle, Terminal } from 'lucide-react';

const LogsTab: React.FC = () => {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [service, setService] = useState('dnsmasq');
  const [lines, setLines] = useState(50);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/logs?service=${service}&lines=${lines}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || 'No logs found.');
      } else {
        setError(data.error || 'Failed to fetch logs');
      }
    } catch (err) {
      setError('An error occurred while fetching logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [service, lines]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Terminal className="w-6 h-6 mr-2 text-blue-600" />
            System Logs
          </h2>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>
        </div>

        <div className="flex space-x-4 mb-6">
          <div className="w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="dnsmasq">dnsmasq (DHCP/DNS)</option>
              <option value="hostapd">hostapd (Hotspot)</option>
              <option value="nexus-pisowifi">nexus-pisowifi (App)</option>
              <option value="dhcpcd">dhcpcd</option>
              <option value="networking">networking</option>
            </select>
          </div>
          <div className="w-1/4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Lines</label>
            <select
              value={lines}
              onChange={(e) => setLines(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
            {logs || 'No logs available.'}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default LogsTab;
