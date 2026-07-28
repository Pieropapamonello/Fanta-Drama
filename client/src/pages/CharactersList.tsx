import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link, useParams } from 'react-router-dom'
import { CharacterMoodCard, moodFromGameState } from '../components/CharacterMoodCard'

export default function CharactersList() {
  const [chars, setChars] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [eventState, setEventState] = useState<string | undefined>()
  const { groupId } = useParams()

  useEffect(() => {
    if (!groupId) return
    api.get(`/characters/group/${groupId}`)
      .then((res) => setChars(res.data.characters))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [groupId])

  useEffect(() => {
    api.get('/events').then((res) => {
      const events = res.data.events || []
      const live = events.find((event: any) => event.state?.toUpperCase().includes('LIVE'))
      setEventState(live?.state || events[0]?.state)
    }).catch(() => {})
  }, [])

  return (
    <div>
      <div className="page-heading">
        <div><p className="eyebrow">La tua cast</p><h2>Personaggi</h2></div>
        <span className="cast-count">{chars.length} in scena</span>
      </div>
      <p className="page-lead">Ogni personaggio reagisce al drama: lo stato e gli effetti cambiano quando un evento entra live o chiude i pronostici.</p>
      <div className="character-grid">
        {chars.map(c => <CharacterMoodCard key={c.id} name={c.name} nickname={c.nickname} image={c.image} mood={moodFromGameState(c.id || c.name, eventState)} />)}
      </div>
      {isLoading && <div className="empty-state">Sto chiamando la tua crew sul palco…</div>}
      {!isLoading && !chars.length && <div className="empty-state">Nessun personaggio ancora: aggiungine uno dal tuo gruppo e vedrai apparire qui la sua versione drama.</div>}
      <div className="mt-4">
        <Link to="/groups" className="btn">Torna ai gruppi</Link>
      </div>
    </div>
  )
}
