import type { Box3, Vector3 } from 'three'

const RANGE = 78 // world units from map centre to edge
const SIZE = 180 // css px (canvas is DPR-scaled)
const ROAD_HALF = 12 // half-width of the central scramble roads, world units

type Rect = { x: number; z: number; w: number; d: number }

/**
 * GPS-style circular minimap: player pinned at centre pointing up, the world
 * rotates under them. Draws the real city — building footprints from the same
 * colliders the physics uses — so it never drifts from the scene.
 */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D
  private readonly r = SIZE / 2
  private readonly buildings: Rect[]

  constructor(
    colliders: Box3[],
    private readonly halfWidth: number,
    private readonly halfDepth: number,
  ) {
    const canvas = document.getElementById('minimap') as HTMLCanvasElement
    const dpr = Math.min(devicePixelRatio, 2)
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    this.ctx = ctx

    // ponytail: precompute footprint centres once; colliders never move.
    this.buildings = colliders.map((b) => ({
      x: (b.min.x + b.max.x) / 2,
      z: (b.min.z + b.max.z) / 2,
      w: b.max.x - b.min.x,
      d: b.max.z - b.min.z,
    }))
  }

  render(player: Vector3, yaw: number, target: Vector3, elapsed: number): void {
    const { ctx, r } = this
    const s = r / RANGE

    ctx.clearRect(0, 0, r * 2, r * 2)
    ctx.save()
    ctx.beginPath()
    ctx.arc(r, r, r - 3, 0, Math.PI * 2)
    ctx.clip()

    // Ground / asphalt base.
    ctx.fillStyle = '#0a0e16'
    ctx.fillRect(0, 0, r * 2, r * 2)

    // World layer: centre on player, heading up, world units → px.
    ctx.save()
    ctx.translate(r, r)
    ctx.rotate(yaw)
    ctx.scale(s, s)
    ctx.translate(-player.x, -player.z)

    // Roads: the scramble cross reads as brighter lanes than the ground.
    ctx.fillStyle = 'rgba(150, 180, 225, 0.16)'
    ctx.fillRect(-this.halfWidth, -ROAD_HALF, this.halfWidth * 2, ROAD_HALF * 2)
    ctx.fillRect(-ROAD_HALF, -this.halfDepth, ROAD_HALF * 2, this.halfDepth * 2)

    // Buildings.
    ctx.fillStyle = 'rgba(96, 118, 158, 0.42)'
    ctx.strokeStyle = 'rgba(140, 170, 215, 0.22)'
    ctx.lineWidth = 0.6
    for (const b of this.buildings) {
      ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d)
      ctx.strokeRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d)
    }
    ctx.restore()

    // Drop target — pulsing pin, clamped to the ring with a chevron if off-map.
    const rx = target.x - player.x
    const rz = target.z - player.z
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    let tx = r + s * (rx * cos - rz * sin)
    let ty = r + s * (rx * sin + rz * cos)
    const dist = Math.hypot(tx - r, ty - r)
    const edge = r - 12
    const offMap = dist > edge
    if (offMap && dist > 0.001) {
      tx = r + ((tx - r) / dist) * edge
      ty = r + ((ty - r) / dist) * edge
    }

    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3)
    ctx.fillStyle = '#54ffc8'
    ctx.beginPath()
    ctx.arc(tx, ty, offMap ? 3 : 4, 0, Math.PI * 2)
    ctx.fill()
    if (!offMap) {
      ctx.strokeStyle = `rgba(84, 255, 200, ${0.5 - pulse * 0.4})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(tx, ty, 5 + pulse * 6, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.restore() // drop clip

    // Player arrow — fixed at centre, always pointing up.
    ctx.fillStyle = '#ffb64a'
    ctx.strokeStyle = 'rgba(10, 12, 20, 0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(r, r - 9)
    ctx.lineTo(r + 6.5, r + 7)
    ctx.lineTo(r, r + 3.5)
    ctx.lineTo(r - 6.5, r + 7)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}
