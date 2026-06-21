import { join, resolve, relative, isAbsolute } from 'node:path'

/**
 * True when `s` is a single path segment safe to use as a folder name:
 * non-empty, not a `.`/`..` traversal token, and free of separators,
 * drive colons, and Windows-reserved characters.
 */
export function isSafeSegment(s: string): boolean {
  return s.length > 0 && s !== '.' && s !== '..' && !/[\\/:*?"<>|]/.test(s)
}

/**
 * True when `target` resolves to a location strictly inside `root` — not
 * root itself, not a sibling, not another drive. Used as a defense-in-depth
 * backstop after segment validation.
 */
export function isWithinRoot(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target))
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Resolve the target directory for a new project from a projects `root`, an
 * optional `parent` grouping path, and a `name`. Rejects any traversal,
 * absolute paths, or invalid segments by returning `null`, so callers can
 * treat a non-null result as safe to create under the root.
 */
export function resolveProjectTarget(
  root: string,
  parent: string | undefined,
  name: string
): { parentDir: string; target: string } | null {
  const cleanName = name.trim()
  if (!isSafeSegment(cleanName)) return null

  const parentSegs = (parent ?? '').trim().split(/[\\/]+/).filter(Boolean)
  if (!parentSegs.every(isSafeSegment)) return null

  const parentDir = parentSegs.length ? join(root, ...parentSegs) : root
  const target = join(parentDir, cleanName)
  if (!isWithinRoot(root, target)) return null

  return { parentDir, target }
}
