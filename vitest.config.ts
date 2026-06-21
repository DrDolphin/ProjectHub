import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Vitest mirrors the app's resolve alias (@shared). `electron` is aliased to a
// stub (test/stubs/electron.ts) so main-process modules that import it resolve
// under plain Node — see the stub for why getPath('userData') is overridable.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Give slow filesystem-bound tests (mkdtemp, many small writes) headroom.
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/index.ts', 'src/preload/**'],
      reporter: ['text', 'html']
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      electron: resolve(__dirname, 'test/stubs/electron.ts')
    }
  }
})
