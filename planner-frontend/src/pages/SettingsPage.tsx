import { useNavigate } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale.js'
import { LanguageSwitcher } from '../components/LanguageSwitcher.js'
import styles from './TenantSettingsPage.module.css'

export function SettingsPage() {
  const navigate = useNavigate()
  const { t } = useLocale()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{t('settings.title')}</p>
          <h1>{t('settings.title')}</h1>
          <p className={styles.subtitle}>{t('settings.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/')}>
            {t('common.back')}
          </button>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('settings.sections')}</h2>
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary} onClick={() => navigate('/settings/company')}>
            {t('settings.companyProfile')}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/settings/plugins')}>
            {t('settings.plugins')}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/settings/layout-styles')}>
            {t('settings.layoutStyles')}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('settings.languageSection')}</h2>
        <p className={styles.subtitle}>{t('settings.languageHint')}</p>
        <LanguageSwitcher />
      </section>
    </div>
  )
}

