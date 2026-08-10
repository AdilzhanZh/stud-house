import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { ProtocolStatusBadge } from '../../../components/ProtocolStatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { deleteProtocol, getProtocolDetail, listProtocols } from '../../../api/protocolApi'
import { formatDate } from '../../../utils/dateFormat'
import {
  adminCellClass,
  adminPageHeading,
  adminRowClickableClass,
  adminTableWrapClass,
  adminTheadClass,
} from '../adminTable'
import type { Protocol, ProtocolStatus } from '../../../types/protocols'

interface Row extends Protocol {
  studentCount: number
}

const STATUSES: ProtocolStatus[] = ['pending', 'approved']

export function ProtocolListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<ProtocolStatus | 'all'>('all')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function load() {
    listProtocols()
      .then(async (protocols) => {
        const withDetail = await Promise.all(
          protocols.map(async (p) => {
            const detail = await getProtocolDetail(p.id).catch(() => null)
            return { ...p, studentCount: detail?.students.length ?? 0 }
          }),
        )
        setRows(withDetail)
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.protocols.loadError'))))
  }

  useEffect(load, [])

  const counts = {
    all: rows?.length ?? 0,
    pending: rows?.filter((r) => r.status === 'pending').length ?? 0,
    approved: rows?.filter((r) => r.status === 'approved').length ?? 0,
  }
  const visibleRows = rows?.filter((r) => activeFilter === 'all' || r.status === activeFilter)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteProtocol(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t('admin.protocols.deleteFailed')))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h1 className={adminPageHeading}>{t('admin.protocols.pageTitle')}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/admin/protocols/template')}>
            {t('admin.protocols.templateButton')}
          </Button>
          <Button onClick={() => navigate('/admin/protocols/new')}>{t('admin.protocols.prepareButton')}</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', ...STATUSES] as const).map((status) => (
          <button
            key={status}
            onClick={() => setActiveFilter(status)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap ${
              activeFilter === status
                ? 'border-turquoise-500 bg-turquoise-500/10 text-turquoise-400'
                : 'border-navy-700 bg-navy-900 text-sand-300 hover:text-sand-100'
            }`}
          >
            {status === 'all' ? t('admin.protocols.statusAll') : t(`protocolStatus.${status}`)} ({counts[status]})
          </button>
        ))}
      </div>

      {error && <Alert variant="error" message={error} />}
      {deleteError && <Alert variant="error" message={deleteError} />}
      {!error && !rows && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

      {rows && (
        <Card className={adminTableWrapClass}>
          <table className="w-full text-left text-sm">
            <thead className={adminTheadClass}>
              <tr>
                <th className={adminCellClass}>{t('admin.protocols.number')}</th>
                <th className={adminCellClass}>{t('admin.protocols.createdAt')}</th>
                <th className={adminCellClass}>{t('admin.protocols.studentCount')}</th>
                <th className={adminCellClass}>{t('admin.applications.status')}</th>
                <th className={adminCellClass} />
              </tr>
            </thead>
            <tbody>
              {visibleRows?.map((r) => (
                <tr
                  key={r.id}
                  className={adminRowClickableClass}
                  onClick={() => navigate(`/admin/protocols/${r.id}`)}
                >
                  <td className={`${adminCellClass} font-semibold text-sand-100`}>№{r.number}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{formatDate(r.created_at)}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{r.studentCount}</td>
                  <td className={adminCellClass}>
                    <ProtocolStatusBadge status={r.status} />
                  </td>
                  <td className={adminCellClass} onClick={(e) => e.stopPropagation()}>
                    {r.status === 'pending' && <DeleteIconButton onClick={() => setDeleteTarget(r)} />}
                  </td>
                </tr>
              ))}
              {visibleRows?.length === 0 && (
                <tr>
                  <td className={`${adminCellClass} text-sand-300`} colSpan={5}>
                    {t('admin.protocols.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('admin.protocols.deleteTitle')}
        message={t('admin.protocols.deleteConfirm')}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
