export default function TelegramLoginButton({ label = 'Continua con Telegram — senza email' }: { label?: string }) {
  return (
    <a
      href="/api/auth/telegram/oidc/start"
      className="btn telegram-login-button inline-flex w-full justify-center"
    >
      {label}
    </a>
  )
}
