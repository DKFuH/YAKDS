import { useNavigate } from 'react-router-dom'
import styles from './TenantSettingsPage.module.css'

export function SettingsPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Einstellungen</p>
          <h1>Einstellungen</h1>
          <p className={styles.subtitle}>Verwalte Firmenprofil und aktivierte Plugins.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/')}>
            {'\u2190 Zur\u00fcck'}
          </button>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Bereiche</h2>
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary} onClick={() => navigate('/settings/company')}>
            Firmenprofil
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/settings/plugins')}>
            Plugins
          </button>
        </div>
      </section>
    </div>
  )
}
