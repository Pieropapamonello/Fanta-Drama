import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleTelegramLogin } from '../services/auth';

function parseTelegramPayload(search: string) {
  const params = new URLSearchParams(search);
  const payload: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    payload[key] = value;
  }
  return payload;
}

export function TelegramCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifica in corso...');

  useEffect(() => {
    async function verify() {
      try {
        const payload = parseTelegramPayload(window.location.search);
        if (!payload.hash) {
          throw new Error('Telegram login payload non valido');
        }

        await handleTelegramLogin(payload);
        setStatus('Login Telegram riuscito. Reindirizzamento...');
        window.setTimeout(() => navigate('/dashboard'), 1200);
      } catch {
        setStatus('Errore durante il login Telegram. Riprovare.');
      }
    }

    verify();
  }, [navigate]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8 text-slate-100 shadow-[0_25px_100px_rgba(15,23,42,0.35)]">
      <h2 className="text-3xl font-semibold">Autenticazione Telegram</h2>
      <p className="mt-4 text-slate-300">{status}</p>
    </div>
  );
}
