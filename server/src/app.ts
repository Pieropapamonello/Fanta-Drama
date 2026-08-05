import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import health from './routes/health'
import auth from './routes/auth'
import profile from './routes/profile'
import groups from './routes/groups'
import characters from './routes/characters'
import cards from './routes/cards'
import events from './routes/events'
import predictions from './routes/predictions'
import admin from './routes/admin'
import telegram from './routes/telegram'
import passkeys from './routes/passkeys'
import auctions from './routes/auctions'
import claims from './routes/claims'
import assets from './routes/assets'
import path from 'path'

const app = express()
app.set('trust proxy', 1)

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  // Telegram Login communicates the result from its authorization popup back
  // to the PWA. `same-origin` would sever window.opener during that flow.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firebaseinstallations.googleapis.com', 'https://fcmregistrations.googleapis.com', 'https://www.googleapis.com'],
      scriptSrc: ["'self'", 'https://telegram.org', 'https://www.gstatic.com'],
      workerSrc: ["'self'"],
      frameSrc: ["'self'", 'https://oauth.telegram.org', 'https://telegram.org'],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:']
    }
  }
}))
app.use(express.json())
app.use(cors({ origin: process.env.CLIENT_URL || undefined }))
// Chat, events and participants refresh in the background. Several friends often
// share one public IP, so an overly low IP limit blocks legitimate group sessions.
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health'
}))

app.use('/api/health', health)
app.use('/api/auth', auth)
app.use('/api/profile', profile)
app.use('/api/groups', groups)
app.use('/api/characters', characters)
app.use('/api/cards', cards)
app.use('/api/events', events)
app.use('/api/predictions', predictions)
app.use('/api/admin', admin)
app.use('/api/telegram', telegram)
app.use('/api/passkeys', passkeys)
app.use('/api/auctions', auctions)
app.use('/api/claims', claims)
app.use('/api/assets', assets)

const clientDist = path.resolve(__dirname, '../../client/dist')
app.use(express.static(clientDist))
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err)
  res.status(500).json({ error: 'internal_error' })
})

export default app
