import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Body1,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Select,
  Spinner,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { leadsApi, type LeadContact, type LeadRoom, type SimpleCabinet } from '../api/leads.js'

type Step = 'room' | 'cabinets' | 'contact' | 'done'

const CABINET_TYPES = [
  { value: 'base', label: 'Unterschrank', defaultH: 720, defaultD: 600 },
  { value: 'wall', label: 'Haengeschrank', defaultH: 600, defaultD: 350 },
  { value: 'tall', label: 'Hochschrank', defaultH: 2100, defaultD: 600 },
  { value: 'appliance', label: 'Geraet', defaultH: 850, defaultD: 600 },
] as const

const useStyles = makeStyles({
  page: {
    maxWidth: '640px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  stepRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    justifyContent: 'center',
  },
  stepDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  stepActive: {
    background: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundInverted,
  },
  stepDone: {
    background: tokens.colorPaletteGreenBackground2,
    color: tokens.colorNeutralForegroundInverted,
  },
  addRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'flex-end',
  },
  cabList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  cabItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    background: tokens.colorNeutralBackground2,
    fontSize: tokens.fontSizeBase300,
  },
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: tokens.spacingVerticalS,
  },
  consentBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    margin: `${tokens.spacingVerticalS} 0`,
  },
  leadId: {
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  doneCard: {
    textAlign: 'center',
  },
})

export function WebplannerPage() {
  const navigate = useNavigate()
  const styles = useStyles()
  const [step, setStep] = useState<Step>('room')
  const [tenantId, setTenantId] = useState('')

  const [roomWidth, setRoomWidth] = useState('4000')
  const [roomDepth, setRoomDepth] = useState('3000')
  const [ceilingHeight, setCeilingHeight] = useState('2500')

  const [cabinets, setCabinets] = useState<SimpleCabinet[]>([])
  const [cabType, setCabType] = useState<SimpleCabinet['type']>('base')
  const [cabWidth, setCabWidth] = useState('600')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [consentData, setConsentData] = useState(false)

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
    if (!consentData) { setError('Einwilligung zur Datenverarbeitung ist erforderlich.'); return }
    const tid = tenantId.trim()
    if (!tid) { setError('Tenant-ID fehlt.'); return }

    const room: LeadRoom = {
      width_mm: parseInt(roomWidth, 10) || 4000,
      depth_mm: parseInt(roomDepth, 10) || 3000,
      ceiling_height_mm: parseInt(ceilingHeight, 10) || 2500,
      shape: 'rectangle',
    }
    const contact: LeadContact = {
      name: name.trim(), email: email.trim(), phone: phone.trim() || undefined,
    }

    setSubmitting(true)
    setError(null)
    try {
      const lead = await leadsApi.create(tid, {
        contact,
        consent: { marketing: consentMarketing, data_processing: true, timestamp: new Date().toISOString() },
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

  const stepLabels = ['Raum', 'Schraenke', 'Kontakt']
  const stepKeys: Step[] = ['room', 'cabinets', 'contact']

  return (
    <div className={styles.page}>
      <Title2>Kuechen-Webplaner</Title2>

      <Field label='Tenant-ID (Dev)'>
        <Input placeholder='UUID' value={tenantId} onChange={(_e, d) => setTenantId(d.value)} />
      </Field>

      <div className={styles.stepRow}>
        {stepLabels.map((_label, i) => {
          const key = stepKeys[i]
          const stepIdx = stepKeys.indexOf(step)
          const isActive = step === key
          const isDone = stepIdx > i
          return (
            <div key={key} className={`${styles.stepDot} ${isActive ? styles.stepActive : ''} ${isDone ? styles.stepDone : ''}`}>
              {i + 1}
            </div>
          )
        })}
      </div>

      {error && (
        <MessageBar intent='error'>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {step === 'room' && (
        <Card>
          <CardHeader header={<Body1><b>1. Raummasze</b></Body1>} />
          <Field label='Breite (mm)'>
            <Input type='number' min='500' value={roomWidth} onChange={(_e, d) => setRoomWidth(d.value)} />
          </Field>
          <Field label='Tiefe (mm)'>
            <Input type='number' min='500' value={roomDepth} onChange={(_e, d) => setRoomDepth(d.value)} />
          </Field>
          <Field label='Raumhoehe (mm)'>
            <Input type='number' min='2000' value={ceilingHeight} onChange={(_e, d) => setCeilingHeight(d.value)} />
          </Field>
          <Button appearance='primary' onClick={() => setStep('cabinets')}>Weiter</Button>
        </Card>
      )}

      {step === 'cabinets' && (
        <Card>
          <CardHeader header={<Body1><b>2. Schraenke hinzufuegen</b></Body1>} />
          <div className={styles.addRow}>
            <Field label='Typ'>
              <Select value={cabType} onChange={(_e, d) => setCabType(d.value as SimpleCabinet['type'])}>
                {CABINET_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
              </Select>
            </Field>
            <Field label='Breite mm'>
              <Input type='number' style={{ width: 100 }} value={cabWidth} onChange={(_e, d) => setCabWidth(d.value)} />
            </Field>
            <Button appearance='primary' onClick={addCabinet}>+ Hinzufuegen</Button>
          </div>
          {cabinets.length === 0 ? (
            <Body1 style={{ color: tokens.colorNeutralForeground3 }}>Noch keine Schraenke — optional.</Body1>
          ) : (
            <ul className={styles.cabList}>
              {cabinets.map(c => (
                <li key={c.id} className={styles.cabItem}>
                  <span>{c.label} · {c.width_mm} mm</span>
                  <Button appearance='subtle' size='small' onClick={() => removeCabinet(c.id)}>×</Button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.navRow}>
            <Button appearance='subtle' onClick={() => setStep('room')}>← Zurueck</Button>
            <Button appearance='primary' onClick={() => setStep('contact')}>Weiter</Button>
          </div>
        </Card>
      )}

      {step === 'contact' && (
        <Card>
          <CardHeader header={<Body1><b>3. Kontaktdaten</b></Body1>} />
          <Field label='Name *' required>
            <Input value={name} onChange={(_e, d) => setName(d.value)} />
          </Field>
          <Field label='E-Mail *' required>
            <Input type='email' value={email} onChange={(_e, d) => setEmail(d.value)} />
          </Field>
          <Field label='Telefon'>
            <Input type='tel' value={phone} onChange={(_e, d) => setPhone(d.value)} />
          </Field>
          <div className={styles.consentBlock}>
            <Checkbox
              checked={consentData}
              onChange={(_e, d) => setConsentData(Boolean(d.checked))}
              label='Ich stimme der Verarbeitung meiner Daten zu. *'
            />
            <Checkbox
              checked={consentMarketing}
              onChange={(_e, d) => setConsentMarketing(Boolean(d.checked))}
              label='Ich moechte Angebote und Informationen erhalten (optional).'
            />
          </div>
          <div className={styles.navRow}>
            <Button appearance='subtle' onClick={() => setStep('cabinets')}>← Zurueck</Button>
            <Button
              appearance='primary'
              onClick={() => void handleSubmit()}
              disabled={submitting || !name.trim() || !email.trim() || !consentData}
              icon={submitting ? <Spinner size='tiny' /> : undefined}
            >
              {submitting ? 'Sende...' : 'Anfrage absenden'}
            </Button>
          </div>
        </Card>
      )}

      {step === 'done' && (
        <Card className={styles.doneCard}>
          <CardHeader header={<Body1><b>Vielen Dank!</b></Body1>} />
          <Body1>Ihre Planung wurde uebermittelt. Unser Team meldet sich bei Ihnen.</Body1>
          {leadId && <span className={styles.leadId}>Lead-ID: {leadId}</span>}
          <Button appearance='primary' onClick={() => navigate('/')}>Zur Startseite</Button>
        </Card>
      )}
    </div>
  )
}
