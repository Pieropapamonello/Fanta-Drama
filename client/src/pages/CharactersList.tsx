import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link, useParams } from 'react-router-dom'

export default function CharactersList() {
  const [chars, setChars] = useState<any[]>([])
  const { groupId } = useParams()
  useEffect(() => {
    if (!groupId) return
    api.get(`/characters/group/${groupId}`).then((res) => setChars(res.data.characters)).catch(() => {})
  }, [groupId])
  return (
    <div>
      <h2 className="text-2xl mb-4">Personaggi</h2>
      <div className="space-y-2">
        {chars.map(c => (
          <div key={c.id} className="p-3 border rounded">
            <h3 className="font-semibold">{c.name} {c.nickname ? `(${c.nickname})` : ''}</h3>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Link to="/groups" className="btn">Torna ai gruppi</Link>
      </div>
    </div>
  )
}
