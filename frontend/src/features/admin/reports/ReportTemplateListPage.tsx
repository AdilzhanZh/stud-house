import { useEffect, useState } from 'react'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { createReportTemplate, listReportTemplates } from '../../../api/reportTemplateApi'
import type { ReportTemplate } from '../../../types/reports'

export function ReportTemplateListPage() {
  const [templates, setTemplates] = useState<ReportTemplate[] | null>(null)
  const [name, setName] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function load() {
    listReportTemplates()
      .then(setTemplates)
      .catch((err) => setError(extractErrorMessage(err, 'Шаблондарды жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await createReportTemplate(name, fileUrl)
      setName('')
      setFileUrl('')
      load()
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Сақтау сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900">Рапорт шаблондары</h1>

      <Card title="Жаңа шаблон қосу">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {submitError && <Alert variant="error" message={submitError} />}
          <Input label="Атауы" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Файл URL-і"
            type="url"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            required
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Қосу
          </Button>
        </form>
      </Card>

      {error && <Alert variant="error" message={error} />}
      {!error && !templates && <p className="text-sm text-gray-500">Жүктелуде...</p>}

      <div className="flex flex-col gap-2">
        {templates?.map((t) => (
          <Card key={t.id}>
            <p className="font-medium text-gray-900">{t.name}</p>
            <a href={t.file_url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
              {t.file_url}
            </a>
          </Card>
        ))}
        {templates && templates.length === 0 && (
          <p className="text-sm text-gray-500">Шаблон қосылмаған</p>
        )}
      </div>
    </div>
  )
}
