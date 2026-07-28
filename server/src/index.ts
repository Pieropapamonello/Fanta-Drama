import 'dotenv/config'
import app from './app'
import { closeDueEvents } from './services/scoring'

const port = process.env.PORT || 4000

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
  void closeDueEvents().catch((error) => console.error('Automatic event scoring failed', error))
  setInterval(() => void closeDueEvents().catch((error) => console.error('Automatic event scoring failed', error)), 60_000)
})
