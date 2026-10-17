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
    edge: 0.27,
    motion: 0.95,
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
    const small = evaluateGate(good({ box: { x: 200, y: 300, width: 200, height: 300 } }));
    expect(small.passed).toBe(false);
    expect(small.tips).toContain(TIPS.tooFar);
    const edge = evaluateGate(good({ box: { x: 100, y: 300, width: 290, height: 420 } })); // 43%
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
  it("refuses motion blur and tells the shopper how to fix it", () => {
    const r = evaluateGate(good({ edge: 0.15, motion: 0.47 }));
    expect(r.passed).toBe(false);
    expect(r.tips).toContain(TIPS.motion);
  });
  it("refuses a badly out-of-focus photo", () => {
    const r = evaluateGate(good({ edge: 0.08 }));
    expect(r.passed).toBe(false);
    expect(r.tips).toContain(TIPS.soft);
  });
  it("only warns on a slightly soft photo", () => {
    const soft = evaluateGate(good({ edge: 0.15 }));
    expect(soft.checks.find((c) => c.id === "sharpness")?.status).toBe("warn");
    expect(soft.passed).toBe(true);
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
    const twoWarn = evaluateGate(good({ imbalance: 0.4, edge: 0.15 }));
    expect(twoWarn.score).toBe(0.8);
    expect(twoWarn.confidence).toBe("medium");
  });
  it("refuses when many small problems add up, even with no single failure", () => {
    const r = evaluateGate(
      good({
        pose: { yaw: 7, pitch: 12, roll: 7 },
        imbalance: 0.4,
        edge: 0.15,
        box: { x: 100, y: 300, width: 290, height: 420 },
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

describe("calibration samples (numbers from real test photos)", () => {
  it("refuses the very dark photo and says why", () => {
    const r = evaluateGate(good({ frameP98: 67.4, pose: { yaw: -2.5, pitch: 8.3, roll: -4.1 } }));
    expect(r.passed).toBe(false);
    expect(r.tips).toContain(TIPS.dark);
  });
  it("passes the sharp, well-lit photo with the face at 52% of the width", () => {
    const r = evaluateGate(
      good({ frameP98: 198.5, pose: { yaw: -1.7, pitch: 5.3, roll: -0.4 }, box: { x: 80, y: 250, width: 350, height: 450 } }),
    );
    expect(r.passed).toBe(true);
    expect(r.checks.find((c) => c.id === "pitch")?.status).toBe("pass");
  });
  it("treats typical selfie framing (face about 48% of the width) as fine", () => {
    const r = evaluateGate(good({ box: { x: 80, y: 250, width: 320, height: 430 } }));
    expect(r.checks.find((c) => c.id === "face_size")?.status).toBe("pass");
  });
});

describe("blur samples (real test photos, and a laptop-webcam-like softening)", () => {
  it("refuses the motion-blurred photo (edge 0.147, direction 0.47)", () => {
    expect(evaluateGate(good({ edge: 0.147, motion: 0.47 })).passed).toBe(false);
  });
  it("passes a soft laptop-webcam-like photo with only a warning (edge 0.16, direction 0.92)", () => {
    const r = evaluateGate(good({ edge: 0.16, motion: 0.92 }));
    expect(r.passed).toBe(true);
    expect(r.tips).toContain(TIPS.soft);
  });
  it("passes sharp photos, including a dark one, with no blur warning", () => {
    for (const s of [{ edge: 0.272, motion: 0.95 }, { edge: 0.237, motion: 0.98 }]) {
      expect(evaluateGate(good(s)).score).toBe(1);
    }
  });
});

describe("motion blur needs two signals", () => {
  it("passes a steady real webcam photo whose direction ratio read 0.607", () => {
    const r = evaluateGate(good({ edge: 0.201, motion: 0.607 }));
    expect(r.checks.find((c) => c.id === "motion_blur")?.status).toBe("pass");
    expect(r.passed).toBe(true);
  });
  it("only warns when the ratio is low but the edges are crisp", () => {
    const r = evaluateGate(good({ edge: 0.27, motion: 0.4 }));
    expect(r.checks.find((c) => c.id === "motion_blur")?.status).toBe("warn");
    expect(r.passed).toBe(true);
  });
  it("refuses when both signals say blur", () => {
    expect(evaluateGate(good({ edge: 0.147, motion: 0.47 })).passed).toBe(false);
  });
});
