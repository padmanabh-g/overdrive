import * as THREE from 'three'
import { look } from './look'
import { makeSignTexture, makeWindowTexture } from './textures'

const BLOCKS = 7
const PITCH = 58
const BLOCK_HALF = 21
const WINDOW_VARIANTS = 6

export type Box2 = { minX: number; maxX: number; minZ: number; maxZ: number }

export type City = {
  group: THREE.Group
  colliders: Box2[]
  /** Street centrelines. Crowd waypoints and route checks use these. */
  streetLines: number[]
  extent: number
}

const rand = mulberry(20260725)

export function buildCity(): City {
  const group = new THREE.Group()
  const colliders: Box2[] = []

  const streetLines: number[] = []
  for (let i = 0; i < BLOCKS - 1; i++) streetLines.push(blockCenter(i) + PITCH / 2)

  const extent = blockCenter(BLOCKS - 1) + BLOCK_HALF

  group.add(makeGround(extent))
  group.add(makeRoads(streetLines, extent))

  const variants = Array.from({ length: WINDOW_VARIANTS }, (_, i) => {
    const tex = makeWindowTexture(i + 1)
    tex.repeat.set(3, 6)
    return {
      material: new THREE.MeshStandardMaterial({
        color: look.buildingColor,
        roughness: look.buildingRoughness,
        metalness: look.buildingMetalness,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 1,
      }),
      transforms: [] as THREE.Matrix4[],
    }
  })

  const signs = new THREE.Group()
  let signIndex = 0

  for (let bx = 0; bx < BLOCKS; bx++) {
    for (let bz = 0; bz < BLOCKS; bz++) {
      const cx = blockCenter(bx)
      const cz = blockCenter(bz)

      // Leave the middle block open as a plaza — the crossing the demo happens on.
      if (bx === 3 && bz === 3) continue

      for (let sx = 0; sx < 2; sx++) {
        for (let sz = 0; sz < 2; sz++) {
          if (rand() < 0.12) continue

          const half = BLOCK_HALF / 2
          const px = cx - BLOCK_HALF + half + sx * BLOCK_HALF
          const pz = cz - BLOCK_HALF + half + sz * BLOCK_HALF
          const w = half * 2 - 3 - rand() * 3
          const d = half * 2 - 3 - rand() * 3
          const h = 14 + Math.pow(rand(), 1.7) * 82

          const variant = variants[Math.floor(rand() * WINDOW_VARIANTS)]!
          variant.transforms.push(
            new THREE.Matrix4().compose(
              new THREE.Vector3(px, h / 2, pz),
              new THREE.Quaternion(),
              new THREE.Vector3(w, h, d),
            ),
          )

          colliders.push({
            minX: px - w / 2,
            maxX: px + w / 2,
            minZ: pz - d / 2,
            maxZ: pz + d / 2,
          })

          if (rand() < look.signChance) {
            signs.add(...makeSign(px, pz, w, d, h, signIndex++))
          }
        }
      }
    }
  }

  for (const v of variants) {
    if (!v.transforms.length) continue
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      v.material,
      v.transforms.length,
    )
    v.transforms.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    group.add(mesh)
  }

  group.add(signs)
  group.add(...streetLamps(streetLines))

  return { group, colliders, streetLines, extent }
}

function blockCenter(i: number): number {
  return (i - (BLOCKS - 1) / 2) * PITCH
}

function makeGround(extent: number): THREE.Mesh {
  const size = extent * 2 + PITCH
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      color: look.groundColor,
      metalness: look.groundMetalness,
      roughness: look.groundRoughness,
      envMapIntensity: 0.5,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

/** Slightly lighter strips down the street centres so the grid reads from ground level. */
function makeRoads(streetLines: number[], extent: number): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({
    color: look.roadColor,
    metalness: 0.7,
    roughness: 0.45,
  })
  const span = extent * 2 + PITCH

  for (const line of streetLines) {
    for (const axis of ['x', 'z'] as const) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(axis === 'x' ? 16 : span, axis === 'x' ? span : 16), mat)
      road.rotation.x = -Math.PI / 2
      road.position.y = 0.02
      road.position[axis] = line
      g.add(road)
    }
  }
  return g
}

/**
 * A sign plus a stretched, dimmed copy lying on the road. The copy is not a real
 * reflection — it is a cheap fake that sells wet asphalt for two draw calls.
 */
function makeSign(px: number, pz: number, w: number, d: number, h: number, index: number): THREE.Object3D[] {
  const { texture, color } = makeSignTexture(index)
  const signH = 7 + rand() * 7
  const signW = signH * 0.28
  const y = 6 + rand() * Math.max(h - 14, 2)

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: color.clone().multiplyScalar(look.neonIntensity),
    transparent: true,
    toneMapped: false,
  })

  const faceX = rand() < 0.5
  const dir = rand() < 0.5 ? 1 : -1
  const offset = (faceX ? w : d) / 2 + 0.35

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), material)
  sign.position.set(px + (faceX ? offset * dir : 0), y, pz + (faceX ? 0 : offset * dir))
  sign.rotation.y = faceX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(signW * 1.5, look.reflectionLength),
    new THREE.MeshBasicMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: look.reflectionOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  glow.rotation.x = -Math.PI / 2
  glow.position.set(sign.position.x, 0.05, sign.position.z)

  return [sign, glow]
}

function streetLamps(streetLines: number[]): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  const lampMat = new THREE.MeshBasicMaterial({ color: look.streetLightColor, toneMapped: false })

  // Real lights only at the plaza and a few intersections — cheap, and the rest is bloom.
  for (let i = 1; i < streetLines.length; i += 2) {
    for (let j = 1; j < streetLines.length; j += 2) {
      const x = streetLines[i]!
      const z = streetLines[j]!

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat)
      bulb.position.set(x, 7.5, z)
      out.push(bulb)

      const light = new THREE.PointLight(look.streetLightColor, look.streetLightIntensity, 46, 2)
      light.position.set(x, 7.5, z)
      out.push(light)
    }
  }
  return out
}

/** Deterministic RNG so the city is identical every reload — important for demo rehearsal. */
function mulberry(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
