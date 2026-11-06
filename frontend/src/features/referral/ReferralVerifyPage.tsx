import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { BrandMark } from '../../components/BrandMark'
import { Card } from '../../components/Card'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { extractErrorMessage } from '../../api/client'
import { verifyReferral } from '../../api/referralApi'
import { formatDate } from '../../utils/dateFormat'
import { referralNumberLabel } from '../../utils/referralPdf'
import { ReferralDocument } from './ReferralDocument'
import type { Referral } from '../../types/referrals'

function StatusBanner({ valid, title, detail }: { valid: boolean; title: string; detail: string }) {
  const Icon = valid ? CheckCircle2 : XCircle
  return (
    <Card>
      <div className="flex items-center gap-3.5">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            valid ? 'bg-mint-500/15 text-mint-400' : 'bg-clay-500/15 text-clay-400'
          }`}
        >
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

// What the QR code on a referral opens, for whoever scans it: usually a dormitory
// warden on a phone, with no account here. So the answer and the facts to compare
// come first, in large type, and the sheet itself follows.
export function ReferralVerifyPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const [referral, setReferral] = useState<Referral | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    verifyReferral(token)
      .then(setReferral)
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 404) setNotFound(true)
        else setError(extractErrorMessage(err, t('referral.loadFailed')))
      })
  }, [token, t])

  const facts = referral?.valid
    ? [
        { label: t('referral.student'), value: referral.student_full_name },
        { label: t('referral.dormitory'), value: referral.dormitory_name },
        { label: t('referral.room'), value: referral.room_number },
        { label: t('referral.institute'), value: referral.institute },
        { label: t('referral.studyGroup'), value: referral.study_group },
        { label: t('referral.address'), value: referral.dormitory_address },
        { label: t('referral.protocol'), value: `№ ${referral.protocol_number}` },
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
        {!referral && !notFound && !error && <p className="text-sm text-sand-300">{t('referral.loading')}</p>}
        {notFound && (
          <StatusBanner valid={false} title={t('referral.notFoundTitle')} detail={t('referral.notFoundDetail')} />
        )}

        {referral && (
          <StatusBanner
            valid={referral.valid}
            title={referral.valid ? t('referral.validTitle') : t('referral.invalidTitle')}
            detail={t(referral.valid ? 'referral.validDetail' : 'referral.invalidDetail', {
              number: referralNumberLabel(referral),
              date: formatDate(referral.issued_at),
            })}
          />
        )}

        {referral?.valid && (
          <>
            <Card className="!py-1.5 !px-4.5">
              {facts.map((fact, i) => (
                <div
                  key={fact.label}
                  className={`flex justify-between gap-4 py-3 text-sm ${i < facts.length - 1 ? 'border-b border-navy-700' : ''}`}
                >
                  <span className="shrink-0 text-sand-300">{fact.label}</span>
                  <span className="text-right font-semibold text-sand-100">{fact.value}</span>
                </div>
              ))}
            </Card>
            <p className="text-sm text-sand-300">{t('referral.compareHint')}</p>
            <ReferralDocument referral={referral} />
          </>
        )}
      </main>
    </div>
  )
}
