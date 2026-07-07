import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { getDormitoryCapacity, listDormitories } from '../../../api/dormitoryApi'
import type { Dormitory } from '../../../types/dormitories'

interface Row extends Dormitory {
  allocated: number | null
}

export function DormitoryListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listDormitories()
      .then(async (list) => {
        const withCapacity = await Promise.all(
          list.map(async (d) => {
            const capacity = await getDormitoryCapacity(d.id).catch(() => null)
            return { ...d, allocated: capacity?.allocated_beds ?? null }
          }),
        )
        if (!cancelled) setRows(withCapacity)
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Жатақханаларды жүктеу сәтсіз аяқталды'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Жатақханалар</h1>
        <Button onClick={() => navigate('/admin/dormitories/new')}>Жаңа жатақхана</Button>
      </div>

      {error && <Alert variant="error" message={error} />}
      {!error && !rows && <p className="text-sm text-gray-500">Жүктелуде...</p>}

      {rows && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Атауы</th>
                <th className="px-4 py-3">Мекенжайы</th>
                <th className="px-4 py-3">Сыйымдылық</th>
                <th className="px-4 py-3">Әрекеттер</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                  <td className="px-4 py-3 text-gray-600">{d.address}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {d.allocated ?? '?'}/{d.total_capacity}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        className="text-indigo-600 hover:underline"
                        onClick={() => navigate(`/admin/dormitories/${d.id}/edit`)}
                      >
                        Өзгерту
                      </button>
                      <button
                        className="text-indigo-600 hover:underline"
                        onClick={() => navigate(`/admin/dormitories/${d.id}`)}
                      >
                        Бөлмелерін көру
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
