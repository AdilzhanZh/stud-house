import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { BrandMark } from '../../components/BrandMark'
import { Card } from '../../components/Card'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { extractErrorMessage } from '../../api/client'
import { verifyResidenceCertificate } from '../../api/residenceCertificateApi'
import { formatDate } from '../../utils/dateFormat'
import { certificateNumberLabel } from '../../utils/residenceCertificatePdf'
import { CertificateDocument } from './CertificateDocument'
import type { ResidenceCertificate } from '../../types/residenceCertificates'

type Tone = 'ok' | 'warn' | 'bad'

const TONES: Record<Tone, { Icon: typeof CheckCircle2; className: string }> = {
  ok: { Icon: CheckCircle2, className: 'bg-mint-500/15 text-mint-400' },
  warn: { Icon: AlertTriangle, className: 'bg-amber-500/15 text-amber-400' },
  bad: { Icon: XCircle, className: 'bg-clay-500/15 text-clay-400' },
}

function StatusBanner({ tone, title, detail }: { tone: Tone; title: string; detail: string }) {
  const { Icon, className } = TONES[tone]
  return (
    <Card>
      <div className="flex items-center gap-3.5">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${className}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-lg font-bold text-sand-100">{title}</p>
          <p className="mt-0.5 text-sm text-sand-300">{detail}</p>
        </div>
      </div>
    </Card>
  )
}

// What the QR code on a certificate opens, for an office clerk with no account
// here. A certificate stays genuine after the student moves out (it was true
// when issued), so there are three answers: genuine and still true, genuine but
// no longer true, and not ours at all.
export function CertificateVerifyPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const [certificate, setCertificate] = useState<ResidenceCertificate | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    verifyResidenceCertificate(token)
      .then(setCertificate)
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 404) setNotFound(true)
        else setError(extractErrorMessage(err, t('certificate.loadFailed')))
      })
  }, [token, t])

  const facts = certificate
    ? [
        { label: t('certificate.student'), value: certificate.student_full_name },
        { label: t('certificate.dormitory'), value: certificate.dormitory_name },
        { label: t('certificate.room'), value: certificate.room_number },
        { label: t('certificate.since'), value: formatDate(certificate.moved_in_at) },
        { label: t('certificate.institute'), value: certificate.institute },
        { label: t('certificate.studyGroup'), value: certificate.study_group },
        { label: t('certificate.course'), value: certificate.course != null ? String(certificate.course) : '' },
        { label: t('certificate.address'), value: certificate.dormitory_address },
      ].filter((fact) => fact.value)
    : []

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="on-chrome border-t-[3px] border-gold-400 bg-navy-900">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-3">
          <BrandMark />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto flex max-w-[860px] flex-col gap-3.5 px-4 py-5">
        {error && <Alert variant="error" message={error} />}
        {!certificate && !notFound && !error && <p className="text-sm text-sand-300">{t('certificate.loading')}</p>}
        {notFound && (
          <StatusBanner tone="bad" title={t('certificate.notFoundTitle')} detail={t('certificate.notFoundDetail')} />
        )}

        {certificate && (
          <>
            <StatusBanner
              tone={certificate.still_resides ? 'ok' : 'warn'}
              title={certificate.still_resides ? t('certificate.validTitle') : t('certificate.movedOutTitle')}
              detail={t(certificate.still_resides ? 'certificate.validDetail' : 'certificate.movedOutDetail', {
                number: certificateNumberLabel(certificate),
                date: formatDate(certificate.issued_at),
              })}
            />
            <Card className="!py-1.5 !px-4.5">
              <dl className="divide-y divide-navy-700">
                {facts.map((fact) => (
                  <div key={fact.label} className="flex justify-between gap-4 py-3 text-sm">
                    <dt className="shrink-0 text-sand-300">{fact.label}</dt>
                    <dd className="text-right font-semibold text-sand-100">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <p className="text-sm text-sand-300">{t('certificate.compareHint')}</p>
            <CertificateDocument certificate={certificate} />
          </>
        )}
      </main>
    </div>
  )
}
