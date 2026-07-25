import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ponytail: merged primitives, not a rigged skeleton. Instanced across ~1400 NPCs;
// upgrade path is a shared SkinnedMesh with GPU instancing if animation is needed.
export function humanoidGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []

  const head = new THREE.SphereGeometry(0.17, 10, 8)
  head.translate(0, 1.66, 0)
  parts.push(head)

  const torso = new THREE.BoxGeometry(0.44, 0.62, 0.26)
  torso.translate(0, 1.19, 0)
  parts.push(torso)

  const hips = new THREE.BoxGeometry(0.42, 0.14, 0.26)
  hips.translate(0, 0.83, 0)
  parts.push(hips)

  for (const side of [-1, 1]) {
    const arm = new THREE.BoxGeometry(0.11, 0.58, 0.13)
    arm.translate(side * 0.28, 1.18, 0)
    parts.push(arm)

    const leg = new THREE.BoxGeometry(0.15, 0.78, 0.18)
    leg.translate(side * 0.11, 0.39, 0)
    parts.push(leg)
  }

  const merged = mergeGeometries(parts, false)
  if (!merged) throw new Error('humanoidGeometry: merge failed')
  parts.forEach((p) => p.dispose())
  return merged
}
