import express from 'express';
import request from 'supertest';
import { sessionManager } from '../sessionManager.js';

// Mock the session manager
jest.mock('../sessionManager.js');

const mockSessionManager = {
  getSession: jest.fn(),
  pauseSession: jest.fn(),
  resumeSession: jest.fn(),
  getSessionTimeRemaining: jest.fn()
};

(sessionManager as any) = mockSessionManager;

// Import the router after mocking
import portalRouter from '../routes/portal.js';

const app = express();
app.use(express.json());
app.use('/api/portal', portalRouter);

describe('Pause/Resume API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/portal/pause', () => {
    it('should pause an active session successfully', async () => {
      const mockSession = {
        macAddress: 'aa:bb:cc:dd:ee:ff',
        active: true,
        paused: false
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.pauseSession.mockResolvedValue(undefined);
      mockSessionManager.getSessionTimeRemaining.mockReturnValue(1800);

      const response = await request(app)
        .post('/api/portal/pause')
        .send({ macAddress: 'aa:bb:cc:dd:ee:ff' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Session paused successfully');
      expect(response.body.data.timeRemaining).toBe(1800);
      expect(mockSessionManager.pauseSession).toHaveBeenCalledWith('aa:bb:cc:dd:ee:ff');
    });

    it('should return error for non-existent session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const response = await request(app)
        .post('/api/portal/pause')
        .send({ macAddress: 'aa:bb:cc:dd:ee:ff' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No active session found');
    });

    it('should return error for already paused session', async () => {
      const mockSession = {
        macAddress: 'aa:bb:cc:dd:ee:ff',
        active: true,
        paused: true
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/portal/pause')
        .send({ macAddress: 'aa:bb:cc:dd:ee:ff' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session is already paused');
    });

    it('should return error for invalid MAC address', async () => {
      const response = await request(app)
        .post('/api/portal/pause')
        .send({ macAddress: 'invalid-mac' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid MAC address format');
    });
  });

  describe('POST /api/portal/resume', () => {
    it('should resume a paused session successfully', async () => {
      const mockSession = {
        macAddress: 'aa:bb:cc:dd:ee:ff',
        active: true,
        paused: true
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.resumeSession.mockResolvedValue(undefined);
      mockSessionManager.getSessionTimeRemaining.mockReturnValue(1800);

      const response = await request(app)
        .post('/api/portal/resume')
        .send({ macAddress: 'aa:bb:cc:dd:ee:ff' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Session resumed successfully');
      expect(response.body.data.timeRemaining).toBe(1800);
      expect(mockSessionManager.resumeSession).toHaveBeenCalledWith('aa:bb:cc:dd:ee:ff');
    });

    it('should return error for non-existent session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const response = await request(app)
        .post('/api/portal/resume')
        .send({ macAddress: 'aa:bb:cc:dd:ee:ff' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No active session found');
    });

    it('should return error for non-paused session', async () => {
      const mockSession = {
        macAddress: 'aa:bb:cc:dd:ee:ff',
        active: true,
        paused: false
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/portal/resume')
        .send({ macAddress: 'aa:bb:cc:dd:ee:ff' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session is not paused');
    });
  });

  describe('GET /api/portal/status', () => {
    it('should include pause status in session status', async () => {
      const mockSession = {
        macAddress: 'aa:bb:cc:dd:ee:ff',
        active: true,
        paused: true,
        pausedAt: new Date().toISOString(),
        pausedDuration: 300
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.getSessionTimeRemaining.mockReturnValue(1500);

      const response = await request(app)
        .get('/api/portal/status')
        .query({ mac: 'aa:bb:cc:dd:ee:ff' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isPaused).toBe(true);
      expect(response.body.data.pausedAt).toBe(mockSession.pausedAt);
      expect(response.body.data.pausedDuration).toBe(300);
      expect(response.body.data.connected).toBe(false); // Should be false when paused
    });

    it('should show connected when session is active and not paused', async () => {
      const mockSession = {
        macAddress: 'aa:bb:cc:dd:ee:ff',
        active: true,
        paused: false
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.getSessionTimeRemaining.mockReturnValue(1800);

      const response = await request(app)
        .get('/api/portal/status')
        .query({ mac: 'aa:bb:cc:dd:ee:ff' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isPaused).toBe(false);
      expect(response.body.data.connected).toBe(true);
    });
  });
});

// Export for manual testing
export { app };