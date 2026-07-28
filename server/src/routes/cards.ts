import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData } from '../services/firebase'

const router = Router()
const schema = z.object({
  title: z.string().trim().min(3).max(100), description: z.string().trim().min(12).max(500),
  rarity: z.enum(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']).optional(),
  type: z.enum(['YES_NO', 'PICK_CHARACTER', 'MULTI_CHOICE', 'NUMBER', 'RANGE', 'TIME', 'TEXT', 'FIRST_ACTION', 'ORDER']).optional(),
  basePoints: z.number().int().min(0).max(100).optional(), imageUrl: z.string().url().max(2048)
})

const STARTER_CARDS = [
  { slug: 'microfono-cristallo', title: 'Microfono di Cristallo', description: 'Pronostica chi conquistera il karaoke con una nota impossibile da dimenticare.', rarity: 'UNCOMMON', type: 'YES_NO', basePoints: 25, imageUrl: '/cards/secret-stage.png' },
  { slug: 'invito-fantasma', title: 'Invito Fantasma', description: 'Indovina se un ospite inatteso comparira quando il gruppo abbassa la guardia.', rarity: 'RARE', type: 'YES_NO', basePoints: 35, imageUrl: '/cards/velvet-secret.png' },
  { slug: 'disco-sospetta', title: 'Disco Sospetta', description: 'Pronostica se la pista da ballo esplodera nel momento meno opportuno.', rarity: 'EPIC', type: 'YES_NO', basePoints: 50, imageUrl: '/cards/disco-twist.png' },
  { slug: 'torta-gravita-zero', title: 'Torta a Gravita Zero', description: 'Scegli se il dolce resistera fino al brindisi finale senza incidenti.', rarity: 'UNCOMMON', type: 'YES_NO', basePoints: 20, imageUrl: '/cards/cake-chaos.png' },
  { slug: 'risata-proibita', title: 'Risata Proibita', description: 'Indovina chi ridera proprio nel silenzio piu importante della serata.', rarity: 'COMMON', type: 'YES_NO', basePoints: 15, imageUrl: '/characters/mischief.png' },
  { slug: 'sorpresa-elettrica', title: 'Sorpresa Elettrica', description: 'Pronostica se un colpo di scena lascera tutti senza parole.', rarity: 'RARE', type: 'YES_NO', basePoints: 40, imageUrl: '/characters/shock.png' },
  { slug: 'energia-della-crew', title: 'Energia della Crew', description: 'Scegli se la squadra trovera il ritmo perfetto prima di mezzanotte.', rarity: 'UNCOMMON', type: 'YES_NO', basePoints: 25, imageUrl: '/characters/pulse.png' },
  { slug: 'piano-in-silenzio', title: 'Piano in Silenzio', description: 'Indovina chi preparera la mossa piu calma e sorprendente della notte.', rarity: 'RARE', type: 'YES_NO', basePoints: 35, imageUrl: '/characters/calm.png' }
  ,{ slug: 'microfono-al-mezzanotte', title: 'Microfono a Mezzanotte', description: 'Pronostica chi salira sul palco quando la festa raggiunge il punto piu intenso.', rarity: 'EPIC', type: 'YES_NO', basePoints: 55, imageUrl: '/cards/community/microfono-cristallo-ai.png' }
  ,{ slug: 'busta-delle-meraviglie', title: 'Busta delle Meraviglie', description: 'Indovina chi ricevera l invito segreto che cambia le alleanze della crew.', rarity: 'RARE', type: 'YES_NO', basePoints: 45, imageUrl: '/cards/community/invito-fantasma-ai.png' }
] as const

function normalized(value: string) {
  return value.toLocaleLowerCase('it-IT').replace(/\s+/g, ' ').trim()
}

async function addCatalogCardToDeck(userId: string, catalogId: string, catalogCard: Record<string, unknown>) {
  const existing = await db.collection('cards').where('authorId', '==', userId).where('catalogCardId', '==', catalogId).limit(1).get()
  if (!existing.empty) return { card: documentData(existing.docs[0].id, existing.docs[0].data() as Record<string, unknown>), alreadyAdded: true }
  const ref = db.collection('cards').doc()
  const card: Record<string, unknown> = { ...catalogCard, catalogCardId: catalogId, authorId: userId, addedAt: new Date().toISOString(), createdAt: new Date().toISOString() }
  delete card.creatorId
  delete card.normalizedTitle
  delete card.normalizedDescription
  await ref.set(card)
  return { card: documentData(ref.id, card), alreadyAdded: false }
}

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = schema.parse(req.body)
    const normalizedTitle = normalized(data.title)
    const normalizedDescription = normalized(data.description)
    const [sameTitle, sameDescription, sameImage] = await Promise.all([
      db.collection('cardCatalog').where('normalizedTitle', '==', normalizedTitle).limit(1).get(),
      db.collection('cardCatalog').where('normalizedDescription', '==', normalizedDescription).limit(1).get(),
      db.collection('cardCatalog').where('imageUrl', '==', data.imageUrl).limit(1).get()
    ])
    if (!sameTitle.empty) return res.status(409).json({ error: 'card_title_already_exists' })
    if (!sameDescription.empty) return res.status(409).json({ error: 'card_description_already_exists' })
    if (!sameImage.empty) return res.status(409).json({ error: 'card_image_already_exists' })
    const profile = await db.collection('users').doc(req.userId!).get()
    const ref = db.collection('cardCatalog').doc()
    const card = { ...data, rarity: data.rarity ?? 'COMMON', type: data.type ?? 'YES_NO', basePoints: data.basePoints ?? 5, creatorId: req.userId!, creatorName: profile.data()?.username ?? 'Giocatore', normalizedTitle, normalizedDescription, createdAt: new Date().toISOString() }
    await ref.set(card)
    const deck = await addCatalogCardToDeck(req.userId!, ref.id, card)
    return res.status(201).json({ card: deck.card, catalogCard: documentData(ref.id, card) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'invalid_card' }) }
})

router.get('/library', requireAuth, async (_req, res) => {
  const catalog = await db.collection('cardCatalog').orderBy('createdAt', 'desc').get()
  const communityCards = catalog.docs.map((doc) => ({ ...documentData(doc.id, doc.data() as Record<string, unknown>), catalogCardId: doc.id }))
  return res.json({ cards: [...STARTER_CARDS, ...communityCards] })
})

router.post('/library/:slug', requireAuth, async (req: AuthRequest, res) => {
  const template = STARTER_CARDS.find((card) => card.slug === req.params.slug)
  if (!template) return res.status(404).json({ error: 'library_card_not_found' })
  const existing = await db.collection('cards').where('authorId', '==', req.userId!).get()
  const duplicate = existing.docs.find((doc) => doc.data().librarySlug === template.slug)
  if (duplicate) return res.status(200).json({ card: documentData(duplicate.id, duplicate.data() as Record<string, unknown>), alreadyAdded: true })
  const ref = db.collection('cards').doc()
  const card = { ...template, librarySlug: template.slug, authorId: req.userId!, createdAt: new Date().toISOString() }
  await ref.set(card)
  return res.status(201).json({ card: documentData(ref.id, card) })
})

router.post('/library/custom/:id', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('cardCatalog').doc(req.params.id).get()
  if (!snapshot.exists) return res.status(404).json({ error: 'catalog_card_not_found' })
  const result = await addCatalogCardToDeck(req.userId!, snapshot.id, snapshot.data() as Record<string, unknown>)
  return res.status(result.alreadyAdded ? 200 : 201).json(result)
})

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('cards').where('authorId', '==', req.userId!).get()
  const cards = snapshot.docs
    .map((doc) => documentData(doc.id, doc.data() as Record<string, unknown>))
    .sort((left, right) => String(right.createdAt ?? right.addedAt ?? '').localeCompare(String(left.createdAt ?? left.addedAt ?? '')))
  return res.json({ cards })
})

router.get('/:id', requireAuth, async (req, res) => {
  const snapshot = await db.collection('cards').doc(req.params.id).get()
  if (!snapshot.exists) return res.status(404).json({ error: 'not_found' })
  return res.json({ card: documentData(snapshot.id, snapshot.data() as Record<string, unknown>) })
})

export default router
