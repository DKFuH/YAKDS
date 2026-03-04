import { api } from '../../api/client.js'

export type EgiImportSummary = {
  walls: number
  roofs: number
  windows: number
  doors: number
  hindrances: number
  installations: number
}

export type EgiParseResult = {
  format: 'egi'
  summary: EgiImportSummary
  warnings: string[]
  preview: {
    room_height_mm: number
  }
}

export type EgiRoomImportResult = EgiParseResult & {
  room_id: string
  job_id: string
  imported: {
    walls: number
    openings: number
    roofs: number
    placements: number
    measure_lines: number
  }
}

export function parseEgi(content: string, sourceFilename?: string): Promise<EgiParseResult> {
  return api.post<EgiParseResult>('/survey-import/formats/egi/parse', {
    content,
    ...(sourceFilename ? { source_filename: sourceFilename } : {}),
  })
}

export function importEgiToRoom(roomId: string, content: string, sourceFilename?: string): Promise<EgiRoomImportResult> {
  return api.post<EgiRoomImportResult>(`/rooms/${roomId}/survey-import/egi`, {
    content,
    ...(sourceFilename ? { source_filename: sourceFilename } : {}),
  })
}
