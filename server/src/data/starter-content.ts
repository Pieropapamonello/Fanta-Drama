export type StarterCard = {
  slug: string; title: string; description: string; prompt: string
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC'
  type: 'YES_NO'; basePoints: number; imageUrl?: string
}

const firstCards: StarterCard[] = [
  { slug: 'microfono-cristallo', title: 'Microfono di Cristallo', description: 'Pronostica chi conquistera il karaoke con una nota impossibile da dimenticare.', prompt: 'crystal microphone on a glamorous violet stage', rarity: 'UNCOMMON', type: 'YES_NO', basePoints: 25, imageUrl: '/cards/secret-stage.png' },
  { slug: 'invito-fantasma', title: 'Invito Fantasma', description: 'Indovina se un ospite inatteso comparira quando il gruppo abbassa la guardia.', prompt: 'mysterious golden invitation in a velvet nightclub', rarity: 'RARE', type: 'YES_NO', basePoints: 35, imageUrl: '/cards/velvet-secret.png' },
  { slug: 'disco-sospetta', title: 'Disco Sospetta', description: 'Pronostica se la pista da ballo esplodera nel momento meno opportuno.', prompt: 'mirror disco ball exploding with violet light', rarity: 'EPIC', type: 'YES_NO', basePoints: 50, imageUrl: '/cards/disco-twist.png' },
  { slug: 'torta-gravita-zero', title: 'Torta a Gravita Zero', description: 'Scegli se il dolce resistera fino al brindisi finale senza incidenti.', prompt: 'elegant birthday cake floating above a party table', rarity: 'UNCOMMON', type: 'YES_NO', basePoints: 20, imageUrl: '/cards/cake-chaos.png' },
  { slug: 'risata-proibita', title: 'Risata Proibita', description: 'Indovina chi ridera proprio nel silenzio piu importante della serata.', prompt: 'mischievous glowing theatre mask at a party', rarity: 'COMMON', type: 'YES_NO', basePoints: 15, imageUrl: '/characters/mischief.png' },
  { slug: 'sorpresa-elettrica', title: 'Sorpresa Elettrica', description: 'Pronostica se un colpo di scena lascera tutti senza parole.', prompt: 'electric surprise box throwing neon sparks', rarity: 'RARE', type: 'YES_NO', basePoints: 40, imageUrl: '/characters/shock.png' },
  { slug: 'energia-della-crew', title: 'Energia della Crew', description: 'Scegli se la squadra trovera il ritmo perfetto prima di mezzanotte.', prompt: 'friends energy waves in a glowing nightclub', rarity: 'UNCOMMON', type: 'YES_NO', basePoints: 25, imageUrl: '/characters/pulse.png' },
  { slug: 'piano-in-silenzio', title: 'Piano in Silenzio', description: 'Indovina chi preparera la mossa piu calma e sorprendente della notte.', prompt: 'secret strategy notes lit by a neon lamp', rarity: 'RARE', type: 'YES_NO', basePoints: 35, imageUrl: '/characters/calm.png' },
  { slug: 'microfono-a-mezzanotte', title: 'Microfono a Mezzanotte', description: 'Pronostica chi salira sul palco quando la festa raggiunge il punto piu intenso.', prompt: 'glittering vintage microphone at midnight celebration', rarity: 'EPIC', type: 'YES_NO', basePoints: 55, imageUrl: '/cards/community/microfono-cristallo-ai.png' },
  { slug: 'busta-delle-meraviglie', title: 'Busta delle Meraviglie', description: 'Indovina chi ricevera linvito segreto che cambia le alleanze della crew.', prompt: 'luxury surprise envelope with gold stars', rarity: 'RARE', type: 'YES_NO', basePoints: 45, imageUrl: '/cards/community/invito-fantasma-ai.png' },
]

const cardIdeas = [
  'Brindisi Ribelle|Scegli se il brindisi partira prima che tutti siano pronti.|champagne glasses clinking with rebellious neon splash',
  'Playlist Traditrice|Indovina se la prossima canzone fara cambiare lato alla pista.|DJ deck and a glowing playlist changing color',
  'Tacchi in Fuga|Pronostica se qualcuno perdera una scarpa durante il momento clou.|a single sparkling high heel racing across dance floor',
  'Selfie Incantato|Scegli se il selfie di gruppo diventera il ricordo della serata.|glowing smartphone capturing friends at a party',
  'Confessione al Bar|Indovina se un segreto verra rivelato davanti ai cocktail.|mysterious cocktail bar with whispering silhouettes',
  'Palloncino Ribelle|Pronostica se un palloncino cambiera il destino della foto.|one neon balloon floating dramatically in a party hall',
  'Messaggio alle 2:00|Scegli se arrivera il messaggio che tutti aspettavano.|phone screen glowing at 2am beside party lights',
  'Re del Karaoke|Indovina chi ricevera lapplauso piu rumoroso.|golden karaoke crown on a stage',
  'Regina della Pista|Pronostica chi guidera il ballo finale.|fashionable dancer under a violet spotlight',
  'Bicchiere della Verita|Scegli se il prossimo sorso fara uscire una confessione.|crystal glass revealing secret constellations',
  'Foto Proibita|Indovina se una foto sparira prima della mattina.|polaroid dissolving into neon glitter',
  'Taxi del Destino|Pronostica chi sara lultimo a salire sul taxi.|yellow taxi waiting outside a neon party',
  'Dado del Caos|Scegli quale scelta imprevista cambiera il gioco.|glowing dice rolling across a velvet table',
  'Look da Leggenda|Indovina se qualcuno cambiera outfit a sorpresa.|dramatic fashion jacket under nightclub lights',
  'Snack Strategico|Pronostica quale snack salvera la crew a fine serata.|luxury midnight snacks on a glowing table',
  'Porta Segreta|Scegli se dietro una porta ci sara un colpo di scena.|ornate door opening to violet light',
  'Bacio Rubato|Indovina se un momento romantico verra scoperto.|two champagne glasses and a hidden heart light',
  'Sfida Impossibile|Pronostica se qualcuno accettera la sfida piu folle.|neon challenge wheel spinning dramatically',
  'Sedia del Capo|Scegli chi conquistera il posto piu ambito della festa.|luxury throne chair in a glamorous party room',
  'Mascara Waterproof|Indovina se il drama fara resistere il trucco fino allalba.|cosmetics glowing beside a tear-shaped jewel',
  'Torta Vendicativa|Pronostica se la torta finira sul volto sbagliato.|cake flying through a colorful party scene',
  'Ultima Canzone|Scegli chi chiedera ancora un brano prima di uscire.|DJ vinyl with a final song glowing on it',
  'Specchio delle Alleanze|Indovina se una coppia di amici cambiera squadra.|ornate mirror showing split neon reflections',
  'Candelina Magica|Pronostica se un desiderio diventera realta stanotte.|magic birthday candle emitting constellations',
  'Braccialetto VIP|Scegli chi otterra laccesso alla zona segreta.|VIP wristband glowing in a velvet rope scene',
  'Rumor di Corridoio|Indovina se il pettegolezzo arrivera alla persona giusta.|neon hallway with flying whisper ribbons',
  'Scommessa di Glitter|Pronostica se una promessa verra mantenuta.|glitter chips and a handwritten promise on velvet',
  'Ombrello da Discoteca|Scegli se il meteo diventera parte dello spettacolo.|transparent umbrella under colorful disco rain',
  'Candela del Plot Twist|Indovina se una luce si spegnera nel momento perfetto.|dramatic candle in a dark violet room',
  'Tavolo delle Confessioni|Pronostica chi siedera al tavolo piu pericoloso.|round table with secret cards and cocktails',
  'Luci Stroboscopiche|Scegli se la musica fara perdere il conto del tempo.|strobe beams surrounding a crystal clock',
  'Coroncina Maledetta|Indovina se chi la indossa diventera il centro del drama.|sparkling party crown with playful purple aura',
  'Eclissi del Party|Pronostica se la festa avra un momento completamente buio.|disco moon eclipse over a party crowd',
  'Telefonata Misteriosa|Scegli se qualcuno rispondera alla chiamata inattesa.|vintage phone glowing on a nightclub table',
  'Piuma di Fenice|Indovina se un piccolo gesto riaccendera la serata.|iridescent phoenix feather floating in neon air',
  'Segnaposto Scomparso|Pronostica se qualcuno finira al tavolo sbagliato.|empty place card on an elegant banquet table',
  'Colpo di Scena Rosa|Scegli se un regalo cambiera lumore della crew.|pink gift box bursting with dramatic light',
  'Coppetta della Vittoria|Indovina chi brindera per primo a una piccola vittoria.|mini trophy cup full of sparkling mocktail',
  'Finale a Sorpresa|Pronostica se la serata finira diversamente dal previsto.|curtain opening to a spectacular party finale',
  'Fuoco Freddo|Scegli se le scintille decorative faranno impazzire la sala.|cold spark fountains in an elegant neon venue',
]

export const starterCards: StarterCard[] = [...firstCards, ...cardIdeas.map((raw, index) => {
  const [title, description, prompt] = raw.split('|')
  const rarity: StarterCard['rarity'] = index % 9 === 0 ? 'LEGENDARY' : index % 4 === 0 ? 'EPIC' : index % 3 === 0 ? 'RARE' : 'UNCOMMON'
  return { slug: title.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), title, description, prompt, rarity, type: 'YES_NO' as const, basePoints: 20 + (index % 5) * 10 }
})]

export type StarterAvatar = { slug: string; title: string; note: string; prompt: string; imageUrl?: string }
const firstAvatars: StarterAvatar[] = [
  { slug: 'on-fire', title: 'On fire', note: 'Sempre al centro della scena', prompt: 'smiling dark-haired man in a cobalt party jacket', imageUrl: '/characters/pulse.png' },
  { slug: 'intrigo', title: 'Intrigo', note: 'Un piano per ogni colpo di scena', prompt: 'elegant woman with a knowing smile', imageUrl: '/characters/mischief.png' },
  { slug: 'plot-twist', title: 'Plot twist', note: 'Imprevedibile fino allultimo', prompt: 'surprised man with electric blue jacket', imageUrl: '/characters/shock.png' },
  { slug: 'in-controllo', title: 'In controllo', note: 'Legge la stanza in silenzio', prompt: 'confident woman in warm violet evening light', imageUrl: '/characters/calm.png' },
  { slug: 'violet-vibe', title: 'Violet vibe', note: 'Sorriso pronto per ogni plot twist', prompt: 'young adult with violet curls and friendly smile', imageUrl: '/avatars/common/violet-curly.png' },
  { slug: 'night-pulse', title: 'Night pulse', note: 'Calmo fuori, caos dentro', prompt: 'young adult with silver blue hair, calm intense gaze', imageUrl: '/avatars/common/silver-blue.png' },
]
const avatarIdeas = ['Velvet rebel','Cosmic smile','Neon strategist','Golden gaze','Electric laugh','Midnight poet','Rose signal','Skyline dreamer','Disco captain','Secret keeper','Prism heart','Moonlight leader','Chrome charm','Sapphire spark','Cherry voltage','Lavender storm','Amber whisper','Ocean pulse','Ruby rhythm','Pearl mystery','Indigo aura','Coral comet','Silver riot','Emerald tactician','Sunset muse','Pixel poet','Velvet thunder','Cyan voyager','Magenta mastermind','Starlight rogue','Golden hour','Night garden','Iris echo','Nova smile','Electric orchid','Blue velvet','Crimson calm','Lime legend','Moonbeam','Fuchsia flame','Obsidian glow','Solar wink','Aurora soul','Diamond drama']
export const starterAvatars: StarterAvatar[] = [...firstAvatars, ...avatarIdeas.map((title) => ({ slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, note: 'Un alter ego originale per la tua drama room', prompt: `original fictional adult character called ${title}, expressive and stylish party portrait` }))]
