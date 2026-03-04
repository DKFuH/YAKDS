import { useTranslation } from 'react-i18next'
import { SUPPORTED_LOCALES } from '../i18n/resolveLocale.js'

const LOCALE_LABELS: Record<string, string> = {
  de: 'DE',
  en: 'EN',
}

interface Props {
  /** Optional callback after language change */
  onChange?: (locale: string) => void
}

/**
 * Language switcher showing only active (non-planned) locales: DE and EN.
 * Updates i18next, localStorage (okp_locale), document.documentElement.lang,
 * and fires-and-forgets a PUT /api/v1/tenant/locale-settings.
 */
export function LanguageSwitcher({ onChange }: Props) {
  const { i18n } = useTranslation()
  const current = i18n.language

  async function handleSwitch(code: string) {
    if (code === current) return

    await i18n.changeLanguage(code)

    try {
      localStorage.setItem('okp_locale', code)
    } catch {
      // Storage blocked – skip
    }

    try {
      document.documentElement.lang = code
    } catch {
      // Non-browser – skip
    }

    // Non-blocking backend sync
    void fetch('/api/v1/tenant/locale-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_locale: code }),
    }).catch(() => {
      // Ignore network errors; locale is already applied locally
    })

    onChange?.(code)
  }

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={current === code}
          onClick={() => void handleSwitch(code)}
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            border: current === code ? '2px solid currentColor' : '1px solid #ccc',
            fontWeight: current === code ? 700 : 400,
            cursor: current === code ? 'default' : 'pointer',
            background: 'transparent',
          }}
        >
          {LOCALE_LABELS[code] ?? code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
