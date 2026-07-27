import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { sendFeedback } from '../../api/feedbackApi'

export function FeedbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSending(true)
    try {
      await sendFeedback(message.trim())
      setMessage('')
      setSent(true)
    } catch (err) {
      setError(extractErrorMessage(err, t('profile.feedbackFailed')))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/profile')}
          aria-label={t('appDetail.backToList')}
          className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-sand-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[19px] font-bold text-sand-100">{t('profile.feedbackTitle')}</span>
      </div>

      <Card>
        <p className="text-sm text-sand-300">{t('profile.feedbackSubtitle')}</p>
        {sent && <Alert variant="success" message={t('profile.feedbackSent')} />}
        {error && <Alert variant="error" message={error} />}
        <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
          <textarea
            rows={5}
            placeholder={t('profile.feedbackPlaceholder')}
            className="w-full resize-y rounded-xl border border-navy-700 bg-navy-950 px-3 py-2.5 text-sm text-sand-100 outline-none placeholder:text-sand-400 focus:border-turquoise-400"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setSent(false)
            }}
          />
          <Button type="submit" isLoading={isSending} disabled={!message.trim()} className="self-start">
            {t('profile.feedbackSend')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
