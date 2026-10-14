import { describe, expect, it } from "vitest";
import { evaluateGate, type GateInput } from "@/widget/gate/evaluate";
import { castStats, exposureStats, type Pixels } from "@/widget/gate/metrics";
import { TIPS } from "@/widget/gate/tips";

const solid = (r: number, g: number, b: number): Pixels => {
  const data = new Uint8ClampedArray(20 * 20 * 4);
  for (let i = 0; i < 400; i++) data.set([r, g, b, 255], i * 4);
  return { data, width: 20, height: 20 };
};

// Skin colours used as numbers, not photos.
const TONES = { light: [241, 201, 176], medium: [180, 136, 104], deep: [59, 34, 25] } as const;

function good(over: Partial<GateInput> = {}): GateInput {
  return {
    faceCount: 1,
    imageWidth: 667,
    imageHeight: 1000,
    box: { x: 80, y: 250, width: 500, height: 600 },
    pose: { yaw: 1, pitch: 1, roll: 1 },
    frameP98: 180,
    imbalance: 0.05,
    sharpness: 0.01,
    ...over,
  };
}
const withTone = (c: readonly [number, number, number], over: Partial<GateInput> = {}) =>
  good({ face: exposureStats(solid(...c)), cast: castStats(solid(...c)), ...over });

describe("fairness: same conditions give the same verdict for every skin tone", () => {
  it("passes a well-lit photo with an identical score for light, medium and deep", () => {
    const results = Object.values(TONES).map((c) => evaluateGate(withTone(c)));
    for (const r of results) {
      expect(r.passed).toBe(true);
      expect(r.score).toBe(1);
    }
  });
  it("refuses a dark scene for every tone, not only for deep skin", () => {
    for (const c of Object.values(TONES)) {
      const r = evaluateGate(withTone(c, { frameP98: 30 }));
      expect(r.passed).toBe(false);
      expect(r.tips).toContain(TIPS.dark);
    }
  });
  it("does not call deep skin 'too dark' in a bright scene", () => {
    const r = evaluateGate(withTone(TONES.deep));
    expect(r.checks.find((c) => c.id === "brightness")?.status).toBe("pass");
  });
});

describe("face presence and size", () => {
  it("refuses no face and multiple faces with a tip", () => {
    const none = evaluateGate(good({ faceCount: 0 }));
    expect(none.passed).toBe(false);
    expect(none.tips).toEqual([TIPS.noFace]);
    expect(evaluateGate(good({ faceCount: 2 })).tips).toEqual([TIPS.multipleFaces]);
    expect(none.score).toBe(0);
  });
  it("fails a small face and warns on a borderline one", () => {
    const small = evaluateGate(good({ box: { x: 200, y: 300, width: 300, height: 400 } }));
    expect(small.passed).toBe(false);
    expect(small.tips).toContain(TIPS.tooFar);
    const edge = evaluateGate(good({ box: { x: 100, y: 300, width: 420, height: 500 } })); // 63%
    expect(edge.checks.find((c) => c.id === "face_size")?.status).toBe("warn");
    expect(edge.passed).toBe(true);
  });
  it("fails a face cut off at the edge", () => {
    const r = evaluateGate(good({ box: { x: 0, y: 250, width: 500, height: 600 } }));
    expect(r.passed).toBe(false);
    expect(r.tips).toContain(TIPS.cropped);
  });
});

describe("head pose", () => {
  it("warns at 8 degrees and fails at 12", () => {
    expect(evaluateGate(good({ pose: { yaw: 8, pitch: 0, roll: 0 } })).checks.find((c) => c.id === "yaw")?.status).toBe("warn");
    const r = evaluateGate(good({ pose: { yaw: -12, pitch: 0, roll: 0 } }));
    expect(r.passed).toBe(false);
    expect(r.tips).toContain(TIPS.yaw);
  });
  it("gives a tip that matches the axis", () => {
    expect(evaluateGate(good({ pose: { yaw: 0, pitch: 12, roll: 0 } })).tips).toContain(TIPS.pitch);
    expect(evaluateGate(good({ pose: { yaw: 0, pitch: 0, roll: 12 } })).tips).toContain(TIPS.roll);
  });
});

describe("lighting and focus", () => {
  it("refuses blown highlights, heavy shadow and strongly uneven light", () => {
    const base = exposureStats(solid(...TONES.medium));
    expect(evaluateGate(good({ face: { ...base, clippedFrac: 0.15 } })).tips).toContain(TIPS.brightSpots);
    expect(evaluateGate(good({ face: { ...base, shadowFrac: 0.4 } })).tips).toContain(TIPS.shadows);
    expect(evaluateGate(good({ imbalance: 0.55 })).tips).toContain(TIPS.uneven);
  });
  it("only warns on blur while the fail threshold is disabled", () => {
    const r = evaluateGate(good({ sharpness: 0 }));
    expect(r.checks.find((c) => c.id === "sharpness")?.status).toBe("warn");
    expect(r.passed).toBe(true);
  });
  it("only warns on a colour cast", () => {
    const r = evaluateGate(good({ cast: { chroma: 60, hue: 200 } }));
    expect(r.checks.find((c) => c.id === "colour_cast")?.status).toBe("warn");
    expect(r.passed).toBe(true);
  });
});

describe("validity score and confidence", () => {
  it("is 1 with no problems and lowers confidence as warnings pile up", () => {
    expect(evaluateGate(good()).confidence).toBe("high");
    const twoWarn = evaluateGate(good({ imbalance: 0.4, sharpness: 0 }));
    expect(twoWarn.score).toBe(0.8);
    expect(twoWarn.confidence).toBe("medium");
  });
  it("refuses when many small problems add up, even with no single failure", () => {
    const r = evaluateGate(
      good({
        pose: { yaw: 7, pitch: 7, roll: 7 },
        imbalance: 0.4,
        sharpness: 0,
        box: { x: 100, y: 300, width: 420, height: 500 },
      }),
    );
    expect(r.checks.some((c) => c.status === "fail")).toBe(false);
    expect(r.score).toBeLessThan(0.6);
    expect(r.passed).toBe(false);
  });
  it("lists the most serious fixes first and without duplicates", () => {
    const r = evaluateGate(good({ pose: { yaw: 12, pitch: 0, roll: 0 }, imbalance: 0.4 }));
    expect(r.tips[0]).toBe(TIPS.yaw);
    expect(new Set(r.tips).size).toBe(r.tips.length);
  });
});
