# FantaDrama

MVP privato per gruppi di amici, eventi, Carte Drama e pronostici con crediti virtuali. Non usa denaro reale e non consente vincite economiche.

## Architettura

- React, Vite e TypeScript per l'interfaccia;
- Firebase Authentication (email e password) per gli accessi;
- Express e Firebase Admin SDK per API protette;
- Cloud Firestore come database;
- un solo Web Service Render: `Fanta-Drama`.

Il backend serve anche i file compilati del frontend: non esistono un secondo servizio web né un database Render da mantenere attivi.

## Dati Firestore

Le collezioni usate sono `users`, `groups`, `characters`, `cards`, `events`, `predictions` e `scores`. Le regole Firestore negano l'accesso diretto dal browser: ogni operazione sui dati passa dall'API, che verifica il Firebase ID token dell'utente. La chiave di servizio resta esclusivamente nella variabile segreta Render `FIREBASE_SERVICE_ACCOUNT_BASE64`.

## Sviluppo locale

Richiede Node.js 22.

```powershell
npm install
Copy-Item client/.env.example client/.env
Copy-Item server/.env.example server/.env
npm run dev:server
```

In un secondo terminale:

```powershell
npm run dev:web
```

Inserisci in `client/.env` la configurazione della Web App Firebase e in `server/.env` la chiave dell'account di servizio codificata Base64. I file `.env` non devono mai essere committati.

## Verifica

```powershell
npm run lint
npm run build
```

Health check: `/api/health`.

## Deploy Render

Il file `render.yaml` descrive esclusivamente il servizio esistente `Fanta-Drama`. Prima del deploy servono queste variabili nell'ambiente Render:

- `FIREBASE_SERVICE_ACCOUNT_BASE64` (segreta, JSON completo dell'account di servizio codificato Base64);
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`;
- gli altri valori Firebase indicati in `render.yaml`;
- `VITE_API_URL=/api`.

In Firebase Authentication aggiungi `fanta-drama.onrender.com` agli Authorized domains. Non abilitare Firebase Storage finché non sarà necessario caricare immagini.

## Sicurezza

Le chiavi e i token non vanno nel repository. Se un token è stato incollato in chat o in un file pubblico, va revocato e rigenerato dal relativo provider.
