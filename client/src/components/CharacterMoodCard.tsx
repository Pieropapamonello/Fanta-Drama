import { Sparkles } from 'lucide-react'

export type CharacterMood = 'pulse' | 'mischief' | 'shock' | 'calm'

const moods: Record<CharacterMood, { label: string; note: string; icon: string }> = {
  pulse: { label: 'On fire', note: 'Pronto a far saltare il banco', icon: '✦' },
  mischief: { label: 'Intrigo', note: 'Sta già preparando il colpo di scena', icon: '◒' },
  shock: { label: 'Plot twist', note: 'Qualcosa di enorme è appena successo', icon: '!' },
  calm: { label: 'In controllo', note: 'Legge la stanza prima di muoversi', icon: '◌' },
}

export const moodFromSeed = (seed = ''): CharacterMood => {
  const total = [...seed].reduce((value, char) => value + char.charCodeAt(0), 0)
  return (['pulse', 'mischief', 'shock', 'calm'] as CharacterMood[])[total % 4]
}

export const moodFromGameState = (seed: string, eventState?: string): CharacterMood => {
  const index = [...seed].reduce((value, char) => value + char.charCodeAt(0), 0) % 3
  const normalized = eventState?.toUpperCase() || ''
  if (normalized.includes('LIVE')) return (['shock', 'pulse', 'mischief'] as CharacterMood[])[index]
  if (normalized.includes('CHIUS')) return (['mischief', 'calm', 'shock'] as CharacterMood[])[index]
  return moodFromSeed(seed)
}

export function CharacterMoodCard({
  name,
  nickname,
  image,
  mood = moodFromSeed(name),
  compact = false,
}: {
  name: string
  nickname?: string
  image?: string
  mood?: CharacterMood
  compact?: boolean
}) {
  const details = moods[mood]
  const src = image || `/characters/${mood}.png`

  return (
    <article className={`character-mood-card mood-${mood} ${compact ? 'is-compact' : ''}`}>
      <div className="avatar-stage" aria-hidden="true">
        <span className="avatar-halo" />
        <img className="character-avatar" src={src} alt="" />
        <span className="mood-spark spark-one" />
        <span className="mood-spark spark-two" />
        <span className="mood-mark">{details.icon}</span>
      </div>
      <div className="character-mood-copy">
        <span className="mood-label"><Sparkles size={12} /> {details.label}</span>
        <h3>{name}</h3>
        {nickname && <p className="character-nickname">@{nickname}</p>}
        {!compact && <p className="mood-note">{details.note}</p>}
      </div>
    </article>
  )
}
