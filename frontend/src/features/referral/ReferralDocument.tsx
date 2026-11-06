import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { TemplatePages } from '../../components/TemplatePages'
import { downloadReferralPdf, getFilledReferralDocument } from '../../utils/referralPdf'
import type { FilledDocument } from '../../utils/pdf'
import type { Referral } from '../../types/referrals'

// The A4 sheet and its download button: the same on the student's own page and
// on the page the QR code opens.
export function ReferralDocument({ referral }: { referral: Referral }) {
  const { t } = useTranslation()
  const [document, setDocument] = useState<FilledDocument | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getFilledReferralDocument(referral)
      .then((filled) => {
        if (!cancelled) setDocument(filled)
      })
      .catch(() => {
        if (!cancelled) setError(t('referral.renderFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [referral, t])

  async function handleDownload() {
    setError(null)
    setIsDownloading(true)
    try {
      await downloadReferralPdf(referral)
    } catch {
      setError(t('referral.downloadFailed'))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="error" message={error} />}
      <Button onClick={handleDownload} isLoading={isDownloading} className="inline-flex items-center gap-2 self-start">
        <Download className="h-4 w-4" /> {t('referral.download')}
      </Button>
      {document && <TemplatePages document={document} />}
    </div>
  )
}
