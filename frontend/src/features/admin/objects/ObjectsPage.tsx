import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building, Building2, Combine, Pencil, Plus } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { Input } from '../../../components/Input'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { extractErrorMessage } from '../../../api/client'
import { listDormitories } from '../../../api/dormitoryApi'
import {
  createObject,
  deleteObject,
  listObjects,
  moveDormitoriesToObject,
  updateObject,
  type ObjectPayload,
} from '../../../api/hierarchyApi'
import { adminChipButtonClass, adminPageHeading } from '../adminTable'
import { canManage } from '../../../constants/roles'
import { useAuth } from '../../auth/useAuth'
import type { DormObject } from '../../../types/hierarchy'
import type { Dormitory } from '../../../types/dormitories'

const emptyForm: ObjectPayload = { name: '', owner_name: null, bin: null, ownership_form: null, phone: null }

// Objects: the top registry level — a dormitory as an organisation with one
// owner, holding one or more buildings (корпуса). Admins and managers create
// objects and move buildings into them; an object whose last building moves
// out is removed by the server.
export function ObjectsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isManager = canManage(user)
  const [searchParams] = useSearchParams()
  const focusId = searchParams.get('focus')

  const [objects, setObjects] = useState<DormObject[] | null>(null)
  const [dormitories, setDormitories] = useState<Dormitory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Create/edit dialog: target null = new object.
  const [editor, setEditor] = useState<{ target: DormObject | null } | null>(null)
  const [form, setForm] = useState<ObjectPayload>(emptyForm)
  const [editError, setEditError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // "Add buildings" (merge) dialog.
  const [mergeTarget, setMergeTarget] = useState<DormObject | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [isMerging, setIsMerging] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<DormObject | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function load() {
    Promise.all([listObjects(), listDormitories()])
      .then(([o, d]) => {
        setObjects(o)
        setDormitories(d)
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  useEffect(load, [])

  useEffect(() => {
    if (focusId && objects) document.getElementById(`object-${focusId}`)?.scrollIntoView({ block: 'center' })
  }, [focusId, objects])

  function openEditor(target: DormObject | null) {
    setEditor({ target })
    setForm(
      target
        ? {
            name: target.name,
            owner_name: target.owner_name,
            bin: target.bin,
            ownership_form: target.ownership_form,
            phone: target.phone,
          }
        : emptyForm,
    )
    setEditError(null)
  }

  async function handleSave() {
    if (!editor) return
    setEditError(null)
    setIsSaving(true)
    const payload: ObjectPayload = {
      name: form.name.trim(),
      owner_name: form.owner_name?.trim() || null,
      bin: form.bin?.trim() || null,
      ownership_form: form.ownership_form?.trim() || null,
      phone: form.phone?.trim() || null,
    }
    try {
      if (editor.target) await updateObject(editor.target.id, payload)
      else await createObject(payload)
      setEditor(null)
      load()
    } catch (err) {
      setEditError(extractErrorMessage(err, t('admin.rooms.saveFailedGeneric')))
    } finally {
      setIsSaving(false)
    }
  }

  function openMerge(target: DormObject) {
    setMergeTarget(target)
    setPicked(new Set())
    setMergeError(null)
  }

  async function handleMerge() {
    if (!mergeTarget || picked.size === 0) return
    setMergeError(null)
    setIsMerging(true)
    try {
      await moveDormitoriesToObject(mergeTarget.id, [...picked])
      setMergeTarget(null)
      load()
    } catch (err) {
      setMergeError(extractErrorMessage(err, t('admin.rooms.saveFailedGeneric')))
    } finally {
      setIsMerging(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setActionError(null)
    setIsDeleting(true)
    try {
      await deleteObject(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteTarget(null)
      setActionError(extractErrorMessage(err, t('admin.rooms.removeFailed')))
    } finally {
      setIsDeleting(false)
    }
  }

  const setField = (key: keyof ObjectPayload) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  if (error) return <Alert variant="error" message={error} />
  if (!objects) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  const candidates = mergeTarget ? dormitories.filter((d) => d.object_id !== mergeTarget.id) : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={adminPageHeading}>{t('admin.objects.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-sand-300">{t('admin.objects.hint')}</p>
        </div>
        {isManager && (
          <Button onClick={() => openEditor(null)}>
            <Plus className="h-4 w-4" /> {t('admin.objects.new')}
          </Button>
        )}
      </div>

      {actionError && <Alert variant="error" message={actionError} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {objects.map((o) => {
          const buildings = dormitories.filter((d) => d.object_id === o.id)
          const details = [
            o.owner_name,
            o.ownership_form,
            o.bin ? `${t('admin.objects.bin')}: ${o.bin}` : null,
            o.phone,
          ].filter(Boolean)
          return (
            <Card
              key={o.id}
              id={`object-${o.id}`}
              className={`!p-4 ${focusId === o.id ? 'ring-2 ring-turquoise-500' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-turquoise-500/10">
                  <Building2 className="h-5 w-5 text-turquoise-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-sand-100">{o.name}</p>
                  {details.length > 0 && <p className="text-sm text-sand-300">{details.join(' · ')}</p>}
                  <p className="font-mono text-[11px] text-sand-400">{o.id}</p>
                </div>
              </div>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-sand-400">
                {t('admin.objects.buildingsCount', { count: buildings.length })}
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {buildings.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/admin/dormitories/${d.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-800/60"
                    >
                      <Building className="h-4 w-4 shrink-0 text-sand-400" />
                      <span className="font-medium text-sand-100">{d.name}</span>
                      <span className="min-w-0 truncate text-xs text-sand-300">{d.address}</span>
                    </Link>
                  </li>
                ))}
                {buildings.length === 0 && <li className="px-2 text-sm text-sand-300">{t('admin.objects.noBuildings')}</li>}
              </ul>

              {isManager && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button className={adminChipButtonClass} onClick={() => openMerge(o)}>
                    <Combine className="mr-1 inline h-3.5 w-3.5" />
                    {t('admin.objects.addBuildings')}
                  </button>
                  <button
                    className={adminChipButtonClass}
                    onClick={() => navigate(`/admin/dormitories/new?object=${o.id}`)}
                  >
                    <Plus className="mr-1 inline h-3.5 w-3.5" />
                    {t('admin.objects.newBuilding')}
                  </button>
                  <button className={adminChipButtonClass} onClick={() => openEditor(o)}>
                    <Pencil className="mr-1 inline h-3.5 w-3.5" />
                    {t('admin.common.edit')}
                  </button>
                  {buildings.length === 0 && <DeleteIconButton onClick={() => setDeleteTarget(o)} />}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <ConfirmDialog
        open={editor != null}
        title={editor?.target ? t('admin.objects.edit') : t('admin.objects.new')}
        message=""
        confirmLabel={t('admin.common.save')}
        isLoading={isSaving}
        onConfirm={handleSave}
        onCancel={() => setEditor(null)}
      >
        <div className="flex flex-col gap-3">
          {editError && <Alert variant="error" message={editError} />}
          <Input
            label={t('admin.objects.name')}
            value={form.name}
            maxLength={255}
            autoFocus
            required
            onChange={setField('name')}
          />
          <Input
            label={t('admin.objects.ownerName')}
            placeholder={t('admin.objects.ownerNameHint')}
            value={form.owner_name ?? ''}
            maxLength={300}
            onChange={setField('owner_name')}
          />
          <Input
            label={t('admin.objects.bin')}
            value={form.bin ?? ''}
            inputMode="numeric"
            maxLength={12}
            onChange={setField('bin')}
          />
          <Input
            label={t('admin.dormitories.ownershipForm')}
            placeholder={t('admin.dormitories.ownershipFormPlaceholder')}
            value={form.ownership_form ?? ''}
            maxLength={100}
            onChange={setField('ownership_form')}
          />
          <Input
            label={t('admin.objects.phone')}
            type="tel"
            value={form.phone ?? ''}
            maxLength={50}
            onChange={setField('phone')}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={mergeTarget != null}
        title={t('admin.objects.addBuildingsTitle', { name: mergeTarget?.name ?? '' })}
        message={t('admin.objects.addBuildingsHint')}
        confirmLabel={t('admin.objects.addBuildingsConfirm', { count: picked.size })}
        isLoading={isMerging}
        onConfirm={handleMerge}
        onCancel={() => setMergeTarget(null)}
      >
        <div className="flex flex-col gap-2">
          {mergeError && <Alert variant="error" message={mergeError} />}
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {candidates.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-800/60"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-turquoise-500"
                  checked={picked.has(d.id)}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(d.id)
                      else next.delete(d.id)
                      return next
                    })
                  }
                />
                <span className="min-w-0">
                  <span className="block font-medium text-sand-100">{d.name}</span>
                  <span className="block text-xs text-sand-300">
                    {t('admin.objects.currentObject', { name: d.object_name })}
                  </span>
                </span>
              </label>
            ))}
            {candidates.length === 0 && <p className="text-sm text-sand-300">{t('admin.objects.nothingToAdd')}</p>}
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('admin.objects.deleteTitle')}
        message={t('admin.objects.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
