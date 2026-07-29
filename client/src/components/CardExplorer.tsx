import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Heart, Volume2, VolumeX, X } from 'lucide-react'
import { DramaCardData } from './DramaCard'

let stopAmbient: (() => void) | null = null
export function playEpicSound(kind: 'open' | 'like' | 'skip') {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) return
  const audio = new AudioContextClass(); const now = audio.currentTime; const notes = kind === 'like' ? [261.63, 329.63, 392, 523.25] : kind === 'skip' ? [220, 185, 146.83] : [196, 246.94, 293.66, 392]
  notes.forEach((frequency: number, index: number) => { const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.type = index % 2 ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(frequency, now + index * .09); gain.gain.setValueAtTime(.0001, now + index * .09); gain.gain.exponentialRampToValueAtTime(.11, now + index * .09 + .025); gain.gain.exponentialRampToValueAtTime(.0001, now + index * .09 + .28); oscillator.connect(gain).connect(audio.destination); oscillator.start(now + index * .09); oscillator.stop(now + index * .09 + .3) })
  window.setTimeout(() => void audio.close(), 900)
}
export function startEpicAmbience() {
  stopAmbient?.()
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) return
  const audio = new AudioContextClass(); void audio.resume()
  const progression = [[130.81, 164.81, 196], [146.83, 185, 220], [110, 138.59, 164.81], [123.47, 155.56, 196]]; let step = 0
  const play = () => { const now = audio.currentTime; progression[step % progression.length].forEach((frequency: number, index: number) => { const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.type = index === 0 ? 'sine' : 'triangle'; oscillator.frequency.setValueAtTime(frequency, now); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(index === 0 ? .045 : .028, now + .12); gain.gain.exponentialRampToValueAtTime(.0001, now + 1.45); oscillator.connect(gain).connect(audio.destination); oscillator.start(now); oscillator.stop(now + 1.5) }); step += 1 }
  play(); const timer = window.setInterval(play, 1450); stopAmbient = () => { window.clearInterval(timer); void audio.close(); stopAmbient = null }
}
export function stopEpicAmbience() { stopAmbient?.() }

export default function CardExplorer({ cards, initialIndex, interests, onClose, onInterest }: { cards: DramaCardData[]; initialIndex: number; interests: Set<string>; onClose: () => void; onInterest: (card: DramaCardData, interested: boolean) => Promise<void> }) {
  const [index, setIndex] = useState(initialIndex); const [drag, setDrag] = useState(0); const [sound, setSound] = useState(true); const pointer = useRef<number | null>(null)
  const card = cards[index]; if (!card) return null
  const key = card.catalogCardId ? `custom:${card.catalogCardId}` : `starter:${card.slug}`; const interested = interests.has(key)
  const choose = async (value: boolean) => { if (sound) playEpicSound(value ? 'like' : 'skip'); await onInterest(card, value); setDrag(value ? 460 : -460); window.setTimeout(() => { setDrag(0); setIndex((current) => (current + 1) % cards.length) }, 240) }
  const finish = () => { if (Math.abs(drag) > 85) void choose(drag > 0); else setDrag(0); pointer.current = null }
  return createPortal(<div className="card-explorer-backdrop" role="dialog" aria-modal="true" aria-label={`Carta ${card.title}`}><div className="card-explorer-top"><button type="button" onClick={() => { stopEpicAmbience(); onClose() }}><X size={22} /> Chiudi</button><button type="button" onClick={() => setSound((value) => { if (value) stopEpicAmbience(); else startEpicAmbience(); return !value })}>{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button></div><div className="swipe-hint"><span>← Scarta</span><b>Trascina la carta</b><span>Interessa →</span></div><article className={`epic-card-view rarity-${(card.rarity || 'COMMON').toLowerCase()}`} style={{ transform: `translateX(${drag}px) rotate(${drag / 18}deg)` }} onPointerDown={(event) => { pointer.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={(event) => { if (pointer.current !== null) setDrag(event.clientX - pointer.current) }} onPointerUp={finish} onPointerCancel={finish}><div className="epic-card-glow" /><header><span>{card.rarity || 'COMMON'}</span><b>{drag > 35 ? 'MI INTERESSA' : drag < -35 ? 'PASSO' : 'ASTA'}</b></header><img src={card.imageUrl || `/cards/${card.slug}.png`} alt={`Illustrazione di ${card.title}`} /><div className="epic-card-copy"><p>PREVISIONE</p><h2>{card.title}</h2><div className="epic-divider" /><p>{card.effect || card.description}</p>{card.creatorName && <small>Creata da {card.creatorName}</small>}</div></article><div className="swipe-actions"><button type="button" className="swipe-no" onClick={() => void choose(false)}>× Passo</button><button type="button" className={`swipe-yes ${interested ? 'is-selected' : ''}`} onClick={() => void choose(true)}><Heart size={18} fill={interested ? 'currentColor' : 'none'} /> Mi interessa</button></div><p className="swipe-progress">{index + 1} / {cards.length} · scorri a sinistra o destra</p></div>, document.body)
}
