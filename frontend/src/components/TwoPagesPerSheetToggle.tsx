import { useTranslation } from 'react-i18next'

interface TwoPagesPerSheetToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

// Shared by the protocol, petition and contract template pages.
export function TwoPagesPerSheetToggle({ checked, onChange }: TwoPagesPerSheetToggleProps) {
  const { t } = useTranslation()
  return (
    <label className="flex items-start gap-2 text-sm text-sand-200">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium">{t('admin.twoPagesPerSheet.label')}</span>
        <span className="block text-xs text-sand-400">{t('admin.twoPagesPerSheet.hint')}</span>
      </span>
    </label>
  )
}
