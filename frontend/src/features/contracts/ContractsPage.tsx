import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check } from 'lucide-react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContractStatusBadge } from '../../components/ContractStatusBadge'
import { TemplatePages } from '../../components/TemplatePages'
import { extractErrorMessage } from '../../api/client'
import { listMyContracts, respondContract } from '../../api/contractApi'
import { getApplication } from '../../api/applicationApi'
import { getDormitory } from '../../api/dormitoryApi'
import { getRoom } from '../../api/roomApi'
import { formatTenge } from '../../utils/dormitoryLabels'
import { formatDate } from '../../utils/dateFormat'
import { getFilledContractPages, downloadContractPdf } from '../../utils/contractPdf'
import { formatTimeRemaining } from './deadline'
import { useIsSettled } from '../residence/useIsSettled'
import { useAuth } from '../auth/useAuth'
import type { ContractLanguage } from '../../api/contractTemplateApi'
import type { Contract } from '../../types/contracts'
import type { Dormitory } from '../../types/dormitories'

type PendingAction = { contractId: string; action: 'accept' | 'decline' } | null
type PagesByLanguage = Record<ContractLanguage, string[]>

const LANGUAGES: ContractLanguage[] = ['kk', 'ru']

export function ContractsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  // Contract.status stays 'accepted' forever, even after the student later
  // exits the room (an exit request only touches room_residents, not the
  // contract) — so the "you're settled, here's how to pay" block must also
  // check the student's live residence, not just the contract's status.
  const isSettled = useIsSettled()
  const [contracts, setContracts] = useState<Contract[] | null>(null)
  const [dormitoryByContract, setDormitoryByContract] = useState<Record<string, Dormitory>>({})
  const [documentByContract, setDocumentByContract] = useState<Record<string, PagesByLanguage>>({})
  const [languageByContract, setLanguageByContract] = useState<Record<string, ContractLanguage>>({})
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())

  // Default to the Russian template only when the site itself is in Russian
  // — every other UI language (including English) falls back to Kazakh.
  const defaultLanguage: ContractLanguage = i18n.language === 'ru' ? 'ru' : 'kk'

  function load() {
    listMyContracts()
      .then(async (list) => {
        setContracts(list)
        const entries = await Promise.all(
          list.map(async (c) => {
            const app = await getApplication(c.application_id).catch(() => null)
            if (!app) return null
            const dormitory = await getDormitory(app.dormitory_id).catch(() => null)
            const room = app.assigned_room_id ? await getRoom(app.assigned_room_id).catch(() => null) : null
            return dormitory ? { contract: c, app, dormitory, room } : null
          }),
        )
        const withDormitory = entries.filter((e): e is NonNullable<typeof e> => e !== null)
        setDormitoryByContract(Object.fromEntries(withDormitory.map((e) => [e.contract.id, e.dormitory])))
        setLanguageByContract(Object.fromEntries(withDormitory.map((e) => [e.contract.id, defaultLanguage])))

        if (!user) return
        const filled = await Promise.all(
          withDormitory.map(async (e) => {
            const values = {
              student_full_name: user.full_name,
              student_iin: user.iin ?? '',
              student_phone: user.phone,
              study_group: e.app.study_group,
              room_number: e.room?.room_number ?? '',
              dormitory_name: e.dormitory.name,
              dormitory_address: e.dormitory.address,
              monthly_payment_bachelor: formatTenge(e.dormitory.monthly_payment_bachelor),
              monthly_payment_master: formatTenge(e.dormitory.monthly_payment_master),
              monthly_payment_doctorate: formatTenge(e.dormitory.monthly_payment_doctorate),
              yearly_payment_bachelor: formatTenge(e.dormitory.yearly_payment_bachelor),
              yearly_payment_master: formatTenge(e.dormitory.yearly_payment_master),
              yearly_payment_doctorate: formatTenge(e.dormitory.yearly_payment_doctorate),
              date: formatDate(e.contract.sent_at),
            }
            const [kk, ru] = await Promise.all([
              getFilledContractPages(values, 'kk').catch(() => null),
              getFilledContractPages(values, 'ru').catch(() => null),
            ])
            return kk && ru ? ([e.contract.id, { kk, ru }] as const) : null
          }),
        )
        setDocumentByContract(Object.fromEntries(filled.filter((e): e is [string, PagesByLanguage] => e !== null)))
      })
      .catch((err) => setError(extractErrorMessage(err, t('contracts.loadError'))))
  }

  useEffect(load, [t, user])

  async function handleDownload(contract: Contract, dormitory: Dormitory | undefined) {
    if (!user) return
    const language = languageByContract[contract.id] ?? defaultLanguage
    setDocumentError(null)
    setDownloadingId(contract.id)
    try {
      const app = await getApplication(contract.application_id)
      const room = app.assigned_room_id ? await getRoom(app.assigned_room_id).catch(() => null) : null
      await downloadContractPdf(
        {
          student_full_name: user.full_name,
          student_iin: user.iin ?? '',
          student_phone: user.phone,
          study_group: app.study_group,
          room_number: room?.room_number ?? '',
          dormitory_name: dormitory?.name ?? '',
          dormitory_address: dormitory?.address ?? '',
          monthly_payment_bachelor: formatTenge(dormitory?.monthly_payment_bachelor),
          monthly_payment_master: formatTenge(dormitory?.monthly_payment_master),
          monthly_payment_doctorate: formatTenge(dormitory?.monthly_payment_doctorate),
          yearly_payment_bachelor: formatTenge(dormitory?.yearly_payment_bachelor),
          yearly_payment_master: formatTenge(dormitory?.yearly_payment_master),
          yearly_payment_doctorate: formatTenge(dormitory?.yearly_payment_doctorate),
          date: formatDate(contract.sent_at),
        },
        `${t('contracts.contractFallback')}-${language}.pdf`,
        language,
      )
    } catch (err) {
      setDocumentError(extractErrorMessage(err, t('contracts.downloadFailed')))
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleConfirm() {
    if (!pendingAction) return
    setActionError(null)
    setIsSubmitting(true)
    try {
      await respondContract(pendingAction.contractId, pendingAction.action)
      setPendingAction(null)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, t('contracts.actionFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-[23px] font-bold text-sand-100">{t('nav.contract')}</h1>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}
      {documentError && <Alert variant="error" message={documentError} />}
      {!error && !contracts && <p className="text-sm text-sand-300">{t('contracts.loading')}</p>}
      {contracts && contracts.length === 0 && <p className="text-sm text-sand-300">{t('contracts.empty')}</p>}

      <div className="flex flex-col gap-3.5">
        {contracts?.map((contract) => {
          const dormitory = dormitoryByContract[contract.id]
          const pagesByLang = documentByContract[contract.id]
          const language = languageByContract[contract.id] ?? defaultLanguage
          return (
            <Card key={contract.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-sand-100">
                    {dormitory?.name ?? t('contracts.contractFallback')}
                  </p>
                  {contract.status === 'sent' && (
                    <p className="mt-0.5 text-sm font-semibold text-clay-400">
                      {t('contracts.respondBy', { time: formatTimeRemaining(contract.response_deadline, t) })}
                    </p>
                  )}
                </div>
                <ContractStatusBadge status={contract.status} />
              </div>

              {pagesByLang ? (
                <div className="mt-3.5 flex flex-col gap-2.5">
                  <div className="flex gap-2">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguageByContract((prev) => ({ ...prev, [contract.id]: lang }))}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                          language === lang
                            ? 'border-turquoise-500 bg-turquoise-500/10 text-turquoise-400'
                            : 'border-navy-700 bg-navy-900 text-sand-300 hover:text-sand-100'
                        }`}
                      >
                        {t(`contracts.language.${lang}`)}
                      </button>
                    ))}
                  </div>
                  <TemplatePages pages={pagesByLang[language]} />
                  <Button
                    variant="secondary"
                    className="self-start"
                    isLoading={downloadingId === contract.id}
                    onClick={() => handleDownload(contract, dormitory)}
                  >
                    {t('contracts.download')}
                  </Button>
                </div>
              ) : (
                dormitory &&
                (dormitory.monthly_payment_bachelor != null || dormitory.yearly_payment_bachelor != null) && (
                  <div className="mt-3.5 flex flex-col gap-1.5 rounded-2xl border border-navy-700 bg-navy-950 p-3.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-sand-300">{t('dorm.monthlyPayment')}</span>
                      <span className="font-semibold text-sand-100">
                        {formatTenge(dormitory.monthly_payment_bachelor)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-sand-300">{t('dorm.yearlyPayment')}</span>
                      <span className="font-semibold text-sand-100">
                        {formatTenge(dormitory.yearly_payment_bachelor)}
                      </span>
                    </div>
                  </div>
                )
              )}

              {contract.status === 'sent' && (
                <div className="mt-3.5 flex flex-wrap gap-2.5">
                  {acknowledged.has(contract.id) ? (
                    <>
                      <Button
                        className="flex-1 min-w-35"
                        onClick={() => setPendingAction({ contractId: contract.id, action: 'accept' })}
                      >
                        {t('contracts.accept')}
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1 min-w-35"
                        onClick={() => setPendingAction({ contractId: contract.id, action: 'decline' })}
                      >
                        {t('contracts.decline')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="flex-1 min-w-35"
                      onClick={() => setAcknowledged((prev) => new Set(prev).add(contract.id))}
                    >
                      {t('contracts.acknowledgeAccept')}
                    </Button>
                  )}
                </div>
              )}

              {contract.status === 'awaiting_manager_decision' && (
                <p className="mt-3.5 text-sm text-sand-200">{t('contracts.awaitingManagerText')}</p>
              )}

              {contract.status === 'accepted' && isSettled && (
                <div className="mt-3.5 flex flex-col gap-2.5 rounded-2xl bg-mint-500/10 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 shrink-0 text-mint-400" />
                    <p className="flex-1 text-sm font-semibold text-mint-400">{t('contracts.settledText')}</p>
                    <Button variant="secondary" onClick={() => navigate('/my-residence')}>
                      {t('contracts.goToResidence')}
                    </Button>
                  </div>
                  <p className="text-sm text-sand-200">{t('contracts.paymentInfoHint')}</p>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {contracts && contracts.some((c) => c.status === 'sent') && (
        <Card className="flex !flex-row items-center gap-3">
          <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-navy-800">
            <AlertCircle className="h-4.5 w-4.5 text-sand-200" />
          </span>
          <p className="text-sm text-sand-200">{t('contracts.footerHint')}</p>
        </Card>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.action === 'accept' ? t('contracts.acceptTitle') : t('contracts.declineTitle')}
        message={pendingAction?.action === 'accept' ? t('contracts.acceptConfirm') : t('contracts.declineConfirm')}
        danger={pendingAction?.action === 'decline'}
        isLoading={isSubmitting}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}
