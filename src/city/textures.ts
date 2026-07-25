import * as THREE from 'three'
import { look } from './look'

const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン'
const SIGN_WORDS = ['居酒屋', 'ラーメン', 'カラオケ', '喫茶', '古着', '寿司', '銭湯', '本屋', '珈琲', '焼鳥']

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  const ctx = el.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  return [el, ctx]
}

/**
 * Windows are most of what makes a box read as a building. Random lit cells,
 * two colour temperatures, occasional dark floors.
 */
export function makeWindowTexture(seed: number): THREE.Texture {
  const cols = 8
  const rows = 16
  const cell = 16
  const [el, ctx] = canvas(cols * cell, rows * cell)

  ctx.fillStyle = '#05070c'
  ctx.fillRect(0, 0, el.width, el.height)

  let n = seed * 9301 + 49297
  const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280)

  for (let r = 0; r < rows; r++) {
    const floorDark = rand() < 0.14
    for (let c = 0; c < cols; c++) {
      const lit = !floorDark && rand() < look.windowLitChance
      if (!lit) continue
      ctx.fillStyle = rand() < 0.7 ? look.windowColor : look.windowColorAlt
      ctx.globalAlpha = 0.55 + rand() * 0.45
      ctx.fillRect(c * cell + 4, r * cell + 4, cell - 8, cell - 7)
    }
  }
  ctx.globalAlpha = 1

  const tex = new THREE.CanvasTexture(el)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Vertical neon sign: a saturated bar with stacked katakana. Bloom does the rest. */
export function makeSignTexture(index: number): { texture: THREE.Texture; color: THREE.Color } {
  const hue = look.neonHues[index % look.neonHues.length] ?? 320
  const color = new THREE.Color().setHSL(hue / 360, look.neonSaturation, look.neonLightness)

  const [el, ctx] = canvas(64, 256)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, el.width, el.height)

  const css = `hsl(${hue} ${look.neonSaturation * 100}% ${look.neonLightness * 100}%)`
  ctx.strokeStyle = css
  ctx.lineWidth = 4
  ctx.strokeRect(6, 6, el.width - 12, el.height - 12)

  const word = SIGN_WORDS[index % SIGN_WORDS.length] ?? KATAKANA.slice(0, 3)
  ctx.fillStyle = css
  ctx.font = '600 34px "Hiragino Sans", "Yu Gothic", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const chars = [...word]
  const step = (el.height - 48) / Math.max(chars.length, 1)
  chars.forEach((ch, i) => ctx.fillText(ch, el.width / 2, 40 + i * step))

  const tex = new THREE.CanvasTexture(el)
  tex.colorSpace = THREE.SRGBColorSpace
  return { texture: tex, color }
}
