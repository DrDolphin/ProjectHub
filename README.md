# ProjectHub

A modern desktop hub for launching, organizing, and managing local development projects.
Built with **Electron + Vite + React + TypeScript + TailwindCSS**.

It live-scans a projects root (default `D:\Projects`), merges your curated notes from
`metadata.json`, and gives you one-click actions for everything you do with a project:

- 🚀 **Launch** — detects a running dev server (common ports + your Vite port) and opens it;
  falls back to opening VS Code.
- 💻 **Open in VS Code** — spawns `code <path>`.
- 📂 **Open folder** — opens the project in Windows Explorer.
- 📋 **Copy path** — full path to clipboard.
- ⭐ **Pin** — keeps important projects at the top.
- 🗑️ **Delete** — modal (Cancel / Delete) moves the folder to an in-app **Trash**
  (instant, same-drive). Restore any time, or **Empty Trash** to remove permanently.
- ✨ **New project** — create a folder with a template (empty / Node / Vite+React / Next.js /
  Python / static HTML), optionally opened in VS Code.
- 📦 **Move / Archive** — move a project elsewhere, or send it to `.archive`.

## Quick start

```bash
pnpm install
pnpm dev          # launch in dev mode (HMR)
```

Build a distributable:

```bash
pnpm typecheck    # type-check main + renderer
pnpm build        # production build → out/
pnpm build:win    # build + Windows installer → dist/
```

## Where things live

| Path | Purpose |
| --- | --- |
| `src/main/` | Electron main process: window, IPC, scan, trash, metadata |
| `src/preload/` | `contextBridge` API exposed to the renderer |
| `src/shared/types.ts` | Shared types + the IPC channel contract (single source of truth) |
| `src/renderer/` | React UI |
| `resources/metadata.seed.json` | Seed notes, applied on first run |

### Persistent data

All app state lives under `<projectsRoot>\.projecthub\` (same drive as the projects, so
trashing is an instant rename):

```
<root>\.projecthub\
  ├── metadata.json   curated notes keyed by absolute path
  ├── pinned.json     pinned paths
  ├── manifest.json   trash entries (id, original path, timestamp)
  └── trash\<items>   trashed folders
```

The projects root itself is stored in `%APPDATA%\ProjectHub\settings.json` and defaults to
`D:\Projects`. Change it via the root picker in the header (restart to apply).

## Architecture notes

- **Security:** `contextIsolation: true`, `nodeIntegration: false`. All filesystem / shell
  access goes through the preload `contextBridge` → `ipcMain.handle` channels defined in
  `src/shared/types.ts` (`IPC`).
- **Hybrid data:** `scanProjects()` walks the root (depth 0 + 1), detects stack/manager from
  `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` / `.csproj`, then merges your
  `metadata.json` entry for that path (description, stack, status, scripts).
- **Trash:** `trashProject()` does a same-volume `rename` into `.projecthub\trash\` and records
  the original path in `manifest.json`. `restoreProject()` moves it back (with a suffix if the
  original location is now taken). `emptyTrash()` permanently removes everything.
