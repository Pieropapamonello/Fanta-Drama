import { db } from './firebase'

async function moveDocuments(docs: FirebaseFirestore.QueryDocumentSnapshot[], updates: Record<string, unknown>) {
  while (docs.length) { const batch = db.batch(); docs.splice(0, 400).forEach((doc) => batch.update(doc.ref, updates)); await batch.commit() }
}

export async function mergeProfiles(primaryId: string, secondaryId: string) {
  if (primaryId === secondaryId) return { alreadyMerged: true }
  const [primary, secondary] = await Promise.all([db.collection('users').doc(primaryId).get(), db.collection('users').doc(secondaryId).get()])
  if (!primary.exists || !secondary.exists) throw new Error('user_not_found')
  const [groups, cards, catalog, predictions, scores, notifications, claims, appeals, transactions, passkeys, leaderAuctions, ownedAuctions, telegramLink, primaryWallet, secondaryWallet] = await Promise.all([
    db.collection('groups').where('memberIds', 'array-contains', secondaryId).get(), db.collection('cards').where('authorId', '==', secondaryId).get(), db.collection('cardCatalog').where('creatorId', '==', secondaryId).get(), db.collection('predictions').where('userId', '==', secondaryId).get(), db.collection('scores').where('userId', '==', secondaryId).get(), db.collection('notifications').where('userId', '==', secondaryId).get(), db.collection('cardClaims').where('userId', '==', secondaryId).get(), db.collection('appeals').where('userId', '==', secondaryId).get(), db.collection('creditTransactions').where('userId', '==', secondaryId).get(), db.collection('passkeys').where('userId', '==', secondaryId).get(), db.collection('auctions').where('leaderId', '==', secondaryId).get(), db.collection('auctions').where('ownerId', '==', secondaryId).get(), db.collection('telegramLinks').doc(secondaryId).get(), db.collection('wallets').doc(primaryId).get(), db.collection('wallets').doc(secondaryId).get()
  ])
  for (const group of groups.docs) {
    const data = group.data(); const memberIds = Array.from(new Set(((data.memberIds as string[]) ?? []).map((id) => id === secondaryId ? primaryId : id)))
    const memberRoles = { ...(data.memberRoles ?? {}) }; const sourceRole = memberRoles[secondaryId]; if (sourceRole === 'ADMIN' || !memberRoles[primaryId]) memberRoles[primaryId] = sourceRole ?? 'MEMBER'; delete memberRoles[secondaryId]
    await group.ref.update({ memberIds, memberRoles, updatedAt: new Date().toISOString() })
  }
  await Promise.all([
    moveDocuments([...cards.docs], { authorId: primaryId }), moveDocuments([...catalog.docs], { creatorId: primaryId }), moveDocuments([...predictions.docs, ...notifications.docs, ...claims.docs, ...appeals.docs, ...transactions.docs, ...passkeys.docs], { userId: primaryId }), moveDocuments([...leaderAuctions.docs], { leaderId: primaryId, leaderName: primary.data()?.username ?? 'Giocatore' }), moveDocuments([...ownedAuctions.docs], { ownerId: primaryId, ownerName: primary.data()?.username ?? 'Giocatore' })
  ])
  for (const score of scores.docs) { const data = score.data(); const destination = db.collection('scores').doc(`${primaryId}_${data.eventId}`); const current = await destination.get(); await destination.set({ ...data, userId: primaryId, points: Number(data.points ?? 0) + Number(current.data()?.points ?? 0), updatedAt: new Date().toISOString() }, { merge: true }); await score.ref.delete() }
  const balance = Number(primaryWallet.data()?.balance ?? 0) + Number(secondaryWallet.data()?.balance ?? 0); const reserved = Number(primaryWallet.data()?.reserved ?? 0) + Number(secondaryWallet.data()?.reserved ?? 0)
  if (primaryWallet.exists || secondaryWallet.exists) { await db.collection('wallets').doc(primaryId).set({ userId: primaryId, balance, reserved, updatedAt: new Date().toISOString() }, { merge: true }); if (secondaryWallet.exists) await secondaryWallet.ref.delete() }
  if (telegramLink.exists) { await db.collection('telegramLinks').doc(primaryId).set({ ...telegramLink.data(), mergedFrom: secondaryId, updatedAt: new Date().toISOString() }, { merge: true }); await telegramLink.ref.delete() }
  await db.collection('users').doc(secondaryId).set({ mergedInto: primaryId, mergedAt: new Date().toISOString(), profileCompleted: false }, { merge: true })
  return { primaryId, moved: { groups: groups.size, cards: cards.size, claims: claims.size, auctions: leaderAuctions.size + ownedAuctions.size, credits: balance, telegram: telegramLink.exists } }
}
