import { renderHtmlToPdf } from './pdf'

export interface ApplicationPdfData {
  applicationId: string
  studentFullName: string
  dormitoryName: string
  roomNumber: string | null
  decidedAt: Date
}

export async function downloadApplicationPdf(data: ApplicationPdfData): Promise<void> {
  const doc = await renderHtmlToPdf(`
    <h1 style="font-size:20px;margin:0 0 24px;">Жатақханаға орналастыру туралы өтініш</h1>
    <p style="margin:0 0 12px;"><strong>Өтініш ID:</strong> ${data.applicationId}</p>
    <p style="margin:0 0 12px;"><strong>Студент:</strong> ${data.studentFullName}</p>
    <p style="margin:0 0 12px;"><strong>Жатақхана:</strong> ${data.dormitoryName}</p>
    <p style="margin:0 0 12px;"><strong>Бөлме:</strong> ${data.roomNumber ?? '—'}</p>
    <p style="margin:0 0 12px;"><strong>Шешім қабылданған күні:</strong> ${data.decidedAt.toLocaleString('kk-KZ')}</p>
    <p style="margin:32px 0 0;">Осы құжат студенттің жатақханаға орналасуға өтінішінің мақұлданғанын растайды.</p>
  `)
  doc.save(`otinish-${data.applicationId}.pdf`)
}

export interface ApplicationSubmissionPdfData {
  applicationId: string
  studentFullName: string
  studentIIN: string | null
  studentEmail: string
  studentPhone: string
  dormitoryName: string
  submittedAt: Date
}

// Placeholder "paper form" template generated the moment a student submits
// an application — not downloaded by the student, just uploaded as an
// application document so the manager can view it. Replace the markup here
// once a real approved form template exists.
export async function generateApplicationSubmissionPdfBlob(
  data: ApplicationSubmissionPdfData,
): Promise<Blob> {
  const doc = await renderHtmlToPdf(`
    <h1 style="font-size:20px;margin:0 0 24px;">Жатақханаға орналастыруға өтініш парағы</h1>
    <p style="margin:0 0 12px;"><strong>Өтініш ID:</strong> ${data.applicationId}</p>
    <p style="margin:0 0 12px;"><strong>Аты-жөні:</strong> ${data.studentFullName}</p>
    <p style="margin:0 0 12px;"><strong>ИИН:</strong> ${data.studentIIN ?? '—'}</p>
    <p style="margin:0 0 12px;"><strong>Email:</strong> ${data.studentEmail}</p>
    <p style="margin:0 0 12px;"><strong>Телефон:</strong> ${data.studentPhone}</p>
    <p style="margin:0 0 12px;"><strong>Жатақхана:</strong> ${data.dormitoryName}</p>
    <p style="margin:0 0 12px;"><strong>Өтініш берілген күні:</strong> ${data.submittedAt.toLocaleString('kk-KZ')}</p>
    <p style="margin:32px 0 0;">Бұл — студенттің жатақханаға орналасуға өтінішінің парағы.</p>
  `)
  return doc.output('blob')
}
