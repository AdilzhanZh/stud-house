import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Select } from '../../../components/Select'
import { extractErrorMessage } from '../../../api/client'
import { updateRoomRestrictions } from '../../../api/roomApi'
import type { Gender, Room } from '../../../types/rooms'

interface RoomRestrictionsDialogProps {
  room: Room | null
  onClose: () => void
  onSaved: (room: Room) => void
}

// A focused editor for just a room's gender restriction, opened from the
// admin's room-assignment grid when a manager clicks a room that doesn't
// match the applicant's gender — lets them relax the restriction right
// there instead of navigating away to the full room-edit page. Course/
// degree/benefit restrictions are preserved as-is. The backend
// (RoomService.UpdateRestrictions) rejects a change that would no longer
// fit an existing resident, surfaced here as a normal form error.
export function RoomRestrictionsDialog({ room, onClose, onSaved }: RoomRestrictionsDialogProps) {
  const { t } = useTranslation()
  const [gender, setGender] = useState<Gender | 'any'>('any')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setGender(room?.restrictions.gender ?? 'any')
    setError(null)
  }, [room])

  async function handleSave() {
    if (!room) return
    setError(null)
    setIsSaving(true)
    try {
      const updated = await updateRoomRestrictions(room.id, {
        gender: gender === 'any' ? null : gender,
        courses: room.restrictions.courses,
        degrees: room.restrictions.degrees,
        benefit_ids: room.restrictions.benefit_ids,
      })
      onSaved(updated)
    } catch (err) {
      setError(extractErrorMessage(err, t('admin.common.saveFailed')))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ConfirmDialog
      open={room != null}
      title={t('admin.rooms.editRestrictionsTitle', { room: room?.room_number })}
      message={t('admin.rooms.genderMismatchDialogHint')}
      confirmLabel={t('admin.common.save')}
      isLoading={isSaving}
      onConfirm={handleSave}
      onCancel={onClose}
    >
      <Select
        label={t('admin.rooms.genderRestriction')}
        value={gender}
        onChange={(e) => setGender(e.target.value as Gender | 'any')}
      >
        <option value="any">{t('admin.rooms.anyGender')}</option>
        <option value="male">{t('admin.dormitories.male')}</option>
        <option value="female">{t('admin.dormitories.female')}</option>
      </Select>
      {error && <p className="mt-2 text-xs text-clay-400">{error}</p>}
    </ConfirmDialog>
  )
}
