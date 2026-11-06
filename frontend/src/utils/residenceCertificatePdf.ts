import QRCode from 'qrcode'
import { renderHtmlPagesToPdf } from './pdf'
import type { FilledDocument } from './pdf'
import type { CertificateLanguage, ResidenceCertificate } from '../types/residenceCertificates'

// Same look as the referral (referralPdf.ts), so the two papers read as one set.
const BAND_BLUE = '#113060'
const GOLD = '#c8ad72'
const INK = '#12233f'
const MUTED = '#5a6b86'
const SANS = 'Arial, Helvetica, sans-serif'

function escapeHtml(text: string): string {
  const element = document.createElement('div')
  element.textContent = text
  return element.innerHTML
}

// A date on the paper doesn't follow the UI language: both versions print
// it the way Kazakh and Russian official papers do, 06.11.2026.
function paperDate(value: string): string {
  return new Date(value).toLocaleDateString('ru-RU')
}

export function certificateNumberLabel(c: Pick<ResidenceCertificate, 'number' | 'issued_at'>): string {
  return `${new Date(c.issued_at).getFullYear()}/${String(c.number).padStart(4, '0')}`
}

export function certificateVerifyUrl(token: string): string {
  return `${window.location.origin}/c/${token}`
}

interface Wording {
  title: string
  subtitle: string
  body: (c: ResidenceCertificate, v: Record<string, string>) => string
  purpose: string
  signatoryTitle: string
  issuedOn: string
  footer: string
}

// Free text the student typed (institute, group) is quoted as "label: value"
// rather than inflected into the sentence, so it reads right whatever
// language it was entered in. Missing details are left out, not left blank.
const WORDING: Record<CertificateLanguage, Wording> = {
  kk: {
    title: 'АНЫҚТАМА',
    subtitle: 'жатақханада тұратыны туралы',
    body: (c, v) => {
      const study = [c.institute && `институты: ${v.institute}`, c.study_group && `оқу тобы: ${v.study_group}`]
        .filter(Boolean)
        .join(', ')
      return (
        `Осы анықтама <b>${v.name}</b>${c.iin ? ` (ЖСН ${v.iin})` : ''} азаматқа (азаматшаға) берілді. ` +
        `Ол Қорқыт Ата атындағы Қызылорда университетінің ${c.course != null ? `${c.course}-курс ` : ''}білім алушысы` +
        `${study ? ` (${study})` : ''} және ${paperDate(c.moved_in_at)} бастап қазіргі уақытқа дейін ` +
        `«${v.dormitory}» жатақханасының № ${v.room} бөлмесінде тұрады.` +
        `${c.dormitory_address ? ` Жатақхананың мекенжайы: ${v.address}.` : ''}`
      )
    },
    purpose: 'Анықтама талап етілген жерге ұсыну үшін берілді.',
    signatoryTitle: 'Әлеуметтік және тәрбие жұмыстары жөніндегі проректор',
    issuedOn: 'Берілген күні',
    footer:
      'Анықтама Student House жүйесінде жасалды. QR кодты сканерлеп, анықтаманың шынайылығын және студенттің қазір де осы жатақханада тұратынын тексеріңіз.',
  },
  ru: {
    title: 'СПРАВКА',
    subtitle: 'о проживании в общежитии',
    body: (c, v) => {
      const study = [c.institute && `институт: ${v.institute}`, c.study_group && `группа: ${v.study_group}`]
        .filter(Boolean)
        .join(', ')
      return (
        `Настоящая справка выдана <b>${v.name}</b>${c.iin ? ` (ИИН ${v.iin})` : ''} в том, что он(а) является ` +
        `обучающимся(-ейся) ${c.course != null ? `${c.course} курса ` : ''}Кызылординского университета имени Коркыт Ата` +
        `${study ? ` (${study})` : ''} и с ${paperDate(c.moved_in_at)} по настоящее время проживает в общежитии ` +
        `«${v.dormitory}», комната № ${v.room}.` +
        `${c.dormitory_address ? ` Адрес общежития: ${v.address}.` : ''}`
      )
    },
    purpose: 'Справка выдана для предъявления по месту требования.',
    signatoryTitle: 'Проректор по социальной и воспитательной работе',
    issuedOn: 'Дата выдачи',
    footer:
      'Справка создана в системе Student House. Отсканируйте QR-код, чтобы проверить подлинность справки и проживает ли студент в этом общежитии сейчас.',
  },
}

// A fixed form, like the referral: the QR code and layout are what make it
// trustworthy, so it isn't a manager-edited template.
function buildCertificateHtml(c: ResidenceCertificate, language: CertificateLanguage, qrDataUrl: string): string {
  const w = WORDING[language]
  const url = certificateVerifyUrl(c.token)
  const v = {
    name: escapeHtml(c.student_full_name),
    iin: escapeHtml(c.iin ?? ''),
    institute: escapeHtml(c.institute),
    study_group: escapeHtml(c.study_group),
    dormitory: escapeHtml(c.dormitory_name),
    room: escapeHtml(c.room_number),
    address: escapeHtml(c.dormitory_address),
  }
  return `
    <div style="position:relative;color:${INK};">
      <img src="/brand/dormitory-mark.png" alt="" style="position:absolute;left:141px;top:300px;width:320px;opacity:0.07;" />

      <div style="position:relative;display:flex;align-items:center;gap:16px;padding:14px 20px;background:${BAND_BLUE};border-bottom:4px solid ${GOLD};font-family:${SANS};">
        <img src="/brand/dormitory-mark.png" alt="" style="height:50px;width:auto;" />
        <div>
          <div style="font-size:22px;font-weight:bold;line-height:1.2;color:#ffffff;">Student House</div>
          <div style="font-size:13px;line-height:1.3;color:#dbe4f2;">${
            language === 'ru' ? 'Кызылординский университет имени Коркыт Ата' : 'Қорқыт Ата атындағы Қызылорда университеті'
          }</div>
        </div>
      </div>

      <div style="position:relative;margin-top:48px;text-align:center;">
        <div style="font-size:26px;font-weight:bold;letter-spacing:2px;">${w.title} № ${certificateNumberLabel(c)}</div>
        <div style="margin-top:6px;font-size:17px;font-weight:bold;">${w.subtitle}</div>
      </div>

      <p style="position:relative;margin:40px 0 0;font-size:16px;line-height:1.75;text-align:justify;text-indent:36px;">${w.body(c, v)}</p>
      <p style="position:relative;margin:14px 0 0;font-size:16px;line-height:1.75;text-indent:36px;">${w.purpose}</p>

      <table style="position:relative;width:100%;margin-top:56px;border-collapse:collapse;font-size:15px;">
        <tr>
          <td style="padding-right:24px;vertical-align:top;">
            <div>${w.signatoryTitle}</div>
            <div style="margin-top:34px;font-weight:bold;">${escapeHtml(c.signatory_name)}</div>
            <div style="margin-top:22px;color:${MUTED};">${w.issuedOn}: ${paperDate(c.issued_at)}</div>
          </td>
          <td style="width:152px;vertical-align:top;text-align:center;">
            <div style="padding:6px;border:2px solid ${BAND_BLUE};background:#ffffff;">
              <img src="${qrDataUrl}" alt="" style="display:block;width:136px;height:136px;" />
            </div>
          </td>
        </tr>
      </table>

      <div style="position:relative;margin-top:40px;padding-top:12px;border-top:1px solid ${GOLD};font-family:${SANS};font-size:11.5px;line-height:1.5;color:${MUTED};">
        ${w.footer}
        <div style="margin-top:2px;color:${INK};">${escapeHtml(url)}</div>
      </div>
    </div>`
}

export async function getFilledCertificateDocument(
  certificate: ResidenceCertificate,
  language: CertificateLanguage,
): Promise<FilledDocument> {
  const qrDataUrl = await QRCode.toDataURL(certificateVerifyUrl(certificate.token), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 544,
    color: { dark: BAND_BLUE, light: '#ffffff' },
  })
  return { pages: [buildCertificateHtml(certificate, language, qrDataUrl)] }
}

export async function downloadCertificatePdf(certificate: ResidenceCertificate, language: CertificateLanguage): Promise<void> {
  const { pages } = await getFilledCertificateDocument(certificate, language)
  const doc = await renderHtmlPagesToPdf(pages)
  doc.save(`${language === 'ru' ? 'spravka' : 'anyktama'}-${certificate.number}.pdf`)
}
