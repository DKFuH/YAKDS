import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { leadsApi, type LeadContact, type LeadRoom, type SimpleCabinet } from '../api/leads.js'
import styles from './WebplannerPage.module.css'

type Step = 'room' | 'cabinets' | 'contact' | 'done'

const CABINET_TYPES = [
  { value: 'base', label: 'Unterschrank', defaultH: 720, defaultD: 600 },
  { value: 'wall', label: 'Hängeschrank', defaultH: 600, defaultD: 350 },
  { value: 'tall', label: 'Hochschrank', defaultH: 2100, defaultD: 600 },
  { value: 'appliance', label: 'Gerät', defaultH: 850, defaultD: 600 },
] as const

export function WebplannerPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('room')
  const [tenantId, setTenantId] = useState('')

  // Step 1: Room
  const [roomWidth, setRoomWidth] = useState('4000')
  const [roomDepth, setRoomDepth] = useState('3000')
  const [ceilingHeight, setCeilingHeight] = useState('2500')

  // Step 2: Cabinets
  const [cabinets, setCabinets] = useState<SimpleCabinet[]>([])
  const [cabType, setCabType] = useState<SimpleCabinet['type']>('base')
  const [cabWidth, setCabWidth] = useState('600')

  // Step 3: Contact
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [consentData, setConsentData] = useState(false)

  // Result
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leadId, setLeadId] = useState<string | null>(null)

  function addCabinet() {
    const w = parseInt(cabWidth, 10)
    if (!w || w < 100) return
    const def = CABINET_TYPES.find(t => t.value === cabType)!
    const newCab: SimpleCabinet = {
      id: crypto.randomUUID(),
      type: cabType,
      width_mm: w,
      height_mm: def.defaultH,
      depth_mm: def.defaultD,
      label: def.label,
    }
    setCabinets(prev => [...prev, newCab])
  }

  function removeCabinet(id: string) {
    setCabinets(prev => prev.filter(c => c.id !== id))
  }

  async function handleSubmit() {
    if (!consentData) {
      setError('Einwilligung zur Datenverarbeitung ist erforderlich.')
      return
    }
    const tid = tenantId.trim()
    if (!tid) {
      setError('Tenant-ID fehlt. Bitte in der Konfiguration eintragen.')
      return
    }

    const room: LeadRoom = {
      width_mm: parseInt(roomWidth, 10) || 4000,
      depth_mm: parseInt(roomDepth, 10) || 3000,
      ceiling_height_mm: parseInt(ceilingHeight, 10) || 2500,
      shape: 'rectangle',
    }
    const contact: LeadContact = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
    }

    setSubmitting(true)
    setError(null)
    try {
      const lead = await leadsApi.create(tid, {
        contact,
        consent: {
          marketing: consentMarketing,
          data_processing: true,
          timestamp: new Date().toISOString(),
        },
        room,
        cabinets,
      })
      setLeadId(lead.id)
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lead konnte nicht gespeichert werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Küchen-Webplaner</h1>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>
          ← Zurück
        </button>
      </header>

      <div className={styles.tenantRow}>
        <label className={styles.tenantLabel}>
          Tenant-ID (Dev):
          <input
            type="text"
            className={styles.tenantInput}
            placeholder="UUID"
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.steps}>
        {(['room', 'cabinets', 'contact'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`${styles.stepDot} ${step === s ? styles.stepActive : ''} ${['cabinets', 'contact', 'done'].includes(step) && i === 0 ? styles.stepDone : ''} ${['contact', 'done'].includes(step) && i === 1 ? styles.stepDone : ''}`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* ── Step 1: Raum ── */}
      {step === 'room' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>1. Raummaße</h2>

          <div className={styles.field}>
            <label>Breite (mm)</label>
            <input type="number" className={styles.input} min={500} value={roomWidth} onChange={e => setRoomWidth(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Tiefe (mm)</label>
            <input type="number" className={styles.input} min={500} value={roomDepth} onChange={e => setRoomDepth(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Raumhöhe (mm)</label>
            <input type="number" className={styles.input} min={2000} value={ceilingHeight} onChange={e => setCeilingHeight(e.target.value)} />
          </div>

          <button type="button" className={styles.nextBtn} onClick={() => setStep('cabinets')}>
            Weiter →
          </button>
        </div>
      )}

      {/* ── Step 2: Schränke ── */}
      {step === 'cabinets' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>2. Schränke hinzufügen</h2>

          <div className={styles.addRow}>
            <select
              className={styles.select}
              value={cabType}
              onChange={e => setCabType(e.target.value as SimpleCabinet['type'])}
            >
              {CABINET_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="number"
              className={styles.input}
              style={{ width: 100 }}
              placeholder="Breite mm"
              value={cabWidth}
              onChange={e => setCabWidth(e.target.value)}
            />
            <button type="button" className={styles.addBtn} onClick={addCabinet}>+ Hinzufügen</button>
          </div>

          {cabinets.length === 0 ? (
            <p className={styles.empty}>Noch keine Schränke — optional.</p>
          ) : (
            <ul className={styles.cabList}>
              {cabinets.map(c => (
                <li key={c.id} className={styles.cabItem}>
                  <span>{c.label} · {c.width_mm} mm</span>
                  <button type="button" className={styles.removeBtn} onClick={() => removeCabinet(c.id)}>×</button>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.navRow}>
            <button type="button" className={styles.backStepBtn} onClick={() => setStep('room')}>← Zurück</button>
            <button type="button" className={styles.nextBtn} onClick={() => setStep('contact')}>Weiter →</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Kontakt ── */}
      {step === 'contact' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>3. Kontaktdaten</h2>

          <div className={styles.field}>
            <label>Name *</label>
            <input type="text" className={styles.input} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>E-Mail *</label>
            <input type="email" className={styles.input} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Telefon</label>
            <input type="tel" className={styles.input} value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          <div className={styles.consentBlock}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={consentData} onChange={e => setConsentData(e.target.checked)} />
              Ich stimme der Verarbeitung meiner Daten zu. *
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={consentMarketing} onChange={e => setConsentMarketing(e.target.checked)} />
              Ich möchte Angebote und Informationen erhalten (optional).
            </label>
          </div>

          <div className={styles.navRow}>
            <button type="button" className={styles.backStepBtn} onClick={() => setStep('cabinets')}>← Zurück</button>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={submitting || !name.trim() || !email.trim() || !consentData}
            >
              {submitting ? 'Sende…' : 'Anfrage absenden'}
            </button>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {step === 'done' && (
        <div className={`${styles.card} ${styles.doneCard}`}>
          <h2 className={styles.cardTitle}>Vielen Dank!</h2>
          <p>Ihre Planung wurde übermittelt. Unser Team meldet sich bei Ihnen.</p>
          {leadId && <p className={styles.leadId}>Lead-ID: {leadId}</p>}
          <button type="button" className={styles.nextBtn} onClick={() => navigate('/')}>
            Zur Startseite
          </button>
        </div>
      )}
    </div>
  )
}
