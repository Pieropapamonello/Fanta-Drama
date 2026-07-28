export type DramaBeatInput = {
  event: { title: string; description?: string; state?: string }
  phase: 'OPENED' | 'CLOSED'
  playersWithPoints?: number
}

function fallbackBeat({ event, phase, playersWithPoints = 0 }: DramaBeatInput) {
  if (phase === 'OPENED') return `Le luci si accendono su “${event.title}”: scegli la tua carta e lascia il segno prima che il caos inizi.`
  return playersWithPoints ? `Sipario su “${event.title}”: i punti sono entrati in classifica e la crew sa già chi ha letto meglio il drama.` : `Sipario su “${event.title}”: nessuna carta è stata giocata, ma il prossimo colpo di scena è già vicino.`
}

function cleanBeat(value: string | undefined, fallback: string) {
  const cleaned = value?.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim()
  return cleaned && cleaned.length >= 18 ? cleaned.slice(0, 420) : fallback
}

export async function createDramaBeat(input: DramaBeatInput) {
  const fallback = fallbackBeat(input)
  if (process.env.TEXT_AI_PROVIDER?.toLowerCase() !== 'groq' || !process.env.GROQ_API_KEY) return fallback

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4_500)
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_TEXT_MODEL ?? 'llama-3.1-8b-instant',
        temperature: 0.9,
        max_completion_tokens: 95,
        messages: [
          { role: 'system', content: 'Sei la regia di FantaDrama, un gioco sociale tra amici. Scrivi in italiano una sola frase breve, energica e inclusiva: 25-55 parole, senza hashtag, Markdown, promesse di premi reali, contenuti offensivi o inviti a scommettere.' },
          { role: 'user', content: `Fase: ${input.phase === 'OPENED' ? 'nuovo evento e pronostici aperti' : 'evento chiuso e punteggi aggiornati'}. Titolo: ${input.event.title}. Descrizione: ${input.event.description || 'nessuna'}. Giocatori con punti: ${input.playersWithPoints ?? 0}.` }
        ]
      })
    })
    if (!response.ok) return fallback
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    return cleanBeat(data.choices?.[0]?.message?.content, fallback)
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}
