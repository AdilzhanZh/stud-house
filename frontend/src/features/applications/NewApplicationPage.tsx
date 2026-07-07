import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { listDormitories } from '../../api/dormitoryApi'
import { createApplication } from '../../api/applicationApi'
import type { Dormitory } from '../../types/dormitories'

export function NewApplicationPage() {
  const [searchParams] = useSearchParams()
  const dormitoryId = searchParams.get('dormitory_id')
  const navigate = useNavigate()

  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [notes, setNotes] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!dormitoryId) {
      setLoadError('Жатақхана таңдалмаған')
      return
    }
    listDormitories()
      .then((list) => {
        const found = list.find((d) => d.id === dormitoryId)
        if (!found) {
          setLoadError('Жатақхана табылмады')
          return
        }
        setDormitory(found)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жатақхананы жүктеу сәтсіз аяқталды')))
  }, [dormitoryId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dormitoryId) return
    setServerError(null)
    setIsSubmitting(true)
    try {
      await createApplication({ dormitory_id: dormitoryId, notes: notes.trim() || null })
      navigate('/applications/my', { replace: true })
    } catch (err) {
      setServerError(extractErrorMessage(err, 'Өтініш жіберу сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card title="Өтініш беру">
      {loadError && <Alert variant="error" message={loadError} />}
      {!loadError && !dormitory && <p className="text-sm text-gray-500">Жүктелуде...</p>}
      {dormitory && (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {serverError && <Alert variant="error" message={serverError} />}
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Жатақхана</p>
            <p className="text-sm text-gray-900">{dormitory.name}</p>
            <p className="text-sm text-gray-500">{dormitory.address}</p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="notes" className="text-sm font-medium text-gray-700">
              Қосымша жазба
            </label>
            <textarea
              id="notes"
              rows={4}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Жіберу
          </Button>
        </form>
      )}
    </Card>
  )
}
