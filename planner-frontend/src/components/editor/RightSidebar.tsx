import type { Room } from '../../api/projects.js'
import styles from './RightSidebar.module.css'

interface Props {
  room: Room | null
}

export function RightSidebar({ room }: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Eigenschaften</h3>
        {room ? (
          <dl className={styles.props}>
            <dt>Raumhöhe</dt>
            <dd>{(room.ceiling_height_mm / 1000).toFixed(2)} m</dd>
            <dt>Platzierungen</dt>
            <dd>{(room.placements as unknown[]).length}</dd>
          </dl>
        ) : (
          <p className={styles.empty}>Kein Objekt ausgewählt</p>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Prüfungen</h3>
        <p className={styles.empty}>Sprint 9 – folgt</p>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Dachschrägen</h3>
        <p className={styles.empty}>Sprint 6 – folgt</p>
      </div>
    </aside>
  )
}
