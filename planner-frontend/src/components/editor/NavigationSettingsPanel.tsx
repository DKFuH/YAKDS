import {
  defaultsForNavigationProfile,
  type NavigationProfile,
  type NavigationSettings,
} from './navigationSettings.js'
import styles from './NavigationSettingsPanel.module.css'

interface Props {
  settings: NavigationSettings
  onChange: (settings: NavigationSettings) => void
}

export function NavigationSettingsPanel({ settings, onChange }: Props) {
  function handleProfileChange(profile: NavigationProfile) {
    onChange(defaultsForNavigationProfile(profile))
  }

  return (
    <section className={styles.panel} aria-label='Navigationseinstellungen'>
      <h3 className={styles.title}>Navigation & Input</h3>
      <p className={styles.hint}>Shortcuts: `1` = 2D · `2` = Split · `3` = 3D</p>

      <div className={styles.grid}>
        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span>Profil</span>
          <select
            value={settings.navigation_profile}
            onChange={(event) => handleProfileChange(event.target.value as NavigationProfile)}
          >
            <option value='cad'>CAD</option>
            <option value='presentation'>Presentation</option>
            <option value='trackpad'>Trackpad</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Touchpad-Modus</span>
          <select
            value={settings.touchpad_mode}
            onChange={(event) => {
              onChange({
                ...settings,
                touchpad_mode: event.target.value === 'trackpad' ? 'trackpad' : 'cad',
              })
            }}
          >
            <option value='cad'>CAD (Wheel = Zoom)</option>
            <option value='trackpad'>Trackpad (Scroll = Pan)</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Zoom-Richtung</span>
          <select
            value={settings.zoom_direction}
            onChange={(event) => {
              onChange({
                ...settings,
                zoom_direction: event.target.value === 'inverted' ? 'inverted' : 'natural',
              })
            }}
          >
            <option value='natural'>Natürlich</option>
            <option value='inverted'>Invertiert</option>
          </select>
        </label>

        <label className={`${styles.toggle} ${styles.fieldFull}`}>
          <input
            type='checkbox'
            checked={settings.middle_mouse_pan}
            onChange={(event) => {
              onChange({
                ...settings,
                middle_mouse_pan: event.target.checked,
              })
            }}
          />
          Middle-Mouse-Pan aktivieren
        </label>

        <label className={`${styles.toggle} ${styles.fieldFull}`}>
          <input
            type='checkbox'
            checked={settings.invert_y_axis}
            onChange={(event) => {
              onChange({
                ...settings,
                invert_y_axis: event.target.checked,
              })
            }}
          />
          Orbit-Achse invertieren (Y)
        </label>
      </div>
    </section>
  )
}
