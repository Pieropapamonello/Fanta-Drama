import { Check, Plus, Sparkles } from 'lucide-react'

const artworkKeys = ['cake-chaos', 'secret-stage', 'disco-twist', 'velvet-secret']

const artFromSeed = (seed = '') => {
  const total = [...seed].reduce((value, char) => value + char.charCodeAt(0), 0)
  return artworkKeys[total % artworkKeys.length]
}

const typeNames: Record<string, string> = {
  YES_NO: 'Previsione', PICK_CHARACTER: 'Bersaglio', MULTI_CHOICE: 'Scelta', NUMBER: 'Numero', RANGE: 'Range', TIME: 'Tempo', TEXT: 'Parola', FIRST_ACTION: 'Azione', ORDER: 'Ordine',
}

export type DramaCardData = {
  id?: string
  slug?: string
  title: string
  description?: string
  effect?: string
  flavor?: string
  rarity?: string
  type?: string
  basePoints?: number
  imageKey?: string
  librarySlug?: string
}

export default function DramaCard({ card, actionLabel, onAction, isAdding, owned = false }: { card: DramaCardData; actionLabel?: string; onAction?: () => void; isAdding?: boolean; owned?: boolean }) {
  const art = card.imageKey || artFromSeed(card.title)
  const effect = card.effect || card.description || 'Una nuova possibilità di far esplodere la serata.'
  const rarity = (card.rarity || 'COMMON').toLowerCase()

  return <article className={`drama-card rarity-${rarity}`}>
    <div className="card-foil" aria-hidden="true" />
    <header className="drama-card-head"><span>{card.rarity || 'COMMON'}</span><b>{card.basePoints || 0} PT</b></header>
    <div className="drama-card-art"><img src={`/cards/${art}.png`} alt={`Illustrazione di ${card.title}`} /><span className="art-shine" /></div>
    <div className="drama-card-body">
      <div className="drama-card-title"><h3>{card.title}</h3><span>{typeNames[card.type || 'YES_NO'] || 'Drama'}</span></div>
      <p className="card-effect"><Sparkles size={13} /><strong>Effetto</strong>{effect}</p>
      <p className="card-flavor">“{card.flavor || 'Una carta nata per trasformare un dettaglio in una leggenda.'}”</p>
    </div>
    {onAction && <button className={`card-add ${owned ? 'is-owned' : ''}`} type="button" onClick={onAction} disabled={isAdding || owned}>{owned ? <><Check size={15} /> Nel mazzo</> : <><Plus size={15} /> {isAdding ? 'Aggiungo…' : actionLabel || 'Aggiungi'}</>}</button>}
  </article>
}
