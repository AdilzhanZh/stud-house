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
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())

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
      <h1 className="font-heading text-2xl text-sand-100">Келісімшарттарым</h1>

      {error && <Alert variant="error" message={error} />}
      {!error && !contracts && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}
      {contracts && contracts.length === 0 && (
        <p className="text-sm text-sand-300/60">Сізде әлі келісімшарт жоқ.</p>
      )}

      <div className="flex flex-col gap-3">
        {contracts?.map((contract) => (
          <Card key={contract.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sand-100">Келісімшарт</p>
                {contract.status === 'sent' && (
                  <p className="text-sm text-sand-300/60">
                    {formatTimeRemaining(contract.response_deadline)}
                  </p>
                )}
              </div>
              <ContractStatusBadge status={contract.status} />
            </div>

            {contract.status === 'sent' && (
              <div className="mt-4 flex flex-col gap-3">
                <a
                  href={contract.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start text-sm font-medium text-turquoise-400 underline underline-offset-2 hover:text-turquoise-300"
                >
                  Келісімшартпен танысу
                </a>
                {acknowledged.has(contract.id) ? (
                  <div className="flex gap-3">
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
                ) : (
                  <Button
                    variant="secondary"
                    className="self-start"
                    onClick={() =>
                      setAcknowledged((prev) => new Set(prev).add(contract.id))
                    }
                  >
                    Таныстым
                  </Button>
                )}
              </div>
            )}

            {contract.status === 'awaiting_manager_decision' && (
              <p className="mt-3 text-sm text-sand-200">
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
