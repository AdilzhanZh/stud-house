import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { listDormitories } from '../../../api/dormitoryApi'
import { listRoomResidents, listRoomsByDormitory } from '../../../api/roomApi'
import { listUsers } from '../../../api/adminUserApi'
import { getStudentProfile } from '../../../api/profileApi'
import { adminCellClass, adminPageHeading, adminRowClass, adminTableWrapClass, adminTheadClass } from '../adminTable'

interface ResidentRow {
  id: string
  studentId: string
  name: string
  dormitoryName: string
  roomNumber: string
  course: number | null
  phone: string
  movedInAt: string
}

const courseLabel = (course: number | null) => (course != null ? `${course}-курс` : '—')

export function ResidentsPage() {
  const [rows, setRows] = useState<ResidentRow[] | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [dormitories, students] = await Promise.all([listDormitories(), listUsers('student')])
        const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))
        const phonesById = Object.fromEntries(students.map((s) => [s.id, s.phone]))

        const perDorm = await Promise.all(
          dormitories.map(async (d) => {
            const rooms = await listRoomsByDormitory(d.id).catch(() => [])
            const perRoom = await Promise.all(
              rooms.map(async (r) => {
                const residents = await listRoomResidents(r.id).catch(() => [])
                return residents.map((res) => ({
                  id: res.id,
                  studentId: res.student_id,
                  dormitoryName: d.name,
                  roomNumber: r.room_number,
                  movedInAt: res.moved_in_at,
                }))
              }),
            )
            return perRoom.flat()
          }),
        )
        const flat = perDorm.flat()
        if (cancelled) return

        const uniqueStudentIds = [...new Set(flat.map((r) => r.studentId))]
        const courseEntries = await Promise.all(
          uniqueStudentIds.map(async (id) => {
            const profile = await getStudentProfile(id).catch(() => null)
            return [id, profile?.course ?? null] as const
          }),
        )
        const courseById = Object.fromEntries(courseEntries)
        if (cancelled) return

        setRows(
          flat.map((r) => ({
            id: r.id,
            studentId: r.studentId,
            name: namesById[r.studentId] ?? r.studentId,
            dormitoryName: r.dormitoryName,
            roomNumber: r.roomNumber,
            course: courseById[r.studentId] ?? null,
            phone: phonesById[r.studentId] ?? '—',
            movedInAt: r.movedInAt,
          })),
        )
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Тұрғындарды жүктеу сәтсіз аяқталды'))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleRows = useMemo(() => {
    if (!rows) return null
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className={adminPageHeading}>Тұрғындар</h1>

      {error && <Alert variant="error" message={error} />}

      <div className="flex max-w-80 items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-sand-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Тұрғынды іздеу..."
          className="w-full bg-transparent text-sm text-sand-100 outline-none placeholder:text-sand-400"
        />
      </div>

      {!rows ? (
        <p className="text-sm text-sand-300">Жүктелуде...</p>
      ) : (
        <Card className={adminTableWrapClass}>
          <table className="w-full text-left text-sm">
            <thead className={adminTheadClass}>
              <tr>
                <th className={adminCellClass}>Студент</th>
                <th className={adminCellClass}>Жатақхана</th>
                <th className={adminCellClass}>Бөлме</th>
                <th className={adminCellClass}>Курс</th>
                <th className={adminCellClass}>Телефон</th>
                <th className={adminCellClass}>Орналасқан күні</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows?.map((r) => (
                <tr key={r.id} className={adminRowClass}>
                  <td className={`${adminCellClass} font-semibold text-sand-100`}>{r.name}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{r.dormitoryName}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{r.roomNumber}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{courseLabel(r.course)}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{r.phone}</td>
                  <td className={`${adminCellClass} text-sand-300`}>
                    {new Date(r.movedInAt).toLocaleDateString('kk-KZ')}
                  </td>
                </tr>
              ))}
              {visibleRows?.length === 0 && (
                <tr>
                  <td className={`${adminCellClass} text-sand-300`} colSpan={6}>
                    Тұрғын табылмады
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
