import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData } from '../services/firebase'
import { groupRole } from '../services/firebase'
import { starterCards } from '../data/starter-content'
import { createEventCardAuction, DEFAULT_DIRECT_CARD_PRICE } from '../services/auctions'
import { notifyGroupMembers } from '../services/notifications'
import { isPlatformAdmin } from '../services/platform-admin'

const router = Router()
const auctionOnly = (_req: AuthRequest, res: any) => res.status(410).json({ error: 'cards_are_available_only_through_event_auctions' })
const schema = z.object({
  title: z.string().trim().min(3).max(100), description: z.string().trim().min(12).max(500),
  rarity: z.enum(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']).optional(),
  type: z.enum(['YES_NO', 'PICK_CHARACTER', 'MULTI_CHOICE', 'NUMBER', 'RANGE', 'TIME', 'TEXT', 'FIRST_ACTION', 'ORDER']).optional(),
  imageUrl: z.string().url().max(2048), imageStoragePath: z.string().max(1024).optional(), eventId: z.string().min(1).optional(),
  directPrice: z.number().int().min(1).max(1_000_000).optional()
})
const interestSchema = z.object({ interested: z.boolean() })
const priceSchema = z.object({ cardKey: z.string().regex(/^(starter|custom):[a-zA-Z0-9_-]+$/), directPrice: z.number().int().min(1).max(1_000_000) })

function normalized(value: string) {
  return value.toLocaleLowerCase('it-IT').replace(/\s+/g, ' ').trim()
}

// Kept only to return an explicit response to older app versions: cards are no
// longer copied into personal decks and can only be won in an event auction.
router.post('/library/:slug', requireAuth, auctionOnly)
router.post('/library/custom/:id', requireAuth, auctionOnly)

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
    // Uniqueness is global for community cards, and local to a single event for
    // event-only cards. This lets two crews tell different stories safely.
    if (!data.eventId && !sameTitle.empty) return res.status(409).json({ error: 'card_title_already_exists' })
    if (!data.eventId && !sameDescription.empty) return res.status(409).json({ error: 'card_description_already_exists' })
    if (!data.eventId && !sameImage.empty) return res.status(409).json({ error: 'card_image_already_exists' })
    let event: any = null
    if (data.eventId) {
      const snapshot = await db.collection('events').doc(data.eventId).get()
      if (!snapshot.exists) return res.status(404).json({ error: 'event_not_found' })
      const platformAdmin = await isPlatformAdmin(req.userId!)
      const role = await groupRole(String(snapshot.data()?.groupId), req.userId!)
      if (!role && !platformAdmin) return res.status(403).json({ error: 'event_access_denied' })
      const participantIds = (snapshot.data()?.participantIds as string[] | undefined) ?? []
      if (!participantIds.includes(req.userId!) && snapshot.data()?.createdBy !== req.userId! && !platformAdmin) return res.status(403).json({ error: 'join_event_before_creating_card' })
      if (new Date(String(snapshot.data()?.endsAt)).getTime() <= Date.now()) return res.status(409).json({ error: 'event_finished' })
      event = snapshot
    }
    const profile = await db.collection('users').doc(req.userId!).get()
    const ref = db.collection('cardCatalog').doc()
    const card = { ...data, directPrice: data.directPrice ?? DEFAULT_DIRECT_CARD_PRICE, rarity: data.rarity ?? 'COMMON', type: data.type ?? 'YES_NO', status: 'APPROVED', scope: data.eventId ? 'EVENT' : 'GLOBAL', creatorId: req.userId!, creatorName: profile.data()?.username ?? 'Giocatore', normalizedTitle, normalizedDescription, createdAt: new Date().toISOString(), autoApprovedAt: new Date().toISOString() }
    await ref.set(card)
    if (event) {
      await createEventCardAuction(event.id, event.data() as Record<string, unknown>, ref.id, card)
      void notifyGroupMembers(String(event.data()?.groupId), { kind: 'EVENT_CARD_CREATED', title: `Nuova carta per ${event.data()?.title}`, message: `${card.creatorName} ha aggiunto “${card.title}”: apri l’evento per comprarla o rilanciare.`, path: `/events/${event.id}`, actionLabel: 'Apri mercato evento' }, [req.userId!])
    }
    return res.status(201).json({ catalogCard: documentData(ref.id, card) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'invalid_card' }) }
})

// The price belongs to the card definition, not to the buyer.  This keeps
// direct-purchase events fair while allowing the card creator (or platform
// admin) to correct a price at any time before a player buys it.
router.patch('/pricing', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { cardKey, directPrice } = priceSchema.parse(req.body)
    const isAdmin = await isPlatformAdmin(req.userId!)
    if (cardKey.startsWith('starter:')) {
      if (!isAdmin) return res.status(403).json({ error: 'only_admin_can_price_starter_cards' })
      const slug = cardKey.slice('starter:'.length)
      if (!starterCards.some((card) => card.slug === slug)) return res.status(404).json({ error: 'card_not_found' })
      await db.collection('cardPriceOverrides').doc(`starter_${slug}`).set({ cardKey, directPrice, updatedBy: req.userId, updatedAt: new Date().toISOString() }, { merge: true })
    } else {
      const cardId = cardKey.slice('custom:'.length)
      const card = await db.collection('cardCatalog').doc(cardId).get()
      if (!card.exists) return res.status(404).json({ error: 'card_not_found' })
      if (!isAdmin && card.data()?.creatorId !== req.userId) return res.status(403).json({ error: 'only_creator_or_admin_can_change_price' })
      await card.ref.update({ directPrice, priceUpdatedBy: req.userId, priceUpdatedAt: new Date().toISOString() })
    }

    // Update every open direct-purchase market immediately; there is no need
    // to wait for the next event refresh.
    const auctions = await db.collection('auctions').where('cardKey', '==', cardKey).get()
    const pending = auctions.docs.filter((auction) => auction.data().acquisitionMode === 'DIRECT' && new Date(String(auction.data().closesAt)).getTime() > Date.now())
    while (pending.length) {
      const batch = db.batch()
      pending.splice(0, 400).forEach((auction) => batch.update(auction.ref, { directPrice, directPriceConfigured: true, updatedAt: new Date().toISOString() }))
      await batch.commit()
    }
    return res.json({ ok: true, cardKey, directPrice })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'price_update_failed' }) }
})

router.get('/library', requireAuth, async (_req, res) => {
  const catalog = await db.collection('cardCatalog').orderBy('createdAt', 'desc').get()
  const communityCards = catalog.docs.filter((doc) => doc.data().status !== 'REJECTED').map((doc) => ({ ...documentData(doc.id, doc.data() as Record<string, unknown>), catalogCardId: doc.id }))
  // Official cards are released only with their own finished GPT image. This
  // prevents the UI fallback art from ever making two cards look the same.
  return res.json({ cards: [...starterCards.filter((card) => Boolean(card.imageUrl)), ...communityCards] })
})

router.post('/library/:slug', requireAuth, async (req: AuthRequest, res) => {
  const template = starterCards.find((card) => card.slug === req.params.slug)
  if (!template) return res.status(404).json({ error: 'library_card_not_found' })
  const existing = await db.collection('cards').where('authorId', '==', req.userId!).get()
  const duplicate = existing.docs.find((doc) => doc.data().librarySlug === template.slug)
  if (duplicate) return res.status(200).json({ card: documentData(duplicate.id, duplicate.data() as Record<string, unknown>), alreadyAdded: true })
  const ref = db.collection('cards').doc()
  if (!template.imageUrl) return res.status(409).json({ error: 'library_card_artwork_pending' })
  const imageUrl = template.imageUrl
  const card = { ...template, imageUrl, librarySlug: template.slug, authorId: req.userId!, createdAt: new Date().toISOString() }
  delete (card as any).prompt
  await ref.set(card)
  return res.status(201).json({ card: documentData(ref.id, card) })
})

router.post('/library/custom/:id', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('cardCatalog').doc(req.params.id).get()
  if (!snapshot.exists) return res.status(404).json({ error: 'catalog_card_not_found' })
  const result = await addCatalogCardToDeck(req.userId!, snapshot.id, snapshot.data() as Record<string, unknown>)
  return res.status(result.alreadyAdded ? 200 : 201).json(result)
})

router.get('/interests', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('cardInterests').where('userId', '==', req.userId!).get()
  return res.json({ keys: snapshot.docs.map((item) => String(item.data().cardKey)) })
})

router.put('/interests/:key', requireAuth, async (req: AuthRequest, res) => {
  const { interested } = interestSchema.parse(req.body); const cardKey = req.params.key
  if (!/^(starter|custom):[a-zA-Z0-9_-]+$/.test(cardKey)) return res.status(400).json({ error: 'invalid_card_key' })
  const id = Buffer.from(`${req.userId!}\u0000${cardKey}`).toString('base64url'); const ref = db.collection('cardInterests').doc(id)
  if (interested) await ref.set({ userId: req.userId!, cardKey, updatedAt: new Date().toISOString() }); else await ref.delete()
  return res.json({ cardKey, interested })
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
