/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import hardwareRoutes from './routes/hardware.js'
import networkRoutes from './routes/network.js'
import sessionRoutes from './routes/session.js'
import adminRoutes from './routes/admin.js'
import portalRoutes from './routes/portal.js'
import { getSettings } from './database.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientDist = path.join(process.cwd(), 'dist')

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/hardware', hardwareRoutes)
app.use('/api/network', networkRoutes)
app.use('/api/session', sessionRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/portal', portalRoutes)

const forceRedirect = process.env.CAPTIVE_FORCE_REDIRECT === 'true'
const allowAdmin = process.env.CAPTIVE_ALLOW_ADMIN !== 'false'

function getClientIp(req: Request): string {
  const xf = (req.headers['x-forwarded-for'] as string) || ''
  const ip = xf.split(',')[0]?.trim() || req.ip || ''
  return ip.replace('::ffff:', '')
}

function sameSubnet(ip: string, gateway: string): boolean {
  const a = ip.split('.')
  const b = gateway.split('.')
  if (a.length < 4 || b.length < 4) return false
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const settings = getSettings()
  const clientIp = getClientIp(req)
  const isCaptiveClient = sameSubnet(clientIp, settings.network.gateway)
  if (
    forceRedirect &&
    isCaptiveClient &&
    req.method === 'GET' &&
    !req.path.startsWith('/api/') &&
    !req.path.startsWith('/portal') &&
    !(allowAdmin && req.path.startsWith('/admin')) &&
    !req.path.startsWith('/assets') &&
    !req.path.startsWith('/favicon') &&
    !req.path.startsWith('/manifest') &&
    !req.path.startsWith('/@vite') &&
    !req.path.startsWith('/index.html')
  ) {
    return res.redirect('/portal')
  }
  next()
})

/**
 * Captive portal detection endpoints
 */
app.get('/generate_204', (req, res) => {
  res.redirect('/portal')
})
app.get('/hotspot-detect.html', (req, res) => {
  res.redirect('/portal')
})
app.get('/ncsi.txt', (req, res) => {
  res.redirect('/portal')
})
app.get('/connecttest.txt', (req, res) => {
  res.redirect('/portal')
})
app.get('/redirect', (req, res) => {
  res.redirect('/portal')
})
app.get('/success', (req, res) => {
  res.type('text/plain').send('Success')
})
app.get('/success.html', (req, res) => {
  res.status(200).send('<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>')
})

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * Static frontend (production)
 * Serve built React app from /dist
 */
app.use(express.static(clientDist))

// SPA fallback for non-API routes
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'API not found',
    })
  }
  res.sendFile(path.join(clientDist, 'index.html'))
})

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
