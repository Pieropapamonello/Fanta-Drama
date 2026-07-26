# Fanta Drama Telegram Bot

Questo progetto crea un bot Telegram per giocare a Fanta Drama usando i membri della tua famiglia come personaggi.

## Come usare

1. Installa le dipendenze:
   ```bash
   pip install -r requirements.txt
   ```
2. Crea un bot su Telegram con BotFather e copia il token.
3. Imposta la variabile d'ambiente:
   ```bash
   set TELEGRAM_BOT_TOKEN=tuo_token
   ```
   oppure su Linux/macOS:
   ```bash
   export TELEGRAM_BOT_TOKEN=tuo_token
   ```
4. Avvia il bot:
   ```bash
   python bot.py
   ```

## Personalizzazione

Modifica i nomi dei personaggi in `config.py`.

CI/CD: Ho aggiunto un workflow GitHub Actions in `.github/workflows/ci-cd.yml` che esegue un controllo sintassi e, se presenti, attiva un deploy su Render usando i segreti `RENDER_SERVICE_ID` e `RENDER_API_KEY`.
Per il deploy automatico:
- Aggiungi i segreti al repo GitHub: `RENDER_SERVICE_ID`, `RENDER_API_KEY`.
- Imposta `TELEGRAM_BOT_TOKEN` nelle Environment Variables del servizio su Render.

Vedi `DEPLOY.md` per istruzioni dettagliate.
