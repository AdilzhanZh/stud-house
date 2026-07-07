import { useEffect, useState } from 'react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { confirmPayment, listPayments } from '../../../api/paymentAdminApi'
import { listContracts } from '../../../api/contractAdminApi'
import { getApplication } from '../../../api/applicationApi'
import { listUsers } from '../../../api/adminUserApi'
import type { Payment } from '../../../types/payments'

interface Row extends Payment {
  studentName: string
}

export function PaymentReviewPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  function load() {
    setRows(null)
    Promise.all([listPayments('submitted'), listContracts(), listUsers('student')])
      .then(async ([payments, contracts, students]) => {
        const contractsById = Object.fromEntries(contracts.map((c) => [c.id, c]))
        const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))
        const withNames = await Promise.all(
          payments.map(async (p) => {
            const contract = contractsById[p.contract_id]
            const app = contract ? await getApplication(contract.application_id).catch(() => null) : null
            return {
              ...p,
              studentName: app ? (namesById[app.student_id] ?? app.student_id) : '—',
            }
          }),
        )
        setRows(withNames)
      })
      .catch((err) => setError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [])

  async function handleDecision(id: string, action: 'confirm' | 'reject') {
    setActionError(null)
    setSubmittingId(id)
    try {
      await confirmPayment(id, action)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Төлем растауы</h1>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}
      {!error && !rows && <p className="text-sm text-gray-500">Жүктелуде...</p>}

      <div className="flex flex-col gap-3">
        {rows?.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">{p.studentName}</p>
                <p className="text-sm text-gray-500">
                  {p.amount} {p.currency}
                </p>
                {p.receipt_file_url && (
                  <a
                    href={p.receipt_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Чекті қарау
                  </a>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleDecision(p.id, 'confirm')}
                  isLoading={submittingId === p.id}
                >
                  Растау
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDecision(p.id, 'reject')}
                  isLoading={submittingId === p.id}
                >
                  Қабылдамау
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {rows && rows.length === 0 && (
          <p className="text-sm text-gray-500">Расталуын күтетін төлем жоқ</p>
        )}
      </div>
    </div>
  )
}
