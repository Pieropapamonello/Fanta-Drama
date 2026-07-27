# FantaDrama

FantaDrama è una base MVP reale per un drama fantasy roster game, progettata per sviluppo serio su GitHub e deploy su Render con una struttura monorepo professionale.

## Architettura del progetto
- `apps/web` — frontend React + Vite + Tailwind, Firebase client auth, Telegram login widget, dashboard dark mode.
- `apps/bot` — backend Node/TypeScript, Firebase Admin, webhook Telegram, notifiche live.
- `packages/shared` — tipi, costanti e utility riusabili.
- `firebase` — regole Firestore e seed demo.
- `docs` — note architetturali e procedure di deploy.

## Obiettivo
Una base early-stage per un prodotto serio con:
- registrazione email/password
- Telegram login verificato server-side
- leghe private con codice invito
- team builder con budget e capitano
- eventi narrativi con bonus/malus
- classifiche globali e di lega
- notifiche Telegram live

## Requisiti
- Node.js 20+
- npm 10+
- account Firebase con Firestore e Authentication
- account Render
- bot Telegram creato con BotFather

## Installazione
```bash
npm install
```

## Seed database (server)
Dal folder `server` eseguire:

```bash
npm install
npx prisma generate
npm run seed
```

Queste operazioni creano l'utente demo `demo@fantadrama.local` (password non utilizzata nel seed), un gruppo demo, 10 personaggi e 40 carte di esempio.

## Esecuzione rapida con Docker
Se preferisci eseguire tutto in container (Postgres + server + client), usa Docker e Docker Compose:

```bash
docker compose build
docker compose up -d
# poi dentro il container server puoi eseguire le migrazioni e il seed:
docker compose exec server npx prisma generate
docker compose exec server npx prisma migrate deploy || echo "run migrate dev locally"
docker compose exec server npm run seed
```

Questo avvierà il frontend su `http://localhost:5173` (servito da nginx) e l'API su `http://localhost:4000`.

## Esecuzione locale
Terminale 1:
```bash
npm run dev:web
```
Terminale 2:
```bash
npm run dev:bot
```

## Comandi principali
```bash
npm run build
npm run lint
npm run format
npm run preview:web
```

## Deploy su Render
Questa repository è pronta per Render con `render.yaml`.
Configura il repo GitHub su Render e crea due servizi:
- `fantadrama-web` — static site frontend
- `fantadrama-bot` — web service Node/TypeScript

## Env vars richieste
Copia `.env.example` in `.env` e configura:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_LOGIN_DOMAIN`
- `TELEGRAM_LOGIN_SECRET`
- `APP_URL`

## Telegram
Il progetto supporta due flussi distinti:
- login Telegram tramite widget con verifica server-side
- bot Telegram per notifiche live e webhook

## Firestore
Collections core previste:
- `users`
- `characters`
- `teams`
- `leagues`
- `events`
- `scoreRules`
- `scoreLogs`
- `telegramLinks`
- `telegramSubscriptions`

## Note
La base è progettata come un prodotto reale e avviabile, non come un esercizio.
La struttura è pensata per manutenzione, team multipli e deploy continuo.
