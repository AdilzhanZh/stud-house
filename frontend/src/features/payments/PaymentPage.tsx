import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Clock } from 'lucide-react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { listMyContracts } from '../../api/contractApi'
import { getApplication } from '../../api/applicationApi'
import { getDormitory } from '../../api/dormitoryApi'
import { getPaymentByContract, submitPayment } from '../../api/paymentApi'
import { uploadFile } from '../../api/uploadApi'
import { formatTenge } from '../../utils/dormitoryLabels'
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
  const [dormitoryName, setDormitoryName] = useState<string | null>(null)
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
        getApplication(found.application_id)
          .then((app) => getDormitory(app.dormitory_id))
          .then((d) => setDormitoryName(d.name))
          .catch(() => setDormitoryName(null))
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
  if (!contract) return <p className="text-sm text-sand-300">Жүктелуде...</p>
  if (contract.status !== 'accepted') {
    return <Alert variant="error" message="Төлем беті тек келісімшарт қабылданғаннан кейін қолжетімді." />
  }
  if (!payment) return <p className="text-sm text-sand-300">Жүктелуде...</p>

  return (
    <div className="flex flex-col gap-3.5">
      <button
        onClick={() => navigate('/contracts/my')}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> Келісімшарт
      </button>
      <h1 className="text-[23px] font-bold text-sand-100">Төлем</h1>

      <Card>
        <p className="text-xs font-semibold tracking-wide text-sand-300 uppercase">Төленетін сома</p>
        <p className="mt-1.5 text-[32px] font-bold text-sand-100">
          {payment.currency === 'KZT' ? formatTenge(payment.amount) : `${payment.amount} ${payment.currency}`}
        </p>
        {dormitoryName && <p className="mt-0.5 text-sm text-sand-300">{dormitoryName}</p>}
      </Card>

      <Card>
        <p className="mb-3 text-[15px] font-bold text-sand-100">Қалай төлеу керек</p>
        <div className="flex flex-col gap-3">
          {[
            <>
              Төлемді <strong className="text-sand-100">бухгалтерияға (212-кабинет)</strong> апарып төле
            </>,
            <>
              Чекті <strong className="text-sand-100">315-кабинетке</strong> әкеліп бер
            </>,
            'Растауды осы жерден күт — хабарлама келеді',
          ].map((text, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-sand-200">
                {i + 1}
              </span>
              <p className="text-sm text-sand-200">{text}</p>
            </div>
          ))}
        </div>
      </Card>

      {payment.status === 'submitted' && (
        <div className="flex items-center gap-3 rounded-2xl bg-mint-500/10 px-4 py-3.5">
          <Clock className="h-5 w-5 shrink-0 text-mint-400" />
          <p className="text-sm font-semibold text-mint-400">Төлеміңіз расталуын күтуде</p>
        </div>
      )}

      {payment.status === 'awaiting_manager_decision' && (
        <Alert
          variant="warning"
          message="Төлемнің мерзімі өтті, менеджердің шешімі күтілуде. Тезірек бухгалтерияға хабарласыңыз."
        />
      )}

      {payment.status === 'confirmed' && <Alert variant="success" message="Төлеміңіз расталды." />}

      {payment.status === 'rejected' && (
        <>
          <Alert variant="error" message={REJECTION_REASON} />
          <Card>
            <p className="mb-3 text-[15px] font-bold text-sand-100">Чекті қайта жүктеу</p>
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              {submitError && <Alert variant="error" message={submitError} />}
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-navy-700 bg-navy-950 p-4">
                <input
                  type="file"
                  required
                  className="hidden"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-sm font-semibold text-sand-100">
                  {receiptFile ? receiptFile.name : 'Чек файлын таңдау'}
                </p>
              </label>
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
