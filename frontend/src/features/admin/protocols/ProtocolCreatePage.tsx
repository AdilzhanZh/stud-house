import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { createProtocol, listProtocolCandidates } from '../../../api/protocolApi'
import { downloadProtocolPdf } from '../../../utils/protocolPdf'
import { MAX_PROTOCOL_STUDENTS, type ProtocolCandidate } from '../../../types/protocols'

// A student can have more than one approved application, so an applicant's
// row is identified by the application and only a resident's by the student.
function candidateKey(c: ProtocolCandidate): string {
  return c.application_id ?? c.student_id
}

export function ProtocolCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [candidates, setCandidates] = useState<ProtocolCandidate[] | null>(null)
  const [dormitoryFilter, setDormitoryFilter] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    listProtocolCandidates()
      .then(setCandidates)
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.protocols.loadError'))))
  }, [t])

  const dormitoryOptions = useMemo(() => {
    const options = new Map<string, { name: string; count: number }>()
    candidates?.forEach((c) => {
      const option = options.get(c.dormitory_id) ?? { name: c.dormitory_name, count: 0 }
      option.count += 1
      options.set(c.dormitory_id, option)
    })
    return Array.from(options, ([id, option]) => ({ id, ...option })).sort((a, b) =>
      a.name.localeCompare(b.name, 'kk'),
    )
  }, [candidates])

  const visible = useMemo(
    () => (candidates ?? []).filter((c) => !dormitoryFilter || c.dormitory_id === dormitoryFilter),
    [candidates, dormitoryFilter],
  )

  const isAtLimit = selectedKeys.size >= MAX_PROTOCOL_STUDENTS
  // "Select all" can only ever take the first MAX_PROTOCOL_STUDENTS rows.
  const allSelected = selectedKeys.size > 0 && selectedKeys.size === Math.min(visible.length, MAX_PROTOCOL_STUDENTS)

  // The selection is cleared rather than carried over, so a protocol meant for
  // one dormitory can't silently include students ticked under another filter.
  function changeDormitoryFilter(dormitoryId: string) {
    setDormitoryFilter(dormitoryId)
    setSelectedKeys(new Set())
  }

  function toggleSelected(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else if (next.size < MAX_PROTOCOL_STUDENTS) next.add(key)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedKeys(allSelected ? new Set() : new Set(visible.slice(0, MAX_PROTOCOL_STUDENTS).map(candidateKey)))
  }

  async function handleSubmit() {
    if (selectedKeys.size === 0) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const selected = visible.filter((c) => selectedKeys.has(candidateKey(c)))
      const protocol = await createProtocol(
        selected.flatMap((c) => (c.application_id ? [c.application_id] : [])),
        selected.filter((c) => !c.application_id).map((c) => c.student_id),
      )
      try {
        await downloadProtocolPdf(
          {
            protocolNumber: protocol.number,
            students: selected.map((c) => ({ name: c.student_full_name, dormitoryName: c.dormitory_name })),
          },
          `khattama-${protocol.number}.pdf`,
        )
      } catch {
        // Best-effort — the protocol itself is already created; the manager
        // can still open/download it again from the detail page.
      }
      navigate(`/admin/protocols/${protocol.id}`)
    } catch (err) {
      setSubmitError(extractErrorMessage(err, t('admin.protocols.createFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h1 className="text-[23px] font-bold text-sand-100">{t('admin.protocols.prepareButton')}</h1>
        <Button variant="secondary" onClick={() => navigate('/admin/protocols')}>
          ← {t('admin.protocols.backToProtocols')}
        </Button>
      </div>

      {loadError && <Alert variant="error" message={loadError} />}
      {!loadError && !candidates && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

      {candidates && (
        <Card title={t('admin.protocols.gatherStudents')}>
          {candidates.length === 0 ? (
            <p className="text-sm text-sand-300">{t('admin.protocols.noEligibleApplications')}</p>
          ) : (
            <>
              <label className="mb-3 flex flex-col gap-1.5 text-sm font-medium text-sand-200">
                {t('admin.protocols.filterByDormitory')}
                <select
                  value={dormitoryFilter}
                  onChange={(e) => changeDormitoryFilter(e.target.value)}
                  className="max-w-sm rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
                >
                  <option value="">
                    {t('admin.protocols.allDormitories')} ({candidates.length})
                  </option>
                  {dormitoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.count})
                    </option>
                  ))}
                </select>
              </label>

              {/* Stays in view while scrolling: the list can run to hundreds of
                  students, and the submit button shouldn't be at its far end. */}
              <div className="sticky top-4 z-10 mb-3 flex flex-col gap-3 rounded-2xl bg-navy-800 p-3 ring-1 ring-turquoise-400/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-sand-200">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                    {t('admin.protocols.selectAll')}
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-sand-300">
                      {t('admin.protocols.selectedCount', { count: selectedKeys.size, max: MAX_PROTOCOL_STUDENTS })}
                    </span>
                    <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={selectedKeys.size === 0}>
                      {t('admin.protocols.prepareButton')}
                    </Button>
                  </div>
                </div>
                {isAtLimit && (
                  <Alert
                    variant="warning"
                    message={t('admin.protocols.selectionLimit', { max: MAX_PROTOCOL_STUDENTS })}
                  />
                )}
                {submitError && <Alert variant="error" message={submitError} />}
              </div>

              <ul className="flex flex-col gap-2">
                {visible.map((c) => {
                  const key = candidateKey(c)
                  const isSelected = selectedKeys.has(key)
                  return (
                    <li key={key}>
                      <label className="flex items-center gap-2 text-sm text-sand-200">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isSelected && isAtLimit}
                          onChange={() => toggleSelected(key)}
                        />
                        <span className="font-medium text-sand-100">{c.student_full_name}</span>
                        <span className="text-sand-300/70">
                          {' '}
                          — {c.dormitory_name}
                          {!c.application_id && ` · ${t('admin.protocols.residentLabel')}`}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
