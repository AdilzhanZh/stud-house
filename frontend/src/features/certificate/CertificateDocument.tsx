import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { TemplatePages } from '../../components/TemplatePages'
import { downloadCertificatePdf, getFilledCertificateDocument } from '../../utils/residenceCertificatePdf'
import type { FilledDocument } from '../../utils/pdf'
import type { CertificateLanguage, ResidenceCertificate } from '../../types/residenceCertificates'

const LANGUAGES: CertificateLanguage[] = ['kk', 'ru']

// The A4 sheet, a choice of its language and the download button: the same on
// the student's own page and on the page the QR code opens. Offices outside
// the university often want the Russian version, so both are one tap away.
export function CertificateDocument({ certificate }: { certificate: ResidenceCertificate }) {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState<CertificateLanguage>(i18n.language === 'ru' ? 'ru' : 'kk')
  const [document, setDocument] = useState<FilledDocument | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getFilledCertificateDocument(certificate, language)
      .then((filled) => {
        if (!cancelled) setDocument(filled)
      })
      .catch(() => {
        if (!cancelled) setError(t('certificate.renderFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [certificate, language, t])

  async function handleDownload() {
    setError(null)
    setIsDownloading(true)
    try {
      await downloadCertificatePdf(certificate, language)
    } catch {
      setError(t('certificate.downloadFailed'))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="error" message={error} />}
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label={t('certificate.languageLabel')} className="inline-flex rounded-lg bg-navy-800 p-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="radio"
              aria-checked={language === lang}
              onClick={() => setLanguage(lang)}
              className={`rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${
                language === lang ? 'bg-navy-900 text-sand-100 shadow-[var(--shadow-card)]' : 'text-sand-300 hover:text-sand-100'
              }`}
            >
              {t(`certificate.language.${lang}`)}
            </button>
          ))}
        </div>
        <Button onClick={handleDownload} isLoading={isDownloading} className="inline-flex items-center gap-2">
          <Download className="h-4 w-4" /> {t('certificate.download')}
        </Button>
      </div>
      {document && <TemplatePages document={document} />}
    </div>
  )
}
