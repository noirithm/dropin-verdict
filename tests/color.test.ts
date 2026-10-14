import { describe, expect, it } from "vitest";
import { hexToRgb, rgbToLab } from "@/shared/color";

describe("rgbToLab", () => {
  it("maps white and black", () => {
    expect(rgbToLab(255, 255, 255).L).toBeCloseTo(100, 0);
    expect(rgbToLab(0, 0, 0).L).toBeCloseTo(0, 0);
  });
  it("matches the published value for sRGB red", () => {
    const lab = rgbToLab(255, 0, 0);
    expect(lab.L).toBeCloseTo(53.24, 0);
    expect(lab.a).toBeCloseTo(80.09, 0);
    expect(lab.b).toBeCloseTo(67.2, 0);
  });
  it("parses hex", () => {
    expect(hexToRgb("#b48868")).toEqual([180, 136, 104]);
  });
});
