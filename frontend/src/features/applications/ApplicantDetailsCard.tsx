import { useTranslation } from 'react-i18next'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import type { AcademicDegree } from '../../types'
import {
  DETAIL_FIELDS,
  LOCKED_ONCE_SET,
  MAX_COURSE,
  MAX_LENGTH,
  visibleDetailFields,
  type DetailField,
  type DetailValues,
} from './applicantDetails'

// Step 3's "details for your documents": inputs for what the profile lacks,
// and a summary of what it already has, which the student may reopen.

interface ApplicantDetailsCardProps {
  values: DetailValues
  onChange: (field: DetailField, value: string) => void
  asked: DetailField[]
  editingKnown: boolean
  onEditKnown: () => void
  degree: AcademicDegree | null
}

export function ApplicantDetailsCard({ values, onChange, asked, editingKnown, onEditKnown, degree }: ApplicantDetailsCardProps) {
  const { t } = useTranslation()
  const visible = visibleDetailFields(asked, editingKnown)
  const known = DETAIL_FIELDS.filter((f) => !visible.includes(f) && values[f].trim())
  const canEditKnown = !editingKnown && known.some((f) => !LOCKED_ONCE_SET.includes(f))
  const maxCourse = MAX_COURSE[degree ?? 'bachelor']

  const label = (f: DetailField) => t(`wizard.details.${f}Label`)

  return (
    <Card className="!p-4">
      <p className="text-sm text-sand-300">{t('wizard.details.title')}</p>
      <p className="mt-1 mb-3 text-xs text-sand-300">{t('wizard.details.hint')}</p>

      {visible.length > 0 && (
        <div className="flex flex-col gap-3">
          {visible.map((f) =>
            f === 'course' ? (
              <Select
                key={f}
                id="detail-course"
                label={label(f)}
                value={values.course}
                onChange={(e) => onChange('course', e.target.value)}
                required
              >
                <option value="">{t('wizard.details.coursePlaceholder')}</option>
                {Array.from({ length: maxCourse }, (_, i) => String(i + 1)).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                key={f}
                id={`detail-${f}`}
                label={label(f)}
                placeholder={t(`wizard.details.${f}Placeholder`)}
                value={values[f]}
                onChange={(e) => onChange(f, e.target.value)}
                maxLength={MAX_LENGTH[f]}
                inputMode={f === 'iin' ? 'numeric' : undefined}
                type={f === 'phone' || f === 'parent_contact' ? 'tel' : 'text'}
                autoComplete={f === 'phone' ? 'tel' : undefined}
                required
              />
            ),
          )}
          {visible.some((f) => LOCKED_ONCE_SET.includes(f)) && (
            <p className="text-xs text-sand-300">{t('wizard.details.lockedHint')}</p>
          )}
        </div>
      )}

      {known.length > 0 && (
        <div className={visible.length > 0 ? 'mt-4 border-t border-navy-700 pt-3' : ''}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold tracking-wide text-sand-300 uppercase">
              {t('wizard.details.fromProfile')}
            </span>
            {canEditKnown && (
              <button type="button" onClick={onEditKnown} className="text-sm font-semibold text-sand-100">
                {t('wizard.change')}
              </button>
            )}
          </div>
          <dl className="mt-1">
            {known.map((f) => (
              <div key={f} className="flex justify-between gap-3 py-1.5 text-sm">
                <dt className="shrink-0 text-sand-300">{label(f)}</dt>
                <dd className="min-w-0 text-right font-semibold break-words text-sand-100">{values[f]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Card>
  )
}
