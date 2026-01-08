/**
 * Admin Authentication API Routes
 * Handle admin login and password management
 */
import { Router, type Request, type Response } from 'express'
import { authenticateAdmin, updateAdminPassword, getAdminCredentials } from '../middleware/auth.js'

const router = Router()

/**
 * Admin Login
 * POST /api/auth/login
 * Body: { username: string, password: string }
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body
    
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' })
      return
    }
    
    if (authenticateAdmin(username, password)) {
      res.json({ 
        success: true, 
        message: 'Login successful',
        username: username
      })
    } else {
      res.status(401).json({ error: 'Invalid credentials' })
    }
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Change Admin Password
 * POST /api/auth/change-password
 * Body: { currentPassword: string, newPassword: string }
 */
router.post('/change-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body
    
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' })
      return
    }
    
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' })
      return
    }
    
    const credentials = getAdminCredentials()
    if (!credentials) {
      res.status(500).json({ error: 'Admin credentials not initialized' })
      return
    }
    
    // Verify current password
    if (!authenticateAdmin(credentials.username, currentPassword)) {
      res.status(401).json({ error: 'Current password is incorrect' })
      return
    }
    
    // Update password
    if (updateAdminPassword(newPassword)) {
      res.json({ 
        success: true, 
        message: 'Password updated successfully'
      })
    } else {
      res.status(500).json({ error: 'Failed to update password' })
    }
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Get Admin Status
 * GET /api/auth/status
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const credentials = getAdminCredentials()
    res.json({
      initialized: !!credentials,
      username: credentials?.username || null
    })
  } catch (error) {
    console.error('Status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * User Logout (placeholder for future session management)
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  res.json({ success: true, message: 'Logged out successfully' })
})

/**
 * User Registration (not implemented for admin system)
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  res.status(403).json({ error: 'Registration not allowed' })
})

export default router
