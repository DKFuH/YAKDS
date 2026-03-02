import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './OnboardingWizard.module.css'

const STEPS = [
  {
    id: 'welcome',
    title: 'Willkommen bei OKP',
    description: 'Dieser Assistent führt dich durch die wichtigsten Einrichtungsschritte. Du kannst den Assistenten jederzeit überspringen.',
    icon: '🏠',
  },
  {
    id: 'catalog',
    title: 'Erster Katalog',
    description: 'Importiere deinen ersten Hersteller-Katalog, um Artikel in Planungen verwenden zu können.',
    icon: '📦',
    cta: '/catalog',
    ctaLabel: 'Zum Katalog',
  },
  {
    id: 'project',
    title: 'Testprojekt anlegen',
    description: 'Lege ein erstes Testprojekt an, um den Planungsworkflow kennenzulernen.',
    icon: '📐',
    cta: '/',
    ctaLabel: 'Projektboard',
  },
  {
    id: 'contacts',
    title: 'Kontakte einrichten',
    description: 'Pflege deine Kundendaten im CRM-Bereich. Verknüpfe Kontakte mit Projekten.',
    icon: '👥',
    cta: '/contacts',
    ctaLabel: 'Zu Kontakten',
  },
  {
    id: 'done',
    title: 'Einrichtung abgeschlossen!',
    description: 'Du hast alle Grundschritte durchlaufen. Viel Erfolg bei der Planung.',
    icon: '✅',
  },
]

const STORAGE_KEY = 'okp_onboarding_done'

interface Props {
  onDismiss: () => void
}

export function OnboardingWizard({ onDismiss }: Props) {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]

  function handleDone() {
    localStorage.setItem(STORAGE_KEY, 'true')
    onDismiss()
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, 'true')
    onDismiss()
  }

  const isLast = stepIndex === STEPS.length - 1

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className={styles.wizard}>
        <div className={styles.stepIndicator}>
          {STEPS.map((s, i) => (
            <span key={s.id} className={`${styles.dot} ${i <= stepIndex ? styles.dotActive : ''}`} />
          ))}
        </div>

        <div className={styles.icon}>{step?.icon}</div>
        <h2 id="onboarding-title" className={styles.title}>{step?.title}</h2>
        <p className={styles.description}>{step?.description}</p>

        {step && 'cta' in step && step.cta && (
          <button
            className={styles.ctaButton}
            onClick={() => {
              navigate(step.cta!)
              handleDone()
            }}
          >
            {step.ctaLabel}
          </button>
        )}

        <div className={styles.actions}>
          {!isLast && (
            <button className={styles.btnSecondary} onClick={handleSkip}>Überspringen</button>
          )}
          {!isLast && (
            <button className={styles.btnPrimary} onClick={() => setStepIndex((i) => i + 1)}>Weiter</button>
          )}
          {isLast && (
            <button className={styles.btnPrimary} onClick={handleDone}>Starten</button>
          )}
        </div>
      </div>
    </div>
  )
}

export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(STORAGE_KEY)
}
