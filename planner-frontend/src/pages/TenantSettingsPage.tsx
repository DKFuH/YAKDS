import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Select,
  Spinner,
  Subtitle2,
  Textarea,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { getTenantSettings, updateTenantSettings, type TenantSettings } from '../api/tenantSettings.js'
import { useLocale } from '../hooks/useLocale.js'
import { LanguageSwitcher } from '../components/LanguageSwitcher.js'
import { SUPPORTED_LOCALES } from '../i18n/resolveLocale.js'

const useStyles = makeStyles({
  page: { display: 'grid', rowGap: tokens.spacingVerticalXL },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  section: { display: 'grid', rowGap: tokens.spacingVerticalM },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  fullWidth: { gridColumn: '1 / -1' },
  actions: { display: 'flex', gap: tokens.spacingHorizontalM, flexWrap: 'wrap', alignItems: 'center' },
})

export function TenantSettingsPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const [form, setForm] = useState<TenantSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tenantLocale, setTenantLocale] = useState<string>('')
  const [localeSaveMsg, setLocaleSaveMsg] = useState<string | null>(null)
  const { t } = useLocale()

  useEffect(() => {
    getTenantSettings()
      .then((data) => setForm(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void fetch('/api/v1/tenant/locale-settings')
      .then((r) => r.ok ? r.json() as Promise<{ preferred_locale: string | null; fallback_locale: string | null }> : Promise.reject(r))
      .then((data) => { if (data.preferred_locale) setTenantLocale(data.preferred_locale) })
      .catch(() => { /* not critical */ })
  }, [])

  async function handleSaveTenantLocale() {
    if (!tenantLocale) return
    try {
      const r = await fetch('/api/v1/tenant/locale-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_locale: tenantLocale }),
      })
      if (r.ok) setLocaleSaveMsg(t('settings.tenantLocaleSaved'))
    } catch { /* ignore */ }
  }

  function handleChange(field: keyof TenantSettings, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null); setSuccess(false)
    try {
      const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...payload } = form
      const updated = await updateTenantSettings(payload)
      setForm(updated); setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
        <Spinner label="Lade Einstellungen…" />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <Title2>Firmenprofil</Title2>
          <Body1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
            Firmendaten für Angebots-PDF, Steuer- und Bankverbindung
          </Body1>
        </div>
        <div className={styles.actions}>
          <Button appearance="secondary" onClick={() => navigate('/settings')}>← Zurück</Button>
        </div>
      </div>

      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {success && <MessageBar intent="success"><MessageBarBody>Einstellungen gespeichert.</MessageBarBody></MessageBar>}

      <form onSubmit={(e) => void handleSubmit(e)}>
        <section className={styles.section}>
          <Subtitle2>Firmendaten</Subtitle2>
          <div className={styles.grid}>
            <Field label="Firmenname"><Input maxLength={200} value={form.company_name ?? ''} onChange={(e) => handleChange('company_name', e.target.value)} /></Field>
            <Field label="Straße"><Input maxLength={200} value={form.company_street ?? ''} onChange={(e) => handleChange('company_street', e.target.value)} /></Field>
            <Field label="PLZ"><Input maxLength={20} value={form.company_zip ?? ''} onChange={(e) => handleChange('company_zip', e.target.value)} /></Field>
            <Field label="Ort"><Input maxLength={100} value={form.company_city ?? ''} onChange={(e) => handleChange('company_city', e.target.value)} /></Field>
            <Field label="Telefon"><Input maxLength={50} value={form.company_phone ?? ''} onChange={(e) => handleChange('company_phone', e.target.value)} /></Field>
            <Field label="E-Mail"><Input type="email" maxLength={200} value={form.company_email ?? ''} onChange={(e) => handleChange('company_email', e.target.value)} /></Field>
            <Field label="Website"><Input maxLength={200} value={form.company_web ?? ''} onChange={(e) => handleChange('company_web', e.target.value)} /></Field>
          </div>
        </section>

        <section className={styles.section} style={{ marginTop: tokens.spacingVerticalL }}>
          <Subtitle2>Steuer &amp; Bank</Subtitle2>
          <div className={styles.grid}>
            <Field label="USt-IdNr."><Input maxLength={30} placeholder="z. B. DE123456789" value={form.vat_id ?? ''} onChange={(e) => handleChange('vat_id', e.target.value)} /></Field>
            <Field label="Steuernummer"><Input maxLength={30} value={form.tax_number ?? ''} onChange={(e) => handleChange('tax_number', e.target.value)} /></Field>
            <Field label="IBAN"><Input maxLength={50} value={form.iban ?? ''} onChange={(e) => handleChange('iban', e.target.value)} /></Field>
            <Field label="BIC"><Input maxLength={20} value={form.bic ?? ''} onChange={(e) => handleChange('bic', e.target.value)} /></Field>
            <Field label="Bank"><Input maxLength={100} value={form.bank_name ?? ''} onChange={(e) => handleChange('bank_name', e.target.value)} /></Field>
          </div>
        </section>

        <section className={styles.section} style={{ marginTop: tokens.spacingVerticalL }}>
          <Subtitle2>Angebotsvorlage</Subtitle2>
          <div className={styles.grid}>
            <Field label="Fußtext (erscheint auf jedem Angebots-PDF)" className={styles.fullWidth}>
              <Textarea rows={4} maxLength={2000} value={form.quote_footer ?? ''} onChange={(_e, d) => handleChange('quote_footer', d.value)} />
            </Field>
            <Field label="Währung"><Input maxLength={3} placeholder="EUR" value={form.currency_code ?? ''} onChange={(e) => handleChange('currency_code', e.target.value)} /></Field>
          </div>
        </section>

        <div className={styles.actions} style={{ marginTop: tokens.spacingVerticalL }}>
          <Button appearance="primary" type="submit" disabled={saving}>
            {saving ? <Spinner size="tiny" /> : t('common.save')}
          </Button>
        </div>
      </form>

      <section className={styles.section}>
        <Subtitle2>{t('settings.languageSection')}</Subtitle2>
        <Body1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>{t('settings.languageHint')}</Body1>
        <LanguageSwitcher />
        <div className={styles.actions}>
          <div>
            <Caption1 style={{ display: 'block', marginBottom: '4px' }}>{t('settings.tenantLocale')}</Caption1>
            <Select value={tenantLocale} onChange={(_e, d) => { setTenantLocale(d.value); setLocaleSaveMsg(null) }}>
              <Option value="">–</Option>
              {SUPPORTED_LOCALES.map((code) => <Option key={code} value={code}>{code.toUpperCase()}</Option>)}
            </Select>
          </div>
          <Button appearance="secondary" onClick={() => void handleSaveTenantLocale()}>{t('settings.tenantLocaleSave')}</Button>
          {localeSaveMsg && <Body1 style={{ color: tokens.colorStatusSuccessForeground1 }}>{localeSaveMsg}</Body1>}
        </div>
      </section>
    </div>
  )
}
