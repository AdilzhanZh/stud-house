import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, Calendar, ChevronLeft, DoorOpen, UserPlus, Users } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Select } from '../../../components/Select'
import { Alert } from '../../../components/Alert'
import { Avatar } from '../../../components/Avatar'
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
import { getStudentProfile } from '../../../api/profileApi'
import { listBenefits, listStudentBenefits } from '../../../api/benefitApi'
import { bilingualField } from '../../../utils/bilingualField'
import { formatDate } from '../../../utils/dateFormat'
import type { Room, RoomResident } from '../../../types/rooms'
import type { Application } from '../../../types/applications'
import type { Dormitory } from '../../../types/dormitories'
import type { StudentProfile, User } from '../../../types'

function occupancyBadgeClass(count: number, capacity: number): string {
  if (count >= capacity) return 'bg-clay-500/10 text-clay-400'
  if (count > 0) return 'bg-amber-500/10 text-amber-400'
  return 'bg-mint-500/10 text-mint-400'
}

export function RoomResidentsView() {
  const { t, i18n } = useTranslation()
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()

  const [room, setRoom] = useState<Room | null>(null)
  const [residents, setResidents] = useState<RoomResident[] | null>(null)
  const [students, setStudents] = useState<User[]>([])
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

  const [detailsTarget, setDetailsTarget] = useState<RoomResident | null>(null)
  const [detailsProfile, setDetailsProfile] = useState<StudentProfile | null>(null)
  const [detailsBenefitNames, setDetailsBenefitNames] = useState<string[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  function load() {
    if (!roomId) return
    Promise.all([
      getRoom(roomId),
      listRoomResidents(roomId),
      listUsers('student'),
      listApplications('settled'),
      listDormitories(),
    ])
      .then(([r, residentList, studentList, settled, dormitoryList]) => {
        setRoom(r)
        setResidents(residentList)
        setStudents(studentList)
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

  const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))

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

  function openDetails(r: RoomResident) {
    setDetailsTarget(r)
    setDetailsProfile(null)
    setDetailsBenefitNames([])
    setDetailsLoading(true)
    Promise.all([
      getStudentProfile(r.student_id).catch(() => null),
      listStudentBenefits(r.student_id).catch(() => []),
      listBenefits().catch(() => []),
    ])
      .then(([profile, studentBenefits, benefits]) => {
        setDetailsProfile(profile)
        const namesByBenefitId = Object.fromEntries(
          benefits.map((b) => [b.id, bilingualField(b.name_kk, b.name_ru, i18n.language)]),
        )
        setDetailsBenefitNames(studentBenefits.map((sb) => namesByBenefitId[sb.benefit_id] ?? sb.benefit_id))
      })
      .finally(() => setDetailsLoading(false))
  }

  if (error) return <Alert variant="error" message={error} />
  if (!room || !residents) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  const residentStudentIds = new Set(residents.map((r) => r.student_id))
  const eligibleApplications = settledApplications.filter(
    (a) => !residentStudentIds.has(a.student_id),
  )

  const detailsUser = detailsTarget ? students.find((s) => s.id === detailsTarget.student_id) : null
  const degreeLabels: Record<NonNullable<StudentProfile['academic_degree']>, string> = {
    bachelor: t('auth.bachelor'),
    master: t('auth.master'),
    doctorate: t('auth.doctorate'),
  }
  const genderLabels: Record<NonNullable<StudentProfile['gender']>, string> = {
    male: t('auth.male'),
    female: t('auth.female'),
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate(`/admin/dormitories/${room.dormitory_id}`)}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> {t('admin.common.back')}
      </button>

      <Card className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-turquoise-500/10">
            <Users className="h-5 w-5 text-turquoise-400" />
          </span>
          <div>
            <h1 className="text-[19px] font-bold text-sand-100">
              {t('admin.rooms.residentsTitle', { room: room.room_number })}
            </h1>
            {room.floor != null && (
              <p className="text-sm text-sand-300">{t('admin.dormitories.floorLabel', { floor: room.floor })}</p>
            )}
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-sm font-bold ${occupancyBadgeClass(
            residents.length,
            room.capacity,
          )}`}
        >
          {residents.length}/{room.capacity}
        </span>
      </Card>

      <Card>
        {releaseError && <Alert variant="error" message={releaseError} />}
        {transferError && <Alert variant="error" message={transferError} />}
        {residents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-800">
              <Users className="h-5 w-5 text-sand-400" />
            </span>
            <p className="text-sm text-sand-300">{t('admin.rooms.noResidents')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {residents.map((r) => (
              <li key={r.id} className="rounded-2xl bg-navy-950/40 transition-colors hover:bg-navy-950/70">
                <div
                  className="flex cursor-pointer items-center gap-3 p-3"
                  onClick={() => openDetails(r)}
                >
                  <Avatar fullName={namesById[r.student_id] ?? r.student_id} sizeClass="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-sand-100">
                      {namesById[r.student_id] ?? r.student_id}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-sand-300">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {formatDate(r.moved_in_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      aria-label={t('admin.rooms.transfer')}
                      title={t('admin.rooms.transfer')}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-turquoise-400 transition-colors hover:bg-turquoise-500/10"
                      onClick={() => openTransfer(r)}
                    >
                      <ArrowLeftRight className="h-4.5 w-4.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('admin.rooms.release')}
                      title={t('admin.rooms.release')}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-clay-400 transition-colors hover:bg-clay-500/10"
                      onClick={() => setReleaseTarget(r)}
                    >
                      <DoorOpen className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>

                {transferTarget?.id === r.id && (
                  <div className="mx-3 mb-3 flex flex-col gap-3 rounded-[14px] bg-navy-950/60 p-3">
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
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-800">
            <UserPlus className="h-4.5 w-4.5 text-turquoise-400" />
          </span>
          <p className="text-[15px] font-bold text-sand-100">{t('admin.rooms.addResident')}</p>
        </div>
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

      {detailsTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailsTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-navy-900 p-6 shadow-[var(--shadow-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Avatar
                fullName={namesById[detailsTarget.student_id] ?? detailsTarget.student_id}
                avatarUrl={detailsUser?.avatar_url}
                sizeClass="h-12 w-12"
                textClass="text-base"
              />
              <div className="min-w-0">
                <h2 className="truncate font-heading text-lg text-sand-100">
                  {namesById[detailsTarget.student_id] ?? detailsTarget.student_id}
                </h2>
                {detailsProfile?.academic_degree && (
                  <p className="text-xs text-sand-300">
                    {degreeLabels[detailsProfile.academic_degree]}
                    {detailsProfile.course != null && ` · ${t('profile.course', { course: detailsProfile.course })}`}
                  </p>
                )}
              </div>
            </div>

            {detailsLoading ? (
              <p className="mt-4 text-sm text-sand-300">{t('admin.common.loading')}</p>
            ) : (
              <dl className="mt-4 flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-sand-300">Email</dt>
                  <dd className="text-right text-sand-100">{detailsUser?.email ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sand-300">{t('admin.applications.phone')}</dt>
                  <dd className="text-right text-sand-100">{detailsUser?.phone || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sand-300">{t('admin.applications.iin')}</dt>
                  <dd className="text-right text-sand-100">{detailsUser?.iin || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sand-300">{t('profile.gender')}</dt>
                  <dd className="text-right text-sand-100">
                    {detailsProfile?.gender ? genderLabels[detailsProfile.gender] : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sand-300">{t('admin.applications.benefit')}</dt>
                  <dd className="text-right text-sand-100">
                    {detailsBenefitNames.length > 0 ? detailsBenefitNames.join(', ') : t('admin.applications.none')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sand-300">{t('admin.residents.movedInAt')}</dt>
                  <dd className="text-right text-sand-100">{formatDate(detailsTarget.moved_in_at)}</dd>
                </div>
              </dl>
            )}

            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={() => setDetailsTarget(null)}>
                {t('admin.common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
