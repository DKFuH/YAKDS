import type { Room } from '../../api/projects.js'
import styles from './CanvasArea.module.css'

interface Props {
  room: Room | null
}

// Platzhalter – wird in Sprint 3 durch Polygon-Editor ersetzt (Codex liefert Algorithmen)
export function CanvasArea({ room }: Props) {
  return (
    <main className={styles.canvas}>
      {room ? (
        <div className={styles.placeholder}>
          <p>Canvas – Raumeditor</p>
          <p className={styles.sub}>Raum: <strong>{room.name}</strong></p>
          <p className={styles.hint}>Polygon-Editor folgt in Sprint 3</p>
        </div>
      ) : (
        <div className={styles.placeholder}>
          <p>Kein Raum ausgewählt</p>
          <p className={styles.hint}>Wähle einen Raum in der linken Sidebar oder lege einen neuen an.</p>
        </div>
      )}
    </main>
  )
}
