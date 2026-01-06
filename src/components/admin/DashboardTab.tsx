import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Clock, Wifi, HardDrive, Activity, TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardData {
  sessions: {
    totalSessions: number;
    activeSessions: number;
    totalRevenue: number;
    averageSessionDuration: number;
    todayRevenue: number;
    todayActiveSessions: number;
  };
  hardware: {
    platform: string;
    gpioAvailable: boolean;
    mockMode: boolean;
    lastCoinPulse: string | null;
    totalCoinsToday: number;
  };
  network: {
    interfaces: number;
    internetConnected: boolean;
    hotspotActive: boolean;
    captivePortalActive: boolean;
  };
  system: {
    uptime: number;
    memory: any;
    timestamp: string;
  };
}

const DashboardTab: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/admin/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const result = await response.json();
      setDashboardData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount);
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

  if (!dashboardData) {
    return null;
  }

  const { sessions, hardware, network, system } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{sessions.activeSessions}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">{sessions.todayActiveSessions} today</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(sessions.totalRevenue)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">{formatCurrency(sessions.todayRevenue)} today</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Session</p>
              <p className="text-2xl font-bold text-gray-900">{sessions.averageSessionDuration}m</p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Total sessions: {sessions.totalSessions}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <HardDrive className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Coins Today</p>
              <p className="text-2xl font-bold text-gray-900">{hardware.totalCoinsToday}</p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Platform: {hardware.platform}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-blue-600" />
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Platform</span>
              <span className="text-sm font-medium text-gray-900 capitalize">{hardware.platform}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">GPIO Available</span>
              <span className={`text-sm font-medium ${hardware.gpioAvailable ? 'text-green-600' : 'text-red-600'}`}>
                {hardware.gpioAvailable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Mock Mode</span>
              <span className={`text-sm font-medium ${hardware.mockMode ? 'text-yellow-600' : 'text-green-600'}`}>
                {hardware.mockMode ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Uptime</span>
              <span className="text-sm font-medium text-gray-900">{formatDuration(Math.floor(system.uptime))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Coin Pulse</span>
              <span className="text-sm font-medium text-gray-900">
                {hardware.lastCoinPulse ? new Date(hardware.lastCoinPulse).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Wifi className="h-5 w-5 mr-2 text-blue-600" />
            Network Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Internet Connection</span>
              <span className={`text-sm font-medium ${network.internetConnected ? 'text-green-600' : 'text-red-600'}`}>
                {network.internetConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Hotspot Active</span>
              <span className={`text-sm font-medium ${network.hotspotActive ? 'text-green-600' : 'text-red-600'}`}>
                {network.hotspotActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Captive Portal</span>
              <span className={`text-sm font-medium ${network.captivePortalActive ? 'text-green-600' : 'text-red-600'}`}>
                {network.captivePortalActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Network Interfaces</span>
              <span className="text-sm font-medium text-gray-900">{network.interfaces}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Last Updated</span>
            <p className="font-medium text-gray-900">{new Date(system.timestamp).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-gray-600">Memory Usage</span>
            <p className="font-medium text-gray-900">
              {Math.round(system.memory.used / 1024 / 1024)}MB / {Math.round(system.memory.total / 1024 / 1024)}MB
            </p>
          </div>
          <div>
            <span className="text-gray-600">System Status</span>
            <p className="font-medium text-green-600">Online</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;