import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { ChevronLeft } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { extractErrorMessage } from '../../api/client'
import { getMyReferral } from '../../api/referralApi'
import { referralNumberLabel } from '../../utils/referralPdf'
import { ReferralDocument } from './ReferralDocument'
import type { Referral } from '../../types/referrals'

export function MyReferralPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [referral, setReferral] = useState<Referral | null>(null)
  const [notIssued, setNotIssued] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyReferral()
      .then(setReferral)
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 404) setNotIssued(true)
        else setError(extractErrorMessage(err, t('referral.loadFailed')))
      })
  }, [t])

  return (
    <div className="flex flex-col gap-3.5">
      <button
        onClick={() => navigate('/my-residence')}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> {t('residence.title')}
      </button>
      <h1 className="text-[23px] font-bold text-sand-100">{t('referral.title')}</h1>

      {error && <Alert variant="error" message={error} />}
      {notIssued && (
        <Card>
          <p className="text-sm text-sand-200">{t('referral.notIssued')}</p>
        </Card>
      )}
      {!referral && !notIssued && !error && <p className="text-sm text-sand-300">{t('referral.loading')}</p>}

      {referral && !referral.valid && (
        <Card>
          <p className="text-sm text-sand-200">
            {t('referral.mineInvalid', { number: referralNumberLabel(referral) })}
          </p>
        </Card>
      )}
      {referral?.valid && (
        <>
          <Card>
            <p className="text-sm text-sand-200">{t('referral.mineHint')}</p>
            {!referral.institute && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-sand-100">{t('referral.instituteMissing')}</p>
                <Button variant="secondary" onClick={() => navigate('/dashboard/profile/edit')}>
                  {t('referral.fillInstitute')}
                </Button>
              </div>
            )}
          </Card>
          <ReferralDocument referral={referral} />
        </>
      )}
    </div>
  )
}
