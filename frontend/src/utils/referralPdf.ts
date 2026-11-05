import QRCode from 'qrcode'
import { renderHtmlPagesToPdf } from './pdf'
import type { FilledDocument } from './pdf'
import { formatDate } from './dateFormat'
import type { Referral } from '../types/referrals'

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

export function referralNumberLabel(referral: Pick<Referral, 'number' | 'issued_at'>): string {
  const year = new Date(referral.issued_at).getFullYear()
  return `${year}/${String(referral.number).padStart(4, '0')}`
}

export function referralVerifyUrl(token: string): string {
  return `${window.location.origin}/r/${token}`
}

function fieldRow(label: string, value: string): string {
  return `
    <tr>
      <td style="width:150px;padding:15px 12px 8px 0;vertical-align:bottom;color:${MUTED};white-space:nowrap;">${label}</td>
      <td style="padding:15px 0 8px;vertical-align:bottom;border-bottom:1px solid #9aa8bf;color:${INK};font-size:16px;font-weight:bold;">${escapeHtml(value) || '&nbsp;'}</td>
    </tr>`
}

// The form is fixed rather than a manager-edited template, because its QR code
// and layout are what make it trustworthy. Always in Kazakh, like the paper
// original. A student's data is escaped: it's free text going into HTML.
function buildReferralHtml(referral: Referral, qrDataUrl: string): string {
  const url = referralVerifyUrl(referral.token)
  return `
    <div style="position:relative;color:${INK};">
      <img src="/brand/dormitory-mark.png" alt="" style="position:absolute;left:141px;top:300px;width:320px;opacity:0.07;" />

      <div style="position:relative;display:flex;align-items:center;gap:16px;padding:14px 20px;background:${BAND_BLUE};border-bottom:4px solid ${GOLD};font-family:${SANS};">
        <img src="/brand/dormitory-mark.png" alt="" style="height:50px;width:auto;" />
        <div>
          <div style="font-size:22px;font-weight:bold;line-height:1.2;color:#ffffff;">Student House</div>
          <div style="font-size:13px;line-height:1.3;color:#dbe4f2;">Қорқыт Ата атындағы Қызылорда университеті</div>
        </div>
      </div>

      <div style="position:relative;margin-top:48px;text-align:center;">
        <div style="font-size:17px;font-weight:bold;">Білім алушыларға жатақхана берілетіні туралы</div>
        <div style="margin-top:6px;font-size:26px;font-weight:bold;letter-spacing:2px;">ЖОЛДАМА № ${referralNumberLabel(referral)}</div>
      </div>

      <table style="position:relative;width:100%;margin-top:36px;border-collapse:collapse;font-size:15px;">
        ${fieldRow('Азамат(-ша)', referral.student_full_name)}
        ${fieldRow('Жатақхана', referral.dormitory_name)}
        ${fieldRow('Бөлме №', referral.room_number)}
        ${fieldRow('Институты', referral.institute)}
        ${fieldRow('Оқу тобы', referral.study_group)}
        ${fieldRow('Мекен-жайы', referral.dormitory_address)}
        ${fieldRow('Негіздеме', `Комиссия хаттамасы № ${referral.protocol_number}`)}
      </table>

      <table style="position:relative;width:100%;margin-top:56px;border-collapse:collapse;font-size:15px;">
        <tr>
          <td style="padding-right:24px;vertical-align:top;">
            <div>Әлеуметтік және тәрбие жұмыстары жөніндегі проректор</div>
            <div style="margin-top:34px;">
              <span style="display:inline-block;width:150px;border-bottom:1px solid ${INK};">&nbsp;</span>
              <span style="margin-left:8px;font-weight:bold;">${escapeHtml(referral.signatory_name)}</span>
            </div>
            <div style="margin-top:22px;color:${MUTED};">Берілген күні: ${formatDate(referral.issued_at)}</div>
          </td>
          <td style="width:152px;vertical-align:top;text-align:center;">
            <div style="padding:6px;border:2px solid ${BAND_BLUE};background:#ffffff;">
              <img src="${qrDataUrl}" alt="" style="display:block;width:136px;height:136px;" />
            </div>
          </td>
        </tr>
      </table>

      <div style="position:relative;margin-top:40px;padding-top:12px;border-top:1px solid ${GOLD};font-family:${SANS};font-size:11.5px;line-height:1.5;color:${MUTED};">
        Жолдама Student House жүйесінде жасалды. Мөрдің орнына QR код қолданылады: оны сканерлеп, жолдаманың жарамдылығын және студенттің қазіргі бөлмесін тексеріңіз.
        <div style="margin-top:2px;color:${INK};">${escapeHtml(url)}</div>
      </div>
    </div>`
}

export async function getFilledReferralDocument(referral: Referral): Promise<FilledDocument> {
  const qrDataUrl = await QRCode.toDataURL(referralVerifyUrl(referral.token), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 544,
    color: { dark: BAND_BLUE, light: '#ffffff' },
  })
  return { pages: [buildReferralHtml(referral, qrDataUrl)] }
}

export async function downloadReferralPdf(referral: Referral): Promise<void> {
  const { pages } = await getFilledReferralDocument(referral)
  const doc = await renderHtmlPagesToPdf(pages)
  doc.save(`zholdama-${referral.number}.pdf`)
}
