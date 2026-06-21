# AGENTS.md

Guidance for AI agents (and humans) working in **ProjectHub** — an Electron desktop
app for launching, organizing, and managing local development projects.
Stack: **Electron + electron-vite + React + TypeScript + TailwindCSS**, package
manager **pnpm**. It is a **Windows-only** app.

This file is the source of truth for how to work in this repo. Read it before
making changes.

## Golden rules

1. **Never commit directly to `main`.** Branch off the latest `main`, one branch
   per concern, and open a PR.
2. **Keep PRs focused.** One logical change per PR. Don't bundle an icon tweak, a
   feature, and a CI change together — it makes review and rollback painful.
3. **Run the full gate locally before you push** (see [Commands](#commands)). CI
   runs the exact same steps and will block the PR otherwise.
4. **CI runs on Windows on purpose** — don't move it to Linux (see
   [Windows-only](#windows-only-this-is-not-optional)).
5. **The IPC contract in `src/shared/types.ts` is the single source of truth.**
   Keep main, preload, and renderer in sync with it.

## Commands

```bash
pnpm install        # install deps (CI uses --frozen-lockfile)
pnpm dev            # run the app with HMR
pnpm lint           # eslint
pnpm typecheck      # tsc for main (node) + renderer (web)
pnpm test           # vitest run (unit tests, main process)
pnpm build          # production build → out/
pnpm build:win      # build + Windows installer → dist/
```

Useful variants: `pnpm lint:fix`, `pnpm test:watch`, `pnpm test:coverage`.

**Before pushing**, run the same gate CI does:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Run `pnpm build` too when your change could affect the build (deps, config,
main/preload entry points).

## Workflow

1. **Sync and branch.** `git checkout main && git pull` then
   `git checkout -b <type>/<short-slug>` (e.g. `feat/…`, `fix/…`, `docs/…`,
   `ci/…`, `design/…`).
2. **Make the change**, matching the conventions and style of surrounding code.
3. **Verify locally** — `pnpm lint && pnpm typecheck && pnpm test` must pass.
   Add or update tests for behavior you change.
4. **Commit** using Conventional Commit style (`feat:`, `fix:`, `chore:`,
   `docs:`, `ci:`, `refactor:`, `design:`). Write a body explaining the *why*.
   For AI-authored commits, end the message with:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
5. **Open a PR to `main`** with a clear description and a short test plan. CI
   (the "Lint, Typecheck, Test & Build" job) must be green to merge.
6. **Address review feedback** with follow-up commits; reply on the thread and
   resolve it once handled.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/main/` | Electron main process — window, IPC handlers, scan, store/trash, config, updater, DeepSeek proxy |
| `src/preload/` | `contextBridge` API exposed to the renderer |
| `src/shared/types.ts` | Shared types **and** the IPC channel contract (`IPC`) — single source of truth |
| `src/renderer/src/` | React UI (components, styles) |
| `test/` | Vitest unit tests (`test/main/**`), fixtures (`test/helpers/`), and the Electron stub (`test/stubs/electron.ts`) |
| `build/` | App-icon source (`icon.svg`) and the raster `icon.png` electron-builder derives the Windows `.ico` from |
| `resources/` | Bundled seed data (e.g. `metadata.seed.json`) |

## Conventions & gotchas

### Windows-only (this is not optional)

- The app ships only a Windows target (`electron-builder --win`, NSIS) and is
  developed on Windows.
- Store keys (metadata, pinned) are **normalized to backslash paths** — this is
  the documented on-disk contract, and unit tests assert it
  (e.g. `D:/Projects/Foo` → `D:\\Projects\\Foo`).
- Because the store tests exercise real filesystem renames with Windows path
  semantics, **CI runs on `windows-latest`**. Running it on Linux mangles
  `/tmp/...` paths and fails. Keep CI on Windows; don't "fix" tests to be
  Linux-friendly at the cost of the path contract.

### Security model

- `contextIsolation: true`, `nodeIntegration: false`. The renderer has **no**
  direct filesystem or shell access.
- Everything goes renderer → preload `contextBridge` → `ipcMain.handle` channels
  defined in `src/shared/types.ts`.
- **IPC handlers are the trust boundary.** They are also a public, AI-driven and
  programmatic surface (`window.projectHub.*`), so validate every input. In
  particular, never join untrusted `name`/`parent` strings onto a root path
  without rejecting traversal — use the `src/main/safePath.ts` helpers
  (`isSafeSegment`, `resolveProjectTarget`).
- API keys and other secrets live in the main process only (e.g. the DeepSeek
  key is proxied through `src/main/deepseek.ts`; it never reaches the renderer).

### Persistent state

- All app state lives under `<projectsRoot>/.projecthub/` (same drive as the
  projects so trashing is an instant rename). The projects root itself is stored
  in `%APPDATA%/ProjectHub/settings.json` (defaults to `D:\Projects`).
- Trash and archive are same-volume `rename`s, not copies.

## Testing

- Vitest, Node environment, tests under `test/**/*.test.ts`; focus is the main
  process.
- `electron` is aliased to a stub (`test/stubs/electron.ts`) so main-process
  modules import cleanly under plain Node; `@shared` is aliased to `src/shared`.
- Prefer fast, filesystem-backed tests via the fixture helpers in
  `test/helpers/`. Keep tests OS-agnostic **except** where they intentionally
  assert the Windows path contract.

## Releases

- `release.yml` is **tag-triggered**; pushing a version tag builds the Windows
  installer and publishes a GitHub release (electron-updater consumes it).
- CI (`ci.yml`) is the per-PR/push build gate and does **not** publish.
- The app icon source is `build/icon.svg`; regenerate `build/icon.png` (≥256px,
  512px preferred) from it when the icon changes — electron-builder derives the
  multi-resolution `.ico` from that PNG.
