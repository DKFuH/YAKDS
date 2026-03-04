export type RenderPreset = 'draft' | 'balanced' | 'best'

export interface RenderPresetOption {
  value: RenderPreset
  label: string
  hint: string
}

export const RENDER_PRESET_OPTIONS: RenderPresetOption[] = [
  {
    value: 'draft',
    label: 'Schnell',
    hint: 'Für schnelle Vorschauen',
  },
  {
    value: 'balanced',
    label: 'Ausgewogen',
    hint: 'Standard für Kundenentwürfe',
  },
  {
    value: 'best',
    label: 'Beste',
    hint: 'Hohe Qualität, längere Renderzeit',
  },
]

export type PresentationSource =
  | { kind: 'split-view' }
  | { kind: 'panorama-tour'; panorama_tour_id: string }
  | { kind: 'manual-camera' }
