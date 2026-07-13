import { useEffect, useState } from 'react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { decideStudentApproval, listPendingStudents } from '../../../api/adminUserApi'
import type { User } from '../../../types'

export function PendingStudentsPage() {
  const [students, setStudents] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  function load() {
    listPendingStudents()
      .then(setStudents)
      .catch((err) => setError(extractErrorMessage(err, 'Тіркелгілерді жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [])

  async function handleDecision(id: string, action: 'approve' | 'reject') {
    setActionError(null)
    setSubmittingId(id)
    try {
      await decideStudentApproval(id, action)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[23px] font-bold text-sand-100">Күтіп тұрған тіркелгілер</h1>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}
      {!error && !students && <p className="text-sm text-sand-300">Жүктелуде...</p>}

      <div className="flex flex-col gap-3">
        {students?.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sand-100">{s.full_name}</p>
                <p className="text-sm text-sand-300">{s.email}</p>
                <p className="text-sm text-sand-300">Телефон: {s.phone || '—'}</p>
                <p className="font-mono text-sm text-sand-300">ЖСН (ИИН): {s.iin ?? '—'}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <Button
                  onClick={() => handleDecision(s.id, 'approve')}
                  isLoading={submittingId === s.id}
                >
                  Растау
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDecision(s.id, 'reject')}
                  isLoading={submittingId === s.id}
                >
                  Қабылдамау
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {students && students.length === 0 && (
          <p className="text-sm text-sand-300">Күтіп тұрған тіркелгі жоқ</p>
        )}
      </div>
    </div>
  )
}
