# CLAUDE.md

This repo's conventions and workflow live in **[AGENTS.md](./AGENTS.md)** — it is
the single source of truth, kept here so the two files never drift.

@AGENTS.md

## Non-negotiables (quick reference)

- **Branch off the latest `main`, one concern per PR.** Never commit to `main`.
- **Run `pnpm lint && pnpm typecheck && pnpm test` before pushing** (add
  `pnpm build` for build-affecting changes). CI runs the same and gates the PR.
- **Windows-only app:** CI runs on `windows-latest` by design, and store keys are
  backslash-normalized — don't undo either. See AGENTS.md → Windows-only.
- **IPC handlers (`src/shared/types.ts` contract) are the trust boundary** —
  validate all inputs; use `src/main/safePath.ts` for any path built from
  user/AI input.
- Conventional Commit messages; end AI-authored commits with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

When asked to "commit": if on `main`, branch first, then commit.
