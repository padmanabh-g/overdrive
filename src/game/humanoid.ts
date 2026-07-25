import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ponytail: merged primitives, not a rigged skeleton. Instanced across ~1400 NPCs;
// upgrade path is a shared SkinnedMesh with GPU instancing if animation is needed.
// Tapered torso + neck + two-segment limbs + feet read as human at a glance while
// staying one static ~1.7m-tall geometry cheap enough to instance by the thousand.
export function humanoidGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []

  const add = (geo: THREE.BufferGeometry, x: number, y: number, z = 0, flattenZ = 1) => {
    if (flattenZ !== 1) geo.scale(1, 1, flattenZ)
    geo.translate(x, y, z)
    parts.push(geo)
  }

  const head = new THREE.SphereGeometry(0.135, 10, 8)
  add(head, 0, 1.7, 0.01, 0.92)

  const neck = new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6)
  add(neck, 0, 1.58, 0)

  // Shoulders wide, waist narrow, flattened front-to-back.
  const torso = new THREE.CylinderGeometry(0.24, 0.17, 0.6, 8)
  add(torso, 0, 1.24, 0, 0.62)

  const hips = new THREE.BoxGeometry(0.4, 0.18, 0.24)
  add(hips, 0, 0.9, 0)

  for (const side of [-1, 1]) {
    const upperArm = new THREE.CylinderGeometry(0.06, 0.07, 0.34, 6)
    add(upperArm, side * 0.3, 1.42, 0)
    const foreArm = new THREE.CylinderGeometry(0.05, 0.06, 0.32, 6)
    add(foreArm, side * 0.31, 1.1, 0.02)

    const thigh = new THREE.CylinderGeometry(0.1, 0.09, 0.46, 6)
    add(thigh, side * 0.11, 0.64, 0)
    const shin = new THREE.CylinderGeometry(0.07, 0.085, 0.42, 6)
    add(shin, side * 0.11, 0.28, 0)

    const foot = new THREE.BoxGeometry(0.14, 0.09, 0.28)
    add(foot, side * 0.11, 0.05, 0.06)
  }

  const merged = mergeGeometries(parts, false)
  if (!merged) throw new Error('humanoidGeometry: merge failed')
  parts.forEach((p) => p.dispose())
  return merged
}
