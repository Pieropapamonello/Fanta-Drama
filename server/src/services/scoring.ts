import { db } from './firebase'
import { notifyGroupMembers, notifyUser } from './notifications'

export async function closeAndScoreEvent(eventId: string, source: 'manual' | 'automatic' = 'manual') {
  const eventRef = db.collection('events').doc(eventId)
  const eventSnapshot = await eventRef.get()
  if (!eventSnapshot.exists) throw new Error('event_not_found')
  const event = eventSnapshot.data()!
  if (event.state === 'PRONOSTICI_CHIUSI') return { alreadyClosed: true, totals: new Map<string, number>(), event }

  const predictions = await db.collection('predictions').where('eventId', '==', eventId).get()
  const cards = await Promise.all(predictions.docs.map((prediction) => db.collection('cards').doc(prediction.data().cardId).get()))
  const totals = new Map<string, number>()
  const batch = db.batch()
  predictions.docs.forEach((prediction, index) => {
    const points = Number(cards[index].data()?.basePoints ?? 0) + Number(prediction.data().credits ?? 0)
    const userId = prediction.data().userId as string
    totals.set(userId, (totals.get(userId) ?? 0) + points)
    batch.update(prediction.ref, { resolved: true, points, resolvedAt: new Date().toISOString() })
  })
  batch.update(eventRef, { state: 'PRONOSTICI_CHIUSI', closedAt: new Date().toISOString(), closedBy: source, updatedAt: new Date().toISOString() })
  for (const [userId, points] of totals) {
    batch.set(db.collection('scores').doc(`${userId}_${eventId}`), { userId, eventId, groupId: event.groupId, points, breakdown: { formula: 'base_points_plus_credits' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  }
  await batch.commit()

  await Promise.allSettled([...totals.entries()].map(([userId, points]) => notifyUser(userId, {
    kind: 'SCORE_UPDATED', title: `Punteggio aggiornato · ${event.title}`, message: `Hai ricevuto ${points} punti per le tue previsioni. Controlla la classifica e il dettaglio dell’evento.`, path: `/events/${eventId}`
  })))
  await notifyGroupMembers(event.groupId, {
    kind: 'EVENT_CLOSED', title: `Pronostici chiusi · ${event.title}`, message: totals.size ? 'I punteggi sono stati calcolati e la classifica è aggiornata.' : 'L’evento è terminato senza pronostici da valutare.', path: `/events/${eventId}`
  }, [...totals.keys()])
  return { alreadyClosed: false, totals, event }
}

export async function closeDueEvents() {
  const snapshot = await db.collection('events').where('state', '==', 'PRONOSTICI_APERTI').get()
  const due = snapshot.docs.filter((doc) => new Date(doc.data().endsAt).getTime() <= Date.now())
  await Promise.allSettled(due.map((event) => closeAndScoreEvent(event.id, 'automatic')))
  return due.length
}
