import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  danger?: boolean
  children?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

// Plain custom modal (no dialog library added this phase) — used for every
// irreversible or process-starting student action per spec: contract
// accept/decline, exit request, transfer request.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  danger = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-[20px] bg-navy-900 p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-lg text-sand-100">{title}</h2>
        <p className="mt-2 text-sm text-sand-300/70">{message}</p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
