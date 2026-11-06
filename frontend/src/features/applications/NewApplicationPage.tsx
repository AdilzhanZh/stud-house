import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Check, Upload } from 'lucide-react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { Input } from '../../components/Input'
import { SegmentedProgress } from '../../components/SegmentedProgress'
import { extractErrorMessage } from '../../api/client'
import { listDormitoryRequiredDocuments } from '../../api/dormitoryApi'
import {
  addApplicationDocument,
  createApplication,
  deleteApplication,
  listMyApplications,
} from '../../api/applicationApi'
import { assignOwnBenefit, listBenefitRequiredDocuments, listBenefits } from '../../api/benefitApi'
import { listRoomsByDormitory } from '../../api/roomApi'
import { getStudentProfile, updateStudentDetails } from '../../api/profileApi'
import { uploadFile } from '../../api/uploadApi'
import { generatePetitionPdfBlob, PETITION_RECEIPT_DOCUMENT_NAME } from '../../utils/petitionPdf'
import { downloadContractPdf, getFilledContractDocument } from '../../utils/contractPdf'
import { formatDate } from '../../utils/dateFormat'
import { formatTenge } from '../../utils/dormitoryLabels'
import { bilingualField } from '../../utils/bilingualField'
import { TemplatePages } from '../../components/TemplatePages'
import type { FilledDocument } from '../../utils/pdf'
import { getDormitory } from '../../api/dormitoryApi'
import { getRoom } from '../../api/roomApi'
import { RoomPicker } from './RoomPicker'
import { useDormitoriesWithMeta } from '../dormitories/useDormitoriesWithMeta'
import { useAuth } from '../auth/useAuth'
import { useIsSettled } from '../residence/useIsSettled'
import { ResidenceRequestsSection } from '../residence/ResidenceRequestsSection'
import { isActiveApplicationStatus } from './statusHelpers'
import type { TFunction } from 'i18next'
import type { ContractLanguage } from '../../api/contractTemplateApi'
import type { ContractFieldValues } from '../../utils/contractPdf'
import type { DormitoryRequiredDocument } from '../../types/dormitories'
import type { Benefit, BenefitRequiredDocument } from '../../types/benefits'
import type { Gender } from '../../types'

type WizardStep = 1 | 2 | 3 | 4

const CONTRACT_LANGUAGES: ContractLanguage[] = ['kk', 'ru']

function DocumentCard({
  name,
  file,
  onChange,
  t,
}: {
  name: string
  file: File | null
  onChange: (file: File | null) => void
  t: TFunction
}) {
  if (file) {
    return (
      <Card className="!p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-mint-500/15">
            <Check className="h-4.5 w-4.5 text-mint-400" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-sand-100">{name}</p>
            <p className="truncate text-sm text-mint-400">
              {file.name} · {t('wizard.uploaded')}
            </p>
          </div>
          <label className="shrink-0 cursor-pointer text-sm font-semibold text-sand-300 hover:text-sand-100">
            {t('wizard.change')}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onChange(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </Card>
    )
  }
  return (
    <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-navy-700 bg-navy-900 p-4">
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-3">
        <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-navy-800">
          <Upload className="h-4.5 w-4.5 text-sand-200" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sand-100">{name}</p>
          <p className="text-sm text-sand-300">{t('wizard.pdfSizeHint')}</p>
        </div>
        <span className="shrink-0 rounded-full bg-turquoise-500/10 px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap text-turquoise-400">
          {t('wizard.uploadLabel')}
        </span>
      </div>
    </label>
  )
}

export function NewApplicationPage() {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSettled = useIsSettled()

  const [step, setStep] = useState<WizardStep>(1)
  const [sent, setSent] = useState(false)

  const { dormitories } = useDormitoriesWithMeta()
  const [dormitoriesWithRooms, setDormitoriesWithRooms] = useState<Set<string>>(new Set())
  const [dormitoryId, setDormitoryId] = useState(searchParams.get('dormitory_id') ?? '')
  const [dormitoryRequiredDocs, setDormitoryRequiredDocs] = useState<DormitoryRequiredDocument[]>([])
  const [studentGender, setStudentGender] = useState<Gender | null>(null)
  const [roomId, setRoomId] = useState('')
  const [hasActiveApplication, setHasActiveApplication] = useState(false)
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [hasBenefit, setHasBenefit] = useState(false)
  const [selectedBenefitIds, setSelectedBenefitIds] = useState<string[]>([])
  const [requiredDocsByBenefit, setRequiredDocsByBenefit] = useState<
    Record<string, BenefitRequiredDocument[]>
  >({})
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({})
  const [studyGroup, setStudyGroup] = useState('')
  const [institute, setInstitute] = useState('')
  const [hometown, setHometown] = useState('')
  const [parentContact, setParentContact] = useState('')
  const [wish, setWish] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contractValues, setContractValues] = useState<ContractFieldValues | null>(null)
  const [contractPages, setContractPages] = useState<Record<ContractLanguage, FilledDocument> | null>(null)
  const [contractLanguage, setContractLanguage] = useState<ContractLanguage>(i18n.language === 'ru' ? 'ru' : 'kk')
  const [contractError, setContractError] = useState<string | null>(null)
  const [isDownloadingContract, setIsDownloadingContract] = useState(false)
  const [contractAgreed, setContractAgreed] = useState(false)

  const STEP_CAPTIONS: Record<WizardStep, string> = {
    1: t('wizard.stepCaption1'),
    2: t('wizard.stepCaption2'),
    3: t('wizard.stepCaption3'),
    4: t('wizard.stepCaption4'),
  }

  useEffect(() => {
    if (!dormitories) return
    // A dormitory with no rooms entered yet can't be applied to — a manager
    // must add rooms first (see FloorCorridorMap-based room creation on the
    // dormitory detail page).
    Promise.all(
      dormitories.map(async (d) => {
        const rooms = await listRoomsByDormitory(d.id).catch(() => [])
        return [d.id, rooms.length > 0] as const
      }),
    )
      .then((withRooms) => setDormitoriesWithRooms(new Set(withRooms.filter(([, has]) => has).map(([id]) => id))))
      .catch((err) => setLoadError(extractErrorMessage(err, t('wizard.loadDormsError'))))
  }, [dormitories, t])

  useEffect(() => {
    listMyApplications()
      .then((list) => setHasActiveApplication(list.some((a) => isActiveApplicationStatus(a.status))))
      .catch(() => {})
    listBenefits()
      .then(setBenefits)
      .catch(() => {})
    if (user) {
      getStudentProfile(user.id)
        .then((profile) => {
          setStudentGender(profile.gender)
          // Prefill from the profile, but never over what the student already typed.
          setInstitute((v) => v || profile.institute)
          setStudyGroup((v) => v || profile.study_group)
          setHometown((v) => v || profile.hometown)
          setParentContact((v) => v || profile.parent_contact)
        })
        .catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (!dormitoryId) {
      setDormitoryRequiredDocs([])
      return
    }
    listDormitoryRequiredDocuments(dormitoryId)
      .then(setDormitoryRequiredDocs)
      .catch(() => setDormitoryRequiredDocs([]))
  }, [dormitoryId])

  // The contract is filled in with this application's own details, so it's
  // only loaded on reaching the final step, once all of them are known.
  useEffect(() => {
    if (step !== 4 || !user) return
    let cancelled = false
    setContractPages(null)
    setContractError(null)

    async function loadContract(student: NonNullable<typeof user>) {
      const [dormitory, room] = await Promise.all([getDormitory(dormitoryId), getRoom(roomId)])
      const values: ContractFieldValues = {
        student_full_name: student.full_name,
        student_iin: student.iin ?? '',
        student_phone: student.phone,
        study_group: studyGroup.trim(),
        room_number: room.room_number,
        dormitory_name: dormitory.name,
        dormitory_address: dormitory.address,
        monthly_payment_bachelor: formatTenge(dormitory.monthly_payment_bachelor),
        monthly_payment_master: formatTenge(dormitory.monthly_payment_master),
        monthly_payment_doctorate: formatTenge(dormitory.monthly_payment_doctorate),
        yearly_payment_bachelor: formatTenge(dormitory.yearly_payment_bachelor),
        yearly_payment_master: formatTenge(dormitory.yearly_payment_master),
        yearly_payment_doctorate: formatTenge(dormitory.yearly_payment_doctorate),
        date: formatDate(new Date()),
      }
      const [kk, ru] = await Promise.all([
        getFilledContractDocument(values, 'kk'),
        getFilledContractDocument(values, 'ru'),
      ])
      if (cancelled) return
      setContractValues(values)
      setContractPages({ kk, ru })
    }

    loadContract(user).catch((err) => {
      if (!cancelled) setContractError(extractErrorMessage(err, t('wizard.contractLoadError')))
    })
    return () => {
      cancelled = true
    }
  }, [step, user, dormitoryId, roomId, studyGroup, t])

  const chosenDormitory = dormitories?.find((d) => d.id === dormitoryId) ?? null

  function toggleBenefit(benefitId: string) {
    setSelectedBenefitIds((prev) => {
      const isSelected = prev.includes(benefitId)
      if (isSelected) return prev.filter((id) => id !== benefitId)
      if (!(benefitId in requiredDocsByBenefit)) {
        listBenefitRequiredDocuments(benefitId)
          .then((docs) => setRequiredDocsByBenefit((r) => ({ ...r, [benefitId]: docs })))
          .catch(() => setRequiredDocsByBenefit((r) => ({ ...r, [benefitId]: [] })))
      }
      return [...prev, benefitId]
    })
  }

  function toggleHasBenefit(checked: boolean) {
    setHasBenefit(checked)
    if (!checked) setSelectedBenefitIds([])
  }

  const selectedRequiredDocs = selectedBenefitIds.flatMap((id) => requiredDocsByBenefit[id] ?? [])
  const allRequiredDocs = [...dormitoryRequiredDocs, ...selectedRequiredDocs]

  function goNext() {
    setServerError(null)
    if (step === 1) {
      if (!dormitoryId) {
        setServerError(t('wizard.dormNotSelected'))
        return
      }
      if (!dormitoriesWithRooms.has(dormitoryId)) {
        setServerError(t('wizard.dormNoRooms'))
        return
      }
      if (!roomId) {
        setServerError(t('wizard.roomNotSelectedError'))
        return
      }
    }
    if (step === 3) {
      const missingDoc = allRequiredDocs.find((doc) => !docFiles[doc.id])
      if (missingDoc) {
        setServerError(
          t('wizard.missingDocError', { doc: bilingualField(missingDoc.document_name_kk, missingDoc.document_name_ru, i18n.language) }),
        )
        return
      }
      const invalidDoc = allRequiredDocs.find((doc) => docFiles[doc.id]?.type !== 'application/pdf')
      if (invalidDoc) {
        setServerError(
          t('wizard.invalidDocError', { doc: bilingualField(invalidDoc.document_name_kk, invalidDoc.document_name_ru, i18n.language) }),
        )
        return
      }
      if (!institute.trim() || !studyGroup.trim() || !hometown.trim() || !parentContact.trim()) {
        setServerError(t('wizard.missingPetitionFieldsError'))
        return
      }
    }
    setStep((s) => (s < 4 ? ((s + 1) as WizardStep) : s))
  }

  function goBack() {
    setServerError(null)
    if (step > 1) {
      // Going back lets the student change what the contract is filled in
      // with, so what they agreed to may no longer be what they'd now submit.
      setContractAgreed(false)
      setStep((s) => (s - 1) as WizardStep)
    } else {
      navigate('/dashboard/home')
    }
  }

  async function handleDownloadContract() {
    if (!contractValues) return
    setContractError(null)
    setIsDownloadingContract(true)
    try {
      await downloadContractPdf(contractValues, `${t('contracts.contractFallback')}-${contractLanguage}.pdf`, contractLanguage)
    } catch (err) {
      setContractError(extractErrorMessage(err, t('contracts.downloadFailed')))
    } finally {
      setIsDownloadingContract(false)
    }
  }

  async function handleSubmit() {
    setServerError(null)
    if (!contractAgreed) {
      setServerError(t('wizard.contractNotAgreedError'))
      return
    }

    setIsSubmitting(true)
    let createdApplicationId: string | null = null
    try {
      // Upload every required document and assign every selected benefit
      // *before* creating the application, so a failure here (the most
      // likely point of failure — file uploads) simply aborts the submit
      // instead of leaving a half-submitted application behind.
      const fileUrlByDocId: Record<string, string> = {}
      for (const doc of allRequiredDocs) {
        fileUrlByDocId[doc.id] = await uploadFile(docFiles[doc.id]!)
      }
      await Promise.all(selectedBenefitIds.map((id) => assignOwnBenefit(id)))

      const application = await createApplication({
        dormitory_id: dormitoryId,
        notes: wish.trim() || null,
        preferred_room_id: roomId || null,
        study_group: studyGroup.trim(),
        hometown: hometown.trim(),
        parent_contact: parentContact.trim(),
        contract_agreed: contractAgreed,
      })
      createdApplicationId = application.id

      // Keep the profile current so the next form and the referral use what was
      // just entered. The application already holds its own copy, so this
      // must not fail a submitted application.
      if (user) {
        await updateStudentDetails(user.id, {
          institute: institute.trim(),
          study_group: studyGroup.trim(),
          hometown: hometown.trim(),
          parent_contact: parentContact.trim(),
        }).catch(() => undefined)
      }

      // Attach the already-uploaded documents. If any of this fails, roll
      // back the just-created application rather than leaving it without
      // its required documents.
      await Promise.all(
        selectedRequiredDocs.map((doc) =>
          addApplicationDocument(application.id, {
            benefit_required_document_id: doc.id,
            file_url: fileUrlByDocId[doc.id],
          }),
        ),
      )
      await Promise.all(
        dormitoryRequiredDocs.map((doc) =>
          addApplicationDocument(application.id, {
            dormitory_required_document_id: doc.id,
            file_url: fileUrlByDocId[doc.id],
          }),
        ),
      )

      if (user) {
        try {
          const dormitoryName = dormitories?.find((d) => d.id === dormitoryId)?.name ?? dormitoryId
          const pdfBlob = await generatePetitionPdfBlob({
            full_name: user.full_name,
            study_group: studyGroup.trim(),
            hometown: hometown.trim(),
            phone_self: user.phone,
            parent_contact: parentContact.trim(),
            dormitory_name: dormitoryName,
          })
          const pdfFile = new File([pdfBlob], `otinish-${application.id}.pdf`, {
            type: 'application/pdf',
          })
          const pdfUrl = await uploadFile(pdfFile)
          await addApplicationDocument(application.id, {
            document_name: PETITION_RECEIPT_DOCUMENT_NAME,
            file_url: pdfUrl,
          })
        } catch {
          // Best-effort receipt copy only — not a required document, so a
          // failure here shouldn't undo the already-complete submission.
        }
      }

      setSent(true)
    } catch (err) {
      if (createdApplicationId) {
        await deleteApplication(createdApplicationId).catch(() => {})
      }
      setServerError(extractErrorMessage(err, t('wizard.submitFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3.5 px-2 py-10 text-center">
        <span className="flex h-19 w-19 items-center justify-center rounded-full bg-mint-500/15">
          <Check className="h-8.5 w-8.5 text-mint-400" strokeWidth={2.5} />
        </span>
        <p className="text-[22px] font-bold text-sand-100">{t('wizard.sentTitle')}</p>
        <p className="max-w-[300px] text-sm text-sand-300">{t('wizard.sentBody')}</p>
        <SegmentedProgress total={6} filled={2} className="mt-1.5 w-full max-w-[300px]" />
        <p className="text-xs text-sand-300">{t('wizard.sentStepCaption')}</p>
        <Button className="mt-2" onClick={() => navigate('/dashboard/home')}>
          {t('wizard.backToHome')}
        </Button>
      </div>
    )
  }

  if (isSettled) {
    return (
      <div className="flex flex-col gap-3.5">
        <span className="text-[19px] font-bold text-sand-100">{t('wizard.alreadySettledTitle')}</span>
        <p className="text-sm text-sand-300">{t('wizard.alreadySettledHint')}</p>
        <ResidenceRequestsSection />
      </div>
    )
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!dormitories) return <p className="text-sm text-sand-300">{t('dorm.loading')}</p>

  if (hasActiveApplication) {
    return <Alert variant="error" message={t('wizard.hasActiveApplication')} />
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          aria-label={t('wizard.back')}
          className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-sand-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[19px] font-bold text-sand-100">{t('wizard.title')}</span>
      </div>

      <SegmentedProgress total={4} filled={step} />
      <p className="text-sm text-sand-300">{STEP_CAPTIONS[step]}</p>

      {serverError && <Alert variant="error" message={serverError} />}

      {step === 1 && (
        <>
          <p className="text-sm text-sand-200">{t('wizard.chooseDormPrompt')}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dormitories.length === 0 && (
              <div className="md:col-span-2 xl:col-span-3">
                <Alert variant="error" message={t('wizard.noDormsAvailable')} />
              </div>
            )}
            {dormitories.map((d) => {
              const hasRooms = dormitoriesWithRooms.has(d.id)
              const selected = dormitoryId === d.id
              if (!hasRooms) {
                return (
                  <Card key={d.id} className="!p-4 opacity-50">
                    <div className="flex items-center gap-2.5">
                      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-navy-700" />
                      <div>
                        <p className="text-[15px] font-semibold text-sand-100">{d.name}</p>
                        <p className="text-sm text-sand-300">
                          {d.address} · {t('wizard.noVacancyShort')}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              }
              return (
                <Card
                  key={d.id}
                  onClick={() => setDormitoryId(d.id)}
                  className={`!p-4 ${selected ? '!border-2 !border-turquoise-500' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-turquoise-500' : 'border-navy-700'
                      }`}
                    >
                      {selected && <span className="h-2.5 w-2.5 rounded-full bg-turquoise-500" />}
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold text-sand-100">{d.name}</p>
                      <p className="text-sm text-sand-300">{d.address}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        d.vacancy > 0 ? 'bg-turquoise-500/10 text-turquoise-400' : 'bg-clay-500/10 text-clay-400'
                      }`}
                    >
                      {d.vacancy > 0 ? t('dorm.vacancyCount', { count: d.vacancy }) : t('wizard.noVacancyShort')}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-navy-800 px-2.5 py-1 text-xs font-semibold text-sand-200">
                      {formatTenge(d.monthly_payment_bachelor)}
                      {t('dorm.perMonth')}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>

          <RoomPicker
            dormitoryId={dormitoryId}
            studentGender={studentGender}
            roomId={roomId}
            onSelectRoom={setRoomId}
          />

          <div className="mt-1">
            <Button className="w-full" onClick={goNext} disabled={!roomId}>
              {t('wizard.continueButton')}
            </Button>
            <p className="mt-2.5 text-center text-xs text-sand-300">{t('wizard.nextDocsHint')}</p>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-sm text-sand-200">
            {allRequiredDocs.length > 0 ? t('wizard.docsHintWithRequired') : t('wizard.docsHintNoneRequired')}
          </p>
          {allRequiredDocs.length > 0 && <p className="text-xs text-sand-300">{t('wizard.docsAiNotice')}</p>}
          <div className="flex max-w-[560px] flex-col gap-3">
            {dormitoryRequiredDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                name={bilingualField(doc.document_name_kk, doc.document_name_ru, i18n.language)}
                file={docFiles[doc.id] ?? null}
                onChange={(file) => setDocFiles((prev) => ({ ...prev, [doc.id]: file }))}
                t={t}
              />
            ))}

            {benefits.length > 0 && (
              <Card className="!p-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-sand-100">
                  <input
                    type="checkbox"
                    checked={hasBenefit}
                    onChange={(e) => toggleHasBenefit(e.target.checked)}
                    className="h-4.5 w-4.5 accent-turquoise-500"
                  />
                  {t('wizard.hasBenefit')}
                </label>
                <p className="mt-2 ml-7 text-sm text-sand-300">{t('wizard.benefitHint')}</p>

                {hasBenefit && (
                  <div className="mt-3 ml-7 flex flex-col gap-3">
                    {benefits.map((b) => (
                      <div key={b.id}>
                        <label className="flex items-start gap-2.5 text-sm text-sand-100">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-turquoise-500"
                            checked={selectedBenefitIds.includes(b.id)}
                            onChange={() => toggleBenefit(b.id)}
                          />
                          <span>
                            {bilingualField(b.name_kk, b.name_ru, i18n.language)}
                            {(b.description_kk || b.description_ru) && (
                              <span className="block text-xs text-sand-300">
                                {bilingualField(b.description_kk, b.description_ru, i18n.language)}
                              </span>
                            )}
                          </span>
                        </label>
                        {selectedBenefitIds.includes(b.id) && (requiredDocsByBenefit[b.id]?.length ?? 0) > 0 && (
                          <div className="mt-2.5 flex flex-col gap-2.5">
                            {requiredDocsByBenefit[b.id].map((doc) => (
                              <DocumentCard
                                key={doc.id}
                                name={bilingualField(doc.document_name_kk, doc.document_name_ru, i18n.language)}
                                file={docFiles[doc.id] ?? null}
                                onChange={(file) => setDocFiles((prev) => ({ ...prev, [doc.id]: file }))}
                                t={t}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          <div className="mt-1">
            <Button className="w-full" onClick={goNext}>
              {t('wizard.continueButton')}
            </Button>
            <p className="mt-2.5 text-center text-xs text-sand-300">{t('wizard.laterDocsHint')}</p>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <p className="text-sm text-sand-200">{t('wizard.reviewIntro')}</p>
          <div className="flex max-w-[560px] flex-col gap-3">
            <Card className="!p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-sand-300">{t('wizard.dormSection')}</span>
                <button onClick={() => setStep(1)} className="text-sm font-semibold text-sand-100">
                  {t('wizard.change')}
                </button>
              </div>
              <p className="mt-1.5 text-[15px] font-semibold text-sand-100">{chosenDormitory?.name}</p>
              <p className="text-sm text-sand-300">
                {chosenDormitory?.address} · {formatTenge(chosenDormitory?.monthly_payment_bachelor)}
                {t('dorm.perMonth')}
              </p>
            </Card>

            <Card className="!p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-sand-300">{t('wizard.docsSection')}</span>
                <button onClick={() => setStep(2)} className="text-sm font-semibold text-sand-100">
                  {t('wizard.change')}
                </button>
              </div>
              {allRequiredDocs.length === 0 ? (
                <p className="mt-1.5 text-sm text-sand-300">{t('wizard.noRequiredDocs')}</p>
              ) : (
                allRequiredDocs.map((doc) => (
                  <p
                    key={doc.id}
                    className={`mt-1.5 text-sm font-semibold ${docFiles[doc.id] ? 'text-mint-400' : 'text-sand-300'}`}
                  >
                    {docFiles[doc.id] ? '✓' : '–'} {bilingualField(doc.document_name_kk, doc.document_name_ru, i18n.language)}
                  </p>
                ))
              )}
            </Card>

            <Card className="!p-4">
              <p className="mb-3 text-sm text-sand-300">{t('wizard.petitionSection')}</p>
              <div className="flex flex-col gap-3">
                <Input
                  label={t('referral.instituteLabel')}
                  placeholder={t('referral.institutePlaceholder')}
                  value={institute}
                  onChange={(e) => setInstitute(e.target.value)}
                  maxLength={200}
                  required
                />
                <Input
                  label={t('wizard.studyGroupLabel')}
                  placeholder={t('wizard.studyGroupPlaceholder')}
                  value={studyGroup}
                  onChange={(e) => setStudyGroup(e.target.value)}
                  maxLength={50}
                  required
                />
                <Input
                  label={t('wizard.hometownLabel')}
                  placeholder={t('wizard.hometownPlaceholder')}
                  value={hometown}
                  onChange={(e) => setHometown(e.target.value)}
                  maxLength={255}
                  required
                />
                <Input
                  label={t('wizard.parentContactLabel')}
                  placeholder={t('wizard.parentContactPlaceholder')}
                  value={parentContact}
                  onChange={(e) => setParentContact(e.target.value)}
                  maxLength={30}
                  required
                />
              </div>
            </Card>

            <Card className="!p-4">
              <p className="mb-1.5 text-sm text-sand-300">{t('wizard.wishLabel')}</p>
              <textarea
                rows={2}
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder={t('wizard.wishPlaceholder')}
                className="w-full resize-y rounded-xl border border-navy-700 bg-navy-950 px-3 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400"
              />
            </Card>
          </div>

          <div className="mt-1">
            <Button className="w-full" onClick={goNext}>
              {t('wizard.continueButton')}
            </Button>
            <p className="mt-2.5 text-center text-xs text-sand-300">{t('wizard.nextContractHint')}</p>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <p className="text-sm text-sand-200">{t('wizard.contractIntro')}</p>
          {contractError && <Alert variant="error" message={contractError} />}
          {!contractPages && !contractError && <p className="text-sm text-sand-300">{t('contracts.loading')}</p>}
          {contractPages && (
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2">
                {CONTRACT_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setContractLanguage(lang)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                      contractLanguage === lang
                        ? 'border-turquoise-500 bg-turquoise-500/10 text-turquoise-400'
                        : 'border-navy-700 bg-navy-900 text-sand-300 hover:text-sand-100'
                    }`}
                  >
                    {t(`contracts.language.${lang}`)}
                  </button>
                ))}
              </div>
              <TemplatePages document={contractPages[contractLanguage]} />
              <Button
                variant="secondary"
                className="self-start"
                isLoading={isDownloadingContract}
                onClick={handleDownloadContract}
              >
                {t('contracts.download')}
              </Button>
              <Card className="!p-4">
                <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold text-sand-100">
                  <input
                    type="checkbox"
                    checked={contractAgreed}
                    onChange={(e) => setContractAgreed(e.target.checked)}
                    className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-turquoise-500"
                  />
                  {t('wizard.contractAgreeLabel')}
                </label>
              </Card>
            </div>
          )}

          <div className="mt-1">
            <Button className="w-full" isLoading={isSubmitting} disabled={!contractAgreed} onClick={handleSubmit}>
              {t('wizard.submitButton')}
            </Button>
            <p className="mt-2.5 text-center text-xs text-sand-300">{t('wizard.contractRequiredHint')}</p>
          </div>
        </>
      )}
    </div>
  )
}
