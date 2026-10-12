import { describe, expect, it } from "vitest";
import { MAX_UNITS_PER_SESSION, sessionCost } from "@/config/caps";

describe("session cost", () => {
  it("costs 21 with one preview and 23 at the max", () => {
    expect(sessionCost(1)).toBe(21);
    expect(MAX_UNITS_PER_SESSION).toBe(23);
  });
  it("clamps out-of-range preview counts", () => {
    expect(sessionCost(-5)).toBe(20);
    expect(sessionCost(99)).toBe(23);
  });
});
