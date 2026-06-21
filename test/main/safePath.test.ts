import { describe, test, expect } from 'vitest'
import { isSafeSegment, isWithinRoot, resolveProjectTarget } from '../../src/main/safePath'

const root = process.platform === 'win32' ? 'D:\\Projects' : '/projects'

describe('isSafeSegment', () => {
  test('accepts ordinary folder names', () => {
    for (const ok of ['app', 'my-cool-app', 'App_2', 'data.pipeline']) {
      expect(isSafeSegment(ok)).toBe(true)
    }
  })

  test('rejects traversal tokens, separators, and reserved chars', () => {
    for (const bad of ['', '.', '..', 'a/b', 'a\\b', 'c:', 'a:b', 'a*', 'a?', 'a|b', 'a<b', 'a>b', 'a"b']) {
      expect(isSafeSegment(bad)).toBe(false)
    }
  })
})

describe('resolveProjectTarget', () => {
  test('resolves a project directly under the root', () => {
    const r = resolveProjectTarget(root, undefined, 'app')
    expect(r).not.toBeNull()
    expect(isWithinRoot(root, r!.target)).toBe(true)
  })

  test('resolves a project under a grouping parent', () => {
    const r = resolveProjectTarget(root, 'server', 'api')
    expect(r).not.toBeNull()
    expect(isWithinRoot(root, r!.target)).toBe(true)
  })

  test('rejects traversal in the name', () => {
    expect(resolveProjectTarget(root, undefined, '..')).toBeNull()
    expect(resolveProjectTarget(root, undefined, '../escape')).toBeNull()
    expect(resolveProjectTarget(root, undefined, 'a/b')).toBeNull()
  })

  test('rejects traversal or absolute paths in the parent', () => {
    expect(resolveProjectTarget(root, '..', 'x')).toBeNull()
    expect(resolveProjectTarget(root, '../../etc', 'x')).toBeNull()
    expect(resolveProjectTarget(root, 'a/../..', 'x')).toBeNull()
  })
})
