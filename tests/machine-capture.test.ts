import { describe, expect, it } from "vitest";
import { reduce } from "@/widget/machine";

describe("capture transitions", () => {
  it("can switch between camera and upload", () => {
    const cam = { name: "capture", via: "camera" } as const;
    expect(reduce(cam, { type: "CHOOSE_UPLOAD" })).toEqual({ name: "capture", via: "upload" });
    const up = { name: "capture", via: "upload" } as const;
    expect(reduce(up, { type: "CHOOSE_CAMERA" })).toEqual({ name: "capture", via: "camera" });
  });
  it("back from capture returns to the source choice", () => {
    expect(reduce({ name: "capture", via: "camera" }, { type: "RETAKE" }).name).toBe("source");
  });
  it("retake from the quality check returns to the source choice", () => {
    expect(reduce({ name: "quality_check" }, { type: "RETAKE" }).name).toBe("source");
  });
});
