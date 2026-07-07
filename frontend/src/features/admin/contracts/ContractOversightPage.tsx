import { useEffect, useState } from 'react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { extractErrorMessage } from '../../../api/client'
import { contractManagerDecision, listContracts } from '../../../api/contractAdminApi'
import { getApplication } from '../../../api/applicationApi'
import { listUsers } from '../../../api/adminUserApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { formatTimeElapsed } from '../../contracts/deadline'
import type { Contract } from '../../../types/contracts'

interface Row extends Contract {
  studentName: string
  dormitoryName: string
}

export function ContractOversightPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [voidTarget, setVoidTarget] = useState<string | null>(null)
  const [voidError, setVoidError] = useState<string | null>(null)
  const [isVoiding, setIsVoiding] = useState(false)

  const [extendTarget, setExtendTarget] = useState<string | null>(null)
  const [newDeadline, setNewDeadline] = useState('')
  const [extendError, setExtendError] = useState<string | null>(null)
  const [isExtending, setIsExtending] = useState(false)

  function load() {
    setRows(null)
    listContracts('awaiting_manager_decision')
      .then(async (contracts) => {
        const [users, dormitories] = await Promise.all([listUsers('student'), listDormitories()])
        const namesById = Object.fromEntries(users.map((u) => [u.id, u.full_name]))
        const dormitoryNamesById = Object.fromEntries(dormitories.map((d) => [d.id, d.name]))
        const withNames = await Promise.all(
          contracts.map(async (c) => {
            const app = await getApplication(c.application_id).catch(() => null)
            return {
              ...c,
              studentName: app ? (namesById[app.student_id] ?? app.student_id) : '—',
              dormitoryName: app ? (dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id) : '—',
            }
          }),
        )
        setRows(withNames)
      })
      .catch((err) => setError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [])

  async function handleVoid() {
    if (!voidTarget) return
    setVoidError(null)
    setIsVoiding(true)
    try {
      await contractManagerDecision(voidTarget, { action: 'void' })
      setVoidTarget(null)
      load()
    } catch (err) {
      setVoidError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setIsVoiding(false)
    }
  }

  async function handleExtend() {
    if (!extendTarget || !newDeadline) return
    setExtendError(null)
    setIsExtending(true)
    try {
      await contractManagerDecision(extendTarget, {
        action: 'extend',
        new_deadline: new Date(newDeadline).toISOString(),
      })
      setExtendTarget(null)
      setNewDeadline('')
      load()
    } catch (err) {
      setExtendError(extractErrorMessage(err, 'Мерзімді ұзарту сәтсіз аяқталды'))
    } finally {
      setIsExtending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Келісімшарт қадағалауы</h1>
      <p className="text-sm text-gray-500">Мерзімі өтіп, менеджер шешімін күтетін келісімшарттар</p>

      {error && <Alert variant="error" message={error} />}
      {!error && !rows && <p className="text-sm text-gray-500">Жүктелуде...</p>}

      <div className="flex flex-col gap-3">
        {rows?.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">{c.studentName}</p>
                <p className="text-sm text-gray-500">{c.dormitoryName}</p>
                <p className="text-sm text-orange-600">
                  Мерзімі {formatTimeElapsed(c.response_deadline)}
                </p>
              </div>
              {extendTarget !== c.id && (
                <div className="flex gap-3">
                  <Button variant="danger" onClick={() => setVoidTarget(c.id)}>
                    Күшін жою
                  </Button>
                  <Button variant="secondary" onClick={() => setExtendTarget(c.id)}>
                    Мерзімді ұзарту
                  </Button>
                </div>
              )}
            </div>

            {extendTarget === c.id && (
              <div className="mt-4 flex flex-col gap-3">
                {extendError && <Alert variant="error" message={extendError} />}
                <input
                  type="datetime-local"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button onClick={handleExtend} isLoading={isExtending} disabled={!newDeadline}>
                    Растау
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setExtendTarget(null)
                      setNewDeadline('')
                      setExtendError(null)
                    }}
                  >
                    Бас тарту
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {rows && rows.length === 0 && (
          <p className="text-sm text-gray-500">Қаралатын келісімшарт жоқ</p>
        )}
      </div>

      <ConfirmDialog
        open={voidTarget !== null}
        title="Келісімшарттың күшін жою"
        message="Бұл әрекет өтінішті rejected етеді және қайтарылмайды. Жалғастырасыз ба?"
        danger
        isLoading={isVoiding}
        onConfirm={handleVoid}
        onCancel={() => {
          setVoidTarget(null)
          setVoidError(null)
        }}
      />
      {voidError && <Alert variant="error" message={voidError} />}
    </div>
  )
}
