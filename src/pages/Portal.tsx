import React, { useState, useEffect } from 'react';
import { Wifi, Clock, DollarSign, Power, CheckCircle, AlertCircle, Loader2, Ticket, RefreshCw, Check, Pause, Play } from 'lucide-react';
import { formatTimeRemaining, calculateTimeProgress } from '../utils/timeUtils';
import { getPauseResumeButtonClasses } from '../utils/uiHelpers';

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
  totalMinutes?: number;
  serverTime?: number;
  sessionEndTime?: string | null;
  isPaused?: boolean;
  pausedAt?: string | null;
  pausedDuration?: number;
}

interface DeviceInfo {
  ip: string;
  mac: string;
  deviceName: string;
  refreshedAt: string;
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
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [pesosInserted, setPesosInserted] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [internetStatus, setInternetStatus] = useState<'checking' | 'online' | 'offline' | null>(null);
  const [verifyingConnection, setVerifyingConnection] = useState(false);
  const [mode, setMode] = useState<'connect' | 'extend'>('connect');
  const [displayTimeRemaining, setDisplayTimeRemaining] = useState<number>(0);
  const [syncAnchor, setSyncAnchor] = useState<{ serverMs: number; clientMs: number; remainingSec: number } | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [debugEvents, setDebugEvents] = useState<Array<{ ts: string; type: string; data: unknown }>>([]);
  const [voucherSuccess, setVoucherSuccess] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pausingSession, setPausingSession] = useState(false);
  const startPingChecker = async (opts?: { timeoutMs?: number; retries?: number }) => {
    try {
      const macParam = encodeURIComponent(sessionInfo?.macAddress || deviceInfo?.mac || '');
      if (!macParam) return;
      setInternetStatus('checking');
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      const es = new EventSource(`/api/portal/ping-check/stream?mac=${macParam}`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data || '{}');
          setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'ping-event', data }, ...prev].slice(0, 50));
          if (data.stage === 'external') {
            setError(data.message || '');
          } else if (data.stage === 'dns' || data.stage === 'gateway' || data.stage === 'firewall' || data.stage === 'connection-reset' || data.stage === 'firewall-fix') {
            setError(data.message || '');
          } else if (data.stage === 'internal' || data.stage === 'auth' || data.stage === 'services-restart') {
            setError(data.message || '');
          } else if (data.stage === 'final') {
            setInternetStatus(data.success ? 'online' : 'offline');
            setError(data.message || '');
            es.close();
            setEventSource(null);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to parse ping event');
        }
      };
      es.onerror = () => {
        es.close();
        setEventSource(null);
      };
      setEventSource(es);
      await fetch('/api/portal/ping-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: sessionInfo?.macAddress || deviceInfo?.mac, timeoutMs: opts?.timeoutMs || 3000, retries: opts?.retries || 2 })
      }).catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to start ping check');
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ping checker setup failed');
    }
  };

  // Check internet status when active
  useEffect(() => {
    if (sessionInfo?.isActive) {
      setInternetStatus('checking');
      const check = async () => {
        try {
          // Check server connectivity first
          const macParam = encodeURIComponent(sessionInfo?.macAddress || deviceInfo?.mac || '');
          const res = await fetch(`/api/portal/check-internet${macParam ? `?mac=${macParam}` : ''}`);
          const data = await res.json();
          if (data.connected) {
             setInternetStatus('online');
          } else {
             setInternetStatus('offline');
          }
          setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'check-internet', data }, ...prev].slice(0, 50));
        } catch (error) {
          console.error('Internet check failed:', error);
          setInternetStatus('offline');
        }
      };
      check();
      const interval = setInterval(check, 5000); // Check every 5 seconds
      return () => clearInterval(interval);
    }
  }, [sessionInfo?.isActive]);

  useEffect(() => {
    const autoRecover = async () => {
      if (!sessionInfo?.isActive) return;
      if (internetStatus === 'offline') {
        try {
          const res = await fetch('/api/network/client/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ macAddress: sessionInfo.macAddress, ipAddress: deviceInfo?.ip })
          });
          const data = await res.json();
          setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'auto-recover', data }, ...prev].slice(0, 50));
          startPingChecker({ timeoutMs: 3000, retries: 2 });
        } catch (e) {
          setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'auto-recover-error', data: String(e) }, ...prev].slice(0, 50));
        }
      }
    };
    autoRecover();
  }, [internetStatus, sessionInfo?.isActive]);

  const handleGoToInternet = async () => {
    setVerifyingConnection(true);
    try {
      // Force a check immediately
      const macParam = encodeURIComponent(sessionInfo?.macAddress || deviceInfo?.mac || '');
      const res = await fetch(`/api/portal/check-internet${macParam ? `?mac=${macParam}` : ''}`);
      const data = await res.json();
      setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'go-to-internet', data }, ...prev].slice(0, 50));
      
      if (data.connected) {
        window.location.href = 'http://google.com';
      } else {
        setError('Internet is not yet ready. Please wait a moment...');
        // Try again in 2 seconds
        setTimeout(async () => {
           try {
             const res2 = await fetch(`/api/portal/check-internet${macParam ? `?mac=${macParam}` : ''}`);
              const data2 = await res2.json();
              setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'retry-internet', data: data2 }, ...prev].slice(0, 50));
              if (data2.connected) {
                window.location.href = 'http://google.com';
              } else {
                setError('Still connecting... Please try again in a few seconds.');
              }
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Retry check failed');
          }
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify connection.');
    } finally {
      setVerifyingConnection(false);
    }
  };
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);

  // Fetch portal settings and session info
  useEffect(() => {
    fetchPortalData();
  }, []);

  // Auto-refresh session info every 30 seconds (or every 5 seconds when paused)
  useEffect(() => {
    if (sessionInfo?.macAddress) {
      // Use shorter interval (5 seconds) when paused to ensure UI stays synchronized
      const refreshInterval = isPaused ? 5000 : 30000;
      const interval = setInterval(fetchSessionInfo, refreshInterval);
      console.log(`📡 Session refresh interval set to ${refreshInterval}ms (paused: ${isPaused})`);
      return () => clearInterval(interval);
    }
  }, [sessionInfo?.macAddress, isPaused]);

  // Monitor pause state changes and ensure UI consistency
  useEffect(() => {
    if (sessionInfo?.macAddress) {
      console.log(`🔍 Pause state monitor: isPaused=${isPaused}, sessionInfo.isPaused=${sessionInfo.isPaused}, sessionActive=${sessionInfo.isActive}`);
      
      // Ensure pause state is synchronized
      if (sessionInfo.isPaused !== undefined && sessionInfo.isPaused !== isPaused) {
        console.log(`🔄 Synchronizing pause state: ${isPaused} → ${sessionInfo.isPaused}`);
        setIsPaused(sessionInfo.isPaused);
      }
      
      // Ensure button visibility is correct
      const shouldShowButton = sessionInfo.macAddress && sessionInfo.isActive;
      console.log(`📍 Button visibility check: shouldShow=${shouldShowButton}, hasMac=${!!sessionInfo.macAddress}, isActive=${sessionInfo.isActive}, isPaused=${isPaused}`);
    }
  }, [sessionInfo, isPaused]);

  // Periodic firewall state validation every 10 seconds when session exists
  useEffect(() => {
    if (sessionInfo?.macAddress) {
      const validateFirewall = async () => {
        try {
          const macParam = encodeURIComponent(sessionInfo.macAddress);
          const res = await fetch(`/api/portal/validate-firewall${macParam ? `?mac=${macParam}` : ''}`);
          const data = await res.json();
          
          if (data.success && data.data.needsFix) {
            console.warn(`⚠️  Firewall state inconsistency detected, fixing...`);
            await fetchSessionInfo(); // Refresh to get corrected state
            startPingChecker({ timeoutMs: 3000, retries: 2 });
          }
        } catch (error) {
          console.warn('⚠️  Could not validate firewall state:', error);
        }
      };
      
      const interval = setInterval(validateFirewall, 10000);
      return () => clearInterval(interval);
    }
  }, [sessionInfo?.macAddress]);

  // Time synchronization and countdown
  useEffect(() => {
    if (!syncAnchor) {
      setDisplayTimeRemaining(sessionInfo?.timeRemaining || 0);
      return;
    }
    
    // Don't count down if session is paused
    if (isPaused) {
      setDisplayTimeRemaining(sessionInfo?.timeRemaining || 0);
      return;
    }
    
    const tick = () => {
      const nowClient = Date.now();
      const offsetMs = syncAnchor.serverMs - syncAnchor.clientMs;
      const estimatedServerNow = nowClient + offsetMs;
      const elapsedSec = Math.max(0, Math.floor((estimatedServerNow - syncAnchor.serverMs) / 1000));
      const remaining = Math.max(0, syncAnchor.remainingSec - elapsedSec);
      setDisplayTimeRemaining(remaining);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [syncAnchor, isPaused, sessionInfo?.timeRemaining]);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      const [settingsResponse, sessionResponse, deviceInfoResponse] = await Promise.all([
        fetch('/api/portal/config'),
        fetch('/api/portal/status'),
        fetch('/api/portal/device-info')
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
          totalPesos: data.session?.pesos || 0,
          totalMinutes: data.session?.minutes || undefined,
          serverTime: data.serverTime || undefined,
          sessionEndTime: data.sessionEndTime ?? null,
          isPaused: data.session?.paused || false,
          pausedAt: data.session?.pausedAt || null,
          pausedDuration: data.session?.pausedDuration || 0
        });
        setIsPaused(data.isPaused || false);
        if (typeof data.serverTime === 'number') {
          setSyncAnchor({
            serverMs: data.serverTime,
            clientMs: Date.now(),
            remainingSec: data.timeRemaining || 0
          });
        } else {
          setSyncAnchor(null);
          setDisplayTimeRemaining(data.timeRemaining || 0);
        }
      }

      if (deviceInfoResponse.ok) {
        const di = await deviceInfoResponse.json();
        const data = di.data || di;
        setDeviceInfo({
          ip: data.ip || 'N/A',
          mac: data.mac || 'N/A',
          deviceName: data.deviceName || 'Unknown',
          refreshedAt: data.refreshedAt || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error fetching portal data:', error);
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
        
        // Update session info with proper pause state
        const sessionData = {
          macAddress: data.session?.macAddress || '',
          timeRemaining: data.timeRemaining || 0,
          isActive: data.connected || false,
          totalPesos: data.session?.pesos || 0,
          totalMinutes: data.session?.minutes || undefined,
          serverTime: data.serverTime || undefined,
          sessionEndTime: data.sessionEndTime ?? null,
          isPaused: data.isPaused || false,
          pausedAt: data.session?.pausedAt || null,
          pausedDuration: data.session?.pausedDuration || 0
        };
        
        // Log state changes for debugging
        if (sessionInfo?.isPaused !== sessionData.isPaused) {
          console.log(`🔄 Pause state changed: ${sessionInfo?.isPaused} → ${sessionData.isPaused}`);
        }
        
        setSessionInfo(sessionData);
        setIsPaused(data.isPaused || false);
        
        // Log button visibility state
        console.log(`📍 Button visibility check - Session: ${!!sessionData.macAddress}, Paused: ${data.isPaused || false}`);
        
        // Update time display immediately
        setDisplayTimeRemaining(data.timeRemaining || 0);
        
        if (typeof data.serverTime === 'number') {
          setSyncAnchor({
            serverMs: data.serverTime,
            clientMs: Date.now(),
            remainingSec: data.timeRemaining || 0
          });
        } else {
          setSyncAnchor(null);
        }
      }
    } catch (error) {
      console.error('Error fetching session info:', error);
      setError('Failed to fetch session time data');
    }
  };

  const formatMAC = (mac: string) => {
    const raw = (mac || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (raw.length === 12) {
      return raw.match(/.{1,2}/g)?.join(':') || mac.toUpperCase();
    }
    return (mac || '').toUpperCase();
  };

  const fetchDeviceInfo = async () => {
    try {
      const response = await fetch('/api/portal/device-info');
      if (response.ok) {
        const di = await response.json();
        const data = di.data || di;
        setDeviceInfo({
          ip: data.ip || 'N/A',
          mac: data.mac || 'N/A',
          deviceName: data.deviceName || 'Unknown',
          refreshedAt: data.refreshedAt || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error fetching device info:', error);
      setDeviceInfo(prev => prev || {
        ip: 'N/A',
        mac: 'N/A',
        deviceName: 'Unknown',
        refreshedAt: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    const interval = setInterval(fetchDeviceInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError('');
      
      const response = await fetch('/api/portal/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesos: pesosInserted || 1 })
      });

      const result = await response.json();
      setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'connect', data: result }, ...prev].slice(0, 50));

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
        if (result.data?.serverTime) {
          setSyncAnchor({
            serverMs: result.data.serverTime,
            clientMs: Date.now(),
            remainingSec: result.data.timeRemaining || 0
          });
        }
      } else {
        setError(result.error || 'Failed to connect');
      }
    } catch (error) {
      setError('Connection failed');
      console.error('Connection error:', error);
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
    } catch (error) {
      setError('Disconnect failed');
      console.error('Disconnect error:', error);
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
      setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'extend', data: result }, ...prev].slice(0, 50));

      if (response.ok && result.success) {
        // Refresh session info after extension
        setTimeout(() => {
          fetchSessionInfo();
        }, 1000);
        if (result.data?.serverTime) {
          setSyncAnchor({
            serverMs: result.data.serverTime,
            clientMs: Date.now(),
            remainingSec: result.data.timeRemaining || 0
          });
        }
      } else {
        setError(result.error || 'Failed to extend session');
      }
    } catch (error) {
      setError('Extension failed');
      console.error('Extension error:', error);
    }
  };



  // Coin modal controls
  const openCoinModal = async (newMode: 'connect' | 'extend' = 'connect') => {
    // Attempt to start coin session on server
    try {
      const res = await fetch('/api/hardware/start-coin-session', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: sessionInfo?.macAddress })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'System busy, please try again.');
        return;
      }
    } catch {
      console.error('Failed to start coin session');
      // Fallback: allow opening modal even if API fails (e.g. mock mode issues)
    }

    setMode(newMode);
    setShowCoinModal(true);
    setPesosInserted(0);
    setCountdown(60);
    const es = new EventSource('/api/hardware/coin/stream');
    es.addEventListener('ping', () => {});
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload && payload.timestamp) {
          if (typeof payload.amount === 'number') {
             setPesosInserted(payload.amount);
          } else {
             setPesosInserted(prev => prev + 1);
          }
          setCountdown(60);
        }
      } catch (error) {
        console.error('Coin stream error:', error);
      }
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
    if (mode === 'connect') {
      await handleConnect();
    } else {
      await handleExtendSession();
    }
  };

  const handleRedeemVoucher = async () => {
    if (!voucherCode.trim()) {
      setError('Please enter a voucher code');
      return;
    }

    try {
      setRedeemingVoucher(true);
      setError('');
      
      const res = await fetch('/api/portal/redeem-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: voucherCode,
          macAddress: sessionInfo?.macAddress || deviceInfo?.mac 
        })
      });

      const data = await res.json();
      setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'redeem-voucher', data }, ...prev].slice(0, 50));

      if (data.success) {
        setVoucherCode('');
        setVoucherSuccess(data.message || 'Voucher redeemed successfully!');
        // Clear success message after 3 seconds
        setTimeout(() => setVoucherSuccess(null), 3000);
        
        // Immediately update session info
        fetchSessionInfo();
        // Force a connectivity check or navigation
        if (data.data && data.data.session && data.data.session.active) {
             setSessionInfo(prev => ({
                ...prev,
                isActive: true,
                macAddress: data.data.session.macAddress,
                timeRemaining: data.data.timeRemaining || 0,
                totalPesos: data.data.session.pesos,
                sessionEndTime: data.data.sessionEndTime,
                serverTime: data.data.serverTime
             } as SessionInfo));

             if (data.data.serverTime) {
                setSyncAnchor({
                  serverMs: new Date(data.data.serverTime).getTime(), // Ensure timestamp format
                  clientMs: Date.now(),
                  remainingSec: data.data.timeRemaining || 0
                });
             }

             startPingChecker({ timeoutMs: 3000, retries: 2 });
             
             try {
               const mac = data.data.session.macAddress;
               const ip = deviceInfo?.ip;
               const res2 = await fetch('/api/network/client/reinit', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ macAddress: mac, ipAddress: ip })
               });
               const d2 = await res2.json();
               setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'client-reinit', data: d2 }, ...prev].slice(0, 50));
             } catch (e) {
               setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'client-reinit-error', data: String(e) }, ...prev].slice(0, 50));
             }
        }
      } else {
        setError(data.error || 'Failed to redeem voucher');
      }
    } catch (error) {
      setError('An error occurred while redeeming voucher');
      console.error('Voucher redemption error:', error);
    } finally {
      setRedeemingVoucher(false);
    }
  };
  
  const fetchDebugInfo = async () => {
    const macParam = encodeURIComponent(sessionInfo?.macAddress || deviceInfo?.mac || '');
    try {
      const res = await fetch(`/api/portal/debug${macParam ? `?mac=${macParam}` : ''}`);
      const data = await res.json();
      setDebugInfo(data.data || data);
      setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'debug-info', data }, ...prev].slice(0, 50));
    } catch (error) {
      console.error('Debug info fetch error:', error);
    }
  };

  const handlePauseSession = async () => {
    if (!sessionInfo?.macAddress) return;
    
    try {
      setPausingSession(true);
      setError('');
      
      console.log('🔄 Starting pause session...');
      
      const response = await fetch('/api/portal/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: sessionInfo.macAddress })
      });

      const result = await response.json();
      setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'pause-session', data: result }, ...prev].slice(0, 50));

      if (response.ok && result.success) {
        console.log('✅ Pause successful, updating UI...');
        
        // Immediately update UI state for better responsiveness
        setIsPaused(true);
        setInternetStatus('offline'); // Set to offline immediately
        
        // Then refresh session info from server for accuracy
        await fetchSessionInfo();
        
        console.log('✅ UI updated for paused state');
        
        // Show success feedback
        setDebugEvents(prev => [{ 
          ts: new Date().toISOString(), 
          type: 'pause-success', 
          data: { message: 'Session paused successfully - Internet blocked' }
        }, ...prev].slice(0, 50));
        
      } else {
        console.error('❌ Pause failed:', result.error);
        setError(result.error || 'Failed to pause session');
        
        // Reset UI state on failure
        setIsPaused(false);
      }
    } catch (error) {
      console.error('❌ Pause session error:', error);
      setError('Failed to pause session');
      
      // Reset UI state on failure
      setIsPaused(false);
    } finally {
      setPausingSession(false);
    }
  };

  const handleResumeSession = async () => {
    if (!sessionInfo?.macAddress) return;
    
    try {
      setPausingSession(true);
      setError('');
      
      console.log('🔄 Starting resume session...');
      
      const response = await fetch('/api/portal/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: sessionInfo.macAddress })
      });

      const result = await response.json();
      setDebugEvents(prev => [{ ts: new Date().toISOString(), type: 'resume-session', data: result }, ...prev].slice(0, 50));

      if (response.ok && result.success) {
        console.log('✅ Resume successful, updating UI...');
        
        // Immediately update UI state for better responsiveness
        setIsPaused(false);
        setInternetStatus('checking'); // Set to checking while we verify connectivity
        
        // Then refresh session info from server for accuracy
        await fetchSessionInfo();
        
        startPingChecker({ timeoutMs: 3000, retries: 2 });
        
        console.log('✅ UI updated for resumed state');
        
        // Show success feedback
        setDebugEvents(prev => [{ 
          ts: new Date().toISOString(), 
          type: 'resume-success', 
          data: { message: 'Session resumed successfully - Internet restored' }
        }, ...prev].slice(0, 50));
        
      } else {
        console.error('❌ Resume failed:', result.error);
        setError(result.error || 'Failed to resume session');
        
        // Reset UI state on failure
        setIsPaused(true);
      }
    } catch (error) {
      console.error('❌ Resume session error:', error);
      setError('Failed to resume session');
      
      // Reset UI state on failure
      setIsPaused(true);
    } finally {
      setPausingSession(false);
    }
  };
 
  const renderBool = (v: unknown, fallback?: boolean) => {
    if (v === true) return 'true';
    if (v === false) return 'false';
    if (typeof fallback === 'boolean') return String(fallback);
    return 'Unknown';
  };
 
 
  useEffect(() => {
    const shouldPoll = !!(sessionInfo?.macAddress || deviceInfo?.mac);
    if (!shouldPoll) return;
    fetchDebugInfo();
    const interval = setInterval(fetchDebugInfo, 10000);
    return () => clearInterval(interval);
  }, [sessionInfo?.macAddress, deviceInfo?.mac, sessionInfo?.isActive]);

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

  const simpleMode = new URLSearchParams(window.location.search).get('simple') === '1';
  if (simpleMode) {
    return (
      <div className={`min-h-screen ${isDarkTheme ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} flex items-center justify-center p-4`}>
        <div className={`w-full max-w-md ${isDarkTheme ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl overflow-hidden`}>
          <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} p-6 text-white text-center`}>
            <Wifi className="w-12 h-12 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">{portalSettings.title}</h1>
            <p className="text-sm opacity-90 mt-2">{portalSettings.welcomeMessage}</p>
          </div>
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            {voucherSuccess && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{voucherSuccess}</span>
              </div>
            )}
            
            {voucherSuccess && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{voucherSuccess}</span>
              </div>
            )}
            {!sessionInfo?.isActive && (
              <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 mb-4`}>
                  <div className="text-sm mb-2">Enter voucher code</div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      placeholder="Voucher Code"
                      className={`flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border ${
                        isDarkTheme ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900'
                      } ${voucherSuccess ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''}`}
                      disabled={redeemingVoucher}
                    />
                    <button
                      onClick={handleRedeemVoucher}
                      disabled={redeemingVoucher || !voucherCode.trim()}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 ${
                        voucherSuccess 
                          ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                          : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                      }`}
                    >
                      {redeemingVoucher ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : voucherSuccess ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Ticket className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
            )}
            {sessionInfo && sessionInfo.macAddress && (
              <div className="space-y-4">
                {isPaused && (
                  <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <span className="font-semibold">Time is paused</span>
                  </div>
                )}
                <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`w-5 h-5 ${isPaused ? 'text-yellow-600' : 'text-green-600'}`} />
                      <span className={`text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
                        {isPaused ? 'Paused' : 'Connected'}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-2xl">{formatTimeRemaining(displayTimeRemaining)}</span>
                  </div>
                </div>
                <button
                  onClick={isPaused ? handleResumeSession : handlePauseSession}
                  disabled={pausingSession}
                  className={getPauseResumeButtonClasses(isPaused, pausingSession)}
                  aria-label={isPaused ? 'Resume session' : 'Pause session'}
                  style={{ minHeight: '48px', visibility: 'visible', display: 'flex' }}
                >
                  {pausingSession ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : isPaused ? (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Resume Session
                    </>
                  ) : (
                    <>
                      <Pause className="w-5 h-5 mr-2" />
                      Pause Session
                    </>
                  )}
                </button>
                <button
                  onClick={handleGoToInternet}
                  disabled={verifyingConnection || isPaused}
                  className={`w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 ${
                    (verifyingConnection || isPaused) ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                >
                  {verifyingConnection ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Go to Internet'}
                </button>
                
                {/* Manual Recovery Button - Show when there are issues */}
                {(error || internetStatus === 'offline') && (
                  <button
                    onClick={async () => {
                      try {
                        console.log('🔄 Manual recovery initiated in simple mode...');
                        setError('');
                        
                        // Force refresh session info
                        await fetchSessionInfo();
                        
                        // Validate firewall state
                        const macParam = encodeURIComponent(sessionInfo.macAddress);
                        const res = await fetch(`/api/portal/validate-firewall${macParam ? `?mac=${macParam}` : ''}`);
                        const data = await res.json();
                        
                        if (data.success) {
                          console.log('✅ Recovery completed:', data.data.message);
                          setDebugEvents(prev => [{ 
                            ts: new Date().toISOString(), 
                            type: 'recovery', 
                            data: { message: 'Manual recovery completed', details: data.data }
                          }, ...prev].slice(0, 50));
                          startPingChecker({ timeoutMs: 3000, retries: 2 });
                        }
                      } catch (recoveryError) {
                        console.error('❌ Recovery failed:', recoveryError);
                        setError('Recovery failed. Please try again or contact support.');
                      }
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center"
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Fix Connection Issues
                  </button>
                )}
                
                <button
                  onClick={handleDisconnect}
                  className={`w-full font-semibold py-3 px-6 rounded-lg transition-all duration-200 ${
                    isDarkTheme ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
          <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'} px-6 py-3 text-center`}>
            <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Powered by NEXUS PISOWIFI System</p>
          </div>
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
      
      {/* Sticky Time Header */}
      {sessionInfo && (
        <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 shadow-lg backdrop-blur-md transition-colors duration-300 ${
          isDarkTheme ? 'bg-gray-900/90 text-white border-b border-gray-700' : 'bg-white/90 text-gray-900 border-b border-gray-200'
        }`}>
          <div className="max-w-md mx-auto">
            {isPaused && (
              <div className="mb-2 text-center">
                <div className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  TIME IS PAUSED
                </div>
              </div>
            )}
            <div className="flex justify-between items-center">
               <div className="flex items-center space-x-2">
                 <Clock className={`w-5 h-5 ${displayTimeRemaining < 300 && sessionInfo.isActive && !isPaused ? 'text-red-500 animate-pulse' : 'text-blue-500'}`} />
                 <span className="font-semibold text-sm uppercase tracking-wider opacity-80">
                   {sessionInfo.isActive && !isPaused ? 'Time Remaining' : displayTimeRemaining > 0 ? 'Time Remaining' : 'Time Status'}
                 </span>
               </div>
               <span className={`font-mono font-bold text-2xl tracking-widest ${
                 displayTimeRemaining < 300 && sessionInfo.isActive && !isPaused ? 'text-red-500 animate-pulse' : (isDarkTheme ? 'text-white' : 'text-gray-900')
               }`}>
                 {formatTimeRemaining(displayTimeRemaining)}
               </span>
            </div>
          </div>
        </div>
      )}
      
      <div className={`relative z-10 min-h-screen flex items-center justify-center p-4 ${sessionInfo?.isActive ? 'pt-20' : ''}`}>
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

            <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 mb-4`}>
              <h3 className={`text-sm font-semibold mb-3 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
                Your Device Information
              </h3>
              <div className="overflow-hidden rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className={isDarkTheme ? 'bg-gray-800' : 'bg-gray-100'}>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">MAC</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">IP</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Device</th>
                    </tr>
                  </thead>
                  <tbody className={isDarkTheme ? 'bg-gray-700' : 'bg-white'}>
                    <tr>
                      <td className={`px-4 py-2 text-sm ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>
                        {deviceInfo ? `MAC: ${formatMAC(deviceInfo.mac)}` : 'MAC: N/A'}
                      </td>
                      <td className={`px-4 py-2 text-sm ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>
                        {deviceInfo ? `IP: ${deviceInfo.ip}` : 'IP: N/A'}
                      </td>
                      <td className={`px-4 py-2 text-sm ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>
                        {deviceInfo ? deviceInfo.deviceName || 'Unknown' : 'Unknown'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {!(sessionInfo && sessionInfo.macAddress) ? (
              /* Not Connected State */
              <div className="text-center">
                <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 mb-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-blue-600" />
                      <span className={`font-medium ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>
                        Time Status
                      </span>
                    </div>
                    <span className="font-bold text-2xl font-mono tracking-wider text-gray-600">
                      {formatTimeRemaining(displayTimeRemaining)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {displayTimeRemaining > 0 ? 'Session pending' : 'No active session'}
                  </div>
                </div>
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
                    onClick={() => openCoinModal('connect')}
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

                <div className="mt-6 border-t pt-4">
                  <div className="text-center mb-3">
                    <span className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Or redeem a voucher code</span>
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      placeholder="Enter Voucher Code"
                      className={`flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border ${
                        isDarkTheme ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900'
                      } ${voucherSuccess ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''}`}
                      disabled={redeemingVoucher}
                    />
                    <button
                      onClick={handleRedeemVoucher}
                      disabled={redeemingVoucher || !voucherCode.trim()}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 ${
                        voucherSuccess 
                          ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                          : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                      }`}
                    >
                      {redeemingVoucher ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : voucherSuccess ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Ticket className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Always Visible Debug Panel */}
                <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 mt-4 border-t-2 border-dashed border-gray-300`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>Debug Info (Permanent)</span>
                    <button
                      onClick={fetchDebugInfo}
                      className="px-2 py-1 bg-indigo-600 text-white rounded-md text-xs"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>MAC: {formatMAC(sessionInfo.macAddress || deviceInfo?.mac || '')}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>IP: {deviceInfo?.ip || (debugInfo?.ip as string) || 'N/A'}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Session Active: {String(debugInfo?.sessionActive ?? sessionInfo.isActive)}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Time Remaining: {formatTimeRemaining((debugInfo?.timeRemaining ?? displayTimeRemaining) as number)}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Server Connected: {renderBool(debugInfo?.serverConnected, internetStatus === 'online' ? true : internetStatus === 'offline' ? false : undefined)}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Client Allowed: {renderBool(debugInfo?.clientAllowed, internetStatus === 'online' ? true : undefined)}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>iptables Rules: {(debugInfo?.iptablesRuleCount as number) ?? 'N/A'}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Firewall Status: {(debugInfo?.firewallStatus?.isAllowed ? 'Allowed' : debugInfo?.firewallStatus?.hasBlockRules ? 'Blocked' : 'Unknown')}</div>
                  </div>
                  
                  {/* Firewall Status Details */}
                  {debugInfo?.firewallStatus && (
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                      <div className={`font-semibold ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>Firewall Details:</div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Allowed: {String(debugInfo.firewallStatus.isAllowed)}</div>
                        <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Block Rules: {debugInfo.firewallStatus.blockRuleCount}</div>
                        <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Allow Rules: {debugInfo.firewallStatus.allowRuleCount}</div>
                        <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Last Check: {new Date(debugInfo.firewallStatus.lastUpdate).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  )}
                  <div className="mt-3">
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'} text-xs mb-1`}>Events</div>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 text-xs">
                      {(debugEvents || []).map((ev, idx) => (
                        <div key={idx} className={`${isDarkTheme ? 'text-gray-200' : 'text-gray-800'} mb-1`}>
                          <span className="font-mono">{new Date(ev.ts).toLocaleTimeString()}</span> [{ev.type}] {typeof ev.data === 'object' ? JSON.stringify(ev.data) : String(ev.data)}
                        </div>
                      ))}
                    </div>
                  </div>
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
                  {isPaused && (
                    <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span className="font-semibold">Time is paused</span>
                    </div>
                  )}
                  {internetStatus && (
                    <div className={`mb-3 text-center text-sm font-medium ${
                      internetStatus === 'online' ? 'text-green-500' : 
                      internetStatus === 'offline' ? 'text-red-500' : 'text-yellow-500'
                    }`}>
                      Internet Status: {internetStatus.toUpperCase()}
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-blue-600" />
                      <span className={`font-medium ${isDarkTheme ? 'text-gray-200' : 'text-gray-700'}`}>
                        Time Remaining
                      </span>
                    </div>
                    <span className={`font-bold text-4xl font-mono tracking-wider ${displayTimeRemaining > 300 ? 'text-green-600' : 'text-red-600 animate-pulse'}`}>
                      {formatTimeRemaining(displayTimeRemaining)}
                    </span>
                  </div>
                  
                  {typeof sessionInfo.totalMinutes === 'number' && sessionInfo.totalMinutes > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${calculateTimeProgress(displayTimeRemaining, (sessionInfo.totalMinutes || 0) * 60)}%` }}
                      />
                    </div>
                  )}
                 
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
                  {/* Pause/Resume Button - Only show when session exists */}
                  {sessionInfo && sessionInfo.macAddress && (
                    <button
                      onClick={isPaused ? handleResumeSession : handlePauseSession}
                      disabled={pausingSession}
                      className={getPauseResumeButtonClasses(isPaused, pausingSession)}
                      aria-label={isPaused ? 'Resume session' : 'Pause session'}
                      style={{ minHeight: '48px', visibility: 'visible', display: 'flex' }}
                    >
                      {pausingSession ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : isPaused ? (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Resume Session
                        </>
                      ) : (
                        <>
                          <Pause className="w-5 h-5 mr-2" />
                          Pause Session
                        </>
                      )}
                    </button>
                  )}
                  
                  {/* Manual Recovery Button - Show when there are issues */}
                  {sessionInfo && sessionInfo.macAddress && (error || internetStatus === 'offline') && (
                    <button
                      onClick={async () => {
                        try {
                          console.log('🔄 Manual recovery initiated...');
                          setError('');
                          
                          // Force refresh session info
                          await fetchSessionInfo();
                          
                          // Validate firewall state
                          const macParam = encodeURIComponent(sessionInfo.macAddress);
                          const res = await fetch(`/api/portal/validate-firewall${macParam ? `?mac=${macParam}` : ''}`);
                          const data = await res.json();
                          
                          if (data.success) {
                            console.log('✅ Recovery completed:', data.data.message);
                            setDebugEvents(prev => [{ 
                              ts: new Date().toISOString(), 
                              type: 'recovery', 
                              data: { message: 'Manual recovery completed', details: data.data }
                            }, ...prev].slice(0, 50));
                          }
                        } catch (recoveryError) {
                          console.error('❌ Recovery failed:', recoveryError);
                          setError('Recovery failed. Please try again or contact support.');
                        }
                      }}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center"
                    >
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Fix Connection Issues
                    </button>
                  )}

                  <button
                    onClick={handleGoToInternet}
                    disabled={verifyingConnection || internetStatus === 'offline' || isPaused}
                    className={`w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center ${
                      (verifyingConnection || internetStatus === 'offline' || isPaused) ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                  >
                    {verifyingConnection ? (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                        Verifying Connection...
                      </>
                    ) : (
                      <>
                        <Wifi className="w-5 h-5 mr-2" />
                        Go to Internet
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => openCoinModal('extend')}
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

                {/* Always Visible Debug Panel (Connected State) */}
                <div className={`${isDarkTheme ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 mt-4 border-t-2 border-dashed border-gray-300`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>Debug Info (Permanent)</span>
                    <button
                      onClick={fetchDebugInfo}
                      className="px-2 py-1 bg-indigo-600 text-white rounded-md text-xs"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>MAC: {formatMAC(sessionInfo.macAddress || deviceInfo?.mac || '')}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>IP: {deviceInfo?.ip || (debugInfo?.ip as string) || 'N/A'}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Session Active: {String(debugInfo?.sessionActive ?? sessionInfo.isActive)}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Time Remaining: {formatTimeRemaining((debugInfo?.timeRemaining ?? displayTimeRemaining) as number)}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Server Connected: {String(debugInfo?.serverConnected)}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Client Allowed: {String(debugInfo?.clientAllowed)}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>iptables Rules: {(debugInfo?.iptablesRuleCount as number) ?? 'N/A'}</div>
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Firewall Status: {(debugInfo?.firewallStatus?.isAllowed ? 'Allowed' : debugInfo?.firewallStatus?.hasBlockRules ? 'Blocked' : 'Unknown')}</div>
                  </div>
                  
                  {/* Firewall Status Details */}
                  {debugInfo?.firewallStatus && (
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                      <div className={`font-semibold ${isDarkTheme ? 'text-gray-200' : 'text-gray-800'}`}>Firewall Details:</div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Allowed: {String(debugInfo.firewallStatus.isAllowed)}</div>
                        <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Block Rules: {debugInfo.firewallStatus.blockRuleCount}</div>
                        <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Allow Rules: {debugInfo.firewallStatus.allowRuleCount}</div>
                        <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Last Check: {new Date(debugInfo.firewallStatus.lastUpdate).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  )}
                  <div className="mt-3">
                    <div className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'} text-xs mb-1`}>Events</div>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 text-xs">
                      {(debugEvents || []).map((ev, idx) => (
                        <div key={idx} className={`${isDarkTheme ? 'text-gray-200' : 'text-gray-800'} mb-1`}>
                          <span className="font-mono">{new Date(ev.ts).toLocaleTimeString()}</span> [{ev.type}] {typeof ev.data === 'object' ? JSON.stringify(ev.data) : String(ev.data)}
                        </div>
                      ))}
                    </div>
                  </div>
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
