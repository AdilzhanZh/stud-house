import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { ContractStatusBadge } from '../../../components/ContractStatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { contractManagerDecision, listContracts } from '../../../api/contractAdminApi'
import { confirmPayment, listPayments, paymentManagerDecision } from '../../../api/paymentAdminApi'
import { getApplication } from '../../../api/applicationApi'
import { listUsers } from '../../../api/adminUserApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { formatTimeElapsed } from '../../contracts/deadline'
import { adminCellClass, adminPageHeading, adminRowClass, adminTableWrapClass, adminTheadClass } from '../adminTable'
import type { Contract } from '../../../types/contracts'
import type { Payment } from '../../../types/payments'

interface ContractRow extends Contract {
  studentName: string
  dormitoryName: string
}

interface PaymentRow extends Payment {
  studentName: string
}

export function ContractsAndPaymentsPage() {
  const { t } = useTranslation()
  const [contracts, setContracts] = useState<ContractRow[] | null>(null)
  const [overdueContracts, setOverdueContracts] = useState<ContractRow[] | null>(null)
  const [pendingPayments, setPendingPayments] = useState<PaymentRow[] | null>(null)
  const [overduePayments, setOverduePayments] = useState<PaymentRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submittingPaymentId, setSubmittingPaymentId] = useState<string | null>(null)

  const [contractVoidTarget, setContractVoidTarget] = useState<string | null>(null)
  const [contractExtendTarget, setContractExtendTarget] = useState<string | null>(null)
  const [contractNewDeadline, setContractNewDeadline] = useState('')
  const [isContractSubmitting, setIsContractSubmitting] = useState(false)

  const [paymentVoidTarget, setPaymentVoidTarget] = useState<string | null>(null)
  const [paymentExtendTarget, setPaymentExtendTarget] = useState<string | null>(null)
  const [paymentNewDeadline, setPaymentNewDeadline] = useState('')
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false)

  function load() {
    Promise.all([listContracts(), listPayments(), listUsers('student'), listDormitories()])
      .then(async ([allContracts, allPayments, students, dormitories]) => {
        const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))
        const dormitoryNamesById = Object.fromEntries(dormitories.map((d) => [d.id, d.name]))
        const contractsById = Object.fromEntries(allContracts.map((c) => [c.id, c]))

        const withContractNames = async (list: Contract[]): Promise<ContractRow[]> =>
          Promise.all(
            list.map(async (c) => {
              const app = await getApplication(c.application_id).catch(() => null)
              return {
                ...c,
                studentName: app ? (namesById[app.student_id] ?? app.student_id) : '—',
                dormitoryName: app ? (dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id) : '—',
              }
            }),
          )
        const withPaymentNames = async (list: Payment[]): Promise<PaymentRow[]> =>
          Promise.all(
            list.map(async (p) => {
              const contract = contractsById[p.contract_id]
              const app = contract ? await getApplication(contract.application_id).catch(() => null) : null
              return { ...p, studentName: app ? (namesById[app.student_id] ?? app.student_id) : '—' }
            }),
          )

        setContracts(await withContractNames(allContracts))
        setOverdueContracts(
          await withContractNames(allContracts.filter((c) => c.status === 'awaiting_manager_decision')),
        )
        // Managers can confirm a payment made in person at the accounting
        // office (rooms 212/315) even if the student never submitted a
        // receipt through the site — so both 'pending' and 'submitted'
        // show up here, not just 'submitted'.
        setPendingPayments(
          await withPaymentNames(allPayments.filter((p) => p.status === 'pending' || p.status === 'submitted')),
        )
        setOverduePayments(
          await withPaymentNames(allPayments.filter((p) => p.status === 'awaiting_manager_decision')),
        )
      })
      .catch((err) => setError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [])

  async function handleContractVoid() {
    if (!contractVoidTarget) return
    setActionError(null)
    setIsContractSubmitting(true)
    try {
      await contractManagerDecision(contractVoidTarget, { action: 'void' })
      setContractVoidTarget(null)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setIsContractSubmitting(false)
    }
  }

  async function handleContractExtend() {
    if (!contractExtendTarget || !contractNewDeadline) return
    setActionError(null)
    setIsContractSubmitting(true)
    try {
      await contractManagerDecision(contractExtendTarget, {
        action: 'extend',
        new_deadline: new Date(contractNewDeadline).toISOString(),
      })
      setContractExtendTarget(null)
      setContractNewDeadline('')
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Мерзімді ұзарту сәтсіз аяқталды'))
    } finally {
      setIsContractSubmitting(false)
    }
  }

  async function handlePaymentDecision(id: string, action: 'confirm' | 'reject') {
    setActionError(null)
    setSubmittingPaymentId(id)
    try {
      await confirmPayment(id, action)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setSubmittingPaymentId(null)
    }
  }

  async function handlePaymentVoid() {
    if (!paymentVoidTarget) return
    setActionError(null)
    setIsPaymentSubmitting(true)
    try {
      await paymentManagerDecision(paymentVoidTarget, { action: 'void' })
      setPaymentVoidTarget(null)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setIsPaymentSubmitting(false)
    }
  }

  async function handlePaymentExtend() {
    if (!paymentExtendTarget || !paymentNewDeadline) return
    setActionError(null)
    setIsPaymentSubmitting(true)
    try {
      await paymentManagerDecision(paymentExtendTarget, {
        action: 'extend',
        new_deadline: new Date(paymentNewDeadline).toISOString(),
      })
      setPaymentExtendTarget(null)
      setPaymentNewDeadline('')
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Мерзімді ұзарту сәтсіз аяқталды'))
    } finally {
      setIsPaymentSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className={adminPageHeading}>Келісімшарттар мен төлемдер</h1>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}

      <div>
        <p className="mb-3 text-[15px] font-bold text-sand-100">Келісімшарттар</p>
        {!contracts ? (
          <p className="text-sm text-sand-300">Жүктелуде...</p>
        ) : (
          <Card className={adminTableWrapClass}>
            <table className="w-full text-left text-sm">
              <thead className={adminTheadClass}>
                <tr>
                  <th className={adminCellClass}>Студент</th>
                  <th className={adminCellClass}>Жатақхана</th>
                  <th className={adminCellClass}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className={adminRowClass}>
                    <td className={`${adminCellClass} font-semibold text-sand-100`}>{c.studentName}</td>
                    <td className={`${adminCellClass} text-sand-300`}>{c.dormitoryName}</td>
                    <td className={adminCellClass}>
                      <ContractStatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
                {contracts.length === 0 && (
                  <tr>
                    <td className={`${adminCellClass} text-sand-300`} colSpan={3}>
                      Келісімшарт жоқ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {overdueContracts && overdueContracts.length > 0 && (
        <div>
          <p className="mb-1 text-[15px] font-bold text-sand-100">Мерзімі өткен келісімшарттар</p>
          <p className="mb-3 text-sm text-sand-300">Жауап берілмеген — келісімшарттың күшін жою немесе ұзарту қажет</p>
          <div className="flex flex-col gap-3">
            {overdueContracts.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sand-100">{c.studentName}</p>
                    <p className="text-sm text-sand-300">{c.dormitoryName}</p>
                    <p className="text-sm text-sand-200">Мерзімі {formatTimeElapsed(c.response_deadline, t)}</p>
                  </div>
                  {contractExtendTarget !== c.id && (
                    <div className="flex gap-2.5">
                      <Button variant="danger" onClick={() => setContractVoidTarget(c.id)}>
                        Күшін жою
                      </Button>
                      <Button variant="secondary" onClick={() => setContractExtendTarget(c.id)}>
                        Мерзімді ұзарту
                      </Button>
                    </div>
                  )}
                </div>
                {contractExtendTarget === c.id && (
                  <div className="mt-3.5 flex flex-col gap-3">
                    <input
                      type="datetime-local"
                      className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
                      value={contractNewDeadline}
                      onChange={(e) => setContractNewDeadline(e.target.value)}
                    />
                    <div className="flex gap-2.5">
                      <Button onClick={handleContractExtend} isLoading={isContractSubmitting} disabled={!contractNewDeadline}>
                        Растау
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setContractExtendTarget(null)
                          setContractNewDeadline('')
                        }}
                      >
                        Бас тарту
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-3 text-[15px] font-bold text-sand-100">Растауды күтетін төлемдер</p>
        {!pendingPayments ? (
          <p className="text-sm text-sand-300">Жүктелуде...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingPayments.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sand-100">{p.studentName}</p>
                    <p className="text-sm text-sand-300">
                      {p.amount} {p.currency}
                    </p>
                    {p.receipt_file_url ? (
                      <a
                        href={p.receipt_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-turquoise-400 hover:text-turquoise-300"
                      >
                        Чекті қарау
                      </a>
                    ) : (
                      <p className="text-sm text-sand-300">
                        Чек жүктелмеген — бухгалтерияда (212/315-кабинет) төленген болуы мүмкін
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2.5">
                    <Button onClick={() => handlePaymentDecision(p.id, 'confirm')} isLoading={submittingPaymentId === p.id}>
                      Растау
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handlePaymentDecision(p.id, 'reject')}
                      isLoading={submittingPaymentId === p.id}
                    >
                      Қабылдамау
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {pendingPayments.length === 0 && <p className="text-sm text-sand-300">Расталуын күтетін төлем жоқ</p>}
          </div>
        )}
      </div>

      {overduePayments && overduePayments.length > 0 && (
        <div>
          <p className="mb-1 text-[15px] font-bold text-sand-100">Мерзімі өткен төлемдер</p>
          <p className="mb-3 text-sm text-sand-300">7 күн ішінде расталмаған — өтінішті жою немесе мерзімді ұзарту қажет</p>
          <div className="flex flex-col gap-3">
            {overduePayments.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sand-100">{p.studentName}</p>
                    <p className="text-sm text-sand-300">
                      {p.amount} {p.currency}
                    </p>
                    <p className="text-sm text-sand-200">Мерзімі {formatTimeElapsed(p.deadline, t)}</p>
                  </div>
                  {paymentExtendTarget !== p.id && (
                    <div className="flex gap-2.5">
                      <Button variant="danger" onClick={() => setPaymentVoidTarget(p.id)}>
                        Өтінішті жою
                      </Button>
                      <Button variant="secondary" onClick={() => setPaymentExtendTarget(p.id)}>
                        Мерзімді ұзарту
                      </Button>
                    </div>
                  )}
                </div>
                {paymentExtendTarget === p.id && (
                  <div className="mt-3.5 flex flex-col gap-3">
                    <input
                      type="datetime-local"
                      className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
                      value={paymentNewDeadline}
                      onChange={(e) => setPaymentNewDeadline(e.target.value)}
                    />
                    <div className="flex gap-2.5">
                      <Button onClick={handlePaymentExtend} isLoading={isPaymentSubmitting} disabled={!paymentNewDeadline}>
                        Растау
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setPaymentExtendTarget(null)
                          setPaymentNewDeadline('')
                        }}
                      >
                        Бас тарту
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={contractVoidTarget !== null}
        title="Келісімшарттың күшін жою"
        message="Бұл әрекет өтінішті rejected етеді және қайтарылмайды. Жалғастырасыз ба?"
        danger
        isLoading={isContractSubmitting}
        onConfirm={handleContractVoid}
        onCancel={() => setContractVoidTarget(null)}
      />
      <ConfirmDialog
        open={paymentVoidTarget !== null}
        title="Өтінішті жою"
        message="Бұл әрекет өтінішті rejected етеді, бөлмені босатады және студентке 7 күн бойы жаңа өтініш беруге тыйым салады. Жалғастырасыз ба?"
        danger
        isLoading={isPaymentSubmitting}
        onConfirm={handlePaymentVoid}
        onCancel={() => setPaymentVoidTarget(null)}
      />
    </div>
  )
}
