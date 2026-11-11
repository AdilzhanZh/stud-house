import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Building2, ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { Input } from '../../../components/Input'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { FloorCorridorMap } from '../../../components/FloorCorridorMap'
import { extractErrorMessage } from '../../../api/client'
import { getDormitory, getDormitoryCapacity } from '../../../api/dormitoryApi'
import { deleteRoom, listBeds, listRoomsByDormitory } from '../../../api/roomApi'
import { bedStatusDotClass } from '../../../utils/bedStatus'
import { createFloor, listDormitoryFloors, retireFloor, updateFloor } from '../../../api/hierarchyApi'
import { floorLabel, roomLabel } from '../../../utils/roomLocation'
import type { Floor } from '../../../types/hierarchy'
import { adminCellClass, adminChipButtonClass, adminPageHeading, adminRowClass, adminTableWrapClass, adminTheadClass } from '../adminTable'
import { canManage } from '../../../constants/roles'
import { useAuth } from '../../auth/useAuth'
import { dormitoryPosition } from '../../dormitories/DormitoryMap'
import { DormitoryMiniMap } from '../../dormitories/DormitoryMapViewer'
import type { Dormitory, DormitoryCapacity } from '../../../types/dormitories'
import { BED_STATUSES, type BedStatus, type Room } from '../../../types/rooms'

const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-lg transition-colors'

interface RoomRow extends Room {
  residentCount: number
  // Active beds per status (free / reserved / occupied / repair / unavailable).
  bedStatusCounts: Record<BedStatus, number>
}

function restrictionsSummary(room: Room, t: TFunction): string {
  const parts: string[] = []
  if (room.restrictions.gender) {
    parts.push(room.restrictions.gender === 'male' ? t('admin.dormitories.male') : t('admin.dormitories.female'))
  } else {
    parts.push(t('admin.dormitories.shared'))
  }
  if ((room.restrictions.courses ?? []).length > 0) {
    parts.push(t('admin.dormitories.coursesRestriction', { courses: room.restrictions.courses.join(',') }))
  }
  if ((room.restrictions.benefit_ids ?? []).length > 0) {
    parts.push(t('admin.dormitories.benefitsRestriction', { count: room.restrictions.benefit_ids.length }))
  }
  return parts.length > 0 ? parts.join(', ') : t('admin.dormitories.unrestricted')
}

export function DormitoryDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // Users without the manager position get this section read-only.
  const { user } = useAuth()
  const isManager = canManage(user)

  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [capacity, setCapacity] = useState<DormitoryCapacity | null>(null)
  const [rooms, setRooms] = useState<RoomRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)

  // Add/edit floor dialog: open with target null to add.
  const [editor, setEditor] = useState<{ target: Floor | null } | null>(null)
  const [editName, setEditName] = useState('')
  const [editNumber, setEditNumber] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [retireTarget, setRetireTarget] = useState<Floor | null>(null)
  const [isRetiring, setIsRetiring] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<RoomRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function load() {
    if (!id) return
    Promise.all([
      getDormitory(id),
      getDormitoryCapacity(id),
      listRoomsByDormitory(id),
      listDormitoryFloors(id),
    ])
      .then(async ([d, cap, roomList, floorList]) => {
        setDormitory(d)
        setCapacity(cap)
        setFloors(floorList)
        const withResidents = await Promise.all(
          roomList.map(async (r) => {
            const beds = await listBeds(r.id).catch(() => [])
            const bedStatusCounts = Object.fromEntries(BED_STATUSES.map((s) => [s, 0])) as Record<BedStatus, number>
            for (const b of beds) bedStatusCounts[b.status] += 1
            return { ...r, residentCount: bedStatusCounts.occupied, bedStatusCounts }
          }),
        )
        setRooms(withResidents)
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  useEffect(load, [id])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteRoom(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t('admin.rooms.deleteFailed')))
    } finally {
      setIsDeleting(false)
    }
  }

  function openFloorEditor(target: Floor | null) {
    setEditor({ target })
    setEditNumber(target?.number != null ? String(target.number) : '')
    setEditName(target?.name ?? '')
    setEditError(null)
  }

  async function handleSaveEditor() {
    if (!editor || !id) return
    setEditError(null)
    setIsSavingEdit(true)
    try {
      const payload = { number: Number(editNumber), name: editName.trim() || null }
      const saved = editor.target ? await updateFloor(editor.target.id, payload) : await createFloor(id, payload)
      setSelectedFloor(saved.id)
      setEditor(null)
      load()
    } catch (err) {
      setEditError(extractErrorMessage(err, t('admin.rooms.saveFailedGeneric')))
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleRetire() {
    if (!retireTarget) return
    setDeleteError(null)
    setIsRetiring(true)
    try {
      await retireFloor(retireTarget.id)
      setSelectedFloor(null)
      setRetireTarget(null)
      load()
    } catch (err) {
      setRetireTarget(null)
      setDeleteError(extractErrorMessage(err, t('admin.rooms.removeFailed')))
    } finally {
      setIsRetiring(false)
    }
  }

  // Floor tabs are real floor records, so an empty floor still has a tab.
  const activeFloorRecord = floors.find((f) => f.id === selectedFloor) ?? floors[0] ?? null

  if (error) return <Alert variant="error" message={error} />
  if (!dormitory || !capacity || !rooms) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  const activeFloorRooms = rooms.filter((r) => r.floor_id === activeFloorRecord?.id)

  const bedsPercent = capacity.total_capacity > 0
    ? Math.min(100, Math.round((capacity.provisioned_beds / capacity.total_capacity) * 100))
    : 0
  const roomsPercent = capacity.total_rooms_target && capacity.total_rooms_target > 0
    ? Math.min(100, Math.round((capacity.rooms_created / capacity.total_rooms_target) * 100))
    : 0

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate('/admin/dormitories')}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> {t('admin.layout.dormitories')}
      </button>
      <h1 className={adminPageHeading}>{dormitory.name} · {t('admin.dormitories.roomsWord')}</h1>

      {deleteError && <Alert variant="error" message={deleteError} />}

      <Card>
        <Link
          to={`/admin/objects?focus=${dormitory.object_id}`}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-turquoise-400 hover:text-turquoise-300"
        >
          <Building2 className="h-4 w-4" /> {t('admin.objects.objectLabel')}: {dormitory.object_name}
        </Link>
        <p className="text-sm text-sand-300">{dormitory.address}</p>
        <div className="mt-3">
          <DormitoryMiniMap dormitory={dormitory} />
          {!dormitoryPosition(dormitory) && isManager && (
            <button className={adminChipButtonClass} onClick={() => navigate(`/admin/dormitories/${id}/edit`)}>
              {t('admin.dormitories.locationPin')}
            </button>
          )}
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm text-sand-300">
            <span>{t('admin.dormitories.bedsProgress')}</span>
            <span>
              {capacity.total_capacity}/{capacity.provisioned_beds}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-navy-700">
            <div
              className="h-2 rounded-full bg-turquoise-500"
              style={{ width: `${bedsPercent}%` }}
            />
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm text-sand-300">
            <span>{t('admin.dormitories.roomsProgress')}</span>
            <span>
              {capacity.total_rooms_target ?? '—'}/{capacity.rooms_created}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-navy-700">
            <div
              className="h-2 rounded-full bg-turquoise-500"
              style={{ width: `${roomsPercent}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-sand-100">{t('admin.dormitories.roomsWord')}</h2>
        {isManager && (
          <Button
            onClick={() =>
              navigate(`/admin/dormitories/${id}/rooms/new${activeFloorRecord ? `?floor=${activeFloorRecord.id}` : ''}`)
            }
          >
            {t('admin.dormitories.newRoom')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedFloor(f.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                f.id === activeFloorRecord?.id
                  ? 'bg-turquoise-500 text-navy-950'
                  : 'bg-navy-800 text-sand-300 hover:bg-navy-700'
              }`}
            >
              {floorLabel(f, t)}
            </button>
          ))}
          {floors.length === 0 && <p className="text-sm text-sand-300">{t('admin.rooms.noFloors')}</p>}
          {isManager && (
            <span className="ml-1 inline-flex items-center gap-1">
              <button
                type="button"
                aria-label={t('admin.rooms.addFloor')}
                title={t('admin.rooms.addFloor')}
                className={`${iconBtn} text-turquoise-400 hover:bg-turquoise-500/10`}
                onClick={() => openFloorEditor(null)}
              >
                <Plus className="h-4 w-4" />
              </button>
              {activeFloorRecord && (
                <button
                  type="button"
                  aria-label={t('admin.rooms.editFloor')}
                  title={t('admin.rooms.editFloor')}
                  className={`${iconBtn} text-turquoise-400 hover:bg-turquoise-500/10`}
                  onClick={() => openFloorEditor(activeFloorRecord)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {activeFloorRecord && activeFloorRecord.room_count === 0 && (
                <button
                  type="button"
                  aria-label={t('admin.rooms.retireFloor')}
                  title={t('admin.rooms.retireFloor')}
                  className={`${iconBtn} text-clay-400 hover:bg-clay-500/10`}
                  onClick={() => setRetireTarget(activeFloorRecord)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </span>
          )}
        </div>
        <FloorCorridorMap
          rooms={activeFloorRooms}
          onSelectRoom={(roomId) => navigate(`/admin/rooms/${roomId}/residents`)}
        />
        <div className="flex flex-wrap gap-4 text-xs text-sand-300">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded ring-1 ring-inset ring-mint-500/30 bg-mint-500/10" /> {t('admin.dormitories.free')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded ring-1 ring-inset ring-amber-400/30 bg-amber-500/10" /> {t('admin.dormitories.partiallyFull')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded ring-1 ring-inset ring-clay-500/30 bg-clay-500/10" /> {t('admin.dormitories.full')}
          </span>
        </div>
      </div>

      <Card className={adminTableWrapClass}>
        <table className="w-full text-left text-sm">
          <thead className={adminTheadClass}>
            <tr>
              <th className={adminCellClass}>{t('admin.dormitories.roomNumber')}</th>
              <th className={adminCellClass}>{t('admin.dormitories.floor')}</th>
              <th className={adminCellClass}>{t('admin.dormitories.capacity')}</th>
              <th className={adminCellClass}>{t('admin.layout.residents')}</th>
              <th className={adminCellClass}>{t('admin.rooms.bedStatusSummary')}</th>
              <th className={adminCellClass}>{t('admin.dormitories.restrictions')}</th>
              <th className={adminCellClass}>{t('admin.dormitories.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {activeFloorRooms.map((room) => (
              <tr key={room.id} className={adminRowClass}>
                <td className={`${adminCellClass} font-semibold text-sand-100`}>{roomLabel(room)}</td>
                <td className={`${adminCellClass} text-sand-300`}>
                  {floorLabel({ number: room.floor, name: room.floor_name }, t)}
                </td>
                <td className={`${adminCellClass} text-sand-300`}>{room.capacity}</td>
                <td className={`${adminCellClass} text-sand-300`}>{room.residentCount}</td>
                <td className={adminCellClass}>
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {BED_STATUSES.filter((st) => room.bedStatusCounts[st] > 0).map((st) => (
                      <span
                        key={st}
                        className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-sand-300"
                        title={t(`admin.rooms.bedStatus.${st}`)}
                      >
                        <span className={`h-2 w-2 rounded-full ${bedStatusDotClass[st]}`} />
                        {t(`admin.rooms.bedStatus.${st}`)} {room.bedStatusCounts[st]}
                      </span>
                    ))}
                  </span>
                </td>
                <td className={`${adminCellClass} text-sand-300`}>{restrictionsSummary(room, t)}</td>
                <td className={adminCellClass}>
                  <div className="flex gap-3">
                    {isManager && (
                      <button
                        className="font-semibold text-turquoise-400 hover:text-turquoise-300"
                        onClick={() => navigate(`/admin/rooms/${room.id}/edit`)}
                      >
                        {t('admin.common.edit')}
                      </button>
                    )}
                    <button
                      className="font-semibold text-turquoise-400 hover:text-turquoise-300"
                      onClick={() => navigate(`/admin/rooms/${room.id}/residents`)}
                    >
                      {t('admin.layout.residents')}
                    </button>
                    {isManager && <DeleteIconButton onClick={() => setDeleteTarget(room)} />}
                  </div>
                </td>
              </tr>
            ))}
            {activeFloorRooms.length === 0 && (
              <tr>
                <td className={`${adminCellClass} text-sand-300`} colSpan={6}>
                  {t('admin.dormitories.noRooms')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('admin.rooms.deleteTitle')}
        message={t('admin.rooms.deleteConfirm', { room: deleteTarget ? roomLabel(deleteTarget) : '' })}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={retireTarget != null}
        title={t('admin.rooms.retireFloor')}
        message={retireTarget ? t('admin.rooms.retireFloorConfirm', { name: floorLabel(retireTarget, t) }) : ''}
        danger
        isLoading={isRetiring}
        onConfirm={handleRetire}
        onCancel={() => setRetireTarget(null)}
      />

      <ConfirmDialog
        open={editor != null}
        title={editor?.target ? t('admin.rooms.editFloor') : t('admin.rooms.addFloor')}
        message=""
        confirmLabel={t('admin.common.save')}
        isLoading={isSavingEdit}
        onConfirm={handleSaveEditor}
        onCancel={() => setEditor(null)}
      >
        <div className="flex flex-col gap-3">
          {editError && <Alert variant="error" message={editError} />}
            <Input
              label={t('admin.rooms.floorNumber')}
              type="number"
              value={editNumber}
              autoFocus
              onChange={(e) => setEditNumber(e.target.value)}
              required
            />
            <Input
              label={t('admin.rooms.floorName')}
              placeholder={t('admin.rooms.floorNameHint')}
              value={editName}
              maxLength={100}
              onChange={(e) => setEditName(e.target.value)}
            />
        </div>
      </ConfirmDialog>
    </div>
  )
}
