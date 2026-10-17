import { describe, expect, it } from "vitest";
import { reduce } from "@/widget/machine";

describe("gate transitions", () => {
  it("an unavailable detector becomes a recoverable error", () => {
    const s = reduce({ name: "quality_check" }, { type: "GATE_UNAVAILABLE" });
    expect(s).toEqual({ name: "error", code: "check_unavailable" });
    expect(reduce(s, { type: "RETAKE" }).name).toBe("source");
  });
  it("retake cancels an analysis in progress", () => {
    expect(reduce({ name: "analyzing" }, { type: "RETAKE" }).name).toBe("source");
  });
  it("a late gate result is ignored once the user has moved on", () => {
    const left = reduce({ name: "quality_check" }, { type: "RETAKE" });
    expect(reduce(left, { type: "GATE_PASSED" })).toEqual(left);
  });
});
