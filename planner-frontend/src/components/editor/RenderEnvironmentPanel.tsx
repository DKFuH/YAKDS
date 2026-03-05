import type {
  RenderEnvironmentPreset,
  RenderEnvironmentSettings,
} from './renderEnvironmentState.js'
import {
  applyRenderEnvironmentPreset,
  clampEnvironmentIntensity,
  normalizeEnvironmentRotation,
  normalizeGroundTint,
} from './renderEnvironmentState.js'
import styles from './RenderEnvironmentPanel.module.css'

interface Props {
  presets: RenderEnvironmentPreset[]
  environment: RenderEnvironmentSettings
  saving: boolean
  onChange: (next: RenderEnvironmentSettings) => void
  onSave: () => void
}

function presetPreviewClassName(presetId: RenderEnvironmentSettings['preset_id']): string {
  if (presetId === 'studio') return styles.presetPreviewStudio
  if (presetId === 'interior') return styles.presetPreviewInterior
  return styles.presetPreviewDaylight
}

export function RenderEnvironmentPanel({
  presets,
  environment,
  saving,
  onChange,
  onSave,
}: Props) {
  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>Render-Umgebung</h3>

      <div className={styles.presetGrid}>
        {presets.map((preset) => {
          const selected = environment.preset_id === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              className={`${styles.presetCard} ${selected ? styles.presetCardActive : ''}`}
              onClick={() => onChange(applyRenderEnvironmentPreset(environment, preset.id))}
            >
              <span className={`${styles.presetPreview} ${presetPreviewClassName(preset.id)}`} />
              <strong>{preset.label}</strong>
              <small>{preset.description}</small>
            </button>
          )
        })}
      </div>

      <div className={styles.grid}>
        <label className={`${styles.field} ${styles.fieldFull}`}>
          Intensitaet: {environment.intensity.toFixed(2)}
          <input
            className={styles.slider}
            type="range"
            min={0.2}
            max={2}
            step={0.05}
            value={environment.intensity}
            onChange={(event) => onChange({
              ...environment,
              intensity: clampEnvironmentIntensity(Number(event.target.value)),
            })}
          />
        </label>

        <label className={styles.field}>
          Rotation (Grad)
          <input
            type="number"
            min={0}
            max={360}
            step={1}
            value={Math.round(environment.rotation_deg)}
            onChange={(event) => onChange({
              ...environment,
              rotation_deg: normalizeEnvironmentRotation(Number(event.target.value)),
            })}
          />
        </label>

        <label className={styles.field}>
          Ground Tint
          <input
            value={environment.ground_tint}
            onChange={(event) => onChange({
              ...environment,
              ground_tint: normalizeGroundTint(event.target.value, environment.preset_id),
            })}
            placeholder="#9AB77C"
          />
        </label>
      </div>

      <div className={styles.actions}>
        <label className={styles.tintControl}>
          <span>Tint</span>
          <input
            className={styles.tintPicker}
            type="color"
            value={environment.ground_tint}
            onChange={(event) => onChange({
              ...environment,
              ground_tint: normalizeGroundTint(event.target.value, environment.preset_id),
            })}
          />
        </label>
        <button type="button" className={styles.btnPrimary} onClick={onSave} disabled={saving}>
          {saving ? 'Speichert...' : 'Speichern'}
        </button>
      </div>
    </section>
  )
}
