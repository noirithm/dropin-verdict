import { describe, expect, it } from "vitest";
import { initialState, reduce, type WidgetEvent, type WidgetState } from "@/widget/machine";

const run = (events: WidgetEvent[], from: WidgetState = initialState) =>
  events.reduce(reduce, from);

describe("widget machine", () => {
  it("happy path reaches the verdict", () => {
    const s = run([
      { type: "OPEN" },
      { type: "CONSENT_GIVEN" },
      { type: "CHOOSE_CAMERA" },
      { type: "PHOTO_READY" },
      { type: "GATE_PASSED" },
      { type: "ANALYSIS_DONE" },
    ]);
    expect(s.name).toBe("verdict");
  });

  it("never reaches analyzing without consent", () => {
    const s = run([{ type: "OPEN" }, { type: "GATE_PASSED" }, { type: "CHOOSE_CAMERA" }]);
    expect(s.name).toBe("consent");
  });

  it("declining consent returns to idle", () => {
    expect(run([{ type: "OPEN" }, { type: "CONSENT_DECLINED" }]).name).toBe("idle");
  });

  it("camera denied falls back to upload", () => {
    const s = run([
      { type: "OPEN" },
      { type: "CONSENT_GIVEN" },
      { type: "CHOOSE_CAMERA" },
      { type: "CAMERA_DENIED" },
    ]);
    expect(s).toEqual({ name: "capture", via: "upload" });
  });

  it("a failed gate refuses with reasons and allows retake", () => {
    const refused = run([
      { type: "OPEN" },
      { type: "CONSENT_GIVEN" },
      { type: "CHOOSE_UPLOAD" },
      { type: "PHOTO_READY" },
      { type: "GATE_FAILED", reasons: ["face too small"] },
    ]);
    expect(refused).toEqual({ name: "refused", reasons: ["face too small"] });
    expect(reduce(refused, { type: "RETAKE" }).name).toBe("source");
  });

  it("every end state can recover", () => {
    const ends: WidgetState[] = [
      { name: "refused", reasons: ["x"] },
      { name: "error", code: "timeout" },
      { name: "verdict" },
      { name: "budget_exhausted" },
    ];
    for (const s of ends) expect(reduce(s, { type: "RESET" })).toEqual(initialState);
  });

  it("budget exhaustion can interrupt any state", () => {
    expect(reduce({ name: "analyzing" }, { type: "BUDGET_EXHAUSTED" }).name).toBe(
      "budget_exhausted",
    );
  });
});
