import { useNavigate } from 'react-router-dom'
import { CatalogBrowser } from '../components/catalog/CatalogBrowser.js'
import styles from './CatalogPage.module.css'

export function CatalogPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Katalog</h1>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/')}
        >
          ← Zur Projekte-Übersicht
        </button>
      </header>

      <CatalogBrowser />
    </div>
  )
}
