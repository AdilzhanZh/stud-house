import { useEffect, useState } from 'react'
import { Card } from '../../../components/Card'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { decideTransferRequest, listTransferRequests } from '../../../api/transferRequestAdminApi'
import { listUsers } from '../../../api/adminUserApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { getRoom, listRoomsByDormitory } from '../../../api/roomApi'
import type { TransferRequest } from '../../../types/transferRequests'
import type { Dormitory } from '../../../types/dormitories'
import type { Room } from '../../../types/rooms'

interface Row extends TransferRequest {
  studentName: string
  currentRoomLabel: string
  requestedDormitoryName: string | null
  requestedRoomLabel: string | null
}

export function TransferRequestListPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [dormitories, setDormitories] = useState<Dormitory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  const [approveTarget, setApproveTarget] = useState<string | null>(null)
  const [approveDormitoryId, setApproveDormitoryId] = useState('')
  const [approveRoomId, setApproveRoomId] = useState('')
  const [roomsForDormitory, setRoomsForDormitory] = useState<Room[]>([])

  function load() {
    setRows(null)
    Promise.all([listTransferRequests('pending'), listUsers('student'), listDormitories()])
      .then(async ([requests, students, dormitoryList]) => {
        setDormitories(dormitoryList)
        const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))
        const dormitoryNamesById = Object.fromEntries(dormitoryList.map((d) => [d.id, d.name]))
        const withDetails = await Promise.all(
          requests.map(async (r) => {
            const currentRoom = await getRoom(r.current_room_id).catch(() => null)
            const requestedRoom = r.requested_room_id
              ? await getRoom(r.requested_room_id).catch(() => null)
              : null
            return {
              ...r,
              studentName: namesById[r.student_id] ?? r.student_id,
              currentRoomLabel: currentRoom
                ? `${dormitoryNamesById[currentRoom.dormitory_id] ?? ''} — ${currentRoom.room_number}`
                : r.current_room_id,
              requestedDormitoryName: r.requested_dormitory_id
                ? (dormitoryNamesById[r.requested_dormitory_id] ?? r.requested_dormitory_id)
                : null,
              requestedRoomLabel: requestedRoom?.room_number ?? null,
            }
          }),
        )
        setRows(withDetails)
      })
      .catch((err) => setError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [])

  function openApprove(r: Row) {
    setApproveTarget(r.id)
    setApproveDormitoryId(r.requested_dormitory_id ?? '')
    setApproveRoomId(r.requested_room_id ?? '')
    setRoomsForDormitory([])
  }

  useEffect(() => {
    if (!approveDormitoryId) {
      setRoomsForDormitory([])
      return
    }
    listRoomsByDormitory(approveDormitoryId).then(setRoomsForDormitory).catch(() => setRoomsForDormitory([]))
  }, [approveDormitoryId])

  async function handleApprove() {
    if (!approveTarget || !approveRoomId) return
    setActionError(null)
    setSubmittingId(approveTarget)
    try {
      await decideTransferRequest(approveTarget, { action: 'approve', room_id: approveRoomId })
      setApproveTarget(null)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setSubmittingId(null)
    }
  }

  async function handleReject(id: string) {
    if (!comment.trim()) return
    setActionError(null)
    setSubmittingId(id)
    try {
      await decideTransferRequest(id, { action: 'reject', comment: comment.trim() })
      setRejectTarget(null)
      setComment('')
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[23px] font-bold text-sand-100">Ауыстыру сұраныстары</h1>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}
      {!error && !rows && <p className="text-sm text-sand-300">Жүктелуде...</p>}

      <div className="flex flex-col gap-3">
        {rows?.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sand-100">{r.studentName}</p>
                <p className="text-sm text-sand-300">Қазіргі бөлме: {r.currentRoomLabel}</p>
                {(r.requestedDormitoryName || r.requestedRoomLabel) && (
                  <p className="text-sm text-sand-300">
                    Сұралған: {r.requestedDormitoryName ?? '—'}
                    {r.requestedRoomLabel ? ` — ${r.requestedRoomLabel}` : ''}
                  </p>
                )}
                {r.reason && <p className="text-sm text-sand-300">{r.reason}</p>}
              </div>
              {rejectTarget !== r.id && approveTarget !== r.id && (
                <div className="flex gap-3">
                  <Button onClick={() => openApprove(r)}>Мақұлдау</Button>
                  <Button variant="danger" onClick={() => setRejectTarget(r.id)}>
                    Қабылдамау
                  </Button>
                </div>
              )}
            </div>

            {approveTarget === r.id && (
              <div className="mt-4 flex flex-col gap-3">
                <Select
                  label="Жатақхана"
                  value={approveDormitoryId}
                  onChange={(e) => {
                    setApproveDormitoryId(e.target.value)
                    setApproveRoomId('')
                  }}
                >
                  <option value="">Таңдаңыз</option>
                  {dormitories.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Бөлме"
                  value={approveRoomId}
                  onChange={(e) => setApproveRoomId(e.target.value)}
                  disabled={!approveDormitoryId}
                >
                  <option value="">Таңдаңыз</option>
                  {roomsForDormitory.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number} ({room.capacity} орын)
                    </option>
                  ))}
                </Select>
                <div className="flex gap-3">
                  <Button
                    onClick={handleApprove}
                    isLoading={submittingId === r.id}
                    disabled={!approveRoomId}
                  >
                    Растау
                  </Button>
                  <Button variant="secondary" onClick={() => setApproveTarget(null)}>
                    Бас тарту
                  </Button>
                </div>
              </div>
            )}

            {rejectTarget === r.id && (
              <div className="mt-4 flex flex-col gap-3">
                <textarea
                  rows={3}
                  placeholder="Себебі (міндетті)"
                  className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    onClick={() => handleReject(r.id)}
                    isLoading={submittingId === r.id}
                    disabled={!comment.trim()}
                  >
                    Растау
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRejectTarget(null)
                      setComment('')
                    }}
                  >
                    Бас тарту
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {rows && rows.length === 0 && (
          <p className="text-sm text-sand-300">Қаралатын сұраныс жоқ</p>
        )}
      </div>
    </div>
  )
}
