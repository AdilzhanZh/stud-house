import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Select } from '../../components/Select'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { extractErrorMessage } from '../../api/client'
import { useAuth } from '../auth/useAuth'
import { getMyResidence } from '../../api/residenceApi'
import { getDormitory, listDormitories } from '../../api/dormitoryApi'
import { createExitRequest, listMyExitRequests } from '../../api/exitRequestApi'
import { createTransferRequest, listMyTransferRequests } from '../../api/transferRequestApi'
import type { Residence } from '../../types/residence'
import type { Dormitory } from '../../types/dormitories'
import type { ExitRequest } from '../../types/exitRequests'
import type { TransferRequest } from '../../types/transferRequests'

const exitStatusLabels: Record<ExitRequest['status'], string> = {
  pending: 'Қаралуда',
  approved: 'Мақұлданды',
  rejected: 'Қабылданбады',
}

const transferStatusLabels: Record<TransferRequest['status'], string> = {
  pending: 'Қаралуда',
  approved: 'Мақұлданды',
  rejected: 'Қабылданбады',
}

export function MyResidencePage() {
  const { user } = useAuth()

  const [residence, setResidence] = useState<Residence | null>(null)
  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [dormitories, setDormitories] = useState<Dormitory[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [latestExit, setLatestExit] = useState<ExitRequest | null>(null)
  const [latestTransfer, setLatestTransfer] = useState<TransferRequest | null>(null)

  const [exitReason, setExitReason] = useState('')
  const [exitError, setExitError] = useState<string | null>(null)
  const [exitSubmitting, setExitSubmitting] = useState(false)
  const [confirmExitOpen, setConfirmExitOpen] = useState(false)

  const [transferDormitoryId, setTransferDormitoryId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferSubmitting, setTransferSubmitting] = useState(false)
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false)

  function load() {
    if (!user) return
    Promise.all([
      getMyResidence(user.id),
      listDormitories(),
      listMyExitRequests(),
      listMyTransferRequests(),
    ])
      .then(async ([res, allDormitories, exitRequests, transferRequests]) => {
        setResidence(res)
        setDormitories(allDormitories)
        setDormitory(await getDormitory(res.dormitory_id))
        setLatestExit(exitRequests[0] ?? null)
        setLatestTransfer(transferRequests[0] ?? null)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [user])

  async function handleExitConfirm() {
    setExitError(null)
    setExitSubmitting(true)
    try {
      const created = await createExitRequest(exitReason.trim() || null)
      setLatestExit(created)
      setExitReason('')
      setConfirmExitOpen(false)
    } catch (err) {
      setExitError(extractErrorMessage(err, 'Шығу өтінішін жіберу сәтсіз аяқталды'))
    } finally {
      setExitSubmitting(false)
    }
  }

  async function handleTransferConfirm() {
    setTransferError(null)
    setTransferSubmitting(true)
    try {
      const created = await createTransferRequest({
        requested_dormitory_id: transferDormitoryId || null,
        requested_room_id: null,
        reason: transferReason.trim() || null,
      })
      setLatestTransfer(created)
      setTransferDormitoryId('')
      setTransferReason('')
      setConfirmTransferOpen(false)
    } catch (err) {
      setTransferError(extractErrorMessage(err, 'Ауыстыру сұрауын жіберу сәтсіз аяқталды'))
    } finally {
      setTransferSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!residence || !dormitory) return <p className="text-sm text-sand-300/60">Жүктелуде...</p>

  const hasPendingRequest = latestExit?.status === 'pending' || latestTransfer?.status === 'pending'

  return (
    <div className="flex flex-col gap-6">
      <Card title="Қазіргі орналасуым">
        <p className="text-sm text-sand-100">{dormitory.name}</p>
        <p className="text-sm text-sand-300/60">{dormitory.address}</p>
        <p className="mt-2 text-sm text-sand-200">Бөлме: {residence.room_number}</p>
      </Card>

      {latestExit && (
        <Alert
          variant={latestExit.status === 'rejected' ? 'error' : 'success'}
          message={`Соңғы шығу өтінішіңіз: ${exitStatusLabels[latestExit.status]}${
            latestExit.status === 'rejected' && latestExit.comment ? ` — ${latestExit.comment}` : ''
          }`}
        />
      )}
      {latestTransfer && (
        <Alert
          variant={latestTransfer.status === 'rejected' ? 'error' : 'success'}
          message={`Соңғы ауыстыру сұрауыңыз: ${transferStatusLabels[latestTransfer.status]}${
            latestTransfer.status === 'rejected' && latestTransfer.comment
              ? ` — ${latestTransfer.comment}`
              : ''
          }`}
        />
      )}

      {hasPendingRequest && (
        <Alert variant="success" message="Сұранысыңыз қаралуда. Жаңа сұраныс беру үшін алдымен ағымдағысы шешілуі керек." />
      )}

      {!hasPendingRequest && (
        <>
          <Card title="Шығу өтінішін беру">
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                setConfirmExitOpen(true)
              }}
            >
              {exitError && <Alert variant="error" message={exitError} />}
              <div className="flex flex-col gap-1">
                <label htmlFor="exit-reason" className="text-sm font-medium text-sand-200">
                  Себебі
                </label>
                <textarea
                  id="exit-reason"
                  rows={3}
                  className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                />
              </div>
              <Button type="submit" className="self-start">
                Шығу өтінішін беру
              </Button>
            </form>
          </Card>

          <Card title="Ауыстыру сұрауы">
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                setConfirmTransferOpen(true)
              }}
            >
              {transferError && <Alert variant="error" message={transferError} />}
              <Select
                label="Жаңа жатақхана"
                value={transferDormitoryId}
                onChange={(e) => setTransferDormitoryId(e.target.value)}
              >
                <option value="">Таңдалмаған</option>
                {dormitories.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <div className="flex flex-col gap-1">
                <label htmlFor="transfer-reason" className="text-sm font-medium text-sand-200">
                  Себебі
                </label>
                <textarea
                  id="transfer-reason"
                  rows={3}
                  className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                />
              </div>
              <Button type="submit" className="self-start">
                Ауыстыру сұрауын беру
              </Button>
            </form>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmExitOpen}
        title="Шығу өтінішін растау"
        message="Шығу өтінішін жібергеннен кейін бұл процесті бастайсыз. Жалғастырасыз ба?"
        isLoading={exitSubmitting}
        onConfirm={handleExitConfirm}
        onCancel={() => setConfirmExitOpen(false)}
      />
      <ConfirmDialog
        open={confirmTransferOpen}
        title="Ауыстыру сұрауын растау"
        message="Ауыстыру сұрауын жібергеннен кейін бұл процесті бастайсыз. Жалғастырасыз ба?"
        isLoading={transferSubmitting}
        onConfirm={handleTransferConfirm}
        onCancel={() => setConfirmTransferOpen(false)}
      />
    </div>
  )
}
