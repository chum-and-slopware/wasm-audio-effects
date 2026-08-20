import { useEffect, useRef } from 'react'
import { AlertIcon } from './Icons'

interface OverwriteDialogProps {
  count: number
  onCancel: () => void
  onConfirm: () => void
}

export function OverwriteDialog({ count, onCancel, onConfirm }: OverwriteDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => confirmRef.current?.focus(), [])

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel()
    }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="overwrite-title" aria-describedby="overwrite-description">
        <span className="dialog-icon"><AlertIcon /></span>
        <p className="eyebrow">Confirmation required</p>
        <h2 id="overwrite-title">Replace existing outputs?</h2>
        <p id="overwrite-description">
          {count} output {count === 1 ? 'file already exists' : 'files already exist'} in <code>_sped-up</code>.
          Only those generated copies will be replaced. Your source audio will not be changed.
        </p>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onCancel}>Go back</button>
          <button className="button danger" ref={confirmRef} onClick={onConfirm}>Replace and start</button>
        </div>
      </div>
    </div>
  )
}
