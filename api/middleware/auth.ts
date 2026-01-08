import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Admin credentials storage
interface AdminCredentials {
  username: string;
  passwordHash: string;
  salt: string;
}

let adminCredentials: AdminCredentials | null = null;

// Hash password with salt
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Generate random salt
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Initialize default admin credentials
export function initializeAdminCredentials() {
  const defaultUsername = 'admin';
  const defaultPassword = 'admin123';
  const salt = generateSalt();
  const passwordHash = hashPassword(defaultPassword, salt);
  
  adminCredentials = {
    username: defaultUsername,
    passwordHash,
    salt
  };
  
  console.log('✓ Default admin credentials initialized (username: admin, password: admin123)');
}

// Get current admin credentials
export function getAdminCredentials(): AdminCredentials | null {
  return adminCredentials;
}

// Update admin password
export function updateAdminPassword(newPassword: string): boolean {
  if (!adminCredentials) return false;
  
  const salt = generateSalt();
  const passwordHash = hashPassword(newPassword, salt);
  
  adminCredentials = {
    ...adminCredentials,
    passwordHash,
    salt
  };
  
  return true;
}

// Authenticate admin
export function authenticateAdmin(username: string, password: string): boolean {
  if (!adminCredentials) return false;
  
  if (username !== adminCredentials.username) return false;
  
  const passwordHash = hashPassword(password, adminCredentials.salt);
  return passwordHash === adminCredentials.passwordHash;
}

// Authentication middleware
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [username, password] = credentials.split(':');
  
  if (!authenticateAdmin(username, password)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  
  next();
}

// Optional authentication middleware for checking if user is admin
export function checkAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    (req as any).isAdmin = false;
    next();
    return;
  }
  
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [username, password] = credentials.split(':');
  
  (req as any).isAdmin = authenticateAdmin(username, password);
  next();
}