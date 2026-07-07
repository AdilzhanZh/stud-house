import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContractStatusBadge } from '../../components/ContractStatusBadge'
import { extractErrorMessage } from '../../api/client'
import { listMyContracts, respondContract } from '../../api/contractApi'
import { formatTimeRemaining } from './deadline'
import type { Contract } from '../../types/contracts'

type PendingAction = { contractId: string; action: 'accept' | 'decline' } | null

export function ContractsPage() {
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<Contract[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function load() {
    listMyContracts()
      .then(setContracts)
      .catch((err) => setError(extractErrorMessage(err, 'Келісімшарттарды жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [])

  async function handleConfirm() {
    if (!pendingAction) return
    setActionError(null)
    setIsSubmitting(true)
    try {
      await respondContract(pendingAction.contractId, pendingAction.action)
      setPendingAction(null)
      load()
      if (pendingAction.action === 'accept') {
        navigate(`/contracts/${pendingAction.contractId}/payment`)
      }
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Келісімшарттарым</h1>

      {error && <Alert variant="error" message={error} />}
      {!error && !contracts && <p className="text-sm text-gray-500">Жүктелуде...</p>}
      {contracts && contracts.length === 0 && (
        <p className="text-sm text-gray-500">Сізде әлі келісімшарт жоқ.</p>
      )}

      <div className="flex flex-col gap-3">
        {contracts?.map((contract) => (
          <Card key={contract.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">Келісімшарт</p>
                {contract.status === 'sent' && (
                  <p className="text-sm text-gray-500">
                    {formatTimeRemaining(contract.response_deadline)}
                  </p>
                )}
              </div>
              <ContractStatusBadge status={contract.status} />
            </div>

            {contract.status === 'sent' && (
              <div className="mt-4 flex gap-3">
                <Button
                  onClick={() => setPendingAction({ contractId: contract.id, action: 'accept' })}
                >
                  Қабылдау
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setPendingAction({ contractId: contract.id, action: 'decline' })}
                >
                  Бас тарту
                </Button>
              </div>
            )}

            {contract.status === 'awaiting_manager_decision' && (
              <p className="mt-3 text-sm text-orange-700">
                Мерзім өтті, менеджердің шешімін күтіңіз.
              </p>
            )}

            {contract.status === 'accepted' && (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => navigate(`/contracts/${contract.id}/payment`)}
              >
                Төлемге өту
              </Button>
            )}
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.action === 'accept' ? 'Келісімшартты қабылдау' : 'Келісімшарттан бас тарту'}
        message={
          pendingAction?.action === 'accept'
            ? 'Қабылдағаннан кейін бұл шешімді өзгерте алмайсыз. Жалғастырасыз ба?'
            : 'Бас тартқаннан кейін бұл шешімді өзгерте алмайсыз. Жалғастырасыз ба?'
        }
        danger={pendingAction?.action === 'decline'}
        isLoading={isSubmitting}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
      {actionError && <Alert variant="error" message={actionError} />}
    </div>
  )
}
