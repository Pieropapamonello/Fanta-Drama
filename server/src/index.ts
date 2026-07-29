import 'dotenv/config'
import app from './app'
import { closeDueEvents } from './services/scoring'
import { refreshAuctions, sendAuctionReminder } from './services/auctions'
import { db } from './services/firebase'

const port = process.env.PORT || 4000

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
  void closeDueEvents().catch((error) => console.error('Automatic event scoring failed', error))
  const tick = async () => { await closeDueEvents(); await refreshAuctions(); const events = await db.collection('events').get(); await Promise.allSettled(events.docs.map((event) => sendAuctionReminder(event.id))) }
  void tick().catch((error) => console.error('Automatic game tick failed', error))
  setInterval(() => void tick().catch((error) => console.error('Automatic game tick failed', error)), 60_000)
})
