Deploy rapido su Render e GitHub

1) Inizializza repo e push su GitHub

```bash
git init
git add .
git commit -m "Fanta Drama web + telegram bot"
# crea repo su GitHub e aggiungi remote
git remote add origin <your-git-url>
git push -u origin main
```

-2) Variabili d'ambiente su Render
- `TELEGRAM_BOT_TOKEN` = token dal BotFather

3) Segreti GitHub necessari per GitHub Actions
- `RENDER_SERVICE_ID` = l'ID del servizio Render (lo trovi nella dashboard di Render)
- `RENDER_API_KEY` = API Key di Render (Create API Key in Render account settings)
- `TELEGRAM_BOT_TOKEN` = (opzionale) se vuoi che Actions o altre integrazioni lo leggano

Imposta questi segreti in Settings → Secrets → Actions del repository GitHub.

4) Deploy su Render
- Crea nuovo servizio, collegalo al repo GitHub
- Tipo: Web Service
- Build command: (vuoto)
- Start command: `gunicorn web:app --bind 0.0.0.0:$PORT`

4) Esecuzione locale per test

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
set TELEGRAM_BOT_TOKEN=tuo_token
python web.py
```

Note:
- Il bot parte in background usando polling quando `TELEGRAM_BOT_TOKEN` è impostato.
- Per usare webhook, sostituisci il meccanismo di polling con webhook e configura l'URL su Render.
