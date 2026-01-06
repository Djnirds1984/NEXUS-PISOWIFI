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
3b npm[2832]:     at NetworkManager.setupHotspot (/root/NEXUS-PISOWIFI/api/networkManag>
Jan 06 14:24:48 rpi3b npm[2832]:     at async <anonymous> (/root/NEXUS-PISOWIFI/api/routes/network.ts:148:>
Jan 06 14:27:55 rpi3b npm[2832]: Installing hostapd and dnsmasq...
Jan 06 14:28:15 rpi3b npm[2832]: Error setting up hotspot: Error: Cannot verify AP mode support. Ensure iw>
Jan 06 14:28:15 rpi3b npm[2832]:     at NetworkManager.verifyAPSupport (/root/NEXUS-PISOWIFI/api/networkMa>
Jan 06 14:28:15 rpi3b npm[2832]:     at async NetworkManager.setupHotspot (/root/NEXUS-PISOWIFI/api/networ>
Jan 06 14:28:15 rpi3b npm[2832]:     at async <anonymous> (/root/NEXUS-PISOWIFI/api/routes/network.ts:148:>
Jan 06 14:28:15 rpi3b npm[2832]: Error setting up hotspot: Error: Hotspot setup failed: Cannot verify AP m>
Jan 06 14:28:15 rpi3b npm[2832]:     at NetworkManager.setupHotspot (/root/NEXUS-PISOWIFI/api/networkManag>
Jan 06 14:28:15 rpi3b npm[2832]:     at async <anonymous> (/root/NEXUS-PISOWIFI/api/routes/network.ts:148:>
lines 1-24/24 (END)
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [pesosInserted, setPesosInserted] = useState(0);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [rates, setRates] = useState<{ pesos: number; minutes: number }[]>([]);

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
      const [settingsResponse, sessionResponse, ratesResponse] = await Promise.all([
        fetch('/api/portal/config'),
        fetch('/api/portal/status'),
        fetch('/api/portal/rates')
      ]);

      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        // config returns success/data
        setPortalSettings(settings.data || settings);
      }

      if (sessionResponse.ok) {
        const status = await sessionResponse.json();
        const data = status.data || status;
        setSessionInfo({
          macAddress: data.session?.macAddress || '',
          timeRemaining: data.timeRemaining || 0,
          isActive: data.connected || false,
          totalPesos: data.session?.pesos || 0
        });
      }

      if (ratesResponse.ok) {
        const r = await ratesResponse.json();
        setRates(r.data || []);
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
        const status = await response.json();
        const data = status.data || status;
        setSessionInfo({
          macAddress: data.session?.macAddress || '',
          timeRemaining: data.timeRemaining || 0,
          isActive: data.connected || false,
          totalPesos: data.session?.pesos || 0
        });
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
      , body: JSON.stringify({ pesos: pesosInserted || 1 }) });

      const result = await response.json();

      if (response.ok && result.success) {
        // Wait a moment then refresh session info
        setTimeout(() => {
          fetchSessionInfo();
        }, 1000);
        // reset modal state
        setShowCoinModal(false);
        setPesosInserted(0);
        setCountdown(60);
        eventSource?.close();
        setEventSource(null);
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

  const formatTime = (seconds: number) => {
    const s = Math.max(0, seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    const ss = sec.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  // Coin modal controls
  const openCoinModal = () => {
    setShowCoinModal(true);
    setPesosInserted(0);
    setCountdown(60);
    const es = new EventSource('/api/hardware/coin/stream');
    es.addEventListener('ping', () => {});
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload && payload.timestamp) {
          setPesosInserted(prev => prev + 1);
          setCountdown(60);
        }
      } catch {}
    };
    setEventSource(es);
  };

  useEffect(() => {
    if (!showCoinModal) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        const next = prev - 1;
        if (next <= 0) {
          // auto close when timeout without coins
          eventSource?.close();
          setEventSource(null);
          setShowCoinModal(false);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showCoinModal, eventSource]);

  const cancelCoinModal = () => {
    eventSource?.close();
    setEventSource(null);
    setShowCoinModal(false);
    setCountdown(60);
    setPesosInserted(0);
  };

  const doneCoinModal = async () => {
    if (pesosInserted <= 0) {
      cancelCoinModal();
      return;
    }
    await handleConnect();
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
                    Insert coins and click done to start your WiFi session
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={openCoinModal}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center"
                  >
                    <DollarSign className="w-5 h-5 mr-2" />
                    Insert Coin
                  </button>
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

      {/* Coin Modal */}
      {showCoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className={`${isDarkTheme ? 'bg-gray-800' : 'bg-white'} w-full max-w-md rounded-xl shadow-xl p-6`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>Insert Coins</h3>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                <span className={`${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>Time left to insert:</span>
              </div>
              <span className="font-bold text-lg text-blue-600">{countdown}s</span>
            </div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                <span className={`${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>Coins inserted</span>
              </div>
              <span className="font-bold text-lg text-green-600">₱{pesosInserted}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={doneCoinModal}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                DONE
              </button>
              <button
                onClick={cancelCoinModal}
                className={`${isDarkTheme ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} w-full font-semibold py-3 px-6 rounded-lg transition-all duration-200`}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portal;
