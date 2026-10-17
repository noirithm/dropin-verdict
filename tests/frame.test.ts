import { describe, expect, it } from "vitest";
import { planFrameCrop } from "@/widget/gate/frame";

const holds = (r: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  b.x >= r.x && b.y >= r.y && b.x + b.width <= r.x + r.width && b.y + b.height <= r.y + r.height;

describe("planFrameCrop", () => {
  it("leaves a well-framed face alone", () => {
    expect(planFrameCrop({ x: 80, y: 250, width: 350, height: 450 }, 667, 1000)).toBeNull();
  });

  it("crops a small laptop-webcam face (29% of the width) to a 3:4 portrait around it", () => {
    const box = { x: 350, y: 180, width: 294, height: 370 };
    const r = planFrameCrop(box, 1000, 844)!;
    expect(r).not.toBeNull();
    expect(holds(r, box)).toBe(true);
    expect(box.width / r.width).toBeGreaterThan(0.5);
    expect(r.width / r.height).toBeCloseTo(0.75, 1);
    expect(r.x + r.width).toBeLessThanOrEqual(1000);
    expect(r.y + r.height).toBeLessThanOrEqual(844);
  });

  it("limits the crop to the photo's own height", () => {
    const box = { x: 290, y: 200, width: 413, height: 520 };
    const r = planFrameCrop(box, 1000, 844)!;
    expect(r.height).toBeLessThanOrEqual(844);
    expect(holds(r, box)).toBe(true);
    expect(box.width / r.width).toBeGreaterThan(0.55);
  });

  it("does not try to repair a face that is already cut off", () => {
    expect(planFrameCrop({ x: 0, y: 200, width: 294, height: 370 }, 1000, 844)).toBeNull();
  });

  it("does not make a crop too small to use", () => {
    expect(planFrameCrop({ x: 440, y: 440, width: 120, height: 150 }, 1000, 1000)).toBeNull();
  });

  it("never returns a crop outside the photo", () => {
    for (let x = 20; x < 700; x += 53) {
      for (const w of [200, 260, 330, 400]) {
        const box = { x, y: 150, width: w, height: w * 1.25 };
        const r = planFrameCrop(box, 1000, 844);
        if (!r) continue;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(1000);
        expect(r.y + r.height).toBeLessThanOrEqual(844);
        expect(holds(r, box)).toBe(true);
      }
    }
  });
});
