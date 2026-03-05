import { useMemo, useState } from 'react'
import type { CameraPreset, CameraPresetMode } from '../../api/cameraPresets.js'
import styles from './CameraPresetPanel.module.css'

interface Props {
  presets: CameraPreset[]
  activePresetId: string | null
  loading: boolean
  saving: boolean
  cameraFovDeg: number
  onSetCameraFovDeg: (next: number) => void
  onSaveCurrentPreset: (payload: { name: string; mode: CameraPresetMode; isDefault: boolean }) => void
  onApplyPreset: (presetId: string) => void
  onDeletePreset: (presetId: string) => void
  onSetDefaultPreset: (presetId: string) => void
}

export function CameraPresetPanel({
  presets,
  activePresetId,
  loading,
  saving,
  cameraFovDeg,
  onSetCameraFovDeg,
  onSaveCurrentPreset,
  onApplyPreset,
  onDeletePreset,
  onSetDefaultPreset,
}: Props) {
  const [name, setName] = useState('Neue Ansicht')
  const [mode, setMode] = useState<CameraPresetMode>('orbit')
  const [saveAsDefault, setSaveAsDefault] = useState(false)

  const sortedPresets = useMemo(
    () => [...presets].sort((left, right) => left.name.localeCompare(right.name)),
    [presets],
  )

  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>Camera Presets</h3>

      <label className={styles.field}>
        FOV ({Math.round(cameraFovDeg)}°)
        <input
          type='range'
          min={20}
          max={110}
          step={1}
          value={cameraFovDeg}
          onChange={(event) => onSetCameraFovDeg(Number(event.target.value))}
        />
      </label>

      <label className={styles.field}>
        Preset-Name
        <input
          type='text'
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder='Neue Ansicht'
        />
      </label>

      <label className={styles.field}>
        Modus
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value === 'visitor' ? 'visitor' : 'orbit')}
        >
          <option value='orbit'>Orbit</option>
          <option value='visitor'>Visitor</option>
        </select>
      </label>

      <label className={styles.checkboxRow}>
        <input
          type='checkbox'
          checked={saveAsDefault}
          onChange={(event) => setSaveAsDefault(event.target.checked)}
        />
        Als Default speichern
      </label>

      <button
        type='button'
        className={styles.action}
        disabled={saving || name.trim().length === 0}
        onClick={() => onSaveCurrentPreset({
          name: name.trim(),
          mode,
          isDefault: saveAsDefault,
        })}
      >
        {saving ? 'Speichere…' : 'Aktuelle Ansicht speichern'}
      </button>

      {loading ? (
        <p className={styles.empty}>Presets werden geladen…</p>
      ) : sortedPresets.length === 0 ? (
        <p className={styles.empty}>Noch keine Kamera-Presets vorhanden.</p>
      ) : (
        <div className={styles.list}>
          {sortedPresets.map((preset) => (
            <article key={preset.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <strong className={styles.itemName}>{preset.name}</strong>
                <span className={styles.itemMeta}>{preset.id === activePresetId ? 'aktiv' : ''}</span>
              </div>
              <div className={styles.itemMeta}>
                {preset.mode} · FOV {Math.round(preset.fov)}° {preset.is_default ? '· default' : ''}
              </div>
              <div className={styles.itemActions}>
                <button type='button' className={styles.action} onClick={() => onApplyPreset(preset.id)}>
                  Anwenden
                </button>
                <button type='button' className={styles.action} onClick={() => onSetDefaultPreset(preset.id)}>
                  Default
                </button>
                <button type='button' className={styles.action} onClick={() => onDeletePreset(preset.id)}>
                  Entfernen
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
