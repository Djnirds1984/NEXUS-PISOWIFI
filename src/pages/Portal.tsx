import React, { useState, useEffect } from 'react';
import { Wifi, Clock, DollarSign, Power, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface PortalSettings {
  title: string;
  welcomeMessage: string;
  backgroundImage: string;
  theme: 'light' | 'dark';
}

interface SessionInfo {
  macAddress: string;
  timeRemaining: number;
  isActive: boolean;
  totalPesos: number;
}

const Portal: React.FC = () => {
  const [portalSettings, setPortalSettings] = useState<PortalSettings>({
    title: 'NEXUS PISOWIFI',
    welcomeMessage: 'Welcome to our WiFi service! Insert coins to get started.',
    backgroundImage: '',
    theme: 'light'
  });
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  // Fetch portal settings and session info
  useEffect(() => {
    fetchPortalData();
  }, []);

  // Auto-refresh session info every 30 seconds
  useEffect(() => {
    if (sessionInfo?.isActive) {
      const interval = setInterval(fetchSessionInfo, 30000);
      return () => clearInterval(interval);
    }
  }, [sessionInfo?.isActive]);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      const [settingsResponse, sessionResponse] = await Promise.all([
        fetch('/api/portal/settings'),
        fetch('/api/portal/status')
      ]);

      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        setPortalSettings(settings);
      }

      if (sessionResponse.ok) {
        const session = await sessionResponse.json();
        setSessionInfo(session);
      }
    } catch (err) {
      console.error('Error fetching portal data:', err);
      setError('Unable to load portal data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionInfo = async () => {
    try {
      const response = await fetch('/api/portal/status');
      if (response.ok) {
        const session = await response.json();
        setSessionInfo(session);
      }
    } catch (err) {
      console.error('Error fetching session info:', err);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError('');
      
      const response = await fetch('/api/portal/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Wait a moment then refresh session info
        setTimeout(() => {
          fetchSessionInfo();
        }, 1000);
      } else {
        setError(result.error || 'Failed to connect');
      }
    } catch (err) {
      setError('Connection failed');
      console.error('Connection error:', err);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setError('');
      const response = await fetch('/api/portal/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setSessionInfo(null);
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to disconnect');
      }
    } catch (err) {
      setError('Disconnect failed');
      console.error('Disconnect error:', err);
    }
  };

  const handleExtendSession = async () => {
    try {
      setError('');
      const response = await fetch('/api/portal/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Refresh session info after extension
        setTimeout(() => {
          fetchSessionInfo();
        }, 1000);
      } else {
        setError(result.error || 'Failed to extend session');
      }
    } catch (err) {
      setError('Extension failed');
      console.error('Extension error:', err);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes <= 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const backgroundStyle = portalSettings.backgroundImage 
    ? { backgroundImage: `url(${portalSettings.backgroundImage})` }
    : {};

  const isDarkTheme = portalSettings.theme === 'dark';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkTheme ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'}`}>
      {/* Background Image Overlay */}
      {portalSettings.backgroundImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={backgroundStyle}
        />
      )}
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className={`w-full max-w-md ${isDarkTheme ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl overflow-hidden`}>
          {/* Header */}
          <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} p-6 text-white text-center`}>
            <Wifi className="w-12 h-12 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">{portalSettings.title}</h1>
            <p className="text-sm opacity-90 mt-2">{portalSettings.welcomeMessage}</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {!sessionInfo?.isActive ? (
              /* Not Connected State */
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wifi className="w-8 h-8 text-gray-400" />
                  </div>
                  <h2 className={`text-xl font-semibold mb-2 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                    Ready to Connect
                  </h2>
                  <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                    Insert coins and click connect to start your WiFi session
                  </p>
                </div>

                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Power className="w-5 h-5 mr-2" />
                      Connect to WiFi
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Connected State */
              <div>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className={`text-xl font-semibold mb-2 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                    Connected!
                  </h2>
                  <p className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                    Enjoy your WiFi session
                  </p>
                </div>

                {/* Session Info */}
                <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 mb-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-blue-600" />
                      <span className={`font-medium ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>
                        Time Remaining
                      </span>
                    </div>
                    <span className={`font-bold text-lg ${sessionInfo.timeRemaining > 5 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatTime(sessionInfo.timeRemaining)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                      <span className={`font-medium ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>
                        Total Spent
                      </span>
                    </div>
                    <span className="font-bold text-lg text-green-600">
                      ₱{sessionInfo.totalPesos.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleExtendSession}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center"
                  >
                    <DollarSign className="w-5 h-5 mr-2" />
                    Add More Coins
                  </button>
                  
                  <button
                    onClick={handleDisconnect}
                    className={`w-full font-semibold py-3 px-6 rounded-lg transition-all duration-200 ${
                      isDarkTheme 
                        ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    } flex items-center justify-center`}
                  >
                    <Power className="w-5 h-5 mr-2" />
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'} px-6 py-3 text-center`}>
            <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
              Powered by NEXUS PISOWIFI System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portal;