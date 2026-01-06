import { Link } from 'react-router-dom';
import { Settings, Wifi, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wifi className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">NEXUS PISOWIFI</h1>
          <p className="text-lg text-gray-600">Coin-Operated WiFi Management System</p>
        </div>

        {/* Navigation Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Admin Dashboard */}
          <Link 
            to="/admin" 
            className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-blue-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Admin Dashboard</h2>
            <p className="text-gray-600 mb-4">
              Manage hardware settings, network configuration, rates, and system monitoring.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                Hardware Control
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                Network Management
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                Session Monitoring
              </span>
            </div>
          </Link>

          {/* User Portal */}
          <Link 
            to="/portal" 
            className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-green-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <Wifi className="w-6 h-6 text-white" />
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-green-600 transition-colors" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">User Portal</h2>
            <p className="text-gray-600 mb-4">
              Connect to WiFi, manage your session, add coins, and monitor your connection time.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                WiFi Connection
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Session Management
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Coin Payment
              </span>
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">System Features</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Cross-Platform Support</h4>
              <p className="text-sm text-gray-600">Works on Raspberry Pi, Orange Pi, and Ubuntu x64 systems</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Wifi className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Advanced Networking</h4>
              <p className="text-sm text-gray-600">VLAN support, hotspot creation, and captive portal</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Session Management</h4>
              <p className="text-sm text-gray-600">MAC address tracking and automatic session expiration</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-gray-500 text-sm">
            NEXUS PISOWIFI System - Professional Coin-Operated WiFi Solution
          </p>
        </div>
      </div>
    </div>
  );
}