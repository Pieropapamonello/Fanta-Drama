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
  const allZero = totals.size > 0 && [...totals.values()].every((points) => points === 0)
  const ranking = [...totals.entries()].sort((a, b) => b[1] - a[1])
  // Credits are only the event budget, never score. When no card is confirmed,
  // every participant is tied at zero and the winner is selected at random.
  const winner = allZero ? ranking[Math.floor(Math.random() * ranking.length)] : ranking[0]
  const winnerProfile = winner ? await db.collection('users').doc(winner[0]).get() : null
  const winnerName = winnerProfile?.data()?.username ?? 'Giocatore'
  const batch = db.batch(); const now = new Date().toISOString()
  batch.update(eventRef, { state: 'PRONOSTICI_CHIUSI', closedAt: now, closedBy: source, updatedAt: now, ...(winner ? { winnerId: winner[0], winnerName, winnerPoints: winner[1], winnerSelection: allZero ? 'RANDOM_ZERO_POINTS' : 'SCORE' } : {}) })
  for (const [userId, points] of totals) batch.set(db.collection('scores').doc(`${userId}_${eventId}`), { userId, eventId, groupId: event.groupId, points, breakdown: { formula: 'confirmed_cards' }, createdAt: now, updatedAt: now }, { merge: true })
  await batch.commit()
  let liveUpdate = await createDramaBeat({ event: { title: String(event.title), description: String(event.description ?? '') }, phase: 'CLOSED', playersWithPoints: [...totals.values()].filter(value => value > 0).length })
  if (allZero && winner) liveUpdate = `${liveUpdate} Nessuna carta è stata confermata: tutti sono a 0 punti. Vincitore estratto casualmente: ${winnerName}.`
  await eventRef.set({ liveUpdate, liveUpdateAt: now }, { merge: true })
  await Promise.allSettled([...totals.entries()].filter(([, points]) => points > 0).map(([userId, points]) => notifyUser(userId, { kind: 'SCORE_UPDATED', title: `Punteggio aggiornato · ${event.title}`, message: `${liveUpdate} Hai chiuso con ${points} punti.`, path: `/events/${eventId}` })))
  await notifyGroupMembers(String(event.groupId), { kind: 'EVENT_CLOSED', title: `Evento concluso · ${event.title}`, message: winner ? `${liveUpdate} Vince la serata ${winnerName} con ${winner[1]} punti.` : liveUpdate, path: `/events/${eventId}` })
  return { alreadyClosed: false, totals, event }
}

export async function closeDueEvents() {
  const snapshot = await db.collection('events').where('state', '==', 'PRONOSTICI_APERTI').get()
  const due = snapshot.docs.filter(doc => new Date(doc.data().endsAt).getTime() <= Date.now())
  await Promise.allSettled(due.map(event => closeAndScoreEvent(event.id, 'automatic')))
  return due.length
}
