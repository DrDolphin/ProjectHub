// Shared test fixtures. Creates isolated temp dirs wired so that:
//   - config.ts reads `settings.json` (projectsRoot) from `userDataDir`
//   - the hub dir (.projecthub/, trash/) lives on the same volume as the
//     projects root so rename-based trash/restore is instant + reliable
//
// Tests call makeFixture() in beforeAll and point the electron stub's
// userData at it via setUserDataDir() (see test/stubs/electron.ts). Because
// Vitest isolates the module registry per test file, config.ts's lazy
// settings cache is fresh for each file — no vi.resetModules() needed.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface Fixture {
  /** Points at app.getPath('userData') for this test file. */
  userDataDir: string
  /** The configured projects root. */
  projectsRoot: string
  /** <projectsRoot>/.projecthub — metadata.json, pinned.json, manifest.json. */
  hubDir: string
  /** <projectsRoot>/.projecthub/trash. */
  trashDir: string
}

export function makeFixture(): Fixture {
  const userDataDir = mkdtempSync(join(tmpdir(), 'ph-ud-'))
  const projectsRoot = mkdtempSync(join(tmpdir(), 'ph-pr-'))
  const hubDir = join(projectsRoot, '.projecthub')
  const trashDir = join(hubDir, 'trash')
  mkdirSync(trashDir, { recursive: true })
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify({ projectsRoot }))
  return { userDataDir, projectsRoot, hubDir, trashDir }
}

export function disposeFixture(f: Fixture): void {
  rmSync(f.userDataDir, { recursive: true, force: true })
  rmSync(f.projectsRoot, { recursive: true, force: true })
}

/** Remove the mutable hub data files so tests in a file stay independent. */
export function resetHubData(f: Fixture): void {
  for (const name of ['metadata.json', 'pinned.json', 'manifest.json', 'manifest.schema.json']) {
    rmSync(join(f.hubDir, name), { force: true })
  }
}

/** Create a throwaway project folder (for scan tests that read on-disk files). */
export function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ph-proj-'))
  return dir
}

export function disposeTempProject(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

export { existsSync }
