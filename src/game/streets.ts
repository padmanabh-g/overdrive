import type { Box3, Vector3 } from 'three'
import { cityLook, type CityLook } from '../city/look'

export type Lane = { axis: 'x' | 'z'; lane: number; min: number; max: number }

export type Streets = {
  lanes: Lane[]
  dropPoints: { x: number; z: number }[]
  halfWidth: number
  halfDepth: number
}

const MARGIN = 1.6
const EDGE = 10

/**
 * Jun's city carves an open cross through the building grid, so walkable space is not a
 * regular street grid. Rather than mirror their layout constants (which would silently
 * break when they retune rows/columns/blockSize), derive it from the colliders they
 * actually produced: a lane is walkable if no building occupies that coordinate at all.
 */
export function deriveStreets(colliders: Box3[], look: CityLook = cityLook): Streets {
  const halfWidth = look.ground.width / 2
  const halfDepth = look.ground.depth / 2

  const clearX = clearCoordinates(colliders, 'x', halfWidth)
  const clearZ = clearCoordinates(colliders, 'z', halfDepth)

  const lanes: Lane[] = [
    // Walk along z, pinned to a clear x — the vertical corridor.
    ...spread(clearX, 8).map((lane) => ({
      axis: 'z' as const,
      lane,
      min: -halfDepth + EDGE,
      max: halfDepth - EDGE,
    })),
    // Walk along x, pinned to a clear z — the horizontal corridor.
    ...spread(clearZ, 6).map((lane) => ({
      axis: 'x' as const,
      lane,
      min: -halfWidth + EDGE,
      max: halfWidth - EDGE,
    })),
  ]

  const midX = middle(clearX)
  const midZ = middle(clearZ)
  const dropPoints = [
    { x: midX, z: -halfDepth + EDGE + 8 },
    { x: midX, z: halfDepth - EDGE - 8 },
    { x: -halfWidth + EDGE + 8, z: midZ },
    { x: halfWidth - EDGE - 8, z: midZ },
  ]

  return { lanes, dropPoints, halfWidth, halfDepth }
}

/** Coordinates along one axis that no collider spans — i.e. clear end to end. */
function clearCoordinates(colliders: Box3[], axis: 'x' | 'z', half: number): number[] {
  const out: number[] = []
  for (let v = -half + EDGE; v <= half - EDGE; v += 2) {
    const blocked = colliders.some((b) => v > b.min[axis] - MARGIN && v < b.max[axis] + MARGIN)
    if (!blocked) out.push(v)
  }
  return out
}

/** Evenly sample at most `count` values so lanes span the corridor instead of bunching. */
function spread(values: number[], count: number): number[] {
  if (values.length <= count) return values
  const step = (values.length - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => values[Math.round(i * step)]!)
}

function middle(values: number[]): number {
  return values.length ? values[Math.floor(values.length / 2)]! : 0
}

export function farthestDrop(streets: Streets, from: Vector3): { x: number; z: number } {
  let best = streets.dropPoints[0] ?? { x: 0, z: 0 }
  let bestDist = -1
  for (const p of streets.dropPoints) {
    const dist = Math.hypot(p.x - from.x, p.z - from.z)
    if (dist > bestDist) {
      bestDist = dist
      best = p
    }
  }
  return best
}
