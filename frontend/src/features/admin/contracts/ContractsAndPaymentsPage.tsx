import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { ContractStatusBadge } from '../../../components/ContractStatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { contractManagerDecision, listContracts } from '../../../api/contractAdminApi'
import { getApplication } from '../../../api/applicationApi'
import { listUsers } from '../../../api/adminUserApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { formatTimeElapsed } from '../../contracts/deadline'
import {
  adminCellClass,
  adminPageHeading,
  adminRowClickableClass,
  adminTableWrapClass,
  adminTheadClass,
} from '../adminTable'
import type { Contract } from '../../../types/contracts'

interface ContractRow extends Contract {
  studentName: string
  dormitoryName: string
}

export function ContractsAndPaymentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<ContractRow[] | null>(null)
  const [overdueContracts, setOverdueContracts] = useState<ContractRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [contractVoidTarget, setContractVoidTarget] = useState<string | null>(null)
  const [contractExtendTarget, setContractExtendTarget] = useState<string | null>(null)
  const [contractNewDeadline, setContractNewDeadline] = useState('')
  const [isContractSubmitting, setIsContractSubmitting] = useState(false)

  function load() {
    Promise.all([listContracts(), listUsers('student'), listDormitories()])
      .then(async ([allContracts, students, dormitories]) => {
        const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))
        const dormitoryNamesById = Object.fromEntries(dormitories.map((d) => [d.id, d.name]))

        const withContractNames = async (list: Contract[]): Promise<ContractRow[]> =>
          Promise.all(
            list.map(async (c) => {
              const app = await getApplication(c.application_id).catch(() => null)
              return {
                ...c,
                studentName: app ? (namesById[app.student_id] ?? app.student_id) : '—',
                dormitoryName: app ? (dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id) : '—',
              }
            }),
          )

        setContracts(await withContractNames(allContracts))
        setOverdueContracts(
          await withContractNames(allContracts.filter((c) => c.status === 'awaiting_manager_decision')),
        )
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  useEffect(load, [])

  async function handleContractVoid() {
    if (!contractVoidTarget) return
    setActionError(null)
    setIsContractSubmitting(true)
    try {
      await contractManagerDecision(contractVoidTarget, { action: 'void' })
      setContractVoidTarget(null)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, t('admin.common.actionFailed')))
    } finally {
      setIsContractSubmitting(false)
    }
  }

  async function handleContractExtend() {
    if (!contractExtendTarget || !contractNewDeadline) return
    setActionError(null)
    setIsContractSubmitting(true)
    try {
      await contractManagerDecision(contractExtendTarget, {
        action: 'extend',
        new_deadline: new Date(contractNewDeadline).toISOString(),
      })
      setContractExtendTarget(null)
      setContractNewDeadline('')
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, t('admin.contracts.extendFailed')))
    } finally {
      setIsContractSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className={adminPageHeading}>{t('admin.layout.contracts')}</h1>
        <Button variant="secondary" onClick={() => navigate('/admin/contracts/contract-template')}>
          {t('admin.contracts.contractTemplateButton')}
        </Button>
      </div>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}

      <div>
        <p className="mb-3 text-[15px] font-bold text-sand-100">{t('admin.contracts.title')}</p>
        {!contracts ? (
          <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>
        ) : (
          <Card className={adminTableWrapClass}>
            <table className="w-full text-left text-sm">
              <thead className={adminTheadClass}>
                <tr>
                  <th className={adminCellClass}>{t('admin.applications.student')}</th>
                  <th className={adminCellClass}>{t('admin.layout.dormitories')}</th>
                  <th className={adminCellClass}>{t('admin.applications.status')}</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr
                    key={c.id}
                    className={adminRowClickableClass}
                    onClick={() => navigate(`/admin/contracts/${c.id}`)}
                  >
                    <td className={`${adminCellClass} font-semibold text-sand-100`}>{c.studentName}</td>
                    <td className={`${adminCellClass} text-sand-300`}>{c.dormitoryName}</td>
                    <td className={adminCellClass}>
                      <ContractStatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
                {contracts.length === 0 && (
                  <tr>
                    <td className={`${adminCellClass} text-sand-300`} colSpan={3}>
                      {t('admin.contracts.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {overdueContracts && overdueContracts.length > 0 && (
        <div>
          <p className="mb-1 text-[15px] font-bold text-sand-100">{t('admin.contracts.overdueTitle')}</p>
          <p className="mb-3 text-sm text-sand-300">{t('admin.contracts.overdueHint')}</p>
          <div className="flex flex-col gap-3">
            {overdueContracts.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sand-100">{c.studentName}</p>
                    <p className="text-sm text-sand-300">{c.dormitoryName}</p>
                    <p className="text-sm text-sand-200">{t('admin.contracts.deadlinePrefix')} {formatTimeElapsed(c.response_deadline, t)}</p>
                  </div>
                  {contractExtendTarget !== c.id && (
                    <div className="flex gap-2.5">
                      <Button variant="danger" onClick={() => setContractVoidTarget(c.id)}>
                        {t('admin.contracts.void')}
                      </Button>
                      <Button variant="secondary" onClick={() => setContractExtendTarget(c.id)}>
                        {t('admin.contracts.extendDeadline')}
                      </Button>
                    </div>
                  )}
                </div>
                {contractExtendTarget === c.id && (
                  <div className="mt-3.5 flex flex-col gap-3">
                    <input
                      type="datetime-local"
                      className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
                      value={contractNewDeadline}
                      onChange={(e) => setContractNewDeadline(e.target.value)}
                    />
                    <div className="flex gap-2.5">
                      <Button onClick={handleContractExtend} isLoading={isContractSubmitting} disabled={!contractNewDeadline}>
                        {t('common.confirm')}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setContractExtendTarget(null)
                          setContractNewDeadline('')
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={contractVoidTarget !== null}
        title={t('admin.contracts.voidContractTitle')}
        message={t('admin.contracts.voidContractConfirm')}
        danger
        isLoading={isContractSubmitting}
        onConfirm={handleContractVoid}
        onCancel={() => setContractVoidTarget(null)}
      />
    </div>
  )
}
