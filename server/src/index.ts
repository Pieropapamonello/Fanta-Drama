import 'dotenv/config'
import app from './app'
import { closeDueEvents } from './services/scoring'
import { refreshAuctions } from './services/auctions'
import { refreshClaimVerificationReminders } from './services/claim-voting'

const port = process.env.PORT || 4000
// Background maintenance must be deliberately conservative on the Firebase
// free tier. Event pages still refresh their own auction when a user opens it.
const TICK_INTERVAL_MS = Math.max(5 * 60_000, Number(process.env.GAME_TICK_INTERVAL_MS ?? 15 * 60_000))
const QUOTA_BACKOFF_MS = Math.max(30 * 60_000, Number(process.env.GAME_TICK_QUOTA_BACKOFF_MS ?? 6 * 60 * 60_000))
let tickRunning = false
let quotaPausedUntil = 0

function isQuotaExceeded(error: unknown) {
  const value = error as { code?: unknown; message?: unknown; details?: unknown }
  return Number(value?.code) === 8 || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(`${value?.message ?? ''} ${value?.details ?? ''}`)
}

async function tick() {
  if (tickRunning || Date.now() < quotaPausedUntil) return
  tickRunning = true
  try {
    await closeDueEvents()
    await refreshAuctions()
    await refreshClaimVerificationReminders()
  } catch (error) {
    if (isQuotaExceeded(error)) {
      quotaPausedUntil = Date.now() + QUOTA_BACKOFF_MS
      console.warn(`Firestore quota exhausted: automatic maintenance paused until ${new Date(quotaPausedUntil).toISOString()}.`)
    } else {
      console.error('Automatic game tick failed', error)
    }
  } finally {
    tickRunning = false
  }
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
  void tick()
  setInterval(() => void tick(), TICK_INTERVAL_MS)
})
