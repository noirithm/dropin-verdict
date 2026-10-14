import { describe, expect, it } from "vitest";
import { castStats, exposureStats, leftRightImbalance, sharpness, type Pixels } from "@/widget/gate/metrics";
import { poseFromLandmarks, faceBox, LM, type Pt } from "@/widget/gate/pose";

function make(w: number, h: number, fn: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const o = (y * w + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}
const solid = (c: [number, number, number]) => make(20, 20, () => c);

describe("exposureStats", () => {
  it("reports a flat crop with no clipping or shadow", () => {
    const s = exposureStats(solid([180, 136, 104]));
    expect(s.clippedFrac).toBe(0);
    expect(s.shadowFrac).toBe(0);
    expect(s.mean).toBeGreaterThan(100);
  });
  it("detects blown highlights", () => {
    const s = exposureStats(make(10, 10, (x) => (x < 5 ? [255, 255, 255] : [150, 120, 100])));
    expect(s.clippedFrac).toBeCloseTo(0.5, 2);
  });
  it("detects a shadow relative to the face's own tone", () => {
    const s = exposureStats(make(10, 10, (x) => (x < 3 ? [20, 12, 8] : [150, 120, 100])));
    expect(s.shadowFrac).toBeCloseTo(0.3, 2);
  });
});

describe("leftRightImbalance", () => {
  it("is zero when even and large when one side is dark", () => {
    expect(leftRightImbalance(solid([150, 120, 100]))).toBe(0);
    const lopsided = make(20, 20, (x) => (x < 10 ? [160, 160, 160] : [80, 80, 80]));
    expect(leftRightImbalance(lopsided)).toBeCloseTo(0.5, 2);
  });
});

describe("sharpness", () => {
  const texture = (scale: number) => make(32, 32, (x) => { const v = (x % 2 ? 140 : 100) * scale; return [v, v, v]; });
  it("scores a flat crop as zero and a textured crop as positive", () => {
    expect(sharpness(solid([120, 120, 120]))).toBe(0);
    expect(sharpness(texture(1))).toBeGreaterThan(0.01);
  });
  it("does not depend on overall brightness, so dark skin is not scored as blurrier", () => {
    expect(sharpness(texture(0.4))).toBeCloseTo(sharpness(texture(1)), 2);
  });
});

describe("castStats", () => {
  it("puts light, medium and deep skin hues in the same plausible range", () => {
    for (const c of [[241, 201, 176], [180, 136, 104], [59, 34, 25]] as [number, number, number][]) {
      const s = castStats(solid(c));
      expect(s.hue).toBeGreaterThan(20);
      expect(s.hue).toBeLessThan(80);
    }
  });
  it("flags a blue-ish cast with a hue far from skin", () => {
    const s = castStats(solid([90, 110, 200]));
    expect(s.hue > 85 || s.hue < 15).toBe(true);
  });
});

describe("pose and box from landmarks", () => {
  const frontal = (): Pt[] => {
    const lm: Pt[] = [];
    lm[LM.rightCheek] = { x: 0.2, y: 0.5, z: 0 };
    lm[LM.leftCheek] = { x: 0.8, y: 0.5, z: 0 };
    lm[LM.forehead] = { x: 0.5, y: 0.1, z: 0 };
    lm[LM.chin] = { x: 0.5, y: 0.9, z: 0 };
    lm[LM.rightEyeOuter] = { x: 0.35, y: 0.4, z: 0 };
    lm[LM.leftEyeOuter] = { x: 0.65, y: 0.4, z: 0 };
    return lm;
  };
  it("reads about zero for a frontal face", () => {
    const p = poseFromLandmarks(frontal(), 1000, 1000);
    expect(Math.abs(p.yaw)).toBeLessThan(0.1);
    expect(Math.abs(p.pitch)).toBeLessThan(0.1);
    expect(Math.abs(p.roll)).toBeLessThan(0.1);
  });
  it("reads about 20 degrees of yaw when one cheek is nearer", () => {
    const lm = frontal();
    lm[LM.leftCheek] = { x: 0.8, y: 0.5, z: 0.6 * Math.tan((20 * Math.PI) / 180) };
    expect(Math.abs(poseFromLandmarks(lm, 1000, 1000).yaw)).toBeCloseTo(20, 0);
  });
  it("reads roll from a tilted eye line", () => {
    const lm = frontal();
    lm[LM.leftEyeOuter] = { x: 0.65, y: 0.4 + 0.3 * Math.tan((10 * Math.PI) / 180), z: 0 };
    expect(poseFromLandmarks(lm, 1000, 1000).roll).toBeCloseTo(10, 0);
  });
  it("builds a pixel box from the landmarks", () => {
    const b = faceBox(frontal(), 1000, 2000);
    expect(b.width).toBeCloseTo(600, 0);
    expect(b.height).toBeCloseTo(1600, 0);
  });
});
