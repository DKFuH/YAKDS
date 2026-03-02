import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        alias: {
            '@okp/shared-schemas': path.resolve(__dirname, '../shared-schemas/src/index.ts'),
        },
        server: {
            deps: {
                inline: [
                    '@okp/shared-schemas',
                    '@okp/dxf-import',
                    '@okp/skp-import',
                ],
            },
        },
    },
})
