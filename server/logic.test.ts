import { test, expect } from 'bun:test'
import { parseDirectorEvent } from './logic'

test('rejects non-JSON', () => {
  expect(parseDirectorEvent('not json', 'fb')).toBeNull()
})

test('rejects out-of-enum event', () => {
  const raw = JSON.stringify({ event: 'riot', where: 'drop', intensity: 0.5, line: 'x' })
  expect(parseDirectorEvent(raw, 'fb')).toBeNull()
})

test('clamps intensity to 1', () => {
  const raw = JSON.stringify({ event: 'surge', where: 'crossing', intensity: 5, line: 'x' })
  expect(parseDirectorEvent(raw, 'fb')?.intensity).toBe(1)
})

test('falls back to fallbackLine when line missing', () => {
  const raw = JSON.stringify({ event: 'calm', where: 'station', intensity: 0.3 })
  expect(parseDirectorEvent(raw, 'fb')?.line).toBe('fb')
})
