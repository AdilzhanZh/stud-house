import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { extractErrorMessage } from '../../../api/client'
import { deleteDormitory, getDormitoryCapacity, listDormitories } from '../../../api/dormitoryApi'
import type { Dormitory } from '../../../types/dormitories'

interface Row extends Dormitory {
  allocated: number | null
  roomsCreated: number | null
}

export function DormitoryListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function load() {
    listDormitories()
      .then(async (list) => {
        const withCapacity = await Promise.all(
          list.map(async (d) => {
            const capacity = await getDormitoryCapacity(d.id).catch(() => null)
            return {
              ...d,
              allocated: capacity?.allocated_beds ?? null,
              roomsCreated: capacity?.rooms_created ?? null,
            }
          }),
        )
        setRows(withCapacity)
      })
      .catch((err) => {
        setError(extractErrorMessage(err, 'Жатақханаларды жүктеу сәтсіз аяқталды'))
      })
  }

  useEffect(load, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteDormitory(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Жатақхананы өшіру сәтсіз аяқталды'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-sand-100">Жатақханалар</h1>
        <Button onClick={() => navigate('/admin/dormitories/new')}>Жаңа жатақхана</Button>
      </div>

      {error && <Alert variant="error" message={error} />}
      {deleteError && <Alert variant="error" message={deleteError} />}
      {!error && !rows && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}

      {rows && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sand-100/10 text-xs uppercase text-sand-300/60">
              <tr>
                <th className="px-4 py-3">Атауы</th>
                <th className="px-4 py-3">Мекенжайы</th>
                <th className="px-4 py-3">Орын саны</th>
                <th className="px-4 py-3">Бөлме саны</th>
                <th className="px-4 py-3">Әрекеттер</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-sand-100/10 last:border-0">
                  <td className="px-4 py-3 font-medium text-sand-100">{d.name}</td>
                  <td className="px-4 py-3 text-sand-300/70">{d.address}</td>
                  <td className="px-4 py-3 text-sand-300/70">
                    {d.total_capacity}/{d.allocated ?? '?'}
                  </td>
                  <td className="px-4 py-3 text-sand-300/70">
                    {d.total_rooms_target ?? '—'}/{d.roomsCreated ?? '?'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-turquoise-300 ring-1 ring-inset ring-turquoise-400/30 transition-colors hover:bg-turquoise-500/10"
                        onClick={() => navigate(`/admin/dormitories/${d.id}/edit`)}
                      >
                        Өзгерту
                      </button>
                      <button
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-turquoise-300 ring-1 ring-inset ring-turquoise-400/30 transition-colors hover:bg-turquoise-500/10"
                        onClick={() => navigate(`/admin/dormitories/${d.id}`)}
                      >
                        Бөлмелер қосу
                      </button>
                      <DeleteIconButton onClick={() => setDeleteTarget(d)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Жатақхананы өшіру"
        message={`"${deleteTarget?.name}" жатақханасын өшіргіңіз келе ме? Бұл әрекетті қайтару мүмкін емес.`}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
