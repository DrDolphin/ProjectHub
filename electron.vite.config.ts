import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        // `electron` is provided by the runtime — it must never be bundled.
        // Otherwise a transitive `require('electron')` (e.g. from
        // electron-updater) pulls in node_modules/electron's install shim,
        // whose `module.exports = getElectronPath()` throws at startup in the
        // packaged app ("Electron failed to install correctly").
        external: ['electron'],
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        external: ['electron'],
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        // The main process loads the preload as `index.mjs`, and Electron
        // requires ESM preload scripts to use the `.mjs` extension. Force it —
        // rollup otherwise emits `.js` under this `"type": "module"` package,
        // which fails to load and leaves `window.projectHub` undefined.
        output: { format: 'es', entryFileNames: '[name].mjs' }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        ...sharedAlias
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    plugins: [react()]
  }
})
