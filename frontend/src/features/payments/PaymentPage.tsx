import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { listMyContracts } from '../../api/contractApi'
import { getApplication } from '../../api/applicationApi'
import { getDormitory } from '../../api/dormitoryApi'
import { getPaymentByContract, submitPayment } from '../../api/paymentApi'
import type { Contract } from '../../types/contracts'
import type { Payment } from '../../types/payments'
import type { Dormitory } from '../../types/dormitories'

// Same hardcoded text PaymentService.notifyStudentPaymentDecision sends —
// there is no per-instance rejection reason field on Payment
// (internal/domain/payment.go), so this static copy stands in for it
// (see backend/README.md's note on this).
const REJECTION_REASON = 'Сіздің төлеміңіз расталмады, чекті қайта жүктеңіз.'

export function PaymentPage() {
  const { id } = useParams<{ id: string }>()

  const [contract, setContract] = useState<Contract | null>(null)
  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [receiptUrl, setReceiptUrl] = useState('')
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

        const [app, pay] = await Promise.all([
          getApplication(found.application_id),
          getPaymentByContract(found.id),
        ])
        setPayment(pay)
        setDormitory(await getDormitory(app.dormitory_id))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!payment) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const updated = await submitPayment(payment.id, receiptUrl)
      setPayment(updated)
      setReceiptUrl('')
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Жіберу сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!contract) return <p className="text-sm text-gray-500">Жүктелуде...</p>
  if (contract.status !== 'accepted') {
    return (
      <Alert
        variant="error"
        message="Төлем беті тек келісімшарт қабылданғаннан кейін қолжетімді."
      />
    )
  }
  if (!payment) return <p className="text-sm text-gray-500">Жүктелуде...</p>

  return (
    <div className="flex flex-col gap-6">
      <Card title="Жатақхана QR-коды">
        {dormitory?.payment_qr_code_url ? (
          <img
            src={dormitory.payment_qr_code_url}
            alt="Төлем QR-коды"
            className="h-56 w-56 rounded-md border border-gray-200 object-contain"
          />
        ) : (
          <p className="text-sm text-gray-500">QR-код жоқ</p>
        )}
        <p className="mt-3 text-sm text-gray-600">
          Сомасы: {payment.amount} {payment.currency}
        </p>
      </Card>

      {payment.status === 'pending' && (
        <Card title="Төлем чегін жүктеу">
          <p className="mb-3 text-xs text-gray-500">
            Файл жүктеу қызметі кейін қосылады — әзірге чектің сілтемесін (URL) енгізіңіз.
          </p>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {submitError && <Alert variant="error" message={submitError} />}
            <Input
              label="Чек файлының URL-і"
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              required
            />
            <Button type="submit" isLoading={isSubmitting} className="self-start">
              Жіберу
            </Button>
          </form>
        </Card>
      )}

      {payment.status === 'submitted' && (
        <Alert variant="success" message="Төлеміңіз расталуын күтуде." />
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
              <Input
                label="Чек файлының URL-і"
                type="url"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                required
              />
              <Button type="submit" isLoading={isSubmitting} className="self-start">
                Қайта жіберу
              </Button>
            </form>
          </Card>
        </>
      )}
    </div>
  )
}
