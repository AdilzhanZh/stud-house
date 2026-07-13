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
import { listRoomResidents } from '../../api/roomApi'
import { createExitRequest, listMyExitRequests } from '../../api/exitRequestApi'
import { createTransferRequest, listMyTransferRequests } from '../../api/transferRequestApi'
import type { Residence } from '../../types/residence'
import type { Dormitory } from '../../types/dormitories'
import type { ExitRequest } from '../../types/exitRequests'
import type { TransferRequest } from '../../types/transferRequests'
import type { RoomResident } from '../../types/rooms'

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
  const [roommates, setRoommates] = useState<RoomResident[]>([])
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
    Promise.all([getMyResidence(user.id), listDormitories(), listMyExitRequests(), listMyTransferRequests()])
      .then(async ([res, allDormitories, exitRequests, transferRequests]) => {
        setResidence(res)
        setDormitories(allDormitories)
        setDormitory(await getDormitory(res.dormitory_id))
        setLatestExit(exitRequests[0] ?? null)
        setLatestTransfer(transferRequests[0] ?? null)
        const residents = await listRoomResidents(res.room_id).catch(() => [])
        setRoommates(residents.filter((r) => r.student_id !== user.id && !r.moved_out_at))
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
  if (!residence || !dormitory) return <p className="text-sm text-sand-300">Жүктелуде...</p>

  const hasPendingRequest = latestExit?.status === 'pending' || latestTransfer?.status === 'pending'

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-[23px] font-bold text-sand-100">Менің орным</h1>

      <Card>
        <div className="flex items-center gap-3.5">
          <span className="flex h-13.5 w-13.5 shrink-0 items-center justify-center rounded-2xl bg-turquoise-500/15 text-lg font-bold text-turquoise-400">
            {residence.room_number}
          </span>
          <div>
            <p className="text-base font-semibold text-sand-100">
              {dormitory.name} · {residence.room_number}-бөлме
            </p>
            <p className="mt-0.5 text-sm text-sand-300">
              {dormitory.address} · {residence.capacity} орындық
            </p>
          </div>
        </div>

        {roommates.length > 0 && (
          <div className="mt-3.5 rounded-2xl border border-navy-700 bg-navy-950 p-3.5">
            <p className="mb-2 text-xs font-semibold tracking-wide text-sand-300 uppercase">Бөлмелестер</p>
            <div className="flex flex-col gap-2">
              {roommates.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2.5 text-sm text-sand-100">
                  <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-sand-200">
                    {i + 1}
                  </span>
                  Бөлмелес — {new Date(r.moved_in_at).toLocaleDateString('kk-KZ')} бастап
                </div>
              ))}
            </div>
          </div>
        )}
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
            latestTransfer.status === 'rejected' && latestTransfer.comment ? ` — ${latestTransfer.comment}` : ''
          }`}
        />
      )}
      {hasPendingRequest && (
        <Alert variant="warning" message="Сұранысыңыз қаралуда. Жаңа сұраныс беру үшін алдымен ағымдағысы шешілуі керек." />
      )}

      {!hasPendingRequest && (
        <div className="flex flex-col gap-3.5 md:grid md:grid-cols-2">
          <Card>
            <p className="text-[15px] font-bold text-sand-100">Ауысу сұрауы</p>
            <p className="mt-1.5 mb-3.5 text-sm text-sand-300">Басқа бөлме немесе жатақханаға ауысқың келсе</p>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                setConfirmTransferOpen(true)
              }}
            >
              {transferError && <Alert variant="error" message={transferError} />}
              <Select label="Жаңа жатақхана" value={transferDormitoryId} onChange={(e) => setTransferDormitoryId(e.target.value)}>
                <option value="">Таңдалмаған</option>
                {dormitories.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <textarea
                rows={2}
                placeholder="Себебі (міндетті емес)"
                className="w-full resize-y rounded-xl border border-navy-700 bg-navy-950 px-3 py-2.5 text-sm text-sand-100 outline-none placeholder:text-sand-400 focus:border-turquoise-400"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
              />
              <Button type="submit" variant="secondary" className="self-start">
                Сұрау жіберу
              </Button>
            </form>
          </Card>

          <Card>
            <p className="text-[15px] font-bold text-sand-100">Шығу өтініші</p>
            <p className="mt-1.5 mb-3.5 text-sm text-sand-300">Жатақханадан біржола шығатын болсаң</p>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                setConfirmExitOpen(true)
              }}
            >
              {exitError && <Alert variant="error" message={exitError} />}
              <textarea
                rows={2}
                placeholder="Себебі (міндетті емес)"
                className="w-full resize-y rounded-xl border border-navy-700 bg-navy-950 px-3 py-2.5 text-sm text-sand-100 outline-none placeholder:text-sand-400 focus:border-turquoise-400"
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value)}
              />
              <Button type="submit" variant="secondary" className="self-start !text-clay-400">
                Өтініш беру
              </Button>
            </form>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmExitOpen}
        title="Шығу өтінішін растау"
        message="Шығу өтінішін жібергеннен кейін бұл процесті бастайсыз. Жалғастырасыз ба?"
        isLoading={exitSubmitting}
        danger
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
