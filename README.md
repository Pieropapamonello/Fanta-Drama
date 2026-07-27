# FantaDrama

**FantaDrama — Pronostica il caos.**

MVP responsive in italiano per creare gruppi privati, eventi, personaggi, Carte Drama e pronostici con crediti esclusivamente virtuali.

> FantaDrama è un gioco di intrattenimento tra amici. Non utilizza denaro reale e non permette vincite economiche.

## Stato della Fase 1

- monorepo npm con frontend e backend TypeScript;
- landing page, registrazione, login e dashboard protetta;
- API REST Express con health check, Helmet, CORS e rate limiting;
- autenticazione JWT e password cifrate con bcrypt;
- schema Prisma PostgreSQL e migrazione iniziale;
- seed di sviluppo con 40 Carte Drama e dati demo;
- configurazione Docker locale, GitHub Actions e Render Blueprint;
- primi moduli MVP per gruppi, eventi, personaggi, carte e pronostici.

Le funzioni live, votazioni, punteggi avanzati, classifiche, badge e notifiche appartengono alle fasi successive.

## Stack

- React 18, Vite, TypeScript, React Router e Tailwind CSS;
- React Hook Form, Zod, Axios e Lucide React;
- Node.js 22, Express, TypeScript, JWT e bcrypt;
- Prisma ORM 6 e PostgreSQL;
- GitHub Actions e Render.

## Struttura

```text
fantadrama/
├── .github/workflows/ci.yml
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── app.ts
│   │   └── index.ts
│   ├── .env.example
│   └── package.json
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── package-lock.json
├── render.yaml
└── README.md
```

Le cartelle `apps/`, `firebase/` e i file Python alla radice appartengono a una precedente implementazione e non fanno parte del runtime React/Express configurato in `render.yaml`.

## Requisiti

- Node.js 22.12 o successivo della linea 22;
- npm;
- PostgreSQL 15+ oppure Docker Desktop;
- Git.

## Configurazione locale

Da Visual Studio Code, apri due terminali nella cartella del progetto.

```powershell
npm install
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Genera due segreti casuali distinti e sostituisci i valori di esempio in `server/.env`:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Avvia PostgreSQL con Docker:

```powershell
docker compose up -d db
```

Poi prepara il database:

```powershell
npm --workspace server run prisma:generate
npm --workspace server run prisma:migrate
npm --workspace server run seed
```

Il seed è bloccato in produzione. In sviluppo crea:

- email: `demo@fantadrama.local`
- password: `Demo1234`

Avvio:

```powershell
# Terminale 1
npm run dev:server

# Terminale 2
npm run dev:web
```

Frontend: `http://localhost:5173`

API: `http://localhost:4000/api`

Health check: `http://localhost:4000/api/health`

## Variabili d'ambiente

Backend:

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `NODE_ENV` | sì | `development`, `test` o `production` |
| `PORT` | sì | Porta HTTP, normalmente `4000` in locale |
| `DATABASE_URL` | sì | Connection string PostgreSQL |
| `JWT_SECRET` | sì | Segreto casuale di almeno 32 caratteri |
| `JWT_REFRESH_SECRET` | predisposta | Segreto distinto per i refresh token |
| `CLIENT_URL` | sì | Origin frontend consentita da CORS |
| `SERVER_URL` | sì | URL pubblico del backend |
| `UPLOAD_MAX_SIZE` | sì | Limite upload in byte |
| `TELEGRAM_BOT_TOKEN` | futura | Predisposta, non usata dalla Fase 1 |

Frontend:

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `VITE_API_URL` | sì | URL completo API, ad esempio `https://fantadrama-server.onrender.com/api` |

Non committare mai file `.env` o token reali.

## Controlli

```powershell
npm run lint
npm test
npm run build
```

La pipeline GitHub esegue installazione riproducibile, generazione Prisma, type-check, test disponibili e build.

## GitHub

Il remote previsto è `origin` e il branch principale è `main`.

```powershell
git status
git add .
git commit -m "feat: complete FantaDrama phase 1"
git push -u origin main
```

Per un repository nuovo:

```powershell
git init
git branch -M main
git remote add origin https://github.com/OWNER/Fanta-Drama.git
git push -u origin main
```

Usa Git Credential Manager o `gh auth login`; non inserire un token nell'URL del remote.

## Deploy su Render

1. Esegui il push di `main` su GitHub.
2. In Render scegli **New > Blueprint**.
3. Collega il repository e seleziona `render.yaml`.
4. Durante la creazione inserisci:
   - `VITE_API_URL`: URL backend con suffisso `/api`;
   - `CLIENT_URL`: URL pubblico del frontend, senza slash finale;
   - `SERVER_URL`: URL pubblico del backend;
   - `TELEGRAM_BOT_TOKEN`: lascia vuoto finché l'integrazione non viene implementata.
5. Render genera automaticamente `JWT_SECRET`, `JWT_REFRESH_SECRET` e la connection string del database.
6. Dopo il primo deploy verifica `/api/health`, registrazione, login e refresh diretto di una rotta React.

Il build installa anche le dipendenze di sviluppo necessarie a TypeScript. Sul piano Render
gratuito, lo start command applica in modo idempotente soltanto le migrazioni Prisma già
versionate prima di avviare l'API; non esegue il seed demo.

## Checklist locale

- [ ] `npm install` termina senza errori.
- [ ] PostgreSQL risponde e `DATABASE_URL` è corretta.
- [ ] `prisma generate` e `prisma migrate deploy` terminano correttamente.
- [ ] `npm run lint` e `npm run build` sono verdi.
- [ ] `GET /api/health` restituisce `{"status":"ok","service":"fantadrama-api"}`.
- [ ] Registrazione e login accettano una password con almeno 8 caratteri, una lettera e un numero.
- [ ] `/dashboard` reindirizza al login senza token.
- [ ] Un utente non può leggere gruppi o eventi di cui non è membro.
- [ ] Il footer mostra l'avviso sull'assenza di denaro reale.
- [ ] Nessun `.env`, token o segreto compare in `git status` o nella cronologia Git.

## Roadmap

1. Gruppi, membri, codici invito, personaggi e stagioni.
2. Eventi, carte, pronostici, crediti e chiusura automatica.
3. Modalità live, segnalazioni, votazioni e punteggi.
4. Classifiche, statistiche, badge e notifiche.
5. Test completi, accessibilità, hardening e ottimizzazione.

## Privacy

I gruppi sono privati. Non pubblicare immagini senza consenso e non creare contenuti offensivi, discriminatori o destinati a umiliare qualcuno.

## Licenza

Progetto privato. Nessuna licenza open source è concessa salvo indicazione esplicita del proprietario.
