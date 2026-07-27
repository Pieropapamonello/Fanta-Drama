import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'

export default function GroupsList() {
  const [groups, setGroups] = useState<any[]>([])
  useEffect(() => {
    api.get('/groups').then((res) => setGroups(res.data.groups)).catch(() => {})
  }, [])
  return (
    <div>
      <h2 className="text-2xl mb-4">I miei gruppi</h2>
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.id} className="p-3 border rounded">
            <h3 className="font-semibold">{g.name}</h3>
            <p className="text-sm">{g.description}</p>
            <Link to={`/groups/${g.id}`} className="text-indigo-600 text-sm">Apri</Link>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Link to="/groups/create" className="btn mr-2">Crea gruppo</Link>
        <Link to="/groups/join" className="btn btn-ghost">Entra con codice</Link>
      </div>
    </div>
  )
}
