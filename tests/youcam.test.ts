import { describe, expect, it } from "vitest";
import { normalizeSkinTone, normalizeTryOn } from "@/shared/youcam";
import tone from "./fixtures/skin-tone-success.json";
import vto from "./fixtures/makeup-vto-success.json";

describe("normalizeSkinTone", () => {
  it("parses the real response shape", () => {
    const r = normalizeSkinTone(tone);
    expect(r.skinHex).toBe("#b48868");
    expect(r.allGood).toBe(true);
  });
  it("rejects a malformed colour", () => {
    const bad = structuredClone(tone);
    bad.data.results.color.skin_color = "brown";
    expect(() => normalizeSkinTone(bad)).toThrow();
  });
  it("rejects an unsuccessful task", () => {
    const bad = structuredClone(tone);
    bad.data.task_status = "error";
    expect(() => normalizeSkinTone(bad)).toThrow();
  });
  it("does not report allGood when face_quality is missing", () => {
    const noq = structuredClone(tone);
    const results: { face_quality?: unknown } = noq.data.results;
    delete results.face_quality;
    const r = normalizeSkinTone(noq);
    expect(r.faceQuality).toBeNull();
    expect(r.allGood).toBe(false);
  });
});

describe("normalizeTryOn", () => {
  it("parses the object result shape", () => {
    expect(normalizeTryOn(vto).imageUrl).toContain("example.invalid");
  });
  it("rejects the array shape from the docs", () => {
    const arr = { data: { task_status: "success", results: [{ download_url: "x" }] } };
    expect(() => normalizeTryOn(arr)).toThrow();
  });
});
