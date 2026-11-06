import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { ChevronLeft, FilePlus2 } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { extractErrorMessage } from '../../api/client'
import { getStudentProfile } from '../../api/profileApi'
import { getMyResidenceCertificate, issueResidenceCertificate } from '../../api/residenceCertificateApi'
import { useAuth } from '../auth/useAuth'
import { formatDate } from '../../utils/dateFormat'
import { certificateNumberLabel } from '../../utils/residenceCertificatePdf'
import { CertificateDocument } from './CertificateDocument'
import type { ResidenceCertificate } from '../../types/residenceCertificates'

export function MyCertificatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [certificate, setCertificate] = useState<ResidenceCertificate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isIssuing, setIsIssuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missingDetails, setMissingDetails] = useState(false)

  useEffect(() => {
    getMyResidenceCertificate()
      .then(setCertificate)
      .catch((err) => {
        if (!(isAxiosError(err) && err.response?.status === 404)) {
          setError(extractErrorMessage(err, t('certificate.loadFailed')))
        }
      })
      .finally(() => setIsLoading(false))
  }, [t])

  // The certificate copies the institute and group from the profile when it's
  // issued, so say so before they end up missing from the paper.
  useEffect(() => {
    if (!user) return
    getStudentProfile(user.id)
      .then((p) => setMissingDetails(!p.institute.trim() || !p.study_group.trim()))
      .catch(() => undefined)
  }, [user])

  async function handleIssue() {
    setError(null)
    setIsIssuing(true)
    try {
      setCertificate(await issueResidenceCertificate())
    } catch (err) {
      setError(extractErrorMessage(err, t('certificate.issueFailed')))
    } finally {
      setIsIssuing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <button
        onClick={() => navigate('/my-residence')}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> {t('residence.title')}
      </button>
      <h1 className="text-[23px] font-bold text-sand-100">{t('certificate.title')}</h1>

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-sand-200">{t('certificate.intro')}</p>
        {missingDetails && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-500/10 px-3.5 py-3">
            <p className="text-sm font-semibold text-sand-100">{t('certificate.detailsMissing')}</p>
            <Button variant="secondary" onClick={() => navigate('/dashboard/profile/edit')}>
              {t('certificate.fillDetails')}
            </Button>
          </div>
        )}
        {error && <Alert variant="error" message={error} />}
        <Button
          variant={certificate ? 'secondary' : 'primary'}
          onClick={handleIssue}
          isLoading={isIssuing}
          disabled={isLoading}
          className="inline-flex items-center gap-2 self-start"
        >
          <FilePlus2 className="h-4 w-4" /> {certificate ? t('certificate.issueNew') : t('certificate.issue')}
        </Button>
      </Card>

      {isLoading && <p className="text-sm text-sand-300">{t('certificate.loading')}</p>}

      {certificate && (
        <>
          <p className="text-sm text-sand-300">
            {t('certificate.latest', {
              number: certificateNumberLabel(certificate),
              date: formatDate(certificate.issued_at),
            })}
          </p>
          {!certificate.still_resides && (
            <Alert variant="warning" message={t('certificate.outdated')} />
          )}
          <CertificateDocument certificate={certificate} />
        </>
      )}
    </div>
  )
}
