import { useTranslation } from 'react-i18next'
import { BellRing, CheckCircle2, Smartphone } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { isIOS, isStandalone, promptInstall, useCanPromptInstall } from '../../pwa/pwa'
import { usePush } from '../../pwa/usePush'

function Row({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-turquoise-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-sand-100">{title}</p>
        <div className="mt-1 text-sm text-sand-300">{children}</div>
      </div>
    </div>
  )
}

// "The app on your phone": adding the site to the home screen, and push
// notifications. Each says what this device can do rather than offering a
// button that can't work here (iOS has no install prompt; Safari has no push).
export function AppOnPhoneCard() {
  const { t } = useTranslation()
  const canPrompt = useCanPromptInstall()
  const push = usePush()
  const installed = isStandalone()

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[13px] font-semibold tracking-wide text-sand-300 uppercase">{t('pwa.section')}</h2>
      <Card className="!py-0 !px-4.5">
        <div className="divide-y divide-navy-700">
          <Row icon={<Smartphone className="h-4.5 w-4.5" />} title={t('pwa.installTitle')}>
            {installed ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-mint-400">
                <CheckCircle2 className="h-4 w-4" /> {t('pwa.installed')}
              </span>
            ) : canPrompt ? (
              <div className="flex flex-col items-start gap-2">
                <span>{t('pwa.installHint')}</span>
                <Button onClick={() => void promptInstall()}>{t('pwa.installButton')}</Button>
              </div>
            ) : isIOS() ? (
              <span>{t('pwa.installIos')}</span>
            ) : (
              <span>{t('pwa.installManual')}</span>
            )}
          </Row>

          {push.state !== 'hidden' && push.state !== 'loading' && (
            <Row icon={<BellRing className="h-4.5 w-4.5" />} title={t('pwa.pushTitle')}>
              {push.state === 'ios-install' && <span>{t('pwa.pushIosInstall')}</span>}
              {push.state === 'unsupported' && <span>{t('pwa.pushUnsupported')}</span>}
              {push.state === 'blocked' && <span>{t('pwa.pushBlocked')}</span>}
              {(push.state === 'off' || push.state === 'on') && (
                <div className="flex flex-col items-start gap-2">
                  <span>{push.state === 'on' ? t('pwa.pushOn') : t('pwa.pushHint')}</span>
                  <Button
                    variant={push.state === 'on' ? 'secondary' : 'primary'}
                    isLoading={push.isBusy}
                    onClick={() => void (push.state === 'on' ? push.turnOff() : push.turnOn())}
                  >
                    {push.state === 'on' ? t('pwa.pushTurnOff') : t('pwa.pushTurnOn')}
                  </Button>
                </div>
              )}
              {push.failed && (
                <div className="mt-2">
                  <Alert variant="error" message={t('pwa.pushFailed')} />
                </div>
              )}
            </Row>
          )}
        </div>
      </Card>
    </section>
  )
}
