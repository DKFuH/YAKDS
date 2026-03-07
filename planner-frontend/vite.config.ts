import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { existsSync } from 'fs'
import type { ViteDevServer } from 'vite'

// Resolves explicit `.js` imports to `.ts` / `.tsx` source files when no `.js` exists.
// Needed because TypeScript sources use `.js` extensions for ESM compatibility,
// but the project keeps only `.ts`/`.tsx` in src/ (no pre-compiled .js copies).
function tsJsFallbackPlugin() {
  return {
    name: 'ts-js-fallback',

    // Called by Vite's module graph during import analysis (covers .tsx→.js→.ts cases)
    resolveId(id: string, importer: string | undefined) {
      if (!id.endsWith('.js')) return null
      if (id.includes('node_modules') || id.startsWith('/@')) return null

      const importerDir = importer ? dirname(importer) : process.cwd()
      const absJs = resolve(importerDir, id)

      if (existsSync(absJs)) return null   // real .js file – let Vite handle it

      const ts = absJs.replace(/\.js$/, '.ts')
      if (existsSync(ts)) return ts

      const tsx = absJs.replace(/\.js$/, '.tsx')
      if (existsSync(tsx)) return tsx

      return null
    },

    // Covers direct HTTP requests from the browser (e.g. <script src="...js">)
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url?.endsWith('.js')) { next(); return }
        if (req.url.includes('node_modules') || req.url.includes('/@')) { next(); return }

        const urlPath = req.url.split('?')[0]
        const absJs = resolve(server.config.root, urlPath.slice(1))

        if (!existsSync(absJs)) {
          const ts = absJs.replace(/\.js$/, '.ts')
          const tsx = absJs.replace(/\.js$/, '.tsx')
          if (existsSync(ts)) {
            req.url = req.url.replace(/\.js(\?.*)?$/, '.ts$1')
          } else if (existsSync(tsx)) {
            req.url = req.url.replace(/\.js(\?.*)?$/, '.tsx$1')
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tsJsFallbackPlugin()],
  optimizeDeps: {
    // Pre-bundle at startup so Vite doesn't trigger mid-session re-optimization
    // (which causes React null errors during HMR when new icon imports are added)
    include: ['@fluentui/react-components', '@fluentui/react-icons'],
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared-schemas/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
