import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { BedSingle, ChevronDown, ChevronRight, Download, Search } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { BedStatusBadge } from '../../../components/BedStatusBadge'
import { bedStatusDotClass } from '../../../utils/bedStatus'
import { extractErrorMessage } from '../../../api/client'
import { getRegistry } from '../../../api/hierarchyApi'
import { floorLabel } from '../../../utils/roomLocation'
import { adminPageHeading } from '../adminTable'
import type { RegistryObject } from '../../../types/hierarchy'
import { BED_STATUSES, type BedStatus } from '../../../types/rooms'

// Keeps only beds with the given status, dropping branches left empty.
function filterByStatus(tree: RegistryObject[], status: BedStatus | null): RegistryObject[] {
  if (!status) return tree
  return tree.flatMap((d) => {
    const dormitories = d.dormitories.flatMap((b) => {
      const floors = b.floors.flatMap((f) => {
        const rooms = f.rooms.flatMap((r) => {
          const beds = r.beds.filter((bd) => bd.status === status)
          return beds.length > 0 ? [{ ...r, beds }] : []
        })
        return rooms.length > 0 ? [{ ...f, rooms }] : []
      })
      return floors.length > 0 ? [{ ...b, floors }] : []
    })
    return dormitories.length > 0 ? [{ ...d, dormitories }] : []
  })
}

function countStatuses(tree: RegistryObject[]): Record<BedStatus, number> {
  const out = Object.fromEntries(BED_STATUSES.map((s) => [s, 0])) as Record<BedStatus, number>
  for (const d of tree)
    for (const b of d.dormitories)
      for (const f of b.floors) for (const r of f.rooms) for (const bd of r.beds) out[bd.status] += 1
  return out
}

// Keeps a node when it matches the search itself (then with everything under
// it) or when something under it matches (then only the matching branches).
function filterRegistry(tree: RegistryObject[], query: string, t: TFunction): RegistryObject[] {
  const q = query.trim().toLowerCase()
  if (!q) return tree
  const hit = (...values: (string | null | undefined)[]) => values.some((v) => v?.toLowerCase().includes(q))
  const out: RegistryObject[] = []
  for (const d of tree) {
    if (hit(d.name, d.owner_name, d.ownership_form)) {
      out.push(d)
      continue
    }
    const dormitories = d.dormitories.flatMap((b) => {
      if (hit(b.name, b.address)) return [b]
      const floors = b.floors.flatMap((f) => {
        if (hit(floorLabel(f, t))) return [f]
        const rooms = f.rooms.flatMap((r) => {
          if (hit(r.room_number)) return [r]
          const beds = r.beds.filter((bd) => hit(bd.code, bd.label))
          return beds.length > 0 ? [{ ...r, beds }] : []
        })
        return rooms.length > 0 ? [{ ...f, rooms }] : []
      })
      return floors.length > 0 ? [{ ...b, floors }] : []
    })
    if (dormitories.length > 0) out.push({ ...d, dormitories })
  }
  return out
}

function countBeds(rooms: { beds: { occupied: boolean }[] }[]) {
  let total = 0
  let occupied = 0
  for (const r of rooms) {
    total += r.beds.length
    occupied += r.beds.filter((b) => b.occupied).length
  }
  return { total, occupied }
}

function csvCell(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// One row per bed (or per empty building/floor/room), semicolon-separated
// with a BOM so Excel opens it with the right columns and Cyrillic intact.
function exportCsv(tree: RegistryObject[], t: TFunction) {
  const header = [
    t('admin.objects.objectLabel'), 'ID',
    t('admin.objects.buildingLabel'), 'ID', t('admin.objects.addressColumn'),
    t('admin.rooms.floorField'), 'ID',
    t('admin.dormitories.roomNumber'), 'ID',
    t('admin.rooms.bedField'), t('admin.rooms.bedCodeColumn'), 'ID',
    t('admin.rooms.statusColumn'),
    t('admin.rooms.serviceReasonColumn'),
    t('admin.rooms.serviceUntilColumn'),
  ]
  const lines = [header]
  for (const d of tree) {
    const dorm = [d.name, d.id]
    if (d.dormitories.length === 0) lines.push([...dorm])
    for (const b of d.dormitories) {
      const building = [...dorm, b.name, b.id, b.address]
      if (b.floors.length === 0) lines.push(building)
      for (const f of b.floors) {
        const floor = [...building, floorLabel(f, t), f.id]
        if (f.rooms.length === 0) lines.push(floor)
        for (const r of f.rooms) {
          const room = [...floor, r.room_number, r.id]
          if (r.beds.length === 0) lines.push(room)
          for (const bd of r.beds) {
            lines.push([
              ...room, bd.label, bd.code, bd.id,
              t(`admin.rooms.bedStatus.${bd.status}`),
              bd.service_reason ?? '',
              bd.service_until ?? '',
            ])
          }
        }
      }
    }
  }
  const csv = '﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `registry-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function Toggle({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full min-w-0 items-center gap-2 py-1.5 text-left">
      {open ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-sand-400" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-sand-400" />
      )}
      {children}
    </button>
  )
}

const idClass = 'font-mono text-[11px] text-sand-400'
const summaryClass = 'ml-auto shrink-0 text-xs text-sand-300'

export function RegistryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tree, setTree] = useState<RegistryObject[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BedStatus | null>(null)
  // Expanded node ids; objects start open. While searching every
  // matching branch is shown open.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    getRegistry()
      .then((data) => {
        setTree(data)
        setExpanded(new Set(data.map((d) => d.id)))
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.common.loadError'))))
  }, [])

  const searched = useMemo(() => (tree ? filterRegistry(tree, search, t) : []), [tree, search, t])
  const visible = useMemo(() => filterByStatus(searched, statusFilter), [searched, statusFilter])
  const statusTotals = useMemo(() => countStatuses(searched), [searched])
  const searching = search.trim() !== '' || statusFilter != null
  const isOpen = (id: string) => searching || expanded.has(id)
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function expandAll() {
    if (!tree) return
    const ids = new Set<string>()
    for (const d of tree) {
      ids.add(d.id)
      for (const b of d.dormitories) {
        ids.add(b.id)
        for (const f of b.floors) {
          ids.add(f.id)
          for (const r of f.rooms) ids.add(r.id)
        }
      }
    }
    setExpanded(ids)
  }

  if (error) return <Alert variant="error" message={error} />
  if (!tree) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className={adminPageHeading}>{t('admin.rooms.registryTitle')}</h1>
        <p className="mt-1 text-sm text-sand-300">{t('admin.rooms.registryHint')}</p>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-sand-100/15 bg-navy-900 px-3">
          <Search className="h-4 w-4 shrink-0 text-sand-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.rooms.registrySearch')}
            aria-label={t('admin.rooms.registrySearch')}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-sand-100 outline-none placeholder:text-sand-400/60"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('admin.rooms.registryStatusFilter')}>
          <button
            type="button"
            aria-pressed={statusFilter == null}
            onClick={() => setStatusFilter(null)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter == null ? 'bg-turquoise-500 text-on-accent' : 'bg-navy-800 text-sand-300 hover:bg-navy-700'
            }`}
          >
            {t('admin.rooms.registryAllStatuses')}
          </button>
          {BED_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === s ? 'bg-turquoise-500 text-on-accent' : 'bg-navy-800 text-sand-300 hover:bg-navy-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${bedStatusDotClass[s]}`} />
              {t(`admin.rooms.bedStatus.${s}`)}
              <span className="tabular-nums opacity-80">{statusTotals[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={expandAll} disabled={searching}>
            {t('admin.rooms.expandAll')}
          </Button>
          <Button variant="secondary" onClick={() => setExpanded(new Set())} disabled={searching}>
            {t('admin.rooms.collapseAll')}
          </Button>
          <Button variant="secondary" onClick={() => exportCsv(visible, t)} className="sm:ml-auto">
            <Download className="h-4 w-4" /> {t('admin.rooms.registryExport')}
          </Button>
        </div>
      </Card>

      {visible.length === 0 && <p className="text-sm text-sand-300">{t('admin.rooms.registryNothingFound')}</p>}

      {visible.map((d) => {
        const dormRooms = d.dormitories.flatMap((b) => b.floors.flatMap((f) => f.rooms))
        const dormBeds = countBeds(dormRooms)
        return (
          <Card key={d.id} className="!py-3">
            <Toggle open={isOpen(d.id)} onClick={() => toggle(d.id)}>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold text-sand-100">{d.name}</span>
                {(d.owner_name || d.ownership_form) && (
                  <span className="block truncate text-xs text-sand-300">
                    {[d.owner_name, d.ownership_form].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span className={idClass}>{d.id}</span>
              </span>
              <span className={summaryClass}>
                {t('admin.rooms.registryBedsSummary', { occupied: dormBeds.occupied, total: dormBeds.total })}
              </span>
            </Toggle>
            {isOpen(d.id) && (
              <ul className="ml-3 border-l border-navy-700 pl-3">
                {d.dormitories.map((b) => {
                  const bBeds = countBeds(b.floors.flatMap((f) => f.rooms))
                  return (
                    <li key={b.id}>
                      <Toggle open={isOpen(b.id)} onClick={() => toggle(b.id)}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-sand-100">{b.name}</span>
                          {b.address && <span className="block truncate text-xs text-sand-300">{b.address}</span>}
                          <span className={idClass}>{b.id}</span>
                        </span>
                        <span className={summaryClass}>
                          {t('admin.rooms.registryBedsSummary', { occupied: bBeds.occupied, total: bBeds.total })}
                        </span>
                      </Toggle>
                      {isOpen(b.id) && (
                        <ul className="ml-3 border-l border-navy-700 pl-3">
                          {b.floors.map((f) => {
                            const fBeds = countBeds(f.rooms)
                            return (
                              <li key={f.id}>
                                <Toggle open={isOpen(f.id)} onClick={() => toggle(f.id)}>
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm text-sand-100">{floorLabel(f, t)}</span>
                                    <span className={idClass}>{f.id}</span>
                                  </span>
                                  <span className={summaryClass}>
                                    {t('admin.rooms.floorRoomsCount', { count: f.rooms.length })} ·{' '}
                                    {t('admin.rooms.registryBedsSummary', { occupied: fBeds.occupied, total: fBeds.total })}
                                  </span>
                                </Toggle>
                                {isOpen(f.id) && (
                                  <ul className="ml-3 border-l border-navy-700 pl-3">
                                    {f.rooms.map((r) => {
                                      const rBeds = countBeds([r])
                                      return (
                                        <li key={r.id}>
                                          <Toggle open={isOpen(r.id)} onClick={() => toggle(r.id)}>
                                            <span className="min-w-0">
                                              <span className="block truncate text-sm text-sand-100">
                                                {t('dorm.rooms.roomNumber', { room: r.room_number })}
                                              </span>
                                              <span className={idClass}>{r.id}</span>
                                            </span>
                                            <span className={summaryClass}>
                                              {t('admin.rooms.registryBedsSummary', {
                                                occupied: rBeds.occupied,
                                                total: rBeds.total,
                                              })}
                                            </span>
                                          </Toggle>
                                          {isOpen(r.id) && (
                                            <ul className="mb-1 ml-3 flex flex-col gap-1 border-l border-navy-700 pl-3">
                                              {r.beds.map((bd) => (
                                                <li key={bd.id}>
                                                  <button
                                                    type="button"
                                                    onClick={() => navigate(`/admin/rooms/${r.id}/residents`)}
                                                    className="flex w-full flex-wrap items-center gap-x-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-navy-800/60"
                                                  >
                                                    <BedSingle className="h-3.5 w-3.5 shrink-0 text-sand-400" />
                                                    <span className="text-sand-100">
                                                      {t('admin.rooms.bedLabel', { label: bd.label })}
                                                    </span>
                                                    <span className="font-mono text-xs text-sand-400">{bd.code}</span>
                                                    {bd.service_reason && (
                                                      <span className="min-w-0 truncate text-xs text-sand-300">
                                                        {bd.service_reason}
                                                      </span>
                                                    )}
                                                    <span className="ml-auto">
                                                      <BedStatusBadge status={bd.status} />
                                                    </span>
                                                  </button>
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        )
      })}
    </div>
  )
}
