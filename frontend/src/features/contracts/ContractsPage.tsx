import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check } from 'lucide-react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContractStatusBadge } from '../../components/ContractStatusBadge'
import { extractErrorMessage } from '../../api/client'
import { listMyContracts, respondContract } from '../../api/contractApi'
import { getApplication } from '../../api/applicationApi'
import { getDormitory } from '../../api/dormitoryApi'
import { formatTenge } from '../../utils/dormitoryLabels'
import { formatTimeRemaining } from './deadline'
import { useIsSettled } from '../residence/useIsSettled'
import type { Contract } from '../../types/contracts'
import type { Dormitory } from '../../types/dormitories'

type PendingAction = { contractId: string; action: 'accept' | 'decline' } | null

export function ContractsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Contract.status stays 'accepted' forever, even after the student later
  // exits the room (an exit request only touches room_residents, not the
  // contract) — so the "you're settled, here's how to pay" block must also
  // check the student's live residence, not just the contract's status.
  const isSettled = useIsSettled()
  const [contracts, setContracts] = useState<Contract[] | null>(null)
  const [dormitoryByContract, setDormitoryByContract] = useState<Record<string, Dormitory>>({})
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())

  function load() {
    listMyContracts()
      .then(async (list) => {
        setContracts(list)
        const entries = await Promise.all(
          list.map(async (c) => {
            const app = await getApplication(c.application_id).catch(() => null)
            if (!app) return null
            const dormitory = await getDormitory(app.dormitory_id).catch(() => null)
            return dormitory ? ([c.id, dormitory] as const) : null
          }),
        )
        setDormitoryByContract(Object.fromEntries(entries.filter((e): e is [string, Dormitory] => e !== null)))
      })
      .catch((err) => setError(extractErrorMessage(err, t('contracts.loadError'))))
  }

  useEffect(load, [t])

  async function handleConfirm() {
    if (!pendingAction) return
    setActionError(null)
    setIsSubmitting(true)
    try {
      await respondContract(pendingAction.contractId, pendingAction.action)
      setPendingAction(null)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, t('contracts.actionFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-[23px] font-bold text-sand-100">{t('nav.contract')}</h1>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}
      {!error && !contracts && <p className="text-sm text-sand-300">{t('contracts.loading')}</p>}
      {contracts && contracts.length === 0 && <p className="text-sm text-sand-300">{t('contracts.empty')}</p>}

      <div className="flex flex-col gap-3.5">
        {contracts?.map((contract) => {
          const dormitory = dormitoryByContract[contract.id]
          return (
            <Card key={contract.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-sand-100">
                    {dormitory?.name ?? t('contracts.contractFallback')}
                  </p>
                  {contract.status === 'sent' && (
                    <p className="mt-0.5 text-sm font-semibold text-clay-400">
                      {t('contracts.respondBy', { time: formatTimeRemaining(contract.response_deadline, t) })}
                    </p>
                  )}
                </div>
                <ContractStatusBadge status={contract.status} />
              </div>

              {dormitory && (dormitory.monthly_payment != null || dormitory.yearly_payment != null) && (
                <div className="mt-3.5 flex flex-col gap-1.5 rounded-2xl border border-navy-700 bg-navy-950 p-3.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-sand-300">{t('dorm.monthlyPayment')}</span>
                    <span className="font-semibold text-sand-100">{formatTenge(dormitory.monthly_payment)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-sand-300">{t('dorm.yearlyPayment')}</span>
                    <span className="font-semibold text-sand-100">{formatTenge(dormitory.yearly_payment)}</span>
                  </div>
                </div>
              )}

              {contract.status === 'sent' && (
                <div className="mt-3.5 flex flex-wrap gap-2.5">
                  {contract.file_url && (
                    <a href={contract.file_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="secondary" className="w-full min-w-35">
                        {t('contracts.openPdf')}
                      </Button>
                    </a>
                  )}
                  {acknowledged.has(contract.id) ? (
                    <>
                      <Button
                        className="flex-1 min-w-35"
                        onClick={() => setPendingAction({ contractId: contract.id, action: 'accept' })}
                      >
                        {t('contracts.accept')}
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1 min-w-35"
                        onClick={() => setPendingAction({ contractId: contract.id, action: 'decline' })}
                      >
                        {t('contracts.decline')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="flex-1 min-w-35"
                      onClick={() => setAcknowledged((prev) => new Set(prev).add(contract.id))}
                    >
                      {t('contracts.acknowledgeAccept')}
                    </Button>
                  )}
                </div>
              )}

              {contract.status === 'awaiting_manager_decision' && (
                <p className="mt-3.5 text-sm text-sand-200">{t('contracts.awaitingManagerText')}</p>
              )}

              {contract.status === 'accepted' && isSettled && (
                <div className="mt-3.5 flex flex-col gap-2.5 rounded-2xl bg-mint-500/10 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 shrink-0 text-mint-400" />
                    <p className="flex-1 text-sm font-semibold text-mint-400">{t('contracts.settledText')}</p>
                    <Button variant="secondary" onClick={() => navigate('/my-residence')}>
                      {t('contracts.goToResidence')}
                    </Button>
                  </div>
                  <p className="text-sm text-sand-200">{t('contracts.paymentInfoHint')}</p>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {contracts && contracts.some((c) => c.status === 'sent') && (
        <Card className="flex !flex-row items-center gap-3">
          <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-navy-800">
            <AlertCircle className="h-4.5 w-4.5 text-sand-200" />
          </span>
          <p className="text-sm text-sand-200">{t('contracts.footerHint')}</p>
        </Card>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.action === 'accept' ? t('contracts.acceptTitle') : t('contracts.declineTitle')}
        message={pendingAction?.action === 'accept' ? t('contracts.acceptConfirm') : t('contracts.declineConfirm')}
        danger={pendingAction?.action === 'decline'}
        isLoading={isSubmitting}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}
