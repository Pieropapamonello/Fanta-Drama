import { db, documentData } from './firebase'
import { notifyGroupMembers, notifyUser } from './notifications'
import { starterCards } from '../data/starter-content'

const INITIAL_CREDITS = 1000
const OPENING_BID = 20
const MIN_INCREMENT = 5

function profileName(value: unknown) { return String(value || 'Un giocatore') }
function deadlineLabel(value: unknown) { return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(String(value))) }

export async function ensureWallet(userId: string) {
  const ref = db.collection('wallets').doc(userId)
  await db.runTransaction(async (transaction) => {
    const wallet = await transaction.get(ref)
    if (!wallet.exists) transaction.set(ref, { userId, balance: INITIAL_CREDITS, reserved: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  })
  return ref.get()
}

async function approvedCatalogCards() {
  const catalog = await db.collection('cardCatalog').get()
  return catalog.docs.filter((card) => card.data().status !== 'REJECTED').map((card) => ({ key: `custom:${card.id}`, ...card.data() }))
}

export async function createEventAuctions(eventId: string, event: Record<string, unknown>) {
  const acquisitionMode = event.acquisitionMode === 'DIRECT' ? 'DIRECT' : 'AUCTION'
  const closesAt = new Date(new Date(String(event.startsAt)).getTime() - (acquisitionMode === 'AUCTION' ? 60 * 60 * 1000 : 0)).toISOString()
  const customCards = await approvedCatalogCards()
  const selectedKeys = new Set(Array.isArray(event.cardKeys) ? event.cardKeys.map(String) : [])
  const cards: any[] = [
    ...starterCards.filter((card) => Boolean(card.imageUrl)).map((card) => ({ key: `starter:${card.slug}`, ...card })),
    ...customCards
  ].filter((card) => !selectedKeys.size || selectedKeys.has(String(card.key)))
  const cardCount = cards.length
  while (cards.length) {
    const batch = db.batch()
    cards.splice(0, 400).forEach((card) => {
      const ref = db.collection('auctions').doc(`${eventId}_${String(card.key).replace(/[^a-zA-Z0-9_-]/g, '_')}`)
      batch.set(ref, {
        eventId, groupId: event.groupId, cardKey: card.key, title: card.title, description: card.description, rarity: card.rarity ?? 'COMMON', type: card.type ?? 'YES_NO', imageUrl: card.imageUrl ?? '', creatorName: card.creatorName ?? null,
        acquisitionMode, openingBid: OPENING_BID, directPrice: Math.max(OPENING_BID, Number(card.basePoints ?? OPENING_BID)), minIncrement: MIN_INCREMENT, currentBid: 0, leaderId: null, leaderName: null, status: acquisitionMode === 'DIRECT' ? 'AVAILABLE' : 'OPEN', opensAt: new Date().toISOString(), closesAt, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }, { merge: true })
    })
    await batch.commit()
  }
  return cardCount
}

export async function buyEventCard(auctionId: string, userId: string) {
  await ensureWallet(userId)
  const auctionRef = db.collection('auctions').doc(auctionId)
  const walletRef = db.collection('wallets').doc(userId)
  const purchaseRef = db.collection('eventCardPurchases').doc(Buffer.from(`${auctionId}\u0000${userId}`).toString('base64url'))
  return db.runTransaction(async (transaction) => {
    const [auctionSnapshot, wallet, existing] = await Promise.all([transaction.get(auctionRef), transaction.get(walletRef), transaction.get(purchaseRef)])
    if (!auctionSnapshot.exists) throw new Error('auction_not_found')
    const auction = auctionSnapshot.data()!
    if (auction.acquisitionMode !== 'DIRECT' || auction.status !== 'AVAILABLE' || new Date(String(auction.closesAt)).getTime() <= Date.now()) throw new Error('direct_purchase_closed')
    if (existing.exists) return documentData(existing.id, existing.data() as Record<string, unknown>)
    const price = Number(auction.directPrice ?? auction.openingBid ?? OPENING_BID)
    const balance = Number(wallet.data()?.balance ?? INITIAL_CREDITS); const reserved = Number(wallet.data()?.reserved ?? 0)
    if (balance - reserved < price) throw new Error('insufficient_credits')
    const now = new Date().toISOString()
    const purchase = { auctionId, eventId: auction.eventId, groupId: auction.groupId, userId, cardKey: auction.cardKey, title: auction.title, description: auction.description ?? '', imageUrl: auction.imageUrl ?? '', rarity: auction.rarity ?? 'COMMON', price, createdAt: now }
    transaction.update(walletRef, { balance: balance - price, updatedAt: now })
    transaction.set(purchaseRef, purchase)
    transaction.set(db.collection('creditTransactions').doc(), { userId, amount: -price, kind: 'DIRECT_CARD_PURCHASE', auctionId, eventId: auction.eventId, createdAt: now })
    return documentData(purchaseRef.id, purchase)
  })
}

export async function placeBid(auctionId: string, userId: string, amount: number) {
  const auctionRef = db.collection('auctions').doc(auctionId)
  const walletRef = db.collection('wallets').doc(userId)
  const result: any = await db.runTransaction(async (transaction) => {
    const [auctionSnapshot, walletSnapshot, profileSnapshot] = await Promise.all([transaction.get(auctionRef), transaction.get(walletRef), transaction.get(db.collection('users').doc(userId))])
    if (!auctionSnapshot.exists) throw new Error('auction_not_found')
    const auction = auctionSnapshot.data()!
    if (auction.status !== 'OPEN' || new Date(String(auction.closesAt)).getTime() <= Date.now()) throw new Error('auction_closed')
    const minimum = auction.leaderId ? Number(auction.currentBid) + Number(auction.minIncrement ?? MIN_INCREMENT) : Number(auction.openingBid ?? OPENING_BID)
    if (!Number.isInteger(amount) || amount < minimum) throw new Error('bid_too_low')
    const wallet = walletSnapshot.exists ? walletSnapshot.data()! : { balance: INITIAL_CREDITS, reserved: 0 }
    const previousOwnBid = auction.leaderId === userId ? Number(auction.currentBid) : 0
    if (Number(wallet.balance) - Number(wallet.reserved) + previousOwnBid < amount) throw new Error('insufficient_credits')
    const previousLeaderId = auction.leaderId ? String(auction.leaderId) : null
    const previousBid = Number(auction.currentBid ?? 0)
    const priorWalletRef = previousLeaderId && previousLeaderId !== userId ? db.collection('wallets').doc(previousLeaderId) : null
    const priorWallet = priorWalletRef ? await transaction.get(priorWalletRef) : null
    if (!walletSnapshot.exists) transaction.set(walletRef, { userId, balance: INITIAL_CREDITS, reserved: amount, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    else transaction.update(walletRef, { reserved: Number(wallet.reserved) - previousOwnBid + amount, updatedAt: new Date().toISOString() })
    if (previousLeaderId && previousLeaderId !== userId) {
      if (priorWallet?.exists && priorWalletRef) transaction.update(priorWalletRef, { reserved: Math.max(0, Number(priorWallet.data()?.reserved ?? 0) - previousBid), updatedAt: new Date().toISOString() })
    }
    const now = new Date().toISOString(); const leaderName = profileSnapshot.data()?.username ?? 'Giocatore'
    transaction.update(auctionRef, { currentBid: amount, leaderId: userId, leaderName, updatedAt: now })
    transaction.set(auctionRef.collection('bids').doc(), { userId, amount, createdAt: now })
    return { auction: { ...auction, id: auctionSnapshot.id, currentBid: amount, leaderId: userId, leaderName }, previousLeaderId, previousBid }
  })
  const marketPath = result.auction.marketScope === 'GROUP' ? `/groups/${result.auction.groupId}/cards` : `/events/${result.auction.eventId}`
  const marketLabel = result.auction.marketScope === 'GROUP' ? 'Apri il mercato della crew' : 'Apri l’evento'
  void notifyGroupMembers(String(result.auction.groupId), { kind: 'AUCTION_OUTBID', title: `Nuova offerta · ${result.auction.title}`, message: `${profileName(result.auction.leaderName)} ha puntato ${amount} crediti. Asta in scadenza il ${deadlineLabel(result.auction.closesAt)}. ${marketLabel} per rilanciare.`, path: marketPath, actionLabel: 'Rilancia ora' }, [userId])
  return result.auction
}

export async function finalizeAuction(auctionId: string) {
  const ref = db.collection('auctions').doc(auctionId)
  const result: any = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new Error('auction_not_found')
    const auction = snapshot.data()!
    if (auction.status !== 'OPEN' || new Date(String(auction.closesAt)).getTime() > Date.now()) return null
    const now = new Date().toISOString()
    if (!auction.leaderId) { transaction.update(ref, { status: 'UNSOLD', finalizedAt: now, updatedAt: now }); return { ...auction, id: snapshot.id, status: 'UNSOLD' } }
    const walletRef = db.collection('wallets').doc(String(auction.leaderId))
    const wallet = await transaction.get(walletRef)
    const balance = Number(wallet.data()?.balance ?? INITIAL_CREDITS); const reserved = Number(wallet.data()?.reserved ?? 0); const paid = Number(auction.currentBid)
    transaction.set(walletRef, { userId: auction.leaderId, balance: Math.max(0, balance - paid), reserved: Math.max(0, reserved - paid), updatedAt: now }, { merge: true })
    transaction.update(ref, { status: 'WON', ownerId: auction.leaderId, ownerName: auction.leaderName ?? 'Giocatore', finalizedAt: now, updatedAt: now })
    transaction.set(db.collection('creditTransactions').doc(), { userId: auction.leaderId, amount: -paid, kind: 'AUCTION_PURCHASE', auctionId: snapshot.id, eventId: auction.eventId, createdAt: now })
    return { ...auction, id: snapshot.id, status: 'WON', ownerId: auction.leaderId }
  })
  if (result?.status === 'WON') {
    const path = result.marketScope === 'GROUP' ? `/groups/${result.groupId}/cards` : `/events/${result.eventId}`
    const context = result.marketScope === 'GROUP' ? 'per questa crew' : 'per questo evento'
    void notifyUser(String(result.ownerId), { kind: 'AUCTION_WON', title: `Hai vinto · ${result.title}`, message: `La carta è tua ${context}: hai speso ${result.currentBid} crediti.`, path })
  }
  return result
}

export async function refreshAuctions() {
  const snapshot = await db.collection('auctions').where('status', '==', 'OPEN').get()
  const due = snapshot.docs.filter((auction) => new Date(String(auction.data().closesAt)).getTime() <= Date.now())
  await Promise.allSettled(due.map((auction) => finalizeAuction(auction.id)))
  return due.length
}

export async function auctionsForEvent(eventId: string, userId: string) {
  await refreshAuctions()
  const wallet = await ensureWallet(userId)
  const [auctions, purchases] = await Promise.all([db.collection('auctions').where('eventId', '==', eventId).get(), db.collection('eventCardPurchases').where('eventId', '==', eventId).get()])
  const owned = new Set(purchases.docs.filter((purchase) => purchase.data().userId === userId).map((purchase) => String(purchase.data().auctionId)))
  const items: any[] = auctions.docs.map((auction) => ({ ...documentData(auction.id, auction.data() as Record<string, unknown>), purchasedByCurrentUser: owned.has(auction.id) }))
  return { currentUserId: userId, wallet: wallet.data(), auctions: items.sort((a, b) => String(a.title).localeCompare(String(b.title), 'it')) }
}

export async function sendAuctionReminder(eventId: string) {
  const ref = db.collection('events').doc(eventId); const event = await ref.get(); if (!event.exists || event.data()?.auctionReminderSentAt) return false
  if (event.data()?.acquisitionMode === 'DIRECT') return false
  const startsAt = new Date(String(event.data()?.startsAt)).getTime(); const closesAt = startsAt - 60 * 60 * 1000
  if (Date.now() < closesAt - 60 * 60 * 1000 || Date.now() >= closesAt) return false
  await ref.set({ auctionReminderSentAt: new Date().toISOString() }, { merge: true })
  await notifyGroupMembers(String(event.data()?.groupId), { kind: 'AUCTION_REMINDER', title: `Aste quasi chiuse · ${event.data()?.title}`, message: 'Manca meno di un’ora alla chiusura: controlla le carte e rilancia se vuoi vincerle.', path: `/events/${eventId}` })
  return true
}
