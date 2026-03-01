import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        alias: {
            '@yakds/shared-schemas': path.resolve(__dirname, '../shared-schemas/src/index.ts'),
        },
        server: {
            deps: {
                inline: [
                    '@yakds/shared-schemas',
                    '@yakds/dxf-import',
                    '@yakds/skp-import',
                ],
            },
        },
    },
})
