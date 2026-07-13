import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { extractErrorMessage } from '../../../api/client'
import { deleteDormitory, getDormitoryCapacity, listDormitories, listDormitoryImages } from '../../../api/dormitoryApi'
import { adminPageHeading, adminChipButtonClass } from '../adminTable'
import type { Dormitory } from '../../../types/dormitories'

interface Row extends Dormitory {
  imageUrl: string | null
  allocated: number
  roomsCreated: number
}

const placeholderStyle = {
  backgroundImage:
    'repeating-linear-gradient(45deg, var(--color-navy-800) 0 8px, var(--color-navy-950) 8px 16px)',
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
        const withMeta = await Promise.all(
          list.map(async (d) => {
            const [capacity, images] = await Promise.all([
              getDormitoryCapacity(d.id).catch(() => null),
              listDormitoryImages(d.id).catch(() => []),
            ])
            return {
              ...d,
              imageUrl: images[0]?.image_url ?? null,
              allocated: capacity?.allocated_beds ?? 0,
              roomsCreated: capacity?.rooms_created ?? 0,
            }
          }),
        )
        setRows(withMeta)
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
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h1 className={adminPageHeading}>Жатақханалар</h1>
        <Button onClick={() => navigate('/admin/dormitories/new')}>+ Жаңа жатақхана</Button>
      </div>

      {error && <Alert variant="error" message={error} />}
      {deleteError && <Alert variant="error" message={deleteError} />}
      {!error && !rows && <p className="text-sm text-sand-300">Жүктелуде...</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows?.map((d) => {
          const pct = d.total_capacity > 0 ? Math.min(100, Math.round((d.allocated / d.total_capacity) * 100)) : 0
          return (
            <Card key={d.id} onClick={() => navigate(`/admin/dormitories/${d.id}`)} className="!p-4">
              {d.imageUrl ? (
                <img src={d.imageUrl} alt={d.name} className="h-27.5 w-full rounded-2xl object-cover" />
              ) : (
                <div className="flex h-27.5 w-full items-center justify-center rounded-2xl" style={placeholderStyle}>
                  <span className="font-mono text-[10px] text-sand-400">жатақхана фотосы</span>
                </div>
              )}
              <p className="mt-3 text-base font-bold text-sand-100">{d.name}</p>
              <p className="mt-0.5 text-sm text-sand-300">{d.address}</p>
              <div className="mt-3 flex items-baseline justify-between text-xs text-sand-300">
                <span>Толуы</span>
                <span className="font-semibold">
                  {d.allocated}/{d.total_capacity} · {d.roomsCreated} бөлме
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-800">
                <div
                  className={`h-full rounded-full ${pct > 95 ? 'bg-clay-400' : 'bg-turquoise-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div
                className="mt-3.5 flex flex-wrap items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button className={adminChipButtonClass} onClick={() => navigate(`/admin/dormitories/${d.id}/edit`)}>
                  Өзгерту
                </button>
                <DeleteIconButton onClick={() => setDeleteTarget(d)} />
              </div>
            </Card>
          )
        })}
      </div>

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
