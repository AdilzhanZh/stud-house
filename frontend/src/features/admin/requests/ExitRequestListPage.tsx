import { useEffect, useState } from 'react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { decideExitRequest, listExitRequests } from '../../../api/exitRequestAdminApi'
import { listUsers } from '../../../api/adminUserApi'
import type { ExitRequest } from '../../../types/exitRequests'

interface Row extends ExitRequest {
  studentName: string
}

export function ExitRequestListPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  function load() {
    setRows(null)
    Promise.all([listExitRequests('pending'), listUsers('student')])
      .then(([requests, students]) => {
        const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))
        setRows(requests.map((r) => ({ ...r, studentName: namesById[r.student_id] ?? r.student_id })))
      })
      .catch((err) => setError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [])

  async function handleApprove(id: string) {
    setActionError(null)
    setSubmittingId(id)
    try {
      await decideExitRequest(id, { action: 'approve' })
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setSubmittingId(null)
    }
  }

  async function handleReject(id: string) {
    if (!comment.trim()) return
    setActionError(null)
    setSubmittingId(id)
    try {
      await decideExitRequest(id, { action: 'reject', comment: comment.trim() })
      setRejectTarget(null)
      setComment('')
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[23px] font-bold text-sand-100">Шығу сұраныстары</h1>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}
      {!error && !rows && <p className="text-sm text-sand-300">Жүктелуде...</p>}

      <div className="flex flex-col gap-3">
        {rows?.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sand-100">{r.studentName}</p>
                {r.reason && <p className="text-sm text-sand-300">{r.reason}</p>}
                <p className="text-xs text-sand-400">
                  {new Date(r.requested_at).toLocaleDateString('kk-KZ')}
                </p>
              </div>
              {rejectTarget !== r.id && (
                <div className="flex gap-3">
                  <Button onClick={() => handleApprove(r.id)} isLoading={submittingId === r.id}>
                    Мақұлдау
                  </Button>
                  <Button variant="danger" onClick={() => setRejectTarget(r.id)}>
                    Қабылдамау
                  </Button>
                </div>
              )}
            </div>

            {rejectTarget === r.id && (
              <div className="mt-4 flex flex-col gap-3">
                <textarea
                  rows={3}
                  placeholder="Себебі (міндетті)"
                  className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    onClick={() => handleReject(r.id)}
                    isLoading={submittingId === r.id}
                    disabled={!comment.trim()}
                  >
                    Растау
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRejectTarget(null)
                      setComment('')
                    }}
                  >
                    Бас тарту
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {rows && rows.length === 0 && (
          <p className="text-sm text-sand-300">Қаралатын сұраныс жоқ</p>
        )}
      </div>
    </div>
  )
}
