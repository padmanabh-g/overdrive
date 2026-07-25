import {
  CanvasTexture,
  Color,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from "three";

import type { CityLook } from "./look";
import type { Random } from "./random";

type CanvasDraw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

function createCanvasTexture(width: number, height: number, draw: CanvasDraw): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  draw(ctx, width, height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createWindowTexture(look: CityLook, random: Random): Texture {
  const lit = new Color(look.buildings.windowEmissive);
  const dark = new Color("#101823");

  const texture = createCanvasTexture(128, 256, (ctx, width, height) => {
    ctx.fillStyle = "#080d14";
    ctx.fillRect(0, 0, width, height);

    const columns = 6;
    const rows = 14;
    const gutterX = 7;
    const gutterY = 8;
    const cellW = (width - gutterX * (columns + 1)) / columns;
    const cellH = (height - gutterY * (rows + 1)) / rows;

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const isLit = random() > 0.58;
        const color = isLit ? lit : dark;
        const alpha = isLit ? 0.76 + random() * 0.24 : 0.32 + random() * 0.18;

        ctx.fillStyle = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(
          color.b * 255,
        )}, ${alpha})`;
        ctx.fillRect(gutterX + x * (cellW + gutterX), gutterY + y * (cellH + gutterY), cellW, cellH);
      }
    }
  });

  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

export function createSignTexture(copy: string, background: string, foreground = "#ffffff"): CanvasTexture {
  return createCanvasTexture(256, 512, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, background);
    gradient.addColorStop(1, "#08090f");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, width - 28, height - 28);

    ctx.shadowColor = foreground;
    ctx.shadowBlur = 18;
    ctx.fillStyle = foreground;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 50px sans-serif";

    const chars = [...copy];
    const step = Math.min(62, (height - 110) / Math.max(chars.length, 1));
    const startY = height / 2 - ((chars.length - 1) * step) / 2;

    chars.forEach((char, index) => {
      ctx.fillText(char, width / 2, startY + index * step);
    });
  });
}

// Real brand SVG (same-origin from /logos, so the canvas isn't tainted) drawn onto a lit
// white lightbox plate — how Japanese storefront signs actually read at night, and bright
// enough to catch bloom. Returns immediately with the blank plate; the logo paints on load.
export function createLogoTexture(url: string): CanvasTexture {
  const W = 640
  const H = 320
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable.")
  }

  const plate = (): void => {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = "#f7f8fa"
    ctx.beginPath()
    ctx.roundRect(10, 10, W - 20, H - 20, 26)
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = "rgba(255,255,255,0.85)"
    ctx.stroke()
  }
  plate()

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter

  const img = new Image()
  img.onload = () => {
    plate()
    const pad = 48
    const scale = Math.min((W - pad * 2) / img.width, (H - pad * 2) / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
    texture.needsUpdate = true
  }
  img.src = url
  return texture
}

export function createCrosswalkTexture(): CanvasTexture {
  return createCanvasTexture(512, 512, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,0.72)";

    for (let x = 18; x < width; x += 58) {
      ctx.fillRect(x, 0, 25, height);
    }
  });
}
