import os
from flask import Flask, render_template, request, redirect, url_for, jsonify, session, flash
from store import store, find_team_by_member
import bot
from telegram import Bot

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "change-me-in-prod")

# Simple auth settings
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")


@app.before_first_request
def start_bot():
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    # If token is set we prefer webhook mode on Render; do not start polling here.
    if token and os.environ.get("FORCE_POLLING", "") == "1":
        bot.start_bot(token, background=True)


@app.route("/")
def index():
    if not session.get("authed"):
        return redirect(url_for("login"))
    teams = list(store.data.get("teams", {}).values())
    characters = store.data.get("character_points", {})
    return render_template("index.html", teams=teams, characters=characters)


@app.route("/crea_squadra", methods=["POST"])
def crea_squadra():
    if not session.get("authed"):
        return redirect(url_for("login"))
    name = request.form.get("name", "").strip()
    user_id = request.form.get("user_id", "-1")
    try:
        uid = int(user_id)
    except Exception:
        uid = -1
    if name and uid != -1:
        store.create_team(uid, name)
    return redirect(url_for("index"))


@app.route("/iscrivi", methods=["POST"])
def iscrivi():
    if not session.get("authed"):
        return redirect(url_for("login"))
    user_id = int(request.form.get("user_id"))
    member = request.form.get("member", "").strip().title()
    store.add_member_to_team(user_id, member)
    return redirect(url_for("index"))


@app.route("/lascia", methods=["POST"])
def lascia():
    if not session.get("authed"):
        return redirect(url_for("login"))
    user_id = int(request.form.get("user_id"))
    member = request.form.get("member", "").strip().title()
    store.remove_member_from_team(user_id, member)
    return redirect(url_for("index"))


@app.route("/evento", methods=["POST"])
def evento():
    if not session.get("authed"):
        return redirect(url_for("login"))
    member = request.form.get("member", "").strip().title()
    event_type = request.form.get("event_type", "").strip().lower()
    store.record_event(member, event_type)
    return redirect(url_for("index"))


# --- Webhook support -------------------------------------------------
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
bot_instance = Bot(token=TELEGRAM_TOKEN) if TELEGRAM_TOKEN else None


def _reply_text_for_command(cmd: str, args: list, user_id: int, user_info: dict) -> str:
    # Minimal dispatcher for commands received via webhook
    cmd = cmd.lower()
    if cmd in ("start",):
        return "Ciao! Benvenuto in Fanta Drama. Usa la web UI o i comandi /crea_squadra, /iscrivi, /evento, /classifica_squadre"
    if cmd == "crea_squadra":
        if not args:
            return "Usa /crea_squadra <nome>"
        name = " ".join(args).strip()
        if store.get_team(user_id):
            return "Hai già una squadra. Usa /squadra per vedere lo stato."
        store.create_team(user_id, name)
        return f"Squadra '{name}' creata!"
    if cmd == "iscrivi":
        if not args:
            return "Usa /iscrivi <nome_personaggio>"
        member = " ".join(args).strip().title()
        if member not in store.data.get("character_points", {}).keys():
            return f"Personaggio non valido. Scegli tra: {', '.join(store.data.get('character_points', {}).keys())}"
        team = store.get_team(user_id)
        if not team:
            return "Non hai una squadra. Crea una con /crea_squadra <nome>."
        success = store.add_member_to_team(user_id, member)
        if not success:
            return f"Impossibile iscrivere {member}. Potrebbe essere già in un'altra squadra o la tua è piena."
        return f"{member} aggiunto alla tua squadra '{team['name']}'!"
    if cmd == "lascia":
        if not args:
            return "Usa /lascia <nome_personaggio>"
        member = " ".join(args).strip().title()
        success = store.remove_member_from_team(user_id, member)
        return f"{member} rimosso dalla tua squadra." if success else f"Non risulta che {member} sia nella tua squadra."
    if cmd == "squadra":
        team = store.get_team(user_id)
        if not team:
            return "Non hai una squadra. Crea una con /crea_squadra <nome>."
        members = team.get("members", [])
        return f"Squadra '{team['name']}':\nMembri: {', '.join(members) if members else 'nessuno'}\nPunti: {team.get('points',0)}"
    if cmd == "lista_membri":
        return "Membri disponibili: " + ", ".join(store.data.get("character_points", {}).keys())
    if cmd == "evento":
        if len(args) < 2:
            return "Usa /evento <nome_personaggio> <tipo_evento>"
        member = args[0].strip().title()
        event_type = args[1].strip().lower()
        points = store.record_event(member, event_type)
        if points is None:
            return f"Tipo evento non valido. Tipi validi: {', '.join(store.data.get('character_points', {}).keys())}"
        owner_uid = find_team_by_member(store.data, member)
        owner_name = store.data["teams"][owner_uid]["name"] if owner_uid else "(nessuna squadra)"
        return f"Evento registrato: {member} -> {event_type} +{points}pt (squadra: {owner_name})"
    if cmd == "classifica_squadre":
        teams = list(store.data.get("teams", {}).values())
        ranked = sorted(teams, key=lambda t: t.get("points", 0), reverse=True)
        if not ranked:
            return "Nessuna squadra ancora creata."
        lines = [f"{t['name']}: {t.get('points',0)} pt ({len(t.get('members',[]))} membri)" for t in ranked]
        return "Classifica squadre:\n" + "\n".join(lines)
    if cmd == "classifica_personaggi":
        cp = store.data.get("character_points", {})
        ranked = sorted(cp.items(), key=lambda x: x[1], reverse=True)
        lines = [f"{name}: {pts} pt" for name, pts in ranked]
        return "Classifica personaggi:\n" + "\n".join(lines)
    if cmd == "regole" or cmd == "help":
        return "Regole: crea squadra /crea_squadra, iscrivi /iscrivi, registra evento /evento"
    return "Comando non riconosciuto. Usa /help per la lista dei comandi."


@app.route("/set_webhook", methods=["POST"])
def set_webhook():
    if not session.get("authed"):
        return jsonify({"error": "unauthorized"}), 401

    # Expects JSON or form param `url` = public base URL (https://...) where app is reachable
    data = request.get_json(silent=True) or request.form
    public_url = data.get("url") if isinstance(data, dict) else request.form.get("url")
    if not public_url:
        return jsonify({"error": "Missing url parameter"}), 400
    if not bot_instance:
        return jsonify({"error": "TELEGRAM_BOT_TOKEN not set on server"}), 400
    webhook_url = public_url.rstrip("/") + f"/webhook/{TELEGRAM_TOKEN}"
    bot_instance.set_webhook(webhook_url)
    return jsonify({"result": "webhook set", "webhook_url": webhook_url})


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        pwd = request.form.get("password", "")
        if pwd == ADMIN_PASSWORD:
            session["authed"] = True
            flash("Autenticato", "success")
            return redirect(url_for("index"))
        flash("Password errata", "danger")
        return redirect(url_for("login"))
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.pop("authed", None)
    return redirect(url_for("login"))


@app.route("/webhook/<token>", methods=["POST"])
def webhook(token: str):
    if token != TELEGRAM_TOKEN:
        return "", 403
    update = request.get_json(force=True)
    # Only handle message updates with text
    message = update.get("message") or update.get("edited_message")
    if not message:
        return "", 200
    chat_id = message["chat"]["id"]
    user = message.get("from", {})
    user_id = user.get("id")
    text = message.get("text", "")
    if not text:
        return "", 200
    parts = text.strip().split()
    cmd = parts[0].lstrip("/")
    args = parts[1:]
    reply = _reply_text_for_command(cmd, args, user_id, user)
    try:
        bot_instance.send_message(chat_id=chat_id, text=reply)
    except Exception:
        pass
    return "", 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
