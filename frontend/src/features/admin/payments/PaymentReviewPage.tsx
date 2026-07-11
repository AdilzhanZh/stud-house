import { useEffect, useState } from 'react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { extractErrorMessage } from '../../../api/client'
import { confirmPayment, listPayments, paymentManagerDecision } from '../../../api/paymentAdminApi'
import { listContracts } from '../../../api/contractAdminApi'
import { getApplication } from '../../../api/applicationApi'
import { listUsers } from '../../../api/adminUserApi'
import { formatTimeElapsed } from '../../contracts/deadline'
import type { Payment } from '../../../types/payments'

interface Row extends Payment {
  studentName: string
}

export function PaymentReviewPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [overdueRows, setOverdueRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const [voidTarget, setVoidTarget] = useState<string | null>(null)
  const [voidError, setVoidError] = useState<string | null>(null)
  const [isVoiding, setIsVoiding] = useState(false)

  const [extendTarget, setExtendTarget] = useState<string | null>(null)
  const [newDeadline, setNewDeadline] = useState('')
  const [extendError, setExtendError] = useState<string | null>(null)
  const [isExtending, setIsExtending] = useState(false)

  function load() {
    setRows(null)
    setOverdueRows(null)
    Promise.all([listPayments(), listContracts(), listUsers('student')])
      .then(async ([allPayments, contracts, students]) => {
        // Managers can confirm a payment made in person at the accounting
        // office (rooms 212/315) even if the student never submitted a
        // receipt through the site — so both 'pending' and 'submitted'
        // show up here, not just 'submitted'.
        const payments = allPayments.filter(
          (p) => p.status === 'pending' || p.status === 'submitted',
        )
        const overdue = allPayments.filter((p) => p.status === 'awaiting_manager_decision')
        const contractsById = Object.fromEntries(contracts.map((c) => [c.id, c]))
        const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))
        const withNames = async (list: Payment[]): Promise<Row[]> =>
          Promise.all(
            list.map(async (p) => {
              const contract = contractsById[p.contract_id]
              const app = contract ? await getApplication(contract.application_id).catch(() => null) : null
              return {
                ...p,
                studentName: app ? (namesById[app.student_id] ?? app.student_id) : '—',
              }
            }),
          )
        setRows(await withNames(payments))
        setOverdueRows(await withNames(overdue))
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

  async function handleVoid() {
    if (!voidTarget) return
    setVoidError(null)
    setIsVoiding(true)
    try {
      await paymentManagerDecision(voidTarget, { action: 'void' })
      setVoidTarget(null)
      load()
    } catch (err) {
      setVoidError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setIsVoiding(false)
    }
  }

  async function handleExtend() {
    if (!extendTarget || !newDeadline) return
    setExtendError(null)
    setIsExtending(true)
    try {
      await paymentManagerDecision(extendTarget, {
        action: 'extend',
        new_deadline: new Date(newDeadline).toISOString(),
      })
      setExtendTarget(null)
      setNewDeadline('')
      load()
    } catch (err) {
      setExtendError(extractErrorMessage(err, 'Мерзімді ұзарту сәтсіз аяқталды'))
    } finally {
      setIsExtending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl text-sand-100">Төлем растауы</h1>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}
      {!error && !rows && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}

      <div className="flex flex-col gap-3">
        {rows?.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sand-100">{p.studentName}</p>
                <p className="text-sm text-sand-300/60">
                  {p.amount} {p.currency}
                </p>
                {p.receipt_file_url ? (
                  <a
                    href={p.receipt_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-turquoise-400 hover:underline"
                  >
                    Чекті қарау
                  </a>
                ) : (
                  <p className="text-sm text-sand-300/60">
                    Чек жүктелмеген — бухгалтерияда (212/315-кабинет) төленген болуы мүмкін
                  </p>
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
          <p className="text-sm text-sand-300/60">Расталуын күтетін төлем жоқ</p>
        )}
      </div>

      <h2 className="mt-4 font-heading text-lg text-sand-100">Мерзімі өткен төлемдер</h2>
      <p className="text-sm text-sand-300/60">
        7 күн ішінде расталмаған төлемдер — өтінішті жою немесе мерзімді ұзарту қажет
      </p>

      <div className="flex flex-col gap-3">
        {overdueRows?.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sand-100">{p.studentName}</p>
                <p className="text-sm text-sand-300/60">
                  {p.amount} {p.currency}
                </p>
                <p className="text-sm text-sand-200">Мерзімі {formatTimeElapsed(p.deadline)}</p>
              </div>
              {extendTarget !== p.id && (
                <div className="flex gap-3">
                  <Button variant="danger" onClick={() => setVoidTarget(p.id)}>
                    Өтінішті жою
                  </Button>
                  <Button variant="secondary" onClick={() => setExtendTarget(p.id)}>
                    Мерзімді ұзарту
                  </Button>
                </div>
              )}
            </div>

            {extendTarget === p.id && (
              <div className="mt-4 flex flex-col gap-3">
                {extendError && <Alert variant="error" message={extendError} />}
                <input
                  type="datetime-local"
                  className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button onClick={handleExtend} isLoading={isExtending} disabled={!newDeadline}>
                    Растау
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setExtendTarget(null)
                      setNewDeadline('')
                      setExtendError(null)
                    }}
                  >
                    Бас тарту
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {overdueRows && overdueRows.length === 0 && (
          <p className="text-sm text-sand-300/60">Мерзімі өткен төлем жоқ</p>
        )}
      </div>

      <ConfirmDialog
        open={voidTarget !== null}
        title="Өтінішті жою"
        message="Бұл әрекет өтінішті rejected етеді, бөлмені босатады және студентке 7 күн бойы жаңа өтініш беруге тыйым салады. Жалғастырасыз ба?"
        danger
        isLoading={isVoiding}
        onConfirm={handleVoid}
        onCancel={() => {
          setVoidTarget(null)
          setVoidError(null)
        }}
      />
      {voidError && <Alert variant="error" message={voidError} />}
    </div>
  )
}
