import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/Button'
import { Select } from '../../../components/Select'
import { Input } from '../../../components/Input'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { setBedStatus } from '../../../api/roomApi'
import type { Bed, BedServiceStatus } from '../../../types/rooms'

interface BedStatusDialogProps {
  bed: Bed
  onClose: () => void
  onSaved: (bed: Bed) => void
}

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Takes a bed out of service (на ремонте / временно недоступно, with a
// reason and an optional expected end date) or returns it to service.
// Only offered for beds nobody lives on or holds: an occupied or reserved
// bed's status follows its stay/reservation automatically.
export function BedStatusDialog({ bed, onClose, onSaved }: BedStatusDialogProps) {
  const { t } = useTranslation()
  const initial: BedServiceStatus =
    bed.status === 'repair' ? 'repair' : bed.status === 'unavailable' ? 'unavailable' : 'in_service'
  const [status, setStatus] = useState<BedServiceStatus>(initial)
  const [reason, setReason] = useState(bed.service_reason ?? '')
  const [until, setUntil] = useState(bed.service_until ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const outOfService = status !== 'in_service'

  async function handleSave() {
    setError(null)
    setIsSaving(true)
    try {
      const updated = outOfService
        ? await setBedStatus(bed.id, status, reason.trim(), until)
        : await setBedStatus(bed.id, 'in_service')
      onSaved(updated)
    } catch (err) {
      setError(extractErrorMessage(err, t('admin.rooms.bedStatusFailed')))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-[20px] bg-navy-900 p-6 shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-lg text-sand-100">
          {t('admin.rooms.bedStatusDialogTitle', { label: bed.label, code: bed.code })}
        </h2>
        {error && <Alert variant="error" message={error} />}
        <Select
          label={t('admin.rooms.bedStatusField')}
          required
          value={status}
          onChange={(e) => setStatus(e.target.value as BedServiceStatus)}
        >
          <option value="in_service">{t('admin.rooms.bedServiceInService')}</option>
          <option value="repair">{t('admin.rooms.bedServiceRepair')}</option>
          <option value="unavailable">{t('admin.rooms.bedServiceUnavailable')}</option>
        </Select>
        {outOfService && (
          <>
            <Input
              label={t('admin.rooms.bedServiceReason')}
              required
              value={reason}
              maxLength={500}
              placeholder={t('admin.rooms.bedServiceReasonPlaceholder')}
              onChange={(e) => setReason(e.target.value)}
            />
            <Input
              label={t('admin.rooms.bedServiceUntilField')}
              type="date"
              value={until}
              min={todayISO()}
              onChange={(e) => setUntil(e.target.value)}
            />
          </>
        )}
        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} isLoading={isSaving} disabled={outOfService && !reason.trim()}>
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
