import styles from './SaveNotificationBanner.module.css'

interface Props {
  onSave: () => void | Promise<void>
  onDismiss: () => void
  saving?: boolean
}

export function SaveNotificationBanner({ onSave, onDismiss, saving = false }: Props) {
  return (
    <div className={styles.banner} role="alert" aria-live="polite">
      <span className={styles.message}>Speichern nicht automatisch – jetzt speichern?</span>
      <button
        className={styles.btnSave}
        disabled={saving}
        onClick={() => void onSave()}
      >
        {saving ? 'Speichern…' : 'Speichern'}
      </button>
      <button
        className={styles.btnDismiss}
        aria-label="Hinweis schließen"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  )
}
