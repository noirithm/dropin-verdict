import { rgbToLab } from "../../shared/color";

/** RGBA pixels, as in ImageData. */
export interface Pixels {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function percentile(sorted: Float32Array, p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

export interface ExposureStats {
  mean: number;
  median: number;
  p98: number;
  clippedFrac: number; // share of pixels with luma >= 245
  shadowFrac: number; // share of pixels under 40% of the median (relative, so tone-neutral)
}

export function exposureStats(px: Pixels): ExposureStats {
  const n = px.width * px.height;
  if (n === 0) return { mean: 0, median: 0, p98: 0, clippedFrac: 0, shadowFrac: 0 };
  const ys = new Float32Array(n);
  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const y = luma(px.data[o], px.data[o + 1], px.data[o + 2]);
    ys[i] = y;
    sum += y;
    if (y >= 245) clipped++;
  }
  const sorted = Float32Array.from(ys).sort();
  const median = percentile(sorted, 0.5);
  const cut = 0.4 * median;
  let shadow = 0;
  for (let i = 0; i < n; i++) if (ys[i] < cut) shadow++;
  return {
    mean: sum / n,
    median,
    p98: percentile(sorted, 0.98),
    clippedFrac: clipped / n,
    shadowFrac: shadow / n,
  };
}

/** Difference between the left and right halves' mean luma, as a share (0 = even). */
export function leftRightImbalance(px: Pixels): number {
  const half = Math.floor(px.width / 2);
  let l = 0;
  let r = 0;
  let nl = 0;
  let nr = 0;
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) {
      const o = (y * px.width + x) * 4;
      const v = luma(px.data[o], px.data[o + 1], px.data[o + 2]);
      if (x < half) {
        l += v;
        nl++;
      } else {
        r += v;
        nr++;
      }
    }
  }
  if (!nl || !nr) return 0;
  const ml = l / nl;
  const mr = r / nr;
  return Math.abs(ml - mr) / Math.max(ml, mr, 1);
}

export interface BlurStats {
  edge: number; // how crisp the strongest edges are, relative to the region's own contrast
  motion: number; // min/max of horizontal vs vertical edge strength: low means directional (motion) blur
}

/** Run on the eye region. Both numbers are ratios, so they don't depend on skin tone or brightness. */
export function blurStats(px: Pixels): BlurStats {
  const { width: w, height: h, data } = px;
  if (w < 5 || h < 5) return { edge: 0, motion: 1 };
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = luma(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const n = (w - 2) * (h - 2);
  const mag = new Float32Array(n);
  const ax = new Float32Array(n);
  const ay = new Float32Array(n);
  let k = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1]) / 8;
      const gy = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1]) / 8;
      ax[k] = Math.abs(gx);
      ay[k] = Math.abs(gy);
      mag[k] = Math.hypot(gx, gy);
      k++;
    }
  }
  const range = percentile(Float32Array.from(g).sort(), 0.99) - percentile(Float32Array.from(g).sort(), 0.01) + 1;
  const pMag = percentile(mag.sort(), 0.99);
  const pX = percentile(ax.sort(), 0.99);
  const pY = percentile(ay.sort(), 0.99);
  const hi = Math.max(pX, pY);
  return { edge: pMag / range, motion: hi < 1e-6 ? 1 : Math.min(pX, pY) / hi };
}

export interface CastStats {
  chroma: number;
  hue: number; // degrees 0-360 in CIELAB
}

export function castStats(px: Pixels): CastStats {
  const n = px.width * px.height;
  if (n === 0) return { chroma: 0, hue: 0 };
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < n; i++) {
    r += px.data[i * 4];
    g += px.data[i * 4 + 1];
    b += px.data[i * 4 + 2];
  }
  const lab = rgbToLab(r / n, g / n, b / n);
  const hue = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return { chroma: Math.hypot(lab.a, lab.b), hue: (hue + 360) % 360 };
}
