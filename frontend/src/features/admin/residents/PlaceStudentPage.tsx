import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Select } from '../../../components/Select'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { listUnhousedStudents } from '../../../api/adminUserApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { addResident, listRoomResidents, listRoomsByDormitory } from '../../../api/roomApi'
import { getStudentProfile } from '../../../api/profileApi'
import { listStudentBenefits } from '../../../api/benefitApi'
import { adminCellClass, adminPageHeading, adminRowClickableClass, adminTableWrapClass, adminTheadClass } from '../adminTable'
import type { TFunction } from 'i18next'
import type { User } from '../../../types'
import type { Dormitory } from '../../../types/dormitories'
import type { Room } from '../../../types/rooms'
import type { StudentProfile } from '../../../types'

// Mirrors RoomService.checkStudentAgainstRestrictions on the backend: a room
// is only selectable if it still has a free bed and the student satisfies
// every restriction dimension the room has set. AddResident re-validates all
// of this server-side — this is purely a client-side hint so the admin isn't
// left picking a room the request will then reject.
function ineligibilityReason(
  room: Room,
  freeBeds: number,
  profile: StudentProfile | null,
  benefitIds: string[],
  t: TFunction,
): string | null {
  if (freeBeds <= 0) return t('admin.placeStudent.roomFull')
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

export function PlaceStudentPage() {
  const { t } = useTranslation()
  const [students, setStudents] = useState<User[] | null>(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selected, setSelected] = useState<User | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<StudentProfile | null>(null)
  const [selectedBenefitIds, setSelectedBenefitIds] = useState<string[]>([])
  const [dormitories, setDormitories] = useState<Dormitory[]>([])
  const [dormitoryId, setDormitoryId] = useState('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [freeBedsByRoom, setFreeBedsByRoom] = useState<Record<string, number>>({})
  const [roomId, setRoomId] = useState('')
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPlacing, setIsPlacing] = useState(false)

  function load() {
    Promise.all([listUnhousedStudents(), listDormitories()])
      .then(([s, d]) => {
        setStudents(s)
        setDormitories(d)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.placeStudent.loadError'))))
  }

  useEffect(load, [])

  useEffect(() => {
    if (!dormitoryId) {
      setRooms([])
      setFreeBedsByRoom({})
      setRoomId('')
      return
    }
    let cancelled = false
    listRoomsByDormitory(dormitoryId)
      .then(async (roomList) => {
        if (cancelled) return
        setRooms(roomList)
        const entries = await Promise.all(
          roomList.map(async (r) => {
            const residents = await listRoomResidents(r.id).catch(() => [])
            return [r.id, r.capacity - residents.length] as const
          }),
        )
        if (!cancelled) setFreeBedsByRoom(Object.fromEntries(entries))
      })
      .catch(() => {
        if (!cancelled) {
          setRooms([])
          setFreeBedsByRoom({})
        }
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
    setDormitoryId('')
    setRoomId('')
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
      load()
    } catch (err) {
      setPlaceError(extractErrorMessage(err, t('admin.placeStudent.placeFailed')))
    } finally {
      setIsPlacing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className={adminPageHeading}>{t('admin.placeStudent.title')}</h1>
        <p className="mt-1 text-sm text-sand-300">{t('admin.placeStudent.description')}</p>
      </div>

      {loadError && <Alert variant="error" message={loadError} />}
      {successMessage && <Alert variant="success" message={successMessage} />}

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

      <Card title={t('admin.placeStudent.selectedStudent')}>
        {!selected ? (
          <p className="text-sm text-sand-300">{t('admin.placeStudent.chooseStudentFirst')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-sand-100">{selected.full_name}</p>
            {placeError && <Alert variant="error" message={placeError} />}
            <Select
              label={t('admin.placeStudent.dormitory')}
              value={dormitoryId}
              onChange={(e) => setDormitoryId(e.target.value)}
            >
              <option value="">{t('admin.common.select')}</option>
              {dormitories.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select
              label={t('admin.placeStudent.room')}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={!dormitoryId}
            >
              <option value="">{t('admin.common.select')}</option>
              {rooms.map((r) => {
                const freeBeds = freeBedsByRoom[r.id] ?? r.capacity
                const reason = ineligibilityReason(r, freeBeds, selectedProfile, selectedBenefitIds, t)
                return (
                  <option key={r.id} value={r.id} disabled={reason != null}>
                    {r.room_number} ({t('admin.requests.bedsCount', { count: r.capacity })})
                    {reason ? ` — ${reason}` : ''}
                  </option>
                )
              })}
            </Select>
            <Button onClick={handlePlace} isLoading={isPlacing} disabled={!roomId} className="self-start">
              {t('admin.placeStudent.placeButton')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
