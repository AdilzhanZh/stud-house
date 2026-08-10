import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { createProtocol, listEligibleApplications } from '../../../api/protocolApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import { downloadProtocolPdf } from '../../../utils/protocolPdf'
import type { Application } from '../../../types/applications'
import type { User } from '../../../types'

interface Candidate {
  application: Application
  student: User | null
  dormitoryName: string
}

export function ProtocolCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([listEligibleApplications(), listUsers('student'), listDormitories()])
      .then(([applications, students, dormitories]) => {
        const studentsById = new Map(students.map((s) => [s.id, s]))
        const dormNamesById = new Map(dormitories.map((d) => [d.id, d.name]))
        setCandidates(
          applications.map((a) => ({
            application: a,
            student: studentsById.get(a.student_id) ?? null,
            dormitoryName: dormNamesById.get(a.dormitory_id) ?? a.dormitory_id,
          })),
        )
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.protocols.loadError'))))
  }, [t])

  function toggleSelected(applicationId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(applicationId)) next.delete(applicationId)
      else next.add(applicationId)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      candidates && prev.size === candidates.length
        ? new Set()
        : new Set(candidates?.map((c) => c.application.id)),
    )
  }

  async function handleSubmit() {
    if (!candidates || selectedIds.size === 0) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const selected = candidates.filter((c) => selectedIds.has(c.application.id))
      const protocol = await createProtocol(Array.from(selectedIds))
      try {
        await downloadProtocolPdf(
          {
            protocolNumber: protocol.number,
            studentNames: selected.map((c) => c.student?.full_name ?? c.application.student_id),
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
              <label className="mb-3 flex items-center gap-2 text-sm font-medium text-sand-200">
                <input
                  type="checkbox"
                  checked={selectedIds.size === candidates.length}
                  onChange={toggleSelectAll}
                />
                {t('admin.protocols.selectAll')}
              </label>
              <ul className="flex flex-col gap-2">
                {candidates.map(({ application, student, dormitoryName }) => (
                  <li key={application.id}>
                    <label className="flex items-center gap-2 text-sm text-sand-200">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(application.id)}
                        onChange={() => toggleSelected(application.id)}
                      />
                      <span className="font-medium text-sand-100">{student?.full_name ?? application.student_id}</span>
                      <span className="text-sand-300/70"> — {dormitoryName}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {submitError && <Alert variant="error" message={submitError} />}
      <Button
        onClick={handleSubmit}
        isLoading={isSubmitting}
        disabled={!candidates || selectedIds.size === 0}
        className="self-start"
      >
        {t('admin.protocols.prepareButton')}
      </Button>
    </div>
  )
}
