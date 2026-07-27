export default function TelegramLoginButton({ label = 'Continua con Telegram — senza email' }: { label?: string }) {
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
  if (!botUsername) return null

  return (
    <a
      href={`https://t.me/${botUsername}?start=app`}
      className="btn mt-5 inline-flex w-full justify-center bg-sky-500 text-white"
    >
      {label}
    </a>
  )
}
