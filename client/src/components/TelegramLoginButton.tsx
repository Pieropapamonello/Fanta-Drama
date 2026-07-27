import { useEffect, useRef } from 'react'

export default function TelegramLoginButton() {
  const container = useRef<HTMLDivElement>(null)
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    if (!container.current || !botUsername) return
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-auth-url', `${window.location.origin}/telegram`)
    container.current.replaceChildren(script)
  }, [botUsername])

  if (!botUsername) return null
  return <div ref={container} className="mt-5 flex justify-center" aria-label="Accedi con Telegram" />
}
