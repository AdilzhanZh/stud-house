import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Search } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { FloorCorridorMap } from '../../../components/FloorCorridorMap'
import { DormitoryCard } from '../../dormitories/DormitoryCard'
import { extractErrorMessage } from '../../../api/client'
import { listUnhousedStudents } from '../../../api/adminUserApi'
import { listDormitories, getDormitoryCapacity, listDormitoryImages } from '../../../api/dormitoryApi'
import { addResident, listRoomAvailability } from '../../../api/roomApi'
import { getStudentProfile } from '../../../api/profileApi'
import { listStudentBenefits } from '../../../api/benefitApi'
import { RoomRestrictionsDialog } from '../rooms/RoomRestrictionsDialog'
import { adminCellClass, adminPageHeading, adminRowClickableClass, adminTableWrapClass, adminTheadClass } from '../adminTable'
import type { TFunction } from 'i18next'
import type { User } from '../../../types'
import type { DormitoryCardData } from '../../dormitories/useDormitoriesWithMeta'
import type { Room, RoomAvailability } from '../../../types/rooms'
import type { StudentProfile } from '../../../types'

// Mirrors RoomService.checkStudentAgainstRestrictions on the backend: a room
// is only selectable if it still has a free bed and the student satisfies
// every restriction dimension the room has set. AddResident re-validates all
// of this server-side — this is purely a client-side hint so the admin isn't
// left picking a room the request will then reject.
function restrictionMismatchReason(
  room: Room,
  profile: StudentProfile | null,
  benefitIds: string[],
  t: TFunction,
): string | null {
  const r = room.restrictions
  if (r.gender != null && profile?.gender !== r.gender) return t('admin.placeStudent.roomGenderMismatch')
  if (r.courses.length > 0 && (profile?.course == null || !r.courses.includes(profile.course))) {
    return t('admin.placeStudent.roomCourseMismatch')
  }
  if (
    r.degrees.length > 0 &&
    (profile?.academic_degree == null || !r.degrees.includes(profile.academic_degree))
  ) {
    return t('admin.placeStudent.roomDegreeMismatch')
  }
  if (r.benefit_ids.length > 0 && !r.benefit_ids.some((id) => benefitIds.includes(id))) {
    return t('admin.placeStudent.roomBenefitMismatch')
  }
  return null
}

type Step = 'student' | 'placement'

// A two-step flow: pick the student first (a long list, so it gets the full
// page), then a second screen for dormitory + room. Splitting it this way
// means the room grid doesn't have to render below a potentially long
// student table — it's the whole screen once you get there. The dormitory
// is chosen from a photo grid (same DormitoryCard used by the student-facing
// pages) rather than a dropdown, and its rooms render as a floor map so a
// restriction mismatch can be shown inline instead of just disabling a
// <select> option.
export function PlaceStudentPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('student')

  const [students, setStudents] = useState<User[] | null>(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selected, setSelected] = useState<User | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<StudentProfile | null>(null)
  const [selectedBenefitIds, setSelectedBenefitIds] = useState<string[]>([])

  const [dormitories, setDormitories] = useState<DormitoryCardData[] | null>(null)
  const [dormitoriesError, setDormitoriesError] = useState<string | null>(null)
  const [dormitoryId, setDormitoryId] = useState('')
  const [rooms, setRooms] = useState<RoomAvailability[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)
  const [roomId, setRoomId] = useState('')
  const [restrictionsRoom, setRestrictionsRoom] = useState<RoomAvailability | null>(null)
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null)

  const [placeError, setPlaceError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPlacing, setIsPlacing] = useState(false)

  function load() {
    listUnhousedStudents()
      .then(setStudents)
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.placeStudent.loadError'))))
  }

  useEffect(load, [])

  useEffect(() => {
    if (dormitories) return
    listDormitories()
      .then(async (list) => {
        const withMeta = await Promise.all(
          list.map(async (d) => {
            const [images, capacity] = await Promise.all([
              listDormitoryImages(d.id).catch(() => []),
              getDormitoryCapacity(d.id).catch(() => null),
            ])
            return {
              ...d,
              imageUrl: images[0]?.image_url ?? null,
              vacancy: capacity ? capacity.total_capacity - capacity.allocated_beds : d.total_capacity,
            }
          }),
        )
        setDormitories(withMeta)
      })
      .catch((err) => setDormitoriesError(extractErrorMessage(err, t('admin.common.loadError'))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!blockedNotice) return
    const timer = setTimeout(() => setBlockedNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [blockedNotice])

  useEffect(() => {
    if (!dormitoryId) {
      setRooms([])
      return
    }
    let cancelled = false
    setRoomsLoading(true)
    listRoomAvailability(dormitoryId)
      .then((list) => {
        if (!cancelled) setRooms(list)
      })
      .catch(() => {
        if (!cancelled) setRooms([])
      })
      .finally(() => {
        if (!cancelled) setRoomsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dormitoryId])

  const visibleStudents = useMemo(() => {
    if (!students) return null
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(q) || (s.iin ?? '').includes(q),
    )
  }, [students, search])

  function selectStudent(student: User) {
    setSelected(student)
    setSelectedProfile(null)
    setSelectedBenefitIds([])
    setPlaceError(null)
    setSuccessMessage(null)
    Promise.all([
      getStudentProfile(student.id).catch(() => null),
      listStudentBenefits(student.id).catch(() => []),
    ]).then(([profile, benefits]) => {
      setSelectedProfile(profile)
      setSelectedBenefitIds(benefits.map((b) => b.benefit_id))
    })
  }

  function goToPlacement() {
    if (!selected) return
    setStep('placement')
  }

  function backToStudents() {
    setStep('student')
    setDormitoryId('')
    setRoomId('')
    setSelectedFloor(null)
  }

  function chooseDormitory(id: string) {
    setDormitoryId(id)
    setRoomId('')
    setSelectedFloor(null)
    setPlaceError(null)
  }

  function changeDormitory() {
    setDormitoryId('')
    setRoomId('')
    setSelectedFloor(null)
  }

  function handleSelectRoom(id: string) {
    const room = rooms.find((r) => r.id === id)
    if (!room) return
    const reason = restrictionMismatchReason(room, selectedProfile, selectedBenefitIds, t)
    if (reason) {
      if (room.restrictions.gender != null && selectedProfile?.gender !== room.restrictions.gender) {
        setRestrictionsRoom(room)
      } else {
        setBlockedNotice(t('admin.placeStudent.roomRestrictionBlocked', { room: room.room_number, reason }))
      }
      return
    }
    setRoomId((prev) => (prev === id ? '' : id))
  }

  function handleRestrictionsSaved(updated: Room) {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? { ...r, restrictions: updated.restrictions } : r)))
    setRestrictionsRoom(null)
  }

  async function handlePlace() {
    if (!selected || !roomId) return
    setPlaceError(null)
    setIsPlacing(true)
    try {
      const room = rooms.find((r) => r.id === roomId)
      await addResident(roomId, selected.id)
      setSuccessMessage(
        t('admin.placeStudent.successMessage', {
          name: selected.full_name,
          room: room?.room_number ?? '',
        }),
      )
      setSelected(null)
      setDormitoryId('')
      setRoomId('')
      setStep('student')
      load()
    } catch (err) {
      setPlaceError(extractErrorMessage(err, t('admin.placeStudent.placeFailed')))
    } finally {
      setIsPlacing(false)
    }
  }

  const roomsByFloor = Object.entries(
    rooms.reduce<Record<number, RoomAvailability[]>>((byFloor, room) => {
      const floor = room.floor ?? 0
      byFloor[floor] = [...(byFloor[floor] ?? []), room]
      return byFloor
    }, {}),
  ).sort(([a], [b]) => Number(a) - Number(b))
  const activeFloor =
    selectedFloor && roomsByFloor.some(([floor]) => floor === selectedFloor) ? selectedFloor : roomsByFloor[0]?.[0]
  const activeFloorRooms = roomsByFloor.find(([floor]) => floor === activeFloor)?.[1] ?? []
  const selectedDormitory = dormitories?.find((d) => d.id === dormitoryId) ?? null
  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null

  if (step === 'placement' && selected) {
    return (
      <div className="flex flex-col gap-3.5">
        <button
          onClick={backToStudents}
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
        >
          <ChevronLeft className="h-4 w-4" /> {t('admin.placeStudent.backToStudentList')}
        </button>

        <div>
          <h1 className={adminPageHeading}>{selected.full_name}</h1>
          <p className="mt-1 text-sm text-sand-300">{t('admin.placeStudent.selectedStudent')}</p>
        </div>

        {successMessage && <Alert variant="success" message={successMessage} />}
        {placeError && <Alert variant="error" message={placeError} />}

        {!dormitoryId ? (
          <>
            <p className="text-sm font-semibold text-sand-100">{t('admin.placeStudent.chooseDormitory')}</p>
            {dormitoriesError && <Alert variant="error" message={dormitoriesError} />}
            {!dormitories ? (
              <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>
            ) : dormitories.length === 0 ? (
              <p className="text-sm text-sand-300">{t('admin.placeStudent.noDormitories')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {dormitories.map((d) => (
                  <DormitoryCard key={d.id} dormitory={d} onClick={() => chooseDormitory(d.id)} />
                ))}
              </div>
            )}
          </>
        ) : (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[15px] font-bold text-sand-100">{selectedDormitory?.name}</p>
              <button
                type="button"
                onClick={changeDormitory}
                className="text-xs font-semibold text-turquoise-400 hover:text-turquoise-300"
              >
                {t('admin.placeStudent.changeDormitory')}
              </button>
            </div>
            {roomsLoading ? (
              <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>
            ) : rooms.length === 0 ? (
              <p className="text-sm text-sand-300">{t('admin.placeStudent.noRooms')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {roomsByFloor.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {roomsByFloor.map(([floor]) => (
                      <button
                        key={floor}
                        type="button"
                        onClick={() => setSelectedFloor(floor)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                          floor === activeFloor
                            ? 'bg-turquoise-500 text-white'
                            : 'bg-navy-800 text-sand-300 hover:bg-navy-700'
                        }`}
                      >
                        {t('admin.dormitories.floorLabel', { floor })}
                      </button>
                    ))}
                  </div>
                )}
                <FloorCorridorMap
                  rooms={activeFloorRooms.map((r) => ({
                    id: r.id,
                    room_number: r.room_number,
                    capacity: r.capacity,
                    residentCount: r.resident_count + r.held_count,
                    warning: restrictionMismatchReason(r, selectedProfile, selectedBenefitIds, t) != null,
                  }))}
                  selectedRoomId={roomId}
                  onSelectRoom={handleSelectRoom}
                  disableFull
                />
                {blockedNotice ? (
                  <p className="text-xs font-medium text-clay-400">{blockedNotice}</p>
                ) : selectedRoom ? (
                  <p className="text-xs text-sand-300">
                    {t('admin.applications.roomSelected', { room: selectedRoom.room_number })}
                  </p>
                ) : null}
              </div>
            )}
            <p className="mt-2.5 text-xs text-sand-300">{t('admin.placeStudent.roomAssignHint')}</p>
          </Card>
        )}

        <Button onClick={handlePlace} isLoading={isPlacing} disabled={!roomId} className="self-start">
          {t('admin.placeStudent.placeButton')}
        </Button>

        <RoomRestrictionsDialog
          room={restrictionsRoom}
          onClose={() => setRestrictionsRoom(null)}
          onSaved={handleRestrictionsSaved}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className={adminPageHeading}>{t('admin.placeStudent.title')}</h1>
        <p className="mt-1 text-sm text-sand-300">{t('admin.placeStudent.description')}</p>
      </div>

      {loadError && <Alert variant="error" message={loadError} />}

      {selected && (
        <Card className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 !bg-navy-800 ring-1 ring-turquoise-400/30">
          <div>
            <p className="text-xs text-sand-300">{t('admin.placeStudent.selectedStudent')}</p>
            <p className="text-sm font-semibold text-sand-100">{selected.full_name}</p>
          </div>
          <Button onClick={goToPlacement}>{t('admin.placeStudent.nextButton')}</Button>
        </Card>
      )}

      <div className="flex max-w-80 items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-sand-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.placeStudent.searchPlaceholder')}
          className="w-full bg-transparent text-sm text-sand-100 outline-none placeholder:text-sand-400"
        />
      </div>

      {!students ? (
        <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-sand-300">{t('admin.placeStudent.empty')}</p>
      ) : (
        <Card className={adminTableWrapClass}>
          <table className="w-full text-left text-sm">
            <thead className={adminTheadClass}>
              <tr>
                <th className={adminCellClass}>{t('admin.applications.student')}</th>
                <th className={adminCellClass}>ЖСН</th>
                <th className={adminCellClass}>{t('admin.applications.phone')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents?.map((s) => (
                <tr
                  key={s.id}
                  className={`${adminRowClickableClass} ${selected?.id === s.id ? 'bg-turquoise-500/10' : ''}`}
                  onClick={() => selectStudent(s)}
                >
                  <td className={`${adminCellClass} font-semibold text-sand-100`}>{s.full_name}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{s.iin ?? '—'}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{s.phone}</td>
                </tr>
              ))}
              {visibleStudents?.length === 0 && (
                <tr>
                  <td className={`${adminCellClass} text-sand-300`} colSpan={3}>
                    {t('admin.placeStudent.notFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
