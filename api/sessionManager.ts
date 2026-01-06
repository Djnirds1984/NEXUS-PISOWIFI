import { networkManager } from './networkManager.js';
import { addSession, updateSession, removeSession, getActiveSessions, cleanupExpiredSessions, getSessions, getSettings } from './database.js';

export interface UserSession {
  macAddress: string;
  ipAddress?: string;
  startTime: Date;
  endTime: Date;
  pesos: number;
  minutes: number;
  active: boolean;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalRevenue: number;
  averageSessionDuration: number;
}

export class SessionManager {
  private activeSessions: Map<string, UserSession> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Load existing active sessions from database
    const sessions = getActiveSessions();
    for (const session of sessions) {
      const userSession: UserSession = {
        ...session,
        startTime: new Date(session.startTime),
        endTime: new Date(session.endTime)
      };
      
      this.activeSessions.set(session.macAddress, userSession);
      
      // Schedule session expiration
      this.scheduleSessionExpiration(session.macAddress, userSession.endTime);
      
      // Allow internet access for this session
      if (userSession.active) {
        await networkManager.allowMACAddress(session.macAddress);
      }
    }

    // Set up periodic cleanup of expired sessions
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Clean up every minute

    console.log(`Session manager initialized with ${this.activeSessions.size} active sessions`);
  }

  async startSession(macAddress: string, pesos: number): Promise<UserSession> {
    try {
      // Calculate session duration based on pesos
      const minutes = this.calculateSessionDuration(pesos);
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + minutes * 60000); // Add minutes in milliseconds

      // Create session object
      const session: UserSession = {
        macAddress,
        startTime,
        endTime,
        pesos,
        minutes,
        active: true
      };

      // Add to database
      addSession({
        ...session,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString()
      });

      // Add to active sessions map
      this.activeSessions.set(macAddress, session);

      // Allow internet access
      await networkManager.allowMACAddress(macAddress);

      // Schedule session expiration
      this.scheduleSessionExpiration(macAddress, endTime);

      console.log(`Session started for ${macAddress}: ${pesos} pesos = ${minutes} minutes`);

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
      const now = new Date();
      const endTime = new Date(now.getTime() + minutes * 60000);
      const session: UserSession = {
        macAddress,
        startTime: now,
        endTime,
        pesos: 0,
        minutes,
        active: true
      };
      addSession({
        ...session,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString()
      });
      this.activeSessions.set(macAddress, session);
      await networkManager.allowMACAddress(macAddress);
      this.scheduleSessionExpiration(macAddress, endTime);
      console.log(`Timed session started for ${macAddress}: ${minutes} minutes`);
      return session;
    } catch (error) {
      console.error('Error starting timed session:', error);
      throw error;
    }
  }

  async endSession(macAddress: string): Promise<void> {
    try {
      const session = this.activeSessions.get(macAddress);
      if (!session) {
        throw new Error('Session not found');
      }

      // Mark session as inactive
      session.active = false;
      updateSession(macAddress, { active: false });

      // Remove from active sessions
      this.activeSessions.delete(macAddress);

      // Cancel expiration timer
      const timer = this.sessionTimers.get(macAddress);
      if (timer) {
        clearTimeout(timer);
        this.sessionTimers.delete(macAddress);
      }

      // Block internet access
      await networkManager.blockMACAddress(macAddress);

      console.log(`Session ended for ${macAddress}`);
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
    return this.activeSessions.get(macAddress);
  }

  getAllActiveSessions(): UserSession[] {
    return Array.from(this.activeSessions.values());
  }

  getSessionTimeRemaining(macAddress: string): number {
    const session = this.activeSessions.get(macAddress);
    if (!session || !session.active) {
      return 0;
    }

    const now = new Date();
    const timeRemaining = session.endTime.getTime() - now.getTime();
    return Math.max(0, Math.floor(timeRemaining / 1000)); // Return seconds
  }

  async extendSession(macAddress: string, additionalMinutes: number): Promise<void> {
    const session = this.activeSessions.get(macAddress);
    if (!session || !session.active) {
      throw new Error('Session not found or inactive');
    }

    // Extend session duration
    session.endTime = new Date(session.endTime.getTime() + additionalMinutes * 60000);
    session.minutes += additionalMinutes;

    // Update database
    updateSession(macAddress, {
      endTime: session.endTime.toISOString(),
      minutes: session.minutes
    });

    // Reschedule expiration timer
    this.scheduleSessionExpiration(macAddress, session.endTime);

    console.log(`Session extended for ${macAddress}: +${additionalMinutes} minutes`);
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

  isSessionActive(macAddress: string): boolean {
    const session = this.activeSessions.get(macAddress);
    return session ? session.active : false;
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
