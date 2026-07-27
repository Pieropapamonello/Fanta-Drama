import React from 'react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="py-12">
      <h2 className="text-3xl font-bold mb-4">FantaDrama — Pronostica il caos</h2>
      <p className="mb-6">Un gioco privato tra amici per pronosticare il caos.</p>
      <div className="space-x-4">
        <Link to="/register" className="btn">Iscriviti</Link>
        <Link to="/login" className="btn btn-ghost">Accedi</Link>
      </div>
    </div>
  )
}
