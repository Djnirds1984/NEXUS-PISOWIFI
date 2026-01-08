import express from 'express';
import { getSettings } from '../database.js';
import { sessionManager } from '../sessionManager.js';
import { resolveMACByIP } from '../utils/network.js';
import { networkManager } from '../networkManager.js';
import { hardwareManager } from '../hardwareManager.js';
import dns from 'dns/promises';

import { voucherManager } from '../voucherManager.js';

const router = express.Router();
const pingSubscribers = new Map<string, Set<express.Response>>();
const pingLogs: Array<{
  ts: string;
  mac: string;
  stage: string;
  message: string;
  success: boolean;
  responseTimeMs?: number;
  details?: any;
}> = [];
function emitPingEvent(mac: string, payload: any) {
  const subs = pingSubscribers.get(mac);
  if (subs) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of subs) {
      res.write(data);
    }
  }
  pingLogs.unshift({
    ts: new Date().toISOString(),
    mac,
    stage: String(payload.stage || ''),
    message: String(payload.message || ''),
    success: !!payload.success,
    responseTimeMs: payload.responseTimeMs,
    details: payload.details
  });
  if (pingLogs.length > 200) pingLogs.length = 200;
}
async function timedExec(cmd: string, timeoutMs: number): Promise<{ ok: boolean; ms?: number; stdout?: string; stderr?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const { exec } = await import('child_process');
    const p = exec(cmd, { signal: controller.signal });
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      let out = '';
      let err = '';
      p.stdout?.on('data', d => { out += String(d); });
      p.stderr?.on('data', d => { err += String(d); });
      p.on('exit', () => resolve({ stdout: out, stderr: err }));
      p.on('error', reject);
    });
    const ms = Date.now() - start;
    if (ms > timeoutMs) return { ok: false, ms, stdout: result.stdout, stderr: result.stderr };
    return { ok: true, ms, stdout: result.stdout, stderr: result.stderr };
  } catch {
    return { ok: false };
  }
}
async function pingHost(host: string, timeoutMs: number): Promise<{ ok: boolean; ms?: number }> {
  const cmd = process.platform === 'win32' ? `ping -n 1 -w ${timeoutMs} ${host}` : `ping -c 1 -W ${Math.ceil(timeoutMs / 1000)} ${host}`;
  const res = await timedExec(cmd, timeoutMs + 500);
  return { ok: res.ok, ms: res.ms };
}
async function checkPortalService(timeoutMs: number): Promise<{ ok: boolean; ms?: number }> {
  const start = Date.now();
  try {
    const r = await fetch('http://localhost:3001/api/portal/status', { method: 'GET' });
    const ms = Date.now() - start;
    if (!r.ok) return { ok: false, ms };
    return { ok: true, ms };
  } catch {
    return { ok: false };
  }
}
async function runPingCheck(macAddress: string, opts?: { timeoutMs?: number; retries?: number; portalOnly?: boolean }): Promise<{ resolved: boolean; report: any }> {
  const timeoutMs = Math.max(500, Number(opts?.timeoutMs || 3000));
  const retries = Math.max(0, Number(opts?.retries || 2));
  let externalOk = false;
  let internalOk = false;
  let externalTime: number | undefined;
  let internalTime: number | undefined;
  for (let i = 0; i <= retries; i++) {
    const ext = await pingHost('8.8.8.8', timeoutMs);
    externalOk = ext.ok;
    externalTime = ext.ms;
    emitPingEvent(macAddress, { stage: 'external', success: externalOk, responseTimeMs: externalTime, message: externalOk ? 'External reachable' : 'External timeout' });
    if (externalOk) break;
  }
  if (!externalOk && !opts?.portalOnly) {
    let dnsOk = false;
    try {
      const start = Date.now();
      await dns.lookup('google.com');
      dnsOk = true;
      emitPingEvent(macAddress, { stage: 'dns', success: true, responseTimeMs: Date.now() - start, message: 'DNS resolved' });
    } catch {
      emitPingEvent(macAddress, { stage: 'dns', success: false, message: 'DNS resolution failed' });
    }
    let gwOk = false;
    try {
      const gw = await networkManager.getDefaultGateway();
      if (gw) {
        const r = await pingHost(gw, timeoutMs);
        gwOk = r.ok;
        emitPingEvent(macAddress, { stage: 'gateway', success: gwOk, responseTimeMs: r.ms, message: gwOk ? 'Gateway reachable' : 'Gateway unreachable', details: { gateway: gw } });
      } else {
        emitPingEvent(macAddress, { stage: 'gateway', success: false, message: 'Gateway not found' });
      }
    } catch {
      emitPingEvent(macAddress, { stage: 'gateway', success: false, message: 'Gateway check failed' });
    }
    try {
      const rules = await networkManager.getIptablesRules().catch(() => []);
      const hasMasq = Array.isArray(rules) && rules.some((x: string) => x.toLowerCase().includes('masquerade'));
      emitPingEvent(macAddress, { stage: 'firewall', success: hasMasq, message: hasMasq ? 'Firewall rules present' : 'Firewall rules missing' });
      if (!hasMasq && process.platform !== 'win32') {
        await networkManager.enableCaptivePortal().catch(() => {});
        emitPingEvent(macAddress, { stage: 'firewall-fix', success: true, message: 'Firewall rules restored' });
      }
    } catch {
      emitPingEvent(macAddress, { stage: 'firewall', success: false, message: 'Firewall validation failed' });
    }
    try {
      await networkManager.restartNetworking();
      emitPingEvent(macAddress, { stage: 'connection-reset', success: true, message: 'Networking restarted' });
    } catch {
      emitPingEvent(macAddress, { stage: 'connection-reset', success: false, message: 'Restart failed' });
    }
    for (let i = 0; i <= retries; i++) {
      const ext2 = await pingHost('8.8.8.8', timeoutMs);
      externalOk = ext2.ok;
      externalTime = ext2.ms;
      emitPingEvent(macAddress, { stage: 'external-retry', success: externalOk, responseTimeMs: externalTime, message: externalOk ? 'External reachable after remediation' : 'External still failing' });
      if (externalOk) break;
    }
  }
  for (let i = 0; i <= retries; i++) {
    const inr = await checkPortalService(timeoutMs);
    internalOk = inr.ok;
    internalTime = inr.ms;
    emitPingEvent(macAddress, { stage: 'internal', success: internalOk, responseTimeMs: internalTime, message: internalOk ? 'Portal reachable' : 'Portal timeout' });
    if (internalOk) break;
  }
  if (!internalOk) {
    try {
      const session = sessionManager.getSession(macAddress);
      const isAllowed = networkManager.isMacAllowed(macAddress);
      emitPingEvent(macAddress, { stage: 'auth', success: !!session && session.active && !session.paused && isAllowed, message: !!session && session.active && !session.paused && isAllowed ? 'Session valid' : 'Session invalid', details: { active: !!session?.active, paused: !!session?.paused, allowed: isAllowed } });
      if (session && session.active) {
        await sessionManager.validateAndFixFirewallState(macAddress);
        emitPingEvent(macAddress, { stage: 'auth-fix', success: true, message: 'Session state validated' });
      }
    } catch {
      emitPingEvent(macAddress, { stage: 'auth', success: false, message: 'Authentication check failed' });
    }
    try {
      await networkManager.restartNetworking();
      emitPingEvent(macAddress, { stage: 'services-restart', success: true, message: 'Services restarted' });
    } catch {
      emitPingEvent(macAddress, { stage: 'services-restart', success: false, message: 'Services restart failed' });
    }
    for (let i = 0; i <= retries; i++) {
      const inr2 = await checkPortalService(timeoutMs);
      internalOk = inr2.ok;
      internalTime = inr2.ms;
      emitPingEvent(macAddress, { stage: 'internal-retry', success: internalOk, responseTimeMs: internalTime, message: internalOk ? 'Portal reachable after remediation' : 'Portal still failing' });
      if (internalOk) break;
    }
  }
  const resolved = externalOk && internalOk;
  emitPingEvent(macAddress, { stage: 'final', success: resolved, message: resolved ? 'Connectivity restored' : 'Connectivity issues persist', details: { externalOk, internalOk, externalTime, internalTime } });
  return { resolved, report: { externalOk, internalOk, externalTime, internalTime } };
}

// Get portal configuration
router.get('/config', async (req, res) => {
  try {
    const settings = getSettings();
    
    res.json({
      success: true,
      data: {
        title: settings.portal.title,
        backgroundImage: settings.portal.backgroundImage,
        welcomeMessage: settings.portal.welcomeMessage,
        rates: settings.rates.rates
      }
    });
  } catch (error) {
    console.error('Error getting portal config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get portal configuration'
    });
  }
});

// Device info for current client
router.get('/device-info', async (req, res) => {
  try {
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');
    const mac = await resolveMACByIP(ip);
    const list = await networkManager.listActiveDevices().catch(() => []);
    const fromList = list.find(d => d.ipAddress === ip || (mac && d.macAddress === mac));
    const hostname = fromList?.hostname || '';
    const macOut = (mac || '').toUpperCase();
    if (!ip) {
      return res.status(400).json({ success: false, error: 'IP not found' });
    }
    res.json({
      success: true,
      data: {
        ip,
        mac: macOut,
        deviceName: hostname || '',
        refreshedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get device info' });
  }
});

// Backward-compatible settings endpoint
router.get('/settings', async (req, res) => {
  try {
    const settings = getSettings();
    res.json({
      title: settings.portal.title,
      backgroundImage: settings.portal.backgroundImage,
      welcomeMessage: settings.portal.welcomeMessage,
      theme: 'light'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get portal settings' });
  }
});

router.get('/ping-check/stream', async (req, res) => {
  try {
    const mac = String(req.query.mac || '').toLowerCase();
    if (!mac) {
      res.status(400).end();
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write('\n');
    let set = pingSubscribers.get(mac);
    if (!set) {
      set = new Set();
      pingSubscribers.set(mac, set);
    }
    set.add(res);
    req.on('close', () => {
      const s = pingSubscribers.get(mac);
      if (s) {
        s.delete(res);
        if (s.size === 0) pingSubscribers.delete(mac);
      }
    });
  } catch {
    res.status(500).end();
  }
});

router.post('/ping-check', async (req, res) => {
  try {
    let { macAddress, timeoutMs, retries } = req.body || {};
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');
    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }
    if (!macAddress) {
      res.status(400).json({ success: false, error: 'MAC address is required' });
      return;
    }
    const result = await runPingCheck(macAddress, { timeoutMs: Number(timeoutMs), retries: Number(retries) });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to run ping check' });
  }
});

router.get('/ping-logs', async (req, res) => {
  try {
    const mac = String(req.query.mac || '').toLowerCase();
    const list = mac ? pingLogs.filter(l => l.mac.toLowerCase() === mac).slice(0, 100) : pingLogs.slice(0, 100);
    res.json({ success: true, data: list });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get ping logs' });
  }
});

// Check connection status
router.get('/status', async (req, res) => {
  try {
    let macAddress = (req.query.mac as string) || '';
    let ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');
    const serverTime = Date.now();
    
    // Attempt resolution if MAC is missing
    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    // Fallback: If no MAC found, or if session check by MAC fails, try checking by IP
    let session = macAddress ? sessionManager.getSession(macAddress) : undefined;
    
    if (!session && ip) {
       // Try finding session by IP
       session = sessionManager.getSessionByIp(ip);
       if (session) {
         // Found session by IP! Update our working MAC
         macAddress = session.macAddress;
         // Also ensure IP mapping is fresh
         sessionManager.updateIpMapping(macAddress, ip);
       }
    }

    // If still no session, and we have a MAC, check simple active status
    if (macAddress && !session) {
       // Maybe it's active but getSession returned undefined? (Unlikely with current implementation but good for safety)
    }

    // Final MAC validation before returning response (only if we have one)
    if (macAddress) {
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(macAddress)) {
         // If we found a session by IP, we trust that session's MAC. 
         // If we resolved a bad MAC from system, we might be in trouble.
         // But let's be lenient: if we found a session, use it.
         if (!session) {
             return res.status(400).json({
               success: false,
               error: 'Invalid MAC address format'
             });
         }
      }
    } else {
       // No MAC, No Session found by IP
       return res.json({
         success: true,
         data: {
           connected: false,
           session: null,
           timeRemaining: 0,
           hasSession: false,
           ip // useful for debugging
         }
       });
    }

    const isActive = session ? session.active : (macAddress ? sessionManager.isSessionActive(macAddress) : false);
    const timeRemaining = session ? sessionManager.getSessionTimeRemaining(session.macAddress) : 0;
    const sessionEndTime = session ? session.endTime?.toISOString?.() : null;
    const isPaused = session?.paused || false;

    res.json({
      success: true,
      data: {
        connected: isActive && !isPaused,
        session: session || null,
        timeRemaining: isActive ? timeRemaining : 0,
        hasSession: !!session,
        macAddress, // Return resolved MAC
        serverTime, // For client synchronization
        sessionEndTime, // Helpful for UI and debugging
        isPaused, // Add pause status
        pausedAt: session?.pausedAt || null,
        pausedDuration: session?.pausedDuration || 0
      }
    });
  } catch (error) {
    console.error('Error checking connection status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check connection status'
    });
  }
});

// Connect to WiFi (start session)
router.post('/connect', async (req, res) => {
  try {
    let { macAddress, pesos } = req.body;
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');

    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    // Fallback: If no MAC, can we find an existing session by IP?
    if (!macAddress && ip) {
       const existingSession = sessionManager.getSessionByIp(ip);
       if (existingSession) {
         macAddress = existingSession.macAddress;
       }
    }

    // Check for active coin session (server-side verified credits)
    if (macAddress) {
      const coinSession = hardwareManager.getCoinSession(macAddress);
      if (coinSession && coinSession.amount > 0) {
        console.log(`Using coin session for ${macAddress}: ${coinSession.amount} pesos`);
        pesos = coinSession.amount;
        // We will clear the session after successful start
      }
    }

    if (!macAddress || !pesos) {
      return res.status(400).json({
        success: false,
        error: 'MAC address and pesos are required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    if (typeof pesos !== 'number' || pesos <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Pesos must be a positive number'
      });
    }

    // Check if user already has an active session
    const existingSession = sessionManager.getSession(macAddress);
    if (existingSession && existingSession.active) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active session'
      });
    }

    // Start new session
    const session = await sessionManager.startSession(macAddress, pesos, ip);

    // Clear coin session if it was used
    if (hardwareManager.getCoinSession(macAddress)) {
      hardwareManager.clearCoinSession();
    }

    const timeRemaining = sessionManager.getSessionTimeRemaining(macAddress);
    const serverTime = Date.now();

    res.json({
      success: true,
      message: `Connected successfully! Your session will last ${session.minutes} minutes.`,
      data: {
        session,
        timeRemaining,
        serverTime,
        sessionEndTime: session.endTime?.toISOString?.()
      }
    });
  } catch (error) {
    console.error('Error connecting to WiFi:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to WiFi'
    });
  }
});

// Extend session
router.post('/extend', async (req, res) => {
  try {
    let { macAddress, pesos } = req.body;

    if (!macAddress) {
      const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    if (!macAddress || !pesos) {
      return res.status(400).json({
        success: false,
        error: 'MAC address and pesos are required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    if (typeof pesos !== 'number' || pesos <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Pesos must be a positive number'
      });
    }

    // Check if user has an active session
    const existingSession = sessionManager.getSession(macAddress);
    if (!existingSession || !existingSession.active) {
      return res.status(400).json({
        success: false,
        error: 'No active session found'
      });
    }

    // Calculate additional minutes based on pesos
    const settings = getSettings();
    const rate = settings.rates.rates.find(r => r.pesos === pesos);
    const additionalMinutes = rate ? rate.minutes : pesos * settings.rates.timePerPeso;

    // Extend session
    await sessionManager.extendSession(macAddress, additionalMinutes);
    
    // Clear coin session if it was used
    if (hardwareManager.getCoinSession(macAddress)) {
      hardwareManager.clearCoinSession();
    }

    const timeRemaining = sessionManager.getSessionTimeRemaining(macAddress);
    const serverTime = Date.now();

    res.json({
      success: true,
      message: `Session extended by ${additionalMinutes} minutes!`,
      data: {
        timeRemaining,
        serverTime,
        sessionEndTime: sessionManager.getSession(macAddress)?.endTime?.toISOString?.() || null
      }
    });
  } catch (error) {
    console.error('Error extending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extend session'
    });
  }
});

// Get available rates
router.get('/rates', async (req, res) => {
  try {
    const settings = getSettings();
    
    res.json({
      success: true,
      data: settings.rates.rates
    });
  } catch (error) {
    console.error('Error getting rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rates'
    });
  }
});

// Disconnect from WiFi (end session)
router.post('/disconnect', async (req, res) => {
  try {
    let { macAddress } = req.body;

    if (!macAddress) {
      const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'MAC address is required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    // Check if user has an active session
    const session = sessionManager.getSession(macAddress);
    if (!session || !session.active) {
      return res.status(400).json({
        success: false,
        error: 'No active session found'
      });
    }

    // End session
    await sessionManager.endSession(macAddress);

    res.json({
      success: true,
      message: 'Disconnected successfully. Thank you for using PisoWiFi!'
    });
  } catch (error) {
    console.error('Error disconnecting from WiFi:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect from WiFi'
    });
  }
});

// Redeem voucher
router.post('/redeem-voucher', async (req, res) => {
  try {
    let { macAddress, code } = req.body;
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');

    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    if (!macAddress || !code) {
      return res.status(400).json({
        success: false,
        error: 'MAC address and voucher code are required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    const result = await voucherManager.redeemVoucher(code, macAddress, ip);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          session: result.session,
          timeRemaining: sessionManager.getSessionTimeRemaining(macAddress),
          serverTime: new Date().toISOString(),
          sessionEndTime: result.session?.endTime
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error redeeming voucher:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to redeem voucher'
    });
  }
});

// Check server internet connectivity
router.get('/check-internet', async (req, res) => {
  try {
    let macAddress = (req.query.mac as string) || '';
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');

    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    // Fallback: If no MAC found, try finding session by IP
    if (!macAddress && ip) {
       const session = sessionManager.getSessionByIp(ip);
       if (session) {
         macAddress = session.macAddress;
       }
    }

    const serverHasInternet = await networkManager.checkInternetConnection();
    let clientIsAllowed = false;

    if (macAddress) {
      // Check if client is in the allowed list
      clientIsAllowed = networkManager.isMacAllowed(macAddress);

      // Self-healing: If client has active session but is NOT allowed, fix it
      const session = sessionManager.getSession(macAddress);
      if (session && session.active && !clientIsAllowed) {
        console.log(`[Self-Healing] Restoring missing firewall rule for ${macAddress}`);
        await networkManager.allowMACAddress(macAddress, session.ipAddress);
        clientIsAllowed = true;
      }
    }

    res.json({
      success: true,
      connected: serverHasInternet && clientIsAllowed,
      serverConnected: serverHasInternet,
      clientAllowed: clientIsAllowed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      connected: false,
      error: 'Failed to check internet connection'
    });
  }
});

router.get('/debug', async (req, res) => {
  try {
    let macAddress = (req.query.mac as string) || '';
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');
    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }
    let session = macAddress ? sessionManager.getSession(macAddress) : undefined;
    if (!session && ip) {
      session = sessionManager.getSessionByIp(ip);
      if (session) {
        macAddress = session.macAddress;
      }
    }
    const serverConnected = await networkManager.checkInternetConnection();
    const clientAllowed = macAddress ? networkManager.isMacAllowed(macAddress) : false;
    const devices = await networkManager.listActiveDevices().catch(() => []);
    const devMatch = devices.find(d => d.macAddress.toLowerCase() === (macAddress || '').toLowerCase() || d.ipAddress === ip);
    const rules = await networkManager.getIptablesRules().catch(() => []);
    
    // Get detailed firewall status if we have a MAC address
    let firewallStatus = null;
    if (macAddress) {
      try {
        firewallStatus = await networkManager.getFirewallStatus(macAddress);
      } catch (e) {
        console.warn('Could not get firewall status:', e);
      }
    }
    
    res.json({
      success: true,
      data: {
        ip,
        macAddress,
        sessionActive: !!(session && session.active),
        timeRemaining: session ? sessionManager.getSessionTimeRemaining(session.macAddress) : 0,
        serverConnected,
        clientAllowed,
        deviceEntry: devMatch || null,
        iptablesRuleCount: Array.isArray(rules) ? rules.length : 0,
        firewallStatus,
        sessionDetails: session ? {
          isPaused: session.paused || false,
          pausedAt: session.pausedAt,
          pausedDuration: session.pausedDuration || 0,
          startTime: session.startTime,
          endTime: session.endTime,
          pesos: session.pesos,
          minutes: session.minutes
        } : null
      }
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'Failed to get debug info'
    });
  }
});

// Validate firewall state
router.get('/validate-firewall', async (req, res) => {
  try {
    let macAddress = (req.query.mac as string) || '';
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');
    
    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }
    
    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'MAC address is required'
      });
    }
    
    const session = sessionManager.getSession(macAddress);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Validate and fix firewall state
    await sessionManager.validateAndFixFirewallState(macAddress);
    
    // Get updated firewall status
    const firewallStatus = await networkManager.getFirewallStatus(macAddress);
    const isAllowed = networkManager.isMacAllowed(macAddress);
    
    // Check if a fix was needed
    const needsFix = (session.paused && isAllowed) || (!session.paused && !isAllowed);
    
    res.json({
      success: true,
      data: {
        sessionPaused: session.paused,
        firewallAllowed: isAllowed,
        firewallStatus,
        needsFix,
        message: needsFix ? 'Firewall state was inconsistent and has been fixed' : 'Firewall state is consistent'
      }
    });
    
  } catch (error) {
    console.error('Error validating firewall state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate firewall state'
    });
  }
});

// Pause session
router.post('/pause', async (req, res) => {
  try {
    let { macAddress } = req.body;
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');

    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'MAC address is required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    // Check if user has an active session
    const session = sessionManager.getSession(macAddress);
    if (!session || !session.active) {
      return res.status(400).json({
        success: false,
        error: 'No active session found'
      });
    }

    // Check if session is already paused
    if (session.paused) {
      return res.status(400).json({
        success: false,
        error: 'Session is already paused'
      });
    }

    // Pause the session
    await sessionManager.pauseSession(macAddress);

    res.json({
      success: true,
      message: 'Session paused successfully',
      data: {
        timeRemaining: sessionManager.getSessionTimeRemaining(macAddress),
        pausedTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error pausing session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause session'
    });
  }
});

// Resume session
router.post('/resume', async (req, res) => {
  try {
    let { macAddress } = req.body;
    const ip = String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.ip || '')).replace('::ffff:', '');

    if (!macAddress) {
      macAddress = (await resolveMACByIP(ip)) || '';
    }

    if (!macAddress) {
      return res.status(400).json({
        success: false,
        error: 'MAC address is required'
      });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MAC address format'
      });
    }

    // Check if user has an active session
    const session = sessionManager.getSession(macAddress);
    if (!session || !session.active) {
      return res.status(400).json({
        success: false,
        error: 'No active session found'
      });
    }

    // Check if session is not paused
    if (!session.paused) {
      return res.status(400).json({
        success: false,
        error: 'Session is not paused'
      });
    }

    // Resume the session
    await sessionManager.resumeSession(macAddress);

    res.json({
      success: true,
      message: 'Session resumed successfully',
      data: {
        timeRemaining: sessionManager.getSessionTimeRemaining(macAddress),
        serverTime: Date.now()
      }
    });
  } catch (error) {
    console.error('Error resuming session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume session'
    });
  }
});

export default router;
