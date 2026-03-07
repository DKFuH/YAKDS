import { Component, StrictMode, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FluentProvider } from '@fluentui/react-components'
import { ProjectList } from './pages/ProjectList.js'
import { Editor } from './pages/Editor.js'
import { CatalogPage } from './pages/CatalogPage.js'
import { BIDashboard } from './pages/BIDashboard.js'
import { ContactsPage } from './pages/ContactsPage.js'
import { DocumentsPage } from './pages/DocumentsPage.js'
import { ProjectArchivePage } from './pages/ProjectArchivePage.js'
import { WebplannerPage } from './pages/WebplannerPage.js'
import { QuoteLinesPage } from './pages/QuoteLinesPage.js'
import { ProductionOrdersPage } from './pages/ProductionOrdersPage.js'
import { SiteSurveyPage } from './pages/SiteSurveyPage.js'
import { SupplierPortalPage } from './pages/SupplierPortalPage.js'
import { ReportsPage } from './pages/ReportsPage.js'
import { CompliancePage } from './pages/CompliancePage.js'
import { TenantSettingsPage } from './pages/TenantSettingsPage.js'
import { ProjectDefaultsPage } from './pages/ProjectDefaultsPage.js'
import { PluginsSettingsPage } from './pages/PluginsSettingsPage.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { LanguagePacksPage } from './pages/LanguagePacksPage.js'
import { LayoutStylesPage } from './pages/LayoutStylesPage.js'
import { McpInfoPage } from './pages/McpInfoPage.js'
import { PanoramaToursPage } from './pages/PanoramaToursPage.js'
import { PublicPanoramaTourPage } from './pages/PublicPanoramaTourPage.js'
import { PresentationModePage } from './pages/PresentationModePage.js'
import { SpecificationPackagesPage } from './pages/SpecificationPackagesPage.js'
import { ExportsPage } from './pages/ExportsPage.js'
import { CutlistPage } from './pages/CutlistPage'
import { NestingPage } from './pages/NestingPage'
import { CaptureDialogHarnessPage } from './pages/CaptureDialogHarnessPage.js'
import { S109ShellHarnessPage } from './pages/S109ShellHarnessPage.js'
import { AppShell } from './components/layout/AppShell.js'
import { getTenantPlugins } from './api/tenantSettings.js'
import { bootstrapOfflinePwa } from './pwa/offlineBootstrap.js'
import { okpFluentTheme } from './theme/fluentTheme.js'
import './i18n/index.js'
import './global.css'

const tischlerPluginFlag = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_ENABLE_TISCHLER_PLUGIN
const tischlerPluginEnabled = String(tischlerPluginFlag ?? 'true').toLowerCase() !== 'false'

function TenantPluginRoute({ pluginId, children }: { pluginId: string; children: ReactNode }) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let active = true

    getTenantPlugins()
      .then((data) => {
        if (!active) return
        setEnabled(data.enabled.includes(pluginId))
      })
      .catch(() => {
        if (!active) return
        setErrored(true)
      })

    return () => {
      active = false
    }
  }, [pluginId])

  if (!tischlerPluginEnabled && pluginId === 'tischler') {
    return <Navigate to="/settings/plugins" replace />
  }

  if (errored) {
    return <Navigate to="/settings/plugins" replace />
  }

  if (enabled === null) {
    return <div style={{ padding: 32, textAlign: 'center' }}>{t('common.loading')}</div>
  }

  if (!enabled) {
    return <Navigate to="/settings/plugins" replace />
  }

  return <>{children}</>
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#c00', background: '#fff' }}>
          <h2>Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {(this.state.error as Error).message}
            {'\n\n'}
            {(this.state.error as Error).stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

bootstrapOfflinePwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={okpFluentTheme}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<ProjectList />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/bi" element={<BIDashboard />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/projects/archive" element={<ProjectArchivePage />} />
              <Route path="/webplanner" element={<WebplannerPage />} />
              <Route path="/projects/:id" element={<Editor />} />
              <Route path="/projects/:id/panorama-tours" element={<PanoramaToursPage />} />
              <Route
                path="/projects/:id/presentation"
                element={<TenantPluginRoute pluginId="presentation"><PresentationModePage /></TenantPluginRoute>}
              />
              <Route
                path="/projects/:id/exports"
                element={<TenantPluginRoute pluginId="viewer-export"><ExportsPage /></TenantPluginRoute>}
              />
              <Route path="/projects/:id/specification-packages" element={<SpecificationPackagesPage />} />
              <Route path="/share/panorama/:token" element={<PublicPanoramaTourPage />} />
              <Route path="/projects/:id/quote-lines" element={<QuoteLinesPage />} />
              <Route path="/production-orders" element={<ProductionOrdersPage />} />
              <Route path="/site-surveys" element={<SiteSurveyPage />} />
              <Route path="/supplier-portal" element={<SupplierPortalPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/compliance" element={<CompliancePage />} />
              <Route path="/settings/mcp" element={<McpInfoPage />} />
              <Route
                path="/projects/:id/cutlist"
                element={<TenantPluginRoute pluginId="tischler"><CutlistPage /></TenantPluginRoute>}
              />
              <Route
                path="/projects/:id/nesting"
                element={<TenantPluginRoute pluginId="tischler"><NestingPage /></TenantPluginRoute>}
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/language-packs" element={<LanguagePacksPage />} />
              <Route path="/settings/company" element={<TenantSettingsPage />} />
              <Route path="/settings/project-defaults" element={<ProjectDefaultsPage />} />
              <Route path="/settings/plugins" element={<PluginsSettingsPage />} />
              <Route path="/settings/layout-styles" element={<LayoutStylesPage />} />
              <Route path="/__e2e/capture-dialog" element={<CaptureDialogHarnessPage />} />
              <Route path="/__e2e/s109-shell" element={<S109ShellHarnessPage />} />
              <Route path="/projects/:id/__e2e/s109-shell" element={<S109ShellHarnessPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </FluentProvider>
  </StrictMode>,
)
