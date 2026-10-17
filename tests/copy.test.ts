import { describe, expect, it } from "vitest";
import { ERROR_COPY, REFUSED } from "@/widget/strings";
import { reduce } from "@/widget/machine";

const CODES = ["api_error", "check_unavailable", "offline", "rate_limited", "timeout", "unsupported_file", "upload_failed"];

describe("error copy", () => {
  it("covers every error code", () => {
    expect(Object.keys(ERROR_COPY).sort()).toEqual(CODES);
  });
  it("gives every error a title, a message and a recovery action", () => {
    for (const c of Object.values(ERROR_COPY)) {
      expect(c.title.length).toBeGreaterThan(3);
      expect(c.message.length).toBeGreaterThan(10);
      expect(c.action.length).toBeGreaterThan(2);
    }
  });
  it("never shows raw technical text to shoppers", () => {
    const all = JSON.stringify([ERROR_COPY, REFUSED]);
    expect(all).not.toMatch(/undefined|null|exception|stack|\b[45]\d\d\b|ECONN|fetch failed/i);
  });
});

describe("recovery from failure screens", () => {
  it("every error code can retake or reset, so there are no dead ends", () => {
    for (const code of CODES) {
      const s = { name: "error", code } as never;
      expect(reduce(s, { type: "RETAKE" }).name).toBe("source");
      expect(reduce(s, { type: "RESET" }).name).toBe("idle");
    }
  });
  it("a refused photo can be retaken", () => {
    expect(reduce({ name: "refused", reasons: ["x"] }, { type: "RETAKE" }).name).toBe("source");
  });
});
