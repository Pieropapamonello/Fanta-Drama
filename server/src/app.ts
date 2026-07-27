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
import path from 'path'

const app = express()

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://www.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:']
    }
  }
}))
app.use(express.json())
app.use(cors({ origin: process.env.CLIENT_URL || undefined }))
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }))

app.use('/api/health', health)
app.use('/api/auth', auth)
app.use('/api/profile', profile)
app.use('/api/groups', groups)
app.use('/api/characters', characters)
app.use('/api/cards', cards)
app.use('/api/events', events)
app.use('/api/predictions', predictions)
app.use('/api/admin', admin)

const clientDist = path.resolve(__dirname, '../../client/dist')
app.use(express.static(clientDist))
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err)
  res.status(500).json({ error: 'internal_error' })
})

export default app
