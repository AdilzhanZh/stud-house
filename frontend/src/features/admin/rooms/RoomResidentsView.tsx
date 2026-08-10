import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Select } from '../../../components/Select'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { extractErrorMessage } from '../../../api/client'
import {
  addResident,
  getRoom,
  listRoomResidents,
  listRoomsByDormitory,
  moveOutResident,
  transferResident,
} from '../../../api/roomApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import { listApplications } from '../../../api/applicationAdminApi'
import { formatDate } from '../../../utils/dateFormat'
import type { Room, RoomResident } from '../../../types/rooms'
import type { Application } from '../../../types/applications'
import type { Dormitory } from '../../../types/dormitories'

export function RoomResidentsView() {
  const { t } = useTranslation()
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()

  const [room, setRoom] = useState<Room | null>(null)
  const [residents, setResidents] = useState<RoomResident[] | null>(null)
  const [namesById, setNamesById] = useState<Record<string, string>>({})
  const [settledApplications, setSettledApplications] = useState<Application[]>([])
  const [dormitories, setDormitories] = useState<Dormitory[]>([])
  const [error, setError] = useState<string | null>(null)

  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)

  const [releaseTarget, setReleaseTarget] = useState<RoomResident | null>(null)
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [isReleasing, setIsReleasing] = useState(false)

  const [transferTarget, setTransferTarget] = useState<RoomResident | null>(null)
  const [transferDormitoryId, setTransferDormitoryId] = useState('')
  const [transferRoomId, setTransferRoomId] = useState('')
  const [roomsForTransfer, setRoomsForTransfer] = useState<Room[]>([])
  const [transferError, setTransferError] = useState<string | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)

  function load() {
    if (!roomId) return
    Promise.all([
      getRoom(roomId),
      listRoomResidents(roomId),
      listUsers('student'),
      listApplications('settled'),
      listDormitories(),
    ])
      .then(([r, residentList, students, settled, dormitoryList]) => {
        setRoom(r)
        setResidents(residentList)
        setNamesById(Object.fromEntries(students.map((s) => [s.id, s.full_name])))
        setSettledApplications(settled.filter((a) => a.dormitory_id === r.dormitory_id))
        setDormitories(dormitoryList)
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  useEffect(load, [roomId])

  useEffect(() => {
    if (!transferDormitoryId) {
      setRoomsForTransfer([])
      return
    }
    listRoomsByDormitory(transferDormitoryId).then(setRoomsForTransfer).catch(() => setRoomsForTransfer([]))
  }, [transferDormitoryId])

  async function handleAssign() {
    if (!roomId || !selectedStudentId) return
    setAssignError(null)
    setIsAssigning(true)
    try {
      await addResident(roomId, selectedStudentId)
      setSelectedStudentId('')
      load()
    } catch (err) {
      setAssignError(extractErrorMessage(err, t('admin.rooms.addResidentFailed')))
    } finally {
      setIsAssigning(false)
    }
  }

  function openTransfer(r: RoomResident) {
    setTransferTarget(r)
    setTransferDormitoryId(room?.dormitory_id ?? '')
    setTransferRoomId('')
    setTransferError(null)
  }

  async function handleRelease() {
    if (!releaseTarget) return
    setReleaseError(null)
    setIsReleasing(true)
    try {
      await moveOutResident(releaseTarget.id)
      setReleaseTarget(null)
      load()
    } catch (err) {
      setReleaseError(extractErrorMessage(err, t('admin.rooms.releaseFailed')))
    } finally {
      setIsReleasing(false)
    }
  }

  async function handleTransfer() {
    if (!transferTarget || !transferRoomId) return
    setTransferError(null)
    setIsTransferring(true)
    try {
      await transferResident(transferTarget.id, transferRoomId)
      setTransferTarget(null)
      load()
    } catch (err) {
      setTransferError(extractErrorMessage(err, t('admin.rooms.transferFailed')))
    } finally {
      setIsTransferring(false)
    }
  }

  if (error) return <Alert variant="error" message={error} />
  if (!room || !residents) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  const residentStudentIds = new Set(residents.map((r) => r.student_id))
  const eligibleApplications = settledApplications.filter(
    (a) => !residentStudentIds.has(a.student_id),
  )

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => navigate(`/admin/dormitories/${room.dormitory_id}`)}
      >
        ← {t('admin.common.back')}
      </Button>

      <Card title={t('admin.rooms.residentsTitle', { room: room.room_number })}>
        {releaseError && <Alert variant="error" message={releaseError} />}
        {transferError && <Alert variant="error" message={transferError} />}
        {residents.length === 0 && <p className="text-sm text-sand-300">{t('admin.rooms.noResidents')}</p>}
        <ul className="flex flex-col gap-3">
          {residents.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 border-b border-navy-800 pb-3 last:border-none last:pb-0">
              <div className="flex items-center justify-between text-sm">
                <span className="text-sand-100">{namesById[r.student_id] ?? r.student_id}</span>
                <span className="text-sand-300">{formatDate(r.moved_in_at)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  className="text-sm font-semibold text-turquoise-400 hover:text-turquoise-300"
                  onClick={() => openTransfer(r)}
                >
                  {t('admin.rooms.transfer')}
                </button>
                <button
                  className="text-sm font-semibold text-clay-400 hover:text-clay-300"
                  onClick={() => setReleaseTarget(r)}
                >
                  {t('admin.rooms.release')}
                </button>
              </div>

              {transferTarget?.id === r.id && (
                <div className="mt-1 flex flex-col gap-3 rounded-[14px] bg-navy-950/40 p-3">
                  <p className="text-sm font-medium text-sand-100">
                    {t('admin.rooms.transferTitle', { name: namesById[r.student_id] ?? r.student_id })}
                  </p>
                  <Select
                    label={t('admin.layout.dormitories')}
                    value={transferDormitoryId}
                    onChange={(e) => {
                      setTransferDormitoryId(e.target.value)
                      setTransferRoomId('')
                    }}
                  >
                    <option value="">{t('admin.common.select')}</option>
                    {dormitories.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label={t('admin.dormitories.roomNumber')}
                    value={transferRoomId}
                    onChange={(e) => setTransferRoomId(e.target.value)}
                    disabled={!transferDormitoryId}
                  >
                    <option value="">{t('admin.common.select')}</option>
                    {roomsForTransfer
                      .filter((candidate) => candidate.id !== room.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.room_number} ({t('admin.requests.bedsCount', { count: candidate.capacity })})
                        </option>
                      ))}
                  </Select>
                  <div className="flex gap-3">
                    <Button onClick={handleTransfer} isLoading={isTransferring} disabled={!transferRoomId}>
                      {t('common.confirm')}
                    </Button>
                    <Button variant="secondary" onClick={() => setTransferTarget(null)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t('admin.rooms.addResident')}>
        {assignError && <Alert variant="error" message={assignError} />}
        {eligibleApplications.length === 0 ? (
          <p className="text-sm text-sand-300">{t('admin.rooms.noEligibleStudents')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Select
              label={t('admin.applications.student')}
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">{t('admin.common.select')}</option>
              {eligibleApplications.map((a) => (
                <option key={a.id} value={a.student_id}>
                  {namesById[a.student_id] ?? a.student_id}
                  {a.preferred_room_id === room.id ? ` ${t('admin.rooms.preferredThisRoom')}` : ''}
                </option>
              ))}
            </Select>
            <Button
              onClick={handleAssign}
              isLoading={isAssigning}
              disabled={!selectedStudentId}
              className="self-start"
            >
              {t('admin.common.add')}
            </Button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={releaseTarget != null}
        title={t('admin.rooms.releaseConfirmTitle')}
        message={t('admin.rooms.releaseConfirmMessage', {
          name: releaseTarget ? namesById[releaseTarget.student_id] ?? releaseTarget.student_id : '',
        })}
        danger
        isLoading={isReleasing}
        onConfirm={handleRelease}
        onCancel={() => setReleaseTarget(null)}
      />
    </div>
  )
}
