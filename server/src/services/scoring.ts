import { db } from './firebase'
import { notifyGroupMembers, notifyUser } from './notifications'
import { createDramaBeat } from './drama-director'

export async function closeAndScoreEvent(eventId: string, source: 'manual' | 'automatic' = 'manual') {
  const eventRef = db.collection('events').doc(eventId); const eventSnapshot = await eventRef.get()
  if (!eventSnapshot.exists) throw new Error('event_not_found')
  const event = eventSnapshot.data()!
  if (event.state === 'PRONOSTICI_CHIUSI') return { alreadyClosed: true, totals: new Map<string, number>(), event }
  const claims = await db.collection('cardClaims').where('eventId', '==', eventId).get()
  const totals = new Map<string, number>(); const participantIds = (event.participantIds as string[] | undefined) ?? []
  participantIds.forEach(userId => totals.set(userId, 0))
  claims.docs.filter(claim => claim.data().status === 'CONFIRMED').forEach(claim => {
    const userId = String(claim.data().userId); totals.set(userId, (totals.get(userId) ?? 0) + Number(claim.data().rewardCredits ?? 0))
  })
  const batch = db.batch(); const now = new Date().toISOString()
  batch.update(eventRef, { state: 'PRONOSTICI_CHIUSI', closedAt: now, closedBy: source, updatedAt: now })
  for (const [userId, points] of totals) batch.set(db.collection('scores').doc(`${userId}_${eventId}`), { userId, eventId, groupId: event.groupId, points, breakdown: { formula: 'confirmed_cards' }, createdAt: now, updatedAt: now }, { merge: true })
  await batch.commit()
  const liveUpdate = await createDramaBeat({ event: { title: String(event.title), description: String(event.description ?? '') }, phase: 'CLOSED', playersWithPoints: [...totals.values()].filter(value => value > 0).length })
  await eventRef.set({ liveUpdate, liveUpdateAt: now }, { merge: true })
  const winner = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]
  await Promise.allSettled([...totals.entries()].filter(([, points]) => points > 0).map(([userId, points]) => notifyUser(userId, { kind: 'SCORE_UPDATED', title: `Punteggio aggiornato · ${event.title}`, message: `${liveUpdate} Hai chiuso con ${points} punti.`, path: `/events/${eventId}` })))
  await notifyGroupMembers(String(event.groupId), { kind: 'EVENT_CLOSED', title: `Evento concluso · ${event.title}`, message: winner ? `${liveUpdate} Vince la serata il giocatore con ${winner[1]} punti.` : liveUpdate, path: `/events/${eventId}` })
  return { alreadyClosed: false, totals, event }
}

export async function closeDueEvents() {
  const snapshot = await db.collection('events').where('state', '==', 'PRONOSTICI_APERTI').get()
  const due = snapshot.docs.filter(doc => new Date(doc.data().endsAt).getTime() <= Date.now())
  await Promise.allSettled(due.map(event => closeAndScoreEvent(event.id, 'automatic')))
  return due.length
}
