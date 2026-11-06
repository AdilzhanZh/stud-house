import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BellRing, X } from 'lucide-react'
import { Button } from '../../components/Button'
import { usePush } from '../../pwa/usePush'

const DISMISSED_KEY = 'student-house-push-nudge-dismissed'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

// A one-tap offer on Home, where students actually look, to get "your
// application was approved" on their phone. Only shown where it can work
// right here and now; dismissing it hides it on this device for good (the
// profile page keeps the switch).
export function PushNudge() {
  const { t } = useTranslation()
  const push = usePush()
  const [dismissed, setDismissed] = useState(wasDismissed)

  if (dismissed || push.state !== 'off') return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Private mode: it just shows again next time.
    }
    setDismissed(true)
  }

  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-turquoise-400/25 bg-turquoise-500/10 px-4 py-3.5">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-turquoise-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-sand-100">{t('pwa.nudgeTitle')}</p>
        <p className="mt-0.5 text-sm text-sand-300">{t('pwa.nudgeBody')}</p>
        <Button className="mt-2.5" isLoading={push.isBusy} onClick={() => void push.turnOn()}>
          {t('pwa.pushTurnOn')}
        </Button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('pwa.nudgeDismiss')}
        className="shrink-0 rounded-full p-1 text-sand-300 hover:text-sand-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
