import { useEffect, useRef } from 'react';

export function TelegramLoginButton() {
  const botUsername = import.meta.env.VITE_TELEGRAM_LOGIN_BOT_USERNAME;
  const callbackUrl = `${window.location.origin}/auth/telegram-callback`;
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?15';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', callbackUrl);
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(script);
  }, [botUsername, callbackUrl]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
      <h3 className="text-lg font-semibold text-white">Accesso Telegram</h3>
      <p className="mt-2 text-slate-400">Accedi con Telegram per ricevere notifiche live direttamente nel tuo bot.</p>
      <div className="mt-6" ref={containerRef} />
    </div>
  );
}
