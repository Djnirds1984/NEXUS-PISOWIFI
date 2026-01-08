import React, { useState, useEffect } from 'react';
import { BarChart3, Wifi, Settings, DollarSign, HardDrive, Network, Database, Users, Activity, Ticket, FileText, Shield } from 'lucide-react';
import DashboardTab from '../components/admin/DashboardTab';
import HardwareTab from '../components/admin/HardwareTab';
import NetworkTab from '../components/admin/NetworkTab';
import RatesTab from '../components/admin/RatesTab';
import PortalTab from '../components/admin/PortalTab';
import DatabaseTab from '../components/admin/DatabaseTab';
import DevicesTab from '../components/admin/DevicesTab';
import BandwidthTab from '../components/admin/BandwidthTab';
import VoucherTab from '../components/admin/VoucherTab';
import LogsTab from '../components/admin/LogsTab';
import SystemSettingsTab from '../components/admin/SystemSettingsTab';
import AdminLogin from '../components/admin/AdminLogin';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authHeader = localStorage.getItem('adminAuth');
      const headers: HeadersInit = {};
      
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      const response = await fetch('/api/admin/dashboard', {
        method: 'GET',
        headers,
      });
      
      if (response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('adminAuth');
      } else if (response.ok) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      localStorage.removeItem('adminAuth');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'hardware', name: 'Hardware', icon: HardDrive },
    { id: 'network', name: 'Network', icon: Network },
    { id: 'rates', name: 'Rates', icon: DollarSign },
    { id: 'portal', name: 'Portal', icon: Settings },
    { id: 'devices', name: 'Devices', icon: Users },
    { id: 'bandwidth', name: 'Bandwidth', icon: Activity },
    { id: 'vouchers', name: 'Vouchers', icon: Ticket },
    { id: 'logs', name: 'System Logs', icon: FileText },
    { id: 'database', name: 'Database', icon: Database },
    { id: 'system', name: 'System Settings', icon: Shield },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'hardware':
        return <HardwareTab />;
      case 'network':
        return <NetworkTab />;
      case 'rates':
        return <RatesTab />;
      case 'portal':
        return <PortalTab />;
      case 'database':
        return <DatabaseTab />;
      case 'devices':
        return <DevicesTab />;
      case 'bandwidth':
        return <BandwidthTab />;
      case 'vouchers':
        return <VoucherTab />;
      case 'logs':
        return <LogsTab />;
      case 'system':
        return <SystemSettingsTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Wifi className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">NEXUS PisoWiFi</h1>
                <p className="text-sm text-gray-500">Admin Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                System Online
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64">
            <nav className="bg-white rounded-lg shadow-sm p-4">
              <ul className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <li key={tab.id}>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{tab.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {tabs.find(tab => tab.id === activeTab)?.name}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {getTabDescription(activeTab)}
                  </p>
                </div>
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function getTabDescription(tab: string): string {
  const descriptions = {
    dashboard: 'Overview of system status, sessions, and revenue',
    hardware: 'Configure GPIO pins and monitor hardware status',
    network: 'Manage network interfaces, VLANs, and hotspot settings',
    rates: 'Set pricing for different time periods',
    portal: 'Customize the user portal appearance and messages',
    devices: 'Manage connected devices and settings',
    bandwidth: 'Limit and monitor per-device bandwidth, manage QoS',
    database: 'Manage SQLite settings and backups'
  };
  return descriptions[tab as keyof typeof descriptions] || '';
}

export default AdminDashboard;
