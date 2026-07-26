import os
import random
import json
import threading
from typing import Dict, List, Optional
from pathlib import Path

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from config import FAMILY_MEMBERS, EVENT_TYPES, MAX_TEAM_SIZE
from store import store, find_team_by_member


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Ciao! Benvenuto in Fanta Drama.\n"
        "Comandi principali: /crea_squadra, /iscrivi, /lascia, /squadra, /evento, /classifica_squadre, /classifica_personaggi, /lista_membri, /regole"
    )


async def regole(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    lines = [
        "Regole di Fanta Drama (versione base):",
        f"- Crea la tua squadra con /crea_squadra <nome> (max {MAX_TEAM_SIZE} membri)",
        "- Iscrivi i personaggi con /iscrivi <nome_personaggio>",
        "- Quando succede un evento drammatico usa /evento <nome_personaggio> <tipo_evento>",
        "- Vedi la classifica squadre con /classifica_squadre e personaggi con /classifica_personaggi",
        "- Tipi di eventi: " + ", ".join(f"{k}({v}pt)" for k, v in EVENT_TYPES.items()),
    ]
    await update.message.reply_text("\n".join(lines))


async def crea_squadra(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("Usa /crea_squadra <nome_squadra>")
        return
    name = " ".join(context.args).strip()
    uid = update.effective_user.id
    if store.get_team(uid):
        await update.message.reply_text("Hai già una squadra. Usa /squadra per vedere lo stato.")
        return
    store.create_team(uid, name)
    await update.message.reply_text(f"Squadra '{name}' creata! Iscrivi i membri con /iscrivi <nome>.")


async def iscrivi(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("Usa /iscrivi <nome_personaggio>")
        return
    member = " ".join(context.args).strip().title()
    if member not in FAMILY_MEMBERS:
        await update.message.reply_text(f"Personaggio non valido. Scegli tra: {', '.join(FAMILY_MEMBERS)}")
        return
    uid = update.effective_user.id
    team = store.get_team(uid)
    if not team:
        await update.message.reply_text("Non hai una squadra. Crea una con /crea_squadra <nome>.")
        return
    if member in team["members"]:
        await update.message.reply_text(f"{member} è già nella tua squadra.")
        return
    success = store.add_member_to_team(uid, member)
    if not success:
        await update.message.reply_text(f"Impossibile iscrivere {member}. Potrebbe essere già in un'altra squadra o la tua è piena.")
        return
    await update.message.reply_text(f"{member} aggiunto alla tua squadra '{team['name']}'!")


async def lascia(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("Usa /lascia <nome_personaggio>")
        return
    member = " ".join(context.args).strip().title()
    uid = update.effective_user.id
    success = store.remove_member_from_team(uid, member)
    if success:
        await update.message.reply_text(f"{member} rimosso dalla tua squadra.")
    else:
        await update.message.reply_text(f"Non risulta che {member} sia nella tua squadra.")


async def squadra(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    team = store.get_team(uid)
    if not team:
        await update.message.reply_text("Non hai una squadra. Crea una con /crea_squadra <nome>.")
        return
    members = team.get("members", [])
    await update.message.reply_text(f"Squadra '{team['name']}':\nMembri: {', '.join(members) if members else 'nessuno'}\nPunti: {team.get('points',0)}")


async def lista_membri(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("Membri disponibili: " + ", ".join(FAMILY_MEMBERS))


async def evento(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if len(context.args) < 2:
        await update.message.reply_text("Usa /evento <nome_personaggio> <tipo_evento>")
        return
    member = context.args[0].strip().title()
    event_type = context.args[1].strip().lower()
    if member not in FAMILY_MEMBERS:
        await update.message.reply_text(f"Personaggio non valido. Scegli tra: {', '.join(FAMILY_MEMBERS)}")
        return
    points = store.record_event(member, event_type)
    if points is None:
        await update.message.reply_text(f"Tipo evento non valido. Tipi validi: {', '.join(EVENT_TYPES.keys())}")
        return
    owner_uid = find_team_by_member(store.data, member)
    owner_name = store.data["teams"][owner_uid]["name"] if owner_uid else "(nessuna squadra)"
    await update.message.reply_text(f"Evento registrato: {member} -> {event_type} +{points}pt (squadra: {owner_name})")


async def classifica_squadre(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    teams = list(store.data.get("teams", {}).values())
    ranked = sorted(teams, key=lambda t: t.get("points", 0), reverse=True)
    if not ranked:
        await update.message.reply_text("Nessuna squadra ancora creata.")
        return
    lines = [f"{t['name']}: {t.get('points',0)} pt ({len(t.get('members',[]))} membri)" for t in ranked]
    await update.message.reply_text("Classifica squadre:\n" + "\n".join(lines))


async def classifica_personaggi(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    cp = store.data.get("character_points", {})
    ranked = sorted(cp.items(), key=lambda x: x[1], reverse=True)
    lines = [f"{name}: {pts} pt" for name, pts in ranked]
    await update.message.reply_text("Classifica personaggi:\n" + "\n".join(lines))


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "/start - benvenuto\n"
        "/crea_squadra <nome> - crea la tua squadra\n"
        "/iscrivi <nome> - aggiungi un personaggio alla tua squadra\n"
        "/lascia <nome> - rimuovi un personaggio\n"
        "/squadra - mostra la tua squadra\n"
        "/evento <nome> <tipo> - registra un evento drammatico\n"
        "/classifica_squadre - mostra le squadre in ordine\n"
        "/classifica_personaggi - mostra i personaggi in ordine\n"
        "/lista_membri - mostra i personaggi disponibili\n"
        "/regole - mostra le regole"
    )


def main() -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        print("Imposta la variabile d'ambiente TELEGRAM_BOT_TOKEN per avviare il bot.")
        return
    start_bot(token, background=False)


if __name__ == "__main__":
    main()


def build_application(token: str) -> Application:
    application = Application.builder().token(token).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("regole", regole))
    application.add_handler(CommandHandler("crea_squadra", crea_squadra))
    application.add_handler(CommandHandler("iscrivi", iscrivi))
    application.add_handler(CommandHandler("lascia", lascia))
    application.add_handler(CommandHandler("squadra", squadra))
    application.add_handler(CommandHandler("lista_membri", lista_membri))
    application.add_handler(CommandHandler("evento", evento))
    application.add_handler(CommandHandler("classifica_squadre", classifica_squadre))
    application.add_handler(CommandHandler("classifica_personaggi", classifica_personaggi))
    application.add_handler(CommandHandler("help", help_command))
    return application


def start_bot(token: str, background: bool = True) -> Application:
    app = build_application(token)
    if background:
        thread = threading.Thread(target=lambda: app.run_polling(allowed_updates=Update.ALL_TYPES), daemon=True)
        thread.start()
        print("Bot polling started in background thread")
    else:
        print("Bot avviato. In ascolto...")
        app.run_polling(allowed_updates=Update.ALL_TYPES)
    return app
