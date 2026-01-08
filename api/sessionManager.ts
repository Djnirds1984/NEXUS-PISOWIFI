import { networkManager } from './networkManager.js';
import { addSession, updateSession, removeSession, getActiveSessions, cleanupExpiredSessions, getSessions, getSettings, getDB } from './database.js';

export interface UserSession {
  macAddress: string;
  ipAddress?: string;
  startTime: Date;
  endTime: Date;
  pesos: number;
  minutes: number;
  active: boolean;
  paused?: boolean;
  pausedAt?: Date;
  pausedDuration?: number;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalRevenue: number;
  averageSessionDuration: number;
}

export class SessionManager {
  private activeSessions: Map<string, UserSession> = new Map();
  private ipToMacMap: Map<string, string> = new Map(); // Fallback for IP-based lookup
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialization is now called explicitly from server.ts
  }

  public async initialize(): Promise<void> {
    console.log('Initializing Session Manager - Starting Recovery Process...');
    
    // Load existing active sessions from database
    const sessions = getActiveSessions();
    let restoredCount = 0;
    let expiredCount = 0;

    console.log(`Found ${sessions.length} potentially active sessions in database.`);

    for (const session of sessions) {
      const normalizedMac = session.macAddress.replace(/-/g, ':').toLowerCase();
      const userSession: UserSession = {
        ...session,
        macAddress: normalizedMac,
        startTime: new Date(session.startTime),
        endTime: new Date(session.endTime),
        paused: session.paused || false,
        pausedAt: session.pausedAt ? new Date(session.pausedAt) : undefined,
        pausedDuration: session.pausedDuration || 0
      };
      
      const now = new Date();
      
      // Handle paused sessions - keep them paused and don't auto-resume
      if (userSession.paused && userSession.pausedAt) {
        console.log(`Session for ${normalizedMac} is paused. Keeping paused state.`);
        // Don't auto-resume - just update the pause duration to account for server downtime
        const pauseDuration = Math.floor((now.getTime() - userSession.pausedAt.getTime()) / 1000);
        userSession.pausedDuration = (userSession.pausedDuration || 0) + pauseDuration;
        userSession.pausedAt = now; // Reset pause time to now to prevent accumulating pause duration
        
        // Update database to reflect the updated pause duration but keep paused state
        updateSession(normalizedMac, {
          pausedDuration: userSession.pausedDuration,
          pausedAt: now.toISOString()
        });
      }
      
      if (userSession.endTime <= now) {
         // Session expired while down
         console.log(`Session for ${normalizedMac} expired during downtime (Expired: ${userSession.endTime.toISOString()})`);
         // Ensure it's marked inactive in DB
         updateSession(normalizedMac, { active: false });
         expiredCount++;
         continue;
      }

      // Restore active session
      await this.syncSessionState(userSession);
      restoredCount++;
      console.log(`Restored active session for ${normalizedMac} (Expires: ${userSession.endTime.toISOString()})`);
    }

    // Set up periodic cleanup of expired sessions
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
      this.verifySessionConsistency();
    }, 60000); // Clean up every minute

    console.log(`Session Recovery Complete: ${restoredCount} restored, ${expiredCount} expired/cleaned.`);
  }

  /**
   * Periodically checks for inconsistencies between in-memory state and database
   */
  private async verifySessionConsistency(): Promise<void> {
    try {
      const dbSessions = getActiveSessions();
      const dbSessionMap = new Map(dbSessions.map(s => [s.macAddress.replace(/-/g, ':').toLowerCase(), s]));
      const now = new Date();

      // 1. DB -> Memory Sync (Restore missing)
      for (const dbSession of dbSessions) {
        const normalizedMac = dbSession.macAddress.replace(/-/g, ':').toLowerCase();
        if (new Date(dbSession.endTime) <= now) continue; // Let cleanup handle it

        if (!this.activeSessions.has(normalizedMac)) {
          console.warn(`[Consistency Check] FOUND INCONSISTENCY: Session for ${normalizedMac} in DB but missing from memory. Restoring...`);
          const userSession: UserSession = {
            ...dbSession,
            macAddress: normalizedMac,
            startTime: new Date(dbSession.startTime),
            endTime: new Date(dbSession.endTime),
            paused: dbSession.paused || false,
            pausedAt: dbSession.pausedAt ? new Date(dbSession.pausedAt) : undefined,
            pausedDuration: dbSession.pausedDuration || 0
          };
          await this.syncSessionState(userSession);
        }
      }

      // 2. Memory -> DB Sync (Detect ghosts)
      for (const [mac, memSession] of this.activeSessions) {
        if (!dbSessionMap.has(mac)) {
           console.warn(`[Consistency Check] FOUND INCONSISTENCY: Session for ${mac} in memory but not active in DB. Ending session...`);
           await this.endSession(mac);
        }
      }
    } catch (error) {
      console.error('[Consistency Check] Error:', error);
    }
  }

  // Helper to update IP mapping
  updateIpMapping(macAddress: string, ipAddress: string) {
    if (ipAddress) {
      this.ipToMacMap.set(ipAddress, macAddress.replace(/-/g, ':').toLowerCase());
      // Also update the session object if it exists
      const session = this.activeSessions.get(macAddress.replace(/-/g, ':').toLowerCase());
      if (session) {
        session.ipAddress = ipAddress;
      }
    }
  }

  getSessionByIp(ipAddress: string): UserSession | undefined {
    const mac = this.ipToMacMap.get(ipAddress);
    if (mac) {
      return this.activeSessions.get(mac);
    }
    // Try to find in active sessions by IP property
    for (const session of this.activeSessions.values()) {
      if (session.ipAddress === ipAddress) return session;
    }
    return undefined;
  }

  // Synchronous DB update only - safe for transactions
  startSessionDB(macAddress: string, pesos: number, ipAddress?: string): UserSession {
      const normalizedMac = macAddress.replace(/-/g, ':').toLowerCase();
      // Calculate session duration based on pesos
      const minutes = this.calculateSessionDuration(pesos);
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + minutes * 60000); // Add minutes in milliseconds

      // Create session object
      const session: UserSession = {
        macAddress: normalizedMac,
        ipAddress,
        startTime,
        endTime,
        pesos,
        minutes,
        active: true,
        paused: false,
        pausedDuration: 0
      };

      // Add to database
      addSession({
        ...session,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
        pausedAt: null
      });
      
      return session;
  }
  
  // Update in-memory state and network access
  async syncSessionState(session: UserSession): Promise<void> {
      const normalizedMac = session.macAddress;
      
      // Add to active sessions map
      this.activeSessions.set(normalizedMac, session);
      if (session.ipAddress) {
        this.ipToMacMap.set(session.ipAddress, normalizedMac);
      }

      // Handle paused sessions - don't allow internet access
      if (session.paused) {
        console.log(`Session ${normalizedMac} is paused, blocking internet access`);
        try {
          await networkManager.blockMACAddress(normalizedMac);
        } catch (e) {
          console.error(`Failed to block network access for paused session ${normalizedMac}:`, e);
        }
        return; // Don't schedule expiration for paused sessions
      }

      // Allow internet access for active sessions
      try {
        await networkManager.allowMACAddress(normalizedMac, session.ipAddress);
      } catch (e) {
        console.error(`Failed to restore network access for ${normalizedMac}:`, e);
      }
      
      try {
        const reinit = await networkManager.reinitializeClientNetwork(normalizedMac, session.ipAddress);
        const verify = await networkManager.verifyClientConnectivity(normalizedMac, session.ipAddress);
        console.log(`Client network reinit for ${normalizedMac}:`, { reinit, verify });
      } catch (e) {
        console.warn(`Client reinit/verify failed for ${normalizedMac}:`, e instanceof Error ? e.message : String(e));
      }

      // Schedule session expiration
      this.scheduleSessionExpiration(normalizedMac, session.endTime);
  }

  async startSession(macAddress: string, pesos: number, ipAddress?: string): Promise<UserSession> {
    try {
      const session = this.startSessionDB(macAddress, pesos, ipAddress);
      
      await this.syncSessionState(session);

      console.log(`Session started for ${session.macAddress} (IP: ${ipAddress || 'unknown'}): ${pesos} pesos = ${session.minutes} minutes`);

      return session;
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    }
  }

  async startTimedSession(macAddress: string, minutes: number): Promise<UserSession> {
    try {
      if (typeof minutes !== 'number' || minutes <= 0) {
        throw new Error('minutes must be a positive number');
      }
      const normalizedMac = macAddress.replace(/-/g, ':').toLowerCase();
      const now = new Date();
      const endTime = new Date(now.getTime() + minutes * 60000);
      const session: UserSession = {
        macAddress: normalizedMac,
        startTime: now,
        endTime,
        pesos: 0,
        minutes,
        active: true,
        paused: false,
        pausedDuration: 0
      };
      addSession({
        ...session,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
        pausedAt: null
      });
      
      await this.syncSessionState(session);
      
      console.log(`Timed session started for ${normalizedMac}: ${minutes} minutes`);
      return session;
    } catch (error) {
      console.error('Error starting timed session:', error);
      throw error;
    }
  }

  async endSession(macAddress: string): Promise<void> {
    try {
      const normalizedMac = macAddress.replace(/-/g, ':').toLowerCase();
      const session = this.activeSessions.get(normalizedMac);
      
      // Even if not in memory, ensure DB is updated
      updateSession(normalizedMac, { active: false });

      if (session) {
         session.active = false;
         this.activeSessions.delete(normalizedMac);
      }

      // Cancel expiration timer
      const timer = this.sessionTimers.get(normalizedMac);
      if (timer) {
        clearTimeout(timer);
        this.sessionTimers.delete(normalizedMac);
      }

      // Block internet access
      await networkManager.blockMACAddress(normalizedMac);

      console.log(`Session ended for ${normalizedMac}`);
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  private calculateSessionDuration(pesos: number): number {
    // Get rates configuration from database
    const { rates } = getSettings();
    
    // Find matching rate or use default calculation
    const rate = rates.rates.find((r: any) => r.pesos === pesos);
    if (rate) {
      return rate.minutes;
    }

    // Default calculation: 1 peso = 30 minutes
    return pesos * rates.timePerPeso;
  }

  private scheduleSessionExpiration(macAddress: string, endTime: Date): void {
    const now = new Date();
    const timeUntilExpiration = endTime.getTime() - now.getTime();

    // Clear existing timer if any
    if (this.sessionTimers.has(macAddress)) {
        clearTimeout(this.sessionTimers.get(macAddress));
    }

    if (timeUntilExpiration <= 0) {
      // Session already expired
      this.endSession(macAddress);
      return;
    }

    // Schedule session expiration
    const timer = setTimeout(() => {
      this.endSession(macAddress);
    }, timeUntilExpiration);

    this.sessionTimers.set(macAddress, timer);
  }

  getSession(macAddress: string): UserSession | undefined {
    return this.activeSessions.get(macAddress.replace(/-/g, ':').toLowerCase());
  }

  isSessionActive(macAddress: string): boolean {
    const session = this.activeSessions.get(macAddress.replace(/-/g, ':').toLowerCase());
    return !!(session && session.active);
  }

  getAllActiveSessions(): UserSession[] {
    return Array.from(this.activeSessions.values());
  }

  async validateAndFixFirewallState(macAddress: string): Promise<void> {
    const normalizedMac = macAddress.replace(/-/g, ':').toLowerCase();
    const session = this.activeSessions.get(normalizedMac);
    
    if (!session) {
      console.warn(`⚠️  No session found for MAC ${normalizedMac}, skipping firewall validation`);
      return;
    }
    
    try {
      const firewallStatus = await networkManager.getFirewallStatus(normalizedMac);
      const isAllowed = networkManager.isMacAllowed(normalizedMac);
      
      console.log(`🔍 Validating firewall state for MAC ${normalizedMac}:`, {
        sessionPaused: session.paused,
        firewallAllowed: isAllowed,
        firewallStatus
      });
      
      // Check for inconsistencies
      if (session.paused && isAllowed) {
        console.error(`❌ CRITICAL: Session is paused but MAC is still allowed in firewall! Fixing...`);
        await networkManager.blockMACAddress(normalizedMac);
        console.log(`✅ Fixed: MAC ${normalizedMac} is now properly blocked`);
      } else if (!session.paused && !isAllowed) {
        console.error(`❌ CRITICAL: Session is active but MAC is blocked in firewall! Fixing...`);
        await networkManager.allowMACAddress(normalizedMac, session.ipAddress);
        console.log(`✅ Fixed: MAC ${normalizedMac} is now properly allowed`);
      } else {
        console.log(`✅ Firewall state is consistent for MAC ${normalizedMac}`);
      }
      
    } catch (error) {
      console.error(`❌ Error validating firewall state for MAC ${normalizedMac}:`, error);
    }
  }

  getSessionTimeRemaining(macAddress: string): number {
    const session = this.activeSessions.get(macAddress.replace(/-/g, ':').toLowerCase());
    if (!session || !session.active) {
      return 0;
    }

    // If session is paused, return the time remaining when it was paused
    if (session.paused) {
      return Math.max(0, Math.floor((session.endTime.getTime() - session.pausedAt!.getTime()) / 1000));
    }

    const now = new Date();
    const timeRemaining = session.endTime.getTime() - now.getTime();
    return Math.max(0, Math.floor(timeRemaining / 1000)); // Return seconds
  }

  extendSessionDB(macAddress: string, additionalMinutes: number): UserSession {
    const normalizedMac = macAddress.replace(/-/g, ':').toLowerCase();
    
    const session = this.activeSessions.get(normalizedMac);
    if (!session || !session.active) {
      throw new Error('Session not found or inactive');
    }

    // Extend session duration
    const newEndTime = new Date(session.endTime.getTime() + additionalMinutes * 60000);
    const newMinutes = session.minutes + additionalMinutes;

    // Update database
    updateSession(normalizedMac, {
      endTime: newEndTime.toISOString(),
      minutes: newMinutes
    });
    
    // Return updated session object (copy)
    return {
        ...session,
        endTime: newEndTime,
        minutes: newMinutes
    };
  }

  async extendSession(macAddress: string, additionalMinutes: number): Promise<void> {
    const normalizedMac = macAddress.replace(/-/g, ':').toLowerCase();
    
    // Check existence first
    const session = this.activeSessions.get(normalizedMac);
    if (!session || !session.active) {
      throw new Error('Session not found or inactive');
    }

    const updatedSession = this.extendSessionDB(normalizedMac, additionalMinutes);
    
    await this.syncSessionState(updatedSession);

    console.log(`Session extended for ${normalizedMac}: +${additionalMinutes} minutes`);
  }

  private async performCleanup(): Promise<void> {
    try {
      // Clean up expired sessions from database
      cleanupExpiredSessions();

      // Clean up expired sessions from memory
      const now = new Date();
      const expiredSessions: string[] = [];

      for (const [macAddress, session] of this.activeSessions) {
        if (session.endTime <= now) {
          expiredSessions.push(macAddress);
        }
      }

      // End expired sessions
      for (const macAddress of expiredSessions) {
        await this.endSession(macAddress);
      }

      if (expiredSessions.length > 0) {
        console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  getSessionStats(): SessionStats {
    const sessions = getActiveSessions();
    const totalSessions = sessions.length;
    const activeSessions = this.activeSessions.size;
    const totalRevenue = sessions.reduce((sum, session) => sum + session.pesos, 0);
    
    const completedSessions = sessions.filter(s => !s.active);
    const averageSessionDuration = completedSessions.length > 0 
      ? completedSessions.reduce((sum, session) => {
          const duration = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000;
          return sum + duration;
        }, 0) / completedSessions.length
      : 0;

    return {
      totalSessions,
      activeSessions,
      totalRevenue,
      averageSessionDuration: Math.round(averageSessionDuration)
    };
  }

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  getTotalRevenue(): number {
    const sessions = getSessions();
    return sessions.reduce((sum: number, session: any) => sum + session.pesos, 0);
  }

  getRevenueForDate(date: Date): number {
    const sessions = getSessions();
    const dateString = date.toISOString().split('T')[0];
    
    return sessions
      .filter((session: any) => session.startTime.startsWith(dateString))
      .reduce((sum: number, session: any) => sum + session.pesos, 0);
  }

  getActiveSessionsForDate(date: Date): number {
    const sessions = getSessions();
    const dateString = date.toISOString().split('T')[0];
    
    return sessions.filter((session: any) => 
      session.startTime.startsWith(dateString) && session.active
    ).length;
  }

  async pauseSession(macAddress: string): Promise<void> {
    const normalizedMac = macAddress.replace(/-/g, ':').toLowerCase();
    const session = this.activeSessions.get(normalizedMac);
    
    console.log(`🔄 Starting pause session process for MAC: ${normalizedMac}`);
    
    if (!session || !session.active) {
      console.error(`❌ Cannot pause session: Session not found or inactive for MAC: ${normalizedMac}`);
      throw new Error('Session not found or inactive');
    }

    if (session.paused) {
      console.warn(`⚠️  Session already paused for MAC: ${normalizedMac}`);
      throw new Error('Session is already paused');
    }

    try {
      // Update session state
      session.paused = true;
      session.pausedAt = new Date();
      session.pausedDuration = session.pausedDuration || 0;

      // Update database
      updateSession(normalizedMac, {
        paused: true,
        pausedAt: session.pausedAt.toISOString(),
        pausedDuration: session.pausedDuration
      });

      // Cancel the existing timer since we're pausing
      const timer = this.sessionTimers.get(normalizedMac);
      if (timer) {
        clearTimeout(timer);
        this.sessionTimers.delete(normalizedMac);
        console.log(`⏰ Cancelled session timer for MAC: ${normalizedMac}`);
      }

      console.log(`🔒 Blocking internet access for MAC: ${normalizedMac}`);
      
      // Block internet access with comprehensive firewall rules
      await networkManager.blockMACAddress(normalizedMac);
      
      // Verify the blocking was successful
      const isAllowed = networkManager.isMacAllowed(normalizedMac);
      if (isAllowed) {
        console.error(`❌ CRITICAL: MAC ${normalizedMac} is still allowed after blocking!`);
        throw new Error('Failed to properly block MAC address - still showing as allowed');
      }
      
      console.log(`✅ Session successfully paused for MAC: ${normalizedMac} at ${session.pausedAt.toISOString()}`);
      
    } catch (error) {
      console.error(`❌ Error pausing session for MAC ${normalizedMac}:`, error);
      
      // Rollback on failure
      session.paused = false;
      session.pausedAt = undefined;
      
      throw new Error(`Failed to pause session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async resumeSession(macAddress: string): Promise<void> {
    const normalizedMac = macAddress.replace(/-/g, ':').toLowerCase();
    const session = this.activeSessions.get(normalizedMac);
    
    console.log(`🔄 Starting resume session process for MAC: ${normalizedMac}`);
    
    if (!session || !session.active) {
      console.error(`❌ Cannot resume session: Session not found or inactive for MAC: ${normalizedMac}`);
      throw new Error('Session not found or inactive');
    }

    if (!session.paused || !session.pausedAt) {
      console.warn(`⚠️  Session not paused for MAC: ${normalizedMac}`);
      throw new Error('Session is not paused');
    }

    try {
      // Calculate paused duration
      const now = new Date();
      const pauseDuration = Math.floor((now.getTime() - session.pausedAt.getTime()) / 1000); // in seconds
      session.pausedDuration = (session.pausedDuration || 0) + pauseDuration;

      // Extend session end time by the pause duration
      const additionalMs = pauseDuration * 1000;
      session.endTime = new Date(session.endTime.getTime() + additionalMs);

      // Reset pause state
      session.paused = false;
      session.pausedAt = undefined;

      // Update database
      updateSession(normalizedMac, {
        paused: false,
        pausedAt: null,
        pausedDuration: session.pausedDuration,
        endTime: session.endTime.toISOString()
      });

      console.log(`🔓 Restoring internet access for MAC: ${normalizedMac}`);
      
      // Restore internet access with comprehensive firewall rules
      await networkManager.allowMACAddress(normalizedMac, session.ipAddress);
      
      // Verify the restoration was successful
      const isAllowed = networkManager.isMacAllowed(normalizedMac);
      if (!isAllowed) {
        console.error(`❌ CRITICAL: MAC ${normalizedMac} is not allowed after restoration!`);
        throw new Error('Failed to properly restore MAC address - still showing as blocked');
      }
      
      // Reschedule session expiration
      this.scheduleSessionExpiration(normalizedMac, session.endTime);

      console.log(`✅ Session successfully resumed for MAC: ${normalizedMac}. Extended by ${pauseDuration} seconds. New end time: ${session.endTime.toISOString()}`);
      
    } catch (error) {
      console.error(`❌ Error resuming session for MAC ${normalizedMac}:`, error);
      
      // Rollback on failure - restore pause state
      session.paused = true;
      session.pausedAt = new Date();
      
      throw new Error(`Failed to resume session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  cleanup(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all session timers
    for (const timer of this.sessionTimers.values()) {
      clearTimeout(timer);
    }
    this.sessionTimers.clear();

    // End all active sessions
    for (const macAddress of this.activeSessions.keys()) {
      this.endSession(macAddress).catch(error => {
        console.error(`Error ending session during cleanup: ${error}`);
      });
    }

    console.log('Session manager cleaned up');
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
