import { Router } from 'express'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'fanta-drama' })
})

export default router
