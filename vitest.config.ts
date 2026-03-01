import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared-schemas/src', import.meta.url)),
      '@planner-api': fileURLToPath(new URL('./planner-api/src', import.meta.url)),
      '@planner-frontend': fileURLToPath(new URL('./planner-frontend/src', import.meta.url)),
      '@dxf-import': fileURLToPath(new URL('./interop-cad/dxf-import/src', import.meta.url)),
      '@dxf-export': fileURLToPath(new URL('./interop-cad/dxf-export/src', import.meta.url)),
      '@skp-import': fileURLToPath(new URL('./interop-sketchup/skp-import/src', import.meta.url))
    }
  },
  test: {
    include: ['**/*.test.ts']
  }
});
