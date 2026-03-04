import { useMemo, useState, type FormEvent } from 'react'
import type { BuildingLevel } from '../../api/levels.js'
import styles from './LevelsPanel.module.css'

interface Props {
  levels: BuildingLevel[]
  activeLevelId: string | null
  onSelectLevel: (id: string) => void
  onToggleVisibility: (level: BuildingLevel) => void
  onCreateLevel: (payload: { name: string; elevation_mm: number }) => void
}

type LevelPreset = 'EG' | 'OG' | 'UG' | 'custom'

const PRESET_ELEVATIONS: Record<Exclude<LevelPreset, 'custom'>, number> = {
  EG: 0,
  OG: 2800,
  UG: -2800,
}

export function LevelsPanel({ levels, activeLevelId, onSelectLevel, onToggleVisibility, onCreateLevel }: Props) {
  const [adding, setAdding] = useState(false)
  const [preset, setPreset] = useState<LevelPreset>('EG')
  const [customName, setCustomName] = useState('')

  const sortedLevels = useMemo(
    () => [...levels].sort((left, right) => left.order_index - right.order_index),
    [levels],
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const name = preset === 'custom' ? customName.trim() : preset
    if (!name) {
      return
    }

    const elevation = preset === 'custom' ? 0 : PRESET_ELEVATIONS[preset]
    onCreateLevel({ name, elevation_mm: elevation })

    setCustomName('')
    setPreset('EG')
    setAdding(false)
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Ebenen</h3>

      {sortedLevels.length === 0 ? (
        <p className={styles.empty}>Keine Ebene verfügbar</p>
      ) : (
        <ul className={styles.list}>
          {sortedLevels.map((level) => (
            <li key={level.id} className={styles.row}>
              <button
                type="button"
                className={`${styles.levelButton} ${activeLevelId === level.id ? styles.levelButtonActive : ''}`}
                onClick={() => onSelectLevel(level.id)}
                title={`Ebene ${level.name} auswählen`}
              >
                <span>{level.name}</span>
                <span className={styles.meta}>{level.elevation_mm} mm</span>
              </button>
              <label className={styles.visibilityToggle}>
                <input
                  type="checkbox"
                  checked={level.visible}
                  onChange={() => onToggleVisibility(level)}
                />
                Sichtbar
              </label>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className={styles.addForm} onSubmit={handleSubmit}>
          <label className={styles.fieldLabel} htmlFor="level-preset-select">Typ</label>
          <select
            id="level-preset-select"
            className={styles.select}
            value={preset}
            onChange={(event) => setPreset(event.target.value as LevelPreset)}
          >
            <option value="EG">EG</option>
            <option value="OG">OG</option>
            <option value="UG">UG</option>
            <option value="custom">Custom</option>
          </select>

          {preset === 'custom' && (
            <>
              <label className={styles.fieldLabel} htmlFor="level-custom-name">Name</label>
              <input
                id="level-custom-name"
                className={styles.input}
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="z. B. Galerie"
              />
            </>
          )}

          <div className={styles.actions}>
            <button type="submit" className={styles.confirmButton}>Anlegen</button>
            <button type="button" className={styles.cancelButton} onClick={() => setAdding(false)}>Abbrechen</button>
          </div>
        </form>
      ) : (
        <button type="button" className={styles.addButton} onClick={() => setAdding(true)}>
          + Ebene hinzufügen
        </button>
      )}
    </section>
  )
}
