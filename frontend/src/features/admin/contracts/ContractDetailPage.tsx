import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ContractStatusBadge } from '../../../components/ContractStatusBadge'
import { TemplatePages } from '../../../components/TemplatePages'
import { extractErrorMessage } from '../../../api/client'
import { listContracts } from '../../../api/contractAdminApi'
import { getApplication } from '../../../api/applicationApi'
import { getDormitory } from '../../../api/dormitoryApi'
import { getRoom } from '../../../api/roomApi'
import { listUsers } from '../../../api/adminUserApi'
import { formatTenge } from '../../../utils/dormitoryLabels'
import { formatDate } from '../../../utils/dateFormat'
import { downloadContractPdf, getFilledContractPages } from '../../../utils/contractPdf'
import { adminPageHeading } from '../adminTable'
import type { ContractFieldValues } from '../../../utils/contractPdf'
import type { ContractLanguage } from '../../../api/contractTemplateApi'
import type { Contract } from '../../../types/contracts'

const LANGUAGES: ContractLanguage[] = ['kk', 'ru']

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [contract, setContract] = useState<Contract | null>(null)
  const [studentName, setStudentName] = useState('')
  const [dormitoryName, setDormitoryName] = useState('')
  const [pagesByLanguage, setPagesByLanguage] = useState<Record<ContractLanguage, string[]> | null>(null)
  const [language, setLanguage] = useState<ContractLanguage>(i18n.language === 'ru' ? 'ru' : 'kk')
  const [error, setError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadValues, setDownloadValues] = useState<ContractFieldValues | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([listContracts(), listUsers('student')])
      .then(async ([contracts, students]) => {
        const found = contracts.find((c) => c.id === id)
        if (!found) {
          setError(t('admin.contracts.notFound'))
          return
        }
        setContract(found)

        const app = await getApplication(found.application_id)
        const [dormitory, room] = await Promise.all([
          getDormitory(app.dormitory_id),
          app.assigned_room_id ? getRoom(app.assigned_room_id).catch(() => null) : Promise.resolve(null),
        ])
        const student = students.find((s) => s.id === app.student_id)

        setStudentName(student?.full_name ?? app.student_id)
        setDormitoryName(dormitory.name)

        const values: ContractFieldValues = {
          student_full_name: student?.full_name ?? '',
          student_iin: student?.iin ?? '',
          student_phone: student?.phone ?? '',
          study_group: app.study_group,
          room_number: room?.room_number ?? '',
          dormitory_name: dormitory.name,
          dormitory_address: dormitory.address,
          monthly_payment_bachelor: formatTenge(dormitory.monthly_payment_bachelor),
          monthly_payment_master: formatTenge(dormitory.monthly_payment_master),
          monthly_payment_doctorate: formatTenge(dormitory.monthly_payment_doctorate),
          yearly_payment_bachelor: formatTenge(dormitory.yearly_payment_bachelor),
          yearly_payment_master: formatTenge(dormitory.yearly_payment_master),
          yearly_payment_doctorate: formatTenge(dormitory.yearly_payment_doctorate),
          date: formatDate(found.sent_at),
        }
        setDownloadValues(values)
        const [kk, ru] = await Promise.all([
          getFilledContractPages(values, 'kk'),
          getFilledContractPages(values, 'ru'),
        ])
        setPagesByLanguage({ kk, ru })
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.common.loadError'))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t])

  async function handleDownload() {
    if (!downloadValues) return
    setDownloadError(null)
    setIsDownloading(true)
    try {
      await downloadContractPdf(downloadValues, `${studentName || 'contract'}-${language}.pdf`, language)
    } catch (err) {
      setDownloadError(extractErrorMessage(err, t('contracts.downloadFailed')))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/contracts')}
          aria-label={t('wizard.back')}
          className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-sand-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className={adminPageHeading}>{t('admin.contracts.detailTitle')}</h1>
      </div>

      {error && <Alert variant="error" message={error} />}
      {downloadError && <Alert variant="error" message={downloadError} />}

      {contract && (
        <Card className="flex !flex-row items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-sand-100">{studentName}</p>
            <p className="text-sm text-sand-300">{dormitoryName}</p>
          </div>
          <ContractStatusBadge status={contract.status} />
        </Card>
      )}

      {pagesByLanguage ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
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
          <TemplatePages pages={pagesByLanguage[language]} />
          <Button variant="secondary" className="self-start" isLoading={isDownloading} onClick={handleDownload}>
            {t('contracts.download')}
          </Button>
        </div>
      ) : (
        !error && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>
      )}
    </div>
  )
}
