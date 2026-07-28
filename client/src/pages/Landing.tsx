import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, Users } from 'lucide-react'

export default function Landing() {
  return <div className="hero">
    <section className="hero-copy">
      <p className="eyebrow"><Sparkles size={13} className="inline mr-1" /> Il tuo drama, le tue regole</p>
      <h1 className="hero-title">Pronostica il <em>caos.</em></h1>
      <p>Trasforma le serate con gli amici in una sfida privata fatta di eventi, carte imprevedibili e classifiche leggendarie.</p>
      <div className="hero-actions">
        <Link to="/register" className="btn">Inizia a giocare <ArrowRight size={16} /></Link>
        <Link to="/login" className="btn btn-ghost">Ho già un account</Link>
      </div>
      <p className="hero-note"><Users size={13} className="inline mr-1" /> Solo gruppi privati. Zero denaro reale.</p>
    </section>
    <section className="hero-visual" aria-label="Anteprima classifica FantaDrama">
      <span className="orb one" /><span className="orb two" />
      <div className="drama-board">
        <div className="board-top"><span>Serata leggendaria</span><span className="live-dot">live</span></div>
        <div className="board-score">+420</div>
        <div className="board-list">
          <div className="board-row"><span>La frase proibita</span><span className="board-tag">EPICA</span></div>
          <div className="board-row"><span>Ingresso a sorpresa</span><span className="board-tag">+80 pt</span></div>
          <div className="board-row"><span>Plot twist finale</span><span className="board-tag">LIVE</span></div>
        </div>
      </div>
    </section>
  </div>
}
