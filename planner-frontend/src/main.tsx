import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProjectList } from './pages/ProjectList.js'
import { Editor } from './pages/Editor.js'
import { CatalogPage } from './pages/CatalogPage.js'
import { BIDashboard } from './pages/BIDashboard.js'
import { ContactsPage } from './pages/ContactsPage.js'
import { DocumentsPage } from './pages/DocumentsPage.js'
import { WebplannerPage } from './pages/WebplannerPage.js'
import { QuoteLinesPage } from './pages/QuoteLinesPage.js'
import { ProductionOrdersPage } from './pages/ProductionOrdersPage.js'
import { SiteSurveyPage } from './pages/SiteSurveyPage.js'
import { SupplierPortalPage } from './pages/SupplierPortalPage.js'
import { ReportsPage } from './pages/ReportsPage.js'
import { CompliancePage } from './pages/CompliancePage.js'
import { McpInfoPage } from './pages/McpInfoPage.js'
import { TenantSettingsPage } from './pages/TenantSettingsPage.js'
import { CutlistPage } from './pages/CutlistPage'
import './global.css'

const tischlerPluginFlag = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_ENABLE_TISCHLER_PLUGIN
const tischlerPluginEnabled = String(tischlerPluginFlag ?? 'true').toLowerCase() !== 'false'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/bi" element={<BIDashboard />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/webplanner" element={<WebplannerPage />} />
        <Route path="/projects/:id" element={<Editor />} />
        <Route path="/projects/:id/quote-lines" element={<QuoteLinesPage />} />
        <Route path="/production-orders" element={<ProductionOrdersPage />} />
        <Route path="/site-surveys" element={<SiteSurveyPage />} />
        <Route path="/supplier-portal" element={<SupplierPortalPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings/mcp" element={<McpInfoPage />} />
        {tischlerPluginEnabled && <Route path="/projects/:id/cutlist" element={<CutlistPage />} />}
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/settings/company" element={<TenantSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
