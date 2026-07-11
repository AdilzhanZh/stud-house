import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { listDormitories, listDormitoryRequiredDocuments } from '../../api/dormitoryApi'
import {
  addApplicationDocument,
  createApplication,
  deleteApplication,
  listMyApplications,
} from '../../api/applicationApi'
import { assignOwnBenefit, listBenefitRequiredDocuments, listBenefits } from '../../api/benefitApi'
import { listRoomResidents, listRoomsByDormitory } from '../../api/roomApi'
import { getStudentProfile } from '../../api/profileApi'
import { uploadFile } from '../../api/uploadApi'
import { generateApplicationSubmissionPdfBlob } from '../../utils/applicationPdf'
import { FloorCorridorMap } from '../../components/FloorCorridorMap'
import { useAuth } from '../auth/useAuth'
import { isActiveApplicationStatus } from './statusHelpers'
import type { Dormitory, DormitoryRequiredDocument } from '../../types/dormitories'
import type { Benefit, BenefitRequiredDocument } from '../../types/benefits'
import type { Room } from '../../types/rooms'
import type { Gender } from '../../types'

interface RoomWithOccupancy extends Room {
  residentCount: number
}

export function NewApplicationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [dormitories, setDormitories] = useState<Dormitory[] | null>(null)
  const [dormitoriesWithRooms, setDormitoriesWithRooms] = useState<Set<string>>(new Set())
  const [dormitoryId, setDormitoryId] = useState(searchParams.get('dormitory_id') ?? '')
  const [dormitoryRequiredDocs, setDormitoryRequiredDocs] = useState<DormitoryRequiredDocument[]>([])
  const [studentGender, setStudentGender] = useState<Gender | null>(null)
  const [rooms, setRooms] = useState<RoomWithOccupancy[]>([])
  const [roomId, setRoomId] = useState('')
  const [hasActiveApplication, setHasActiveApplication] = useState(false)
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [hasBenefit, setHasBenefit] = useState(false)
  const [selectedBenefitIds, setSelectedBenefitIds] = useState<string[]>([])
  const [requiredDocsByBenefit, setRequiredDocsByBenefit] = useState<
    Record<string, BenefitRequiredDocument[]>
  >({})
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    listDormitories()
      .then(async (list) => {
        setDormitories(list)
        // A dormitory with no rooms entered yet can't be applied to — a
        // manager must add rooms first (see FloorCorridorMap-based room
        // creation on the dormitory detail page).
        const withRooms = await Promise.all(
          list.map(async (d) => {
            const rooms = await listRoomsByDormitory(d.id).catch(() => [])
            return [d.id, rooms.length > 0] as const
          }),
        )
        setDormitoriesWithRooms(new Set(withRooms.filter(([, hasRooms]) => hasRooms).map(([id]) => id)))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жатақханаларды жүктеу сәтсіз аяқталды')))
    listMyApplications()
      .then((list) => setHasActiveApplication(list.some((a) => isActiveApplicationStatus(a.status))))
      .catch(() => {})
    listBenefits()
      .then(setBenefits)
      .catch(() => {})
    if (user) {
      getStudentProfile(user.id)
        .then((profile) => setStudentGender(profile.gender))
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
    setRoomId('')
    listRoomsByDormitory(dormitoryId)
      .then(async (list) => {
        const withOccupancy = await Promise.all(
          list.map(async (r) => {
            const residents = await listRoomResidents(r.id).catch(() => [])
            return { ...r, residentCount: residents.length }
          }),
        )
        setRooms(withOccupancy)
      })
      .catch(() => setRooms([]))
  }, [dormitoryId])

  // A student may only pick a room whose gender restriction is either unset
  // (a shared/mixed room) or matches their own gender — a manager can still
  // assign a different room later regardless of this preference.
  const eligibleRooms = rooms.filter(
    (r) => r.restrictions.gender === null || r.restrictions.gender === studentGender,
  )
  const eligibleFloorGroups = Object.entries(
    eligibleRooms.reduce<Record<number, RoomWithOccupancy[]>>((byFloor, room) => {
      const floor = room.floor ?? 0
      byFloor[floor] = [...(byFloor[floor] ?? []), room]
      return byFloor
    }, {}),
  ).sort(([a], [b]) => Number(a) - Number(b))
  const selectedRoom = eligibleRooms.find((r) => r.id === roomId) ?? null

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dormitoryId) {
      setServerError('Жатақхананы таңдаңыз')
      return
    }
    if (!dormitoriesWithRooms.has(dormitoryId)) {
      setServerError('Бұл жатақханада әлі бөлме енгізілмеген, өтініш беруге болмайды')
      return
    }
    setServerError(null)

    const allRequiredDocs = [...dormitoryRequiredDocs, ...selectedRequiredDocs]
    const missingDoc = allRequiredDocs.find((doc) => !docFiles[doc.id])
    if (missingDoc) {
      setServerError(`"${missingDoc.document_name}" құжатын жүктеңіз`)
      return
    }
    const invalidDoc = allRequiredDocs.find((doc) => docFiles[doc.id]?.type !== 'application/pdf')
    if (invalidDoc) {
      setServerError(`"${invalidDoc.document_name}" құжаты үшін тек PDF форматындағы файл жүктеуге болады`)
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
        notes: null,
        preferred_room_id: roomId || null,
      })
      createdApplicationId = application.id

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
          const pdfBlob = await generateApplicationSubmissionPdfBlob({
            applicationId: application.id,
            studentFullName: user.full_name,
            studentIIN: user.iin,
            studentEmail: user.email,
            studentPhone: user.phone,
            dormitoryName,
            submittedAt: new Date(),
          })
          const pdfFile = new File([pdfBlob], `otinish-${application.id}.pdf`, {
            type: 'application/pdf',
          })
          const pdfUrl = await uploadFile(pdfFile)
          await addApplicationDocument(application.id, {
            document_name: 'Өтініш парағы (PDF)',
            file_url: pdfUrl,
          })
        } catch {
          // Best-effort receipt copy only — not a required document, so a
          // failure here shouldn't undo the already-complete submission.
        }
      }

      navigate('/applications/my', { replace: true })
    } catch (err) {
      if (createdApplicationId) {
        await deleteApplication(createdApplicationId).catch(() => {})
      }
      setServerError(extractErrorMessage(err, 'Өтініш жіберу сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card title="Өтініш беру">
      {loadError && <Alert variant="error" message={loadError} />}
      {hasActiveApplication && (
        <Alert
          variant="error"
          message="Сізде белсенді өтінішіңіз бар. Жаңа өтініш беру үшін алдымен ағымдағысын шешу керек."
        />
      )}
      {!loadError && !dormitories && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}
      {dormitories && !hasActiveApplication && (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {serverError && <Alert variant="error" message={serverError} />}

          <Select
            label="Жатақхана"
            required
            value={dormitoryId}
            onChange={(e) => setDormitoryId(e.target.value)}
          >
            <option value="">Таңдаңыз</option>
            {dormitories
              .filter((d) => dormitoriesWithRooms.has(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.address}
                </option>
              ))}
          </Select>
          {dormitories.length > 0 && dormitoriesWithRooms.size === 0 && (
            <Alert
              variant="error"
              message="Қазіргі уақытта бөлмесі енгізілген жатақхана жоқ, өтініш беру мүмкін емес"
            />
          )}

          {dormitoryId && eligibleFloorGroups.length > 0 && (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-sand-200">
                Бөлме (қалауыңыз бойынша, міндетті емес)
              </label>
              <div className="flex flex-col gap-4">
                {eligibleFloorGroups.map(([floor, floorRooms]) => (
                  <div key={floor} className="flex flex-col gap-2">
                    {floor !== '0' && <p className="text-xs text-sand-300/60">{floor}-қабат</p>}
                    <FloorCorridorMap
                      rooms={floorRooms}
                      selectedRoomId={roomId}
                      onSelectRoom={(id) => setRoomId((prev) => (prev === id ? '' : id))}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-sand-300/60">
                {selectedRoom
                  ? `Таңдалды: ${selectedRoom.room_number}-бөлме (${selectedRoom.residentCount}/${selectedRoom.capacity} орын)`
                  : 'Бөлме таңдалмады — оны кейін менеджер тағайындайды'}
              </p>
            </div>
          )}

          {dormitoryRequiredDocs.length > 0 && (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-sand-200">Жатақхана үшін қажетті құжаттар</label>
              <p className="text-xs text-amber-600">Тек PDF форматындағы файл қабылданады</p>
              {dormitoryRequiredDocs.map((doc) => (
                <div key={doc.id} className="flex flex-col gap-1">
                  <label className="text-base font-semibold text-sand-100">
                    {doc.document_name}
                    <span className="text-clay-400"> *</span>
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    required
                    onChange={(e) =>
                      setDocFiles((prev) => ({
                        ...prev,
                        [doc.id]: e.target.files?.[0] ?? null,
                      }))
                    }
                    className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-turquoise-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-turquoise-300 hover:file:bg-turquoise-500/15"
                  />
                </div>
              ))}
            </div>
          )}

          {benefits.length > 0 && (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-sand-200">
                <input
                  type="checkbox"
                  checked={hasBenefit}
                  onChange={(e) => toggleHasBenefit(e.target.checked)}
                />
                Менде льгота бар
                <span className="ml-1 text-xs font-normal text-sand-400">(міндетті емес)</span>
              </label>

              {hasBenefit && (
              <div className="flex flex-col gap-3">
                {benefits.map((b) => (
                  <div key={b.id}>
                    <label className="flex items-start gap-2 text-sm text-sand-200">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedBenefitIds.includes(b.id)}
                        onChange={() => toggleBenefit(b.id)}
                      />
                      <span>
                        {b.name}
                        {b.description && (
                          <span className="block text-xs text-sand-300/60">{b.description}</span>
                        )}
                      </span>
                    </label>

                    {selectedBenefitIds.includes(b.id) && (requiredDocsByBenefit[b.id]?.length ?? 0) > 0 && (
                      <div className="mt-2 ml-6 flex flex-col gap-2 border-l-2 border-turquoise-400/20 pl-3">
                        <p className="text-xs text-amber-600">Тек PDF форматындағы файл қабылданады</p>
                        {requiredDocsByBenefit[b.id].map((doc) => (
                          <div key={doc.id} className="flex flex-col gap-1">
                            <label className="text-base font-semibold text-sand-100">
                              {doc.document_name}
                              <span className="text-clay-400"> *</span>
                            </label>
                            <input
                              type="file"
                              accept="application/pdf"
                              required
                              onChange={(e) =>
                                setDocFiles((prev) => ({
                                  ...prev,
                                  [doc.id]: e.target.files?.[0] ?? null,
                                }))
                              }
                              className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-turquoise-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-turquoise-300 hover:file:bg-turquoise-500/15"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Жіберу
          </Button>
        </form>
      )}
    </Card>
  )
}
