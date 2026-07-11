import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { listMyContracts } from '../../api/contractApi'
import { getPaymentByContract, submitPayment } from '../../api/paymentApi'
import { uploadFile } from '../../api/uploadApi'
import type { Contract } from '../../types/contracts'
import type { Payment } from '../../types/payments'

// Same hardcoded text PaymentService.notifyStudentPaymentDecision sends —
// there is no per-instance rejection reason field on Payment
// (internal/domain/payment.go), so this static copy stands in for it
// (see backend/README.md's note on this).
const REJECTION_REASON = 'Сіздің төлеміңіз расталмады, чекті қайта жүктеңіз.'

export function PaymentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [contract, setContract] = useState<Contract | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function load() {
    if (!id) return
    listMyContracts()
      .then(async (contracts) => {
        const found = contracts.find((c) => c.id === id)
        if (!found) {
          setLoadError('Келісімшарт табылмады')
          return
        }
        setContract(found)
        if (found.status !== 'accepted') return

        setPayment(await getPaymentByContract(found.id))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!payment || !receiptFile) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const receiptUrl = await uploadFile(receiptFile)
      const updated = await submitPayment(payment.id, receiptUrl)
      setPayment(updated)
      setReceiptFile(null)
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Жіберу сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!contract) return <p className="text-sm text-sand-300/60">Жүктелуде...</p>
  if (contract.status !== 'accepted') {
    return (
      <Alert
        variant="error"
        message="Төлем беті тек келісімшарт қабылданғаннан кейін қолжетімді."
      />
    )
  }
  if (!payment) return <p className="text-sm text-sand-300/60">Жүктелуде...</p>

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/contracts/my')}>
        ← Артқа
      </Button>

      <Card title="Төлем ақпараты">
        <p className="text-sm text-sand-300/70">
          Сомасы: {payment.amount} {payment.currency}
        </p>
        <p className="mt-3 text-sm text-sand-100">
          Төлемді <strong>бухгалтерияға (212-кабинет)</strong> апарып төлеңіз, содан кейін төлем
          чегін <strong>315-кабинетке</strong> әкеліп беріңіз.
        </p>
      </Card>

      {payment.status === 'submitted' && (
        <Alert variant="success" message="Төлеміңіз расталуын күтуде." />
      )}

      {payment.status === 'awaiting_manager_decision' && (
        <Alert
          variant="error"
          message="Төлемнің мерзімі өтті, менеджердің шешімі күтілуде. Тезірек бухгалтерияға хабарласыңыз."
        />
      )}

      {payment.status === 'confirmed' && (
        <Alert variant="success" message="Төлеміңіз расталды." />
      )}

      {payment.status === 'rejected' && (
        <>
          <Alert variant="error" message={REJECTION_REASON} />
          <Card title="Чекті қайта жүктеу">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {submitError && <Alert variant="error" message={submitError} />}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-sand-200">
                  Чек файлы <span className="text-clay-400">*</span>
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-turquoise-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-turquoise-400 hover:file:bg-turquoise-500/15"
                />
              </div>
              <Button type="submit" isLoading={isSubmitting} disabled={!receiptFile} className="self-start">
                Қайта жіберу
              </Button>
            </form>
          </Card>
        </>
      )}
    </div>
  )
}
