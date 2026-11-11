import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftRight,
  BedSingle,
  Calendar,
  Check,
  ChevronLeft,
  DoorOpen,
  History,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Select } from '../../../components/Select'
import { Input } from '../../../components/Input'
import { Alert } from '../../../components/Alert'
import { Avatar } from '../../../components/Avatar'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { BedStatusBadge } from '../../../components/BedStatusBadge'
import { bedStatusDotClass } from '../../../utils/bedStatus'
import { BedStatusDialog } from './BedStatusDialog'
import { extractErrorMessage } from '../../../api/client'
import {
  addBeds,
  addResident,
  getBedHistory,
  getBedStatusHistory,
  getRoom,
  listBeds,
  listRoomResidents,
  listRoomsByDormitory,
  moveOutResident,
  renameBed,
  retireBed,
  transferResident,
} from '../../../api/roomApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import { changeHeldBed, listApplications } from '../../../api/applicationAdminApi'
import { getStudentProfile } from '../../../api/profileApi'
import { listBenefits, listStudentBenefits } from '../../../api/benefitApi'
import { bilingualField } from '../../../utils/bilingualField'
import { formatDate } from '../../../utils/dateFormat'
import { canManage } from '../../../constants/roles'
import { useAuth } from '../../auth/useAuth'
import { BED_STATUSES, type Bed, type BedHistory, type BedStatusHistory, type Room, type RoomResident } from '../../../types/rooms'
import type { Application } from '../../../types/applications'
import type { Dormitory } from '../../../types/dormitories'
import type { StudentProfile, User } from '../../../types'
import { floorLabel, roomLabel } from '../../../utils/roomLocation'

function occupancyBadgeClass(count: number, capacity: number): string {
  if (count >= capacity) return 'bg-clay-500/10 text-clay-400'
  if (count > 0) return 'bg-amber-500/10 text-amber-400'
  return 'bg-mint-500/10 text-mint-400'
}

export function RoomResidentsView() {
  const { t, i18n } = useTranslation()
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  // Users without the manager position see residents read-only: no
  // placing, transferring or moving out, and no (manager-only) applications.
  const { user } = useAuth()
  const isManager = canManage(user)

  const [room, setRoom] = useState<Room | null>(null)
  const [residents, setResidents] = useState<RoomResident[] | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [showRetiredBeds, setShowRetiredBeds] = useState(false)
  const [students, setStudents] = useState<User[]>([])
  const [settledApplications, setSettledApplications] = useState<Application[]>([])
  const [dormitories, setDormitories] = useState<Dormitory[]>([])
  const [error, setError] = useState<string | null>(null)

  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [assignBedId, setAssignBedId] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)

  const [releaseTarget, setReleaseTarget] = useState<RoomResident | null>(null)
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [isReleasing, setIsReleasing] = useState(false)

  const [transferTarget, setTransferTarget] = useState<RoomResident | null>(null)
  const [transferDormitoryId, setTransferDormitoryId] = useState('')
  const [transferRoomId, setTransferRoomId] = useState('')
  const [transferBedId, setTransferBedId] = useState('')
  const [roomsForTransfer, setRoomsForTransfer] = useState<Room[]>([])
  const [bedsForTransfer, setBedsForTransfer] = useState<Bed[]>([])
  const [transferError, setTransferError] = useState<string | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)

  const [bedError, setBedError] = useState<string | null>(null)
  const [isAddingBed, setIsAddingBed] = useState(false)
  const [retireTarget, setRetireTarget] = useState<Bed | null>(null)
  const [isRetiring, setIsRetiring] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Bed | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<Bed | null>(null)
  const [history, setHistory] = useState<BedHistory | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [statusHistory, setStatusHistory] = useState<BedStatusHistory | null>(null)
  // Names of whoever changed a bed's status (staff), loaded with the history.
  const [staffNames, setStaffNames] = useState<Record<string, string>>({})
  const [statusTarget, setStatusTarget] = useState<Bed | null>(null)
  const [moveTarget, setMoveTarget] = useState<Bed | null>(null)
  const [moveBedId, setMoveBedId] = useState('')
  const [isMoving, setIsMoving] = useState(false)

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
      isManager ? listApplications('settled') : Promise.resolve([] as Application[]),
      listDormitories(),
      listBeds(roomId, showRetiredBeds),
    ])
      .then(([r, residentList, studentList, settled, dormitoryList, bedList]) => {
        setRoom(r)
        setResidents(residentList)
        setBeds(bedList)
        setStudents(studentList)
        setSettledApplications(settled.filter((a) => a.dormitory_id === r.dormitory_id))
        setDormitories(dormitoryList)
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  useEffect(load, [roomId, isManager, showRetiredBeds])

  useEffect(() => {
    if (!transferDormitoryId) {
      setRoomsForTransfer([])
      return
    }
    listRoomsByDormitory(transferDormitoryId).then(setRoomsForTransfer).catch(() => setRoomsForTransfer([]))
  }, [transferDormitoryId])

  useEffect(() => {
    if (!transferRoomId) {
      setBedsForTransfer([])
      return
    }
    listBeds(transferRoomId).then(setBedsForTransfer).catch(() => setBedsForTransfer([]))
  }, [transferRoomId])

  const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))

  async function handleAssign() {
    if (!roomId || !selectedStudentId) return
    setAssignError(null)
    setIsAssigning(true)
    try {
      await addResident(roomId, selectedStudentId, assignBedId)
      setSelectedStudentId('')
      setAssignBedId('')
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
    setTransferBedId('')
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
      await transferResident(transferTarget.id, transferRoomId, transferBedId)
      setTransferTarget(null)
      load()
    } catch (err) {
      setTransferError(extractErrorMessage(err, t('admin.rooms.transferFailed')))
    } finally {
      setIsTransferring(false)
    }
  }

  async function handleAddBed() {
    if (!roomId) return
    setBedError(null)
    setIsAddingBed(true)
    try {
      await addBeds(roomId, 1)
      load()
    } catch (err) {
      setBedError(extractErrorMessage(err, t('admin.rooms.addBedFailed')))
    } finally {
      setIsAddingBed(false)
    }
  }

  async function handleRetireBed() {
    if (!retireTarget) return
    setBedError(null)
    setIsRetiring(true)
    try {
      await retireBed(retireTarget.id)
      setRetireTarget(null)
      load()
    } catch (err) {
      setRetireTarget(null)
      setBedError(extractErrorMessage(err, t('admin.rooms.retireBedFailed')))
    } finally {
      setIsRetiring(false)
    }
  }

  function openRename(b: Bed) {
    setRenameTarget(b)
    setRenameValue(b.label)
    setBedError(null)
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return
    setBedError(null)
    setIsRenaming(true)
    try {
      await renameBed(renameTarget.id, renameValue.trim())
      setRenameTarget(null)
      load()
    } catch (err) {
      setBedError(extractErrorMessage(err, t('admin.rooms.renameBedFailed')))
    } finally {
      setIsRenaming(false)
    }
  }

  function openHistory(b: Bed) {
    setHistoryTarget(b)
    setHistory(null)
    setStatusHistory(null)
    setHistoryError(null)
    Promise.all([getBedHistory(b.id), getBedStatusHistory(b.id), listUsers().catch(() => [] as User[])])
      .then(([stays, statuses, users]) => {
        setHistory(stays)
        setStatusHistory(statuses)
        setStaffNames(Object.fromEntries(users.map((u) => [u.id, u.full_name])))
      })
      .catch((err) => setHistoryError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  function openMove(b: Bed) {
    setMoveTarget(b)
    setMoveBedId('')
    setBedError(null)
  }

  async function handleMoveReservation() {
    if (!moveTarget?.held_application_id || !moveBedId) return
    setBedError(null)
    setIsMoving(true)
    try {
      await changeHeldBed(moveTarget.held_application_id, moveBedId)
      setMoveTarget(null)
      load()
    } catch (err) {
      setBedError(extractErrorMessage(err, t('admin.rooms.moveReservationFailed')))
    } finally {
      setIsMoving(false)
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
  // Beds a student can be put on: free ones, plus the bed their own
  // application reserves.
  const placeableBeds = (list: Bed[], studentId: string | undefined) =>
    list.filter(
      (b) => !b.retired_at && (b.status === 'free' || (b.status === 'reserved' && b.held_student_id === studentId)),
    )
  const freeBeds = placeableBeds(beds, selectedStudentId || undefined)
  const freeTransferBeds = placeableBeds(bedsForTransfer, transferTarget?.student_id)
  const activeBeds = beds.filter((b) => !b.retired_at)
  const statusCounts = BED_STATUSES.map((status) => ({
    status,
    count: activeBeds.filter((b) => b.status === status).length,
  })).filter((c) => c.count > 0)
  const today = new Date().toISOString().slice(0, 10)
  const nameOf = (studentId: string) => namesById[studentId] ?? studentId
  const nameOfStaff = (userId: string) => staffNames[userId] ?? null
  function bedSubtitle(b: Bed): string {
    if (b.retired_at) return t('admin.rooms.bedRetired', { date: formatDate(b.retired_at) })
    if (b.student_id) return nameOf(b.student_id)
    if (b.held_student_id) return t('admin.rooms.bedReservedBy', { name: nameOf(b.held_student_id) })
    if (b.status === 'repair' || b.status === 'unavailable') {
      const parts = [b.service_reason ?? '']
      if (b.service_until) {
        parts.push(
          b.service_until < today
            ? t('admin.rooms.bedServiceOverdue', { date: formatDate(b.service_until) })
            : t('admin.rooms.bedServiceUntil', { date: formatDate(b.service_until) }),
        )
      }
      return parts.filter(Boolean).join(' · ')
    }
    return t('admin.rooms.bedFree')
  }
  const serviceLabel = (s: 'in_service' | 'repair' | 'unavailable') =>
    s === 'in_service' ? t('admin.rooms.bedServiceInService') : t(`admin.rooms.bedStatus.${s}`)
  const transferIsSameRoom = transferRoomId === room.id
  const bedName = (b: { label: string }) => t('admin.rooms.bedLabel', { label: b.label })
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
              {t('admin.rooms.residentsTitle', { room: roomLabel(room) })}
            </h1>
            <p className="text-sm text-sand-300">
              {[
                dormitories.find((d) => d.id === room.dormitory_id)?.object_name,
                dormitories.find((d) => d.id === room.dormitory_id)?.name,
                floorLabel({ number: room.floor, name: room.floor_name }, t),
              ]
                .filter(Boolean)
                .join(' → ')}
            </p>
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
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-sand-300">
                      {r.bed_label && (
                        <span className="inline-flex items-center gap-1">
                          <BedSingle className="h-3.5 w-3.5 shrink-0" />
                          {bedName({ label: r.bed_label })}
                          {r.bed_code && <span className="font-mono text-sand-400">· {r.bed_code}</span>}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {formatDate(r.moved_in_at)}
                      </span>
                    </p>
                  </div>
                  {isManager && (
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
                  )}
                </div>

                {transferTarget?.id === r.id && (
                  <div className="mx-3 mb-3 flex flex-col gap-3 rounded-lg bg-navy-950/60 p-3">
                    <p className="text-sm font-medium text-sand-100">
                      {t('admin.rooms.transferTitle', { name: namesById[r.student_id] ?? r.student_id })}
                    </p>
                    <Select
                      label={t('admin.layout.dormitories')}
                      value={transferDormitoryId}
                      onChange={(e) => {
                        setTransferDormitoryId(e.target.value)
                        setTransferRoomId('')
                        setTransferBedId('')
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
                      onChange={(e) => {
                        setTransferRoomId(e.target.value)
                        setTransferBedId('')
                      }}
                      disabled={!transferDormitoryId}
                    >
                      <option value="">{t('admin.common.select')}</option>
                      {roomsForTransfer.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {roomLabel(candidate)} ({t('admin.requests.bedsCount', { count: candidate.capacity })})
                          {candidate.id === room.id ? ` ${t('admin.rooms.thisRoom')}` : ''}
                        </option>
                      ))}
                    </Select>
                    {transferRoomId && (
                      <Select
                        label={t('admin.rooms.bedField')}
                        value={transferBedId}
                        onChange={(e) => setTransferBedId(e.target.value)}
                        error={transferIsSameRoom && !transferBedId ? t('admin.rooms.bedRequiredSameRoom') : undefined}
                      >
                        <option value="">
                          {transferIsSameRoom ? t('admin.common.select') : t('admin.rooms.anyFreeBed')}
                        </option>
                        {freeTransferBeds.map((b) => (
                          <option key={b.id} value={b.id}>
                            {bedName(b)} · {b.code}
                          </option>
                        ))}
                      </Select>
                    )}
                    <div className="flex gap-3">
                      <Button
                        onClick={handleTransfer}
                        isLoading={isTransferring}
                        disabled={!transferRoomId || (transferIsSameRoom && !transferBedId)}
                      >
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
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-800">
              <BedSingle className="h-4.5 w-4.5 text-turquoise-400" />
            </span>
            <p className="text-[15px] font-bold text-sand-100">{t('admin.rooms.bedsTitle')}</p>
          </div>
          {isManager && (
            <Button variant="secondary" onClick={handleAddBed} isLoading={isAddingBed}>
              <Plus className="h-4 w-4" /> {t('admin.rooms.addBed')}
            </Button>
          )}
        </div>
        <p className="mb-3 text-xs text-sand-300">{t('admin.rooms.bedsHint')}</p>
        {statusCounts.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label={t('admin.rooms.bedStatusSummary')}>
            {statusCounts.map(({ status, count }) => (
              <span key={status} className="inline-flex items-center gap-1.5 text-xs text-sand-200">
                <span className={`h-2 w-2 rounded-full ${bedStatusDotClass[status]}`} />
                {t(`admin.rooms.bedStatus.${status}`)}: <span className="font-semibold text-sand-100">{count}</span>
              </span>
            ))}
          </div>
        )}
        {bedError && <Alert variant="error" message={bedError} />}
        <ul className="flex flex-col gap-2">
          {beds.map((b) => (
            <li
              key={b.id}
              className={`flex flex-wrap items-center gap-3 rounded-2xl bg-navy-950/40 p-3 ${b.retired_at ? 'opacity-60' : ''}`}
            >
              {renameTarget?.id === b.id ? (
                <div className="flex min-w-0 flex-1 items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      label={t('admin.rooms.renameBedLabel')}
                      value={renameValue}
                      maxLength={50}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename()
                        if (e.key === 'Escape') setRenameTarget(null)
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={t('common.confirm')}
                    title={t('common.confirm')}
                    disabled={isRenaming || !renameValue.trim()}
                    className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-xl text-mint-400 transition-colors hover:bg-mint-500/10 disabled:opacity-50"
                    onClick={handleRename}
                  >
                    <Check className="h-4.5 w-4.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('common.cancel')}
                    title={t('common.cancel')}
                    className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-xl text-sand-300 transition-colors hover:bg-navy-800"
                    onClick={() => setRenameTarget(null)}
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-sand-100">
                      {bedName(b)}
                      <span className="font-mono text-xs font-normal text-sand-400">{b.code}</span>
                      {!b.retired_at && <BedStatusBadge status={b.status} />}
                    </p>
                    <p
                      className={`mt-0.5 text-xs break-words ${
                        b.service_until && b.service_until < today && !b.retired_at ? 'text-clay-400' : 'text-sand-300'
                      }`}
                    >
                      {bedSubtitle(b)}
                    </p>
                    {moveTarget?.id === b.id && (
                      <div className="mt-2 flex flex-col gap-2">
                        <p className="text-xs font-medium text-sand-100">
                          {t('admin.rooms.moveReservationTitle', {
                            name: b.held_student_id ? nameOf(b.held_student_id) : '',
                          })}
                        </p>
                        {activeBeds.some((x) => x.status === 'free') ? (
                          <div className="flex items-end gap-2">
                            <div className="min-w-0 flex-1">
                              <Select
                                label={t('admin.rooms.bedField')}
                                value={moveBedId}
                                onChange={(e) => setMoveBedId(e.target.value)}
                              >
                                <option value="">{t('admin.common.select')}</option>
                                {activeBeds
                                  .filter((x) => x.status === 'free')
                                  .map((x) => (
                                    <option key={x.id} value={x.id}>
                                      {bedName(x)} · {x.code}
                                    </option>
                                  ))}
                              </Select>
                            </div>
                            <Button onClick={handleMoveReservation} isLoading={isMoving} disabled={!moveBedId}>
                              {t('common.confirm')}
                            </Button>
                            <Button variant="secondary" onClick={() => setMoveTarget(null)}>
                              {t('common.cancel')}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-sand-300">{t('admin.rooms.noOtherFreeBeds')}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={t('admin.rooms.bedHistory')}
                      title={t('admin.rooms.bedHistory')}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-sand-300 transition-colors hover:bg-navy-800"
                      onClick={() => openHistory(b)}
                    >
                      <History className="h-4.5 w-4.5" />
                    </button>
                    {isManager && !b.retired_at && (
                      <>
                        {(b.status === 'free' || b.status === 'repair' || b.status === 'unavailable') && (
                          <button
                            type="button"
                            aria-label={t('admin.rooms.changeBedStatus')}
                            title={t('admin.rooms.changeBedStatus')}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-amber-400 transition-colors hover:bg-amber-500/10"
                            onClick={() => setStatusTarget(b)}
                          >
                            <Wrench className="h-4.5 w-4.5" />
                          </button>
                        )}
                        {b.status === 'reserved' && b.held_application_id && (
                          <button
                            type="button"
                            aria-label={t('admin.rooms.moveReservation')}
                            title={t('admin.rooms.moveReservation')}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-amber-400 transition-colors hover:bg-amber-500/10"
                            onClick={() => openMove(b)}
                          >
                            <ArrowLeftRight className="h-4.5 w-4.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={t('admin.rooms.renameBed')}
                          title={t('admin.rooms.renameBed')}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-turquoise-400 transition-colors hover:bg-turquoise-500/10"
                          onClick={() => openRename(b)}
                        >
                          <Pencil className="h-4.5 w-4.5" />
                        </button>
                        {!b.resident_id && !b.held_application_id && (
                          <button
                            type="button"
                            aria-label={t('admin.rooms.retireBed')}
                            title={t('admin.rooms.retireBed')}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-clay-400 transition-colors hover:bg-clay-500/10"
                            onClick={() => setRetireTarget(b)}
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-sand-300">
          <input
            type="checkbox"
            checked={showRetiredBeds}
            onChange={(e) => setShowRetiredBeds(e.target.checked)}
            className="h-4 w-4 accent-turquoise-500"
          />
          {t('admin.rooms.showRetired')}
        </label>
      </Card>

      {isManager && (
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
              <Select
                label={t('admin.rooms.bedField')}
                value={assignBedId}
                onChange={(e) => setAssignBedId(e.target.value)}
              >
                <option value="">{t('admin.rooms.anyFreeBed')}</option>
                {freeBeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {bedName(b)} · {b.code}
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
      )}

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

      <ConfirmDialog
        open={retireTarget != null}
        title={t('admin.rooms.retireBedConfirmTitle')}
        message={t('admin.rooms.retireBedConfirmMessage', {
          label: retireTarget?.label ?? '',
          code: retireTarget?.code ?? '',
        })}
        danger
        isLoading={isRetiring}
        onConfirm={handleRetireBed}
        onCancel={() => setRetireTarget(null)}
      />

      {historyTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setHistoryTarget(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-[20px] bg-navy-900 p-6 shadow-[var(--shadow-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-lg text-sand-100">
              {t('admin.rooms.bedHistoryTitle', { label: historyTarget.label, code: historyTarget.code })}
            </h2>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {historyError ? (
                <Alert variant="error" message={historyError} />
              ) : !history || !statusHistory ? (
                <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>
              ) : (
                <div className="flex flex-col gap-4">
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sand-400">
                    {t('admin.rooms.bedHistoryStays')}
                  </p>
                  {history.stays.length === 0 ? (
                    <p className="text-sm text-sand-300">{t('admin.rooms.bedHistoryEmpty')}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {history.stays.map((stay) => (
                        <li key={stay.id} className="flex items-center gap-3 rounded-2xl bg-navy-950/40 p-3">
                          <Avatar fullName={namesById[stay.student_id] ?? stay.student_id} sizeClass="h-9 w-9" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-sand-100">
                              {namesById[stay.student_id] ?? stay.student_id}
                            </p>
                            <p className="text-xs text-sand-300">
                              {formatDate(stay.moved_in_at)} —{' '}
                              {stay.moved_out_at ? formatDate(stay.moved_out_at) : t('admin.rooms.bedHistoryNow')}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sand-400">
                    {t('admin.rooms.bedHistoryStatuses')}
                  </p>
                  {statusHistory.changes.length === 0 ? (
                    <p className="text-sm text-sand-300">{t('admin.rooms.bedHistoryNoStatusChanges')}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {statusHistory.changes.map((c) => (
                        <li key={c.id} className="rounded-2xl bg-navy-950/40 p-3">
                          <p className="text-sm font-semibold text-sand-100">
                            {t('admin.rooms.bedHistoryStatusChange', {
                              from: serviceLabel(c.old_status),
                              to: serviceLabel(c.new_status),
                            })}
                          </p>
                          <p className="mt-0.5 text-xs text-sand-300">
                            {[
                              formatDate(c.changed_at),
                              c.changed_by ? nameOfStaff(c.changed_by) : null,
                              c.reason,
                              c.until ? t('admin.rooms.bedServiceUntil', { date: formatDate(c.until) }) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={() => setHistoryTarget(null)}>
                {t('admin.common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {statusTarget && (
        <BedStatusDialog
          bed={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSaved={() => {
            setStatusTarget(null)
            load()
          }}
        />
      )}

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
