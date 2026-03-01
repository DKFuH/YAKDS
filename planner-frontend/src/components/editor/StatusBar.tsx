import type { ProjectDetail, Room } from '../../api/projects.js'
import styles from './StatusBar.module.css'

interface Props {
  project: ProjectDetail
  selectedRoom: Room | null
}

export function StatusBar({ project, selectedRoom }: Props) {
  const totalRooms = project.rooms.length
  const totalPlacements = project.rooms.reduce(
    (sum, r) => sum + (r.placements as unknown[]).length,
    0,
  )

  return (
    <footer className={styles.bar}>
      <span>{totalRooms} Räume · {totalPlacements} Möbel</span>
      {selectedRoom && (
        <span>Aktiv: <strong>{selectedRoom.name}</strong></span>
      )}
      <span className={styles.right}>Gesamtpreis: — (Sprint 12)</span>
    </footer>
  )
}
