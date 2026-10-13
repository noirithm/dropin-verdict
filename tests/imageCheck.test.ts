import { describe, expect, it } from "vitest";
import { checkFileBasics, fitWithin, isTooSmall, sniffImageType } from "@/widget/imageCheck";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const text = new TextEncoder().encode("hello world");

describe("sniffImageType", () => {
  it("detects jpeg and png by content", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
  });
  it("rejects other content, even if it was named .jpg", () => {
    expect(sniffImageType(text)).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("checkFileBasics", () => {
  it("accepts a normal photo", () => {
    expect(checkFileBasics(3_000_000, jpeg)).toBeNull();
  });
  it("flags unsupported content first", () => {
    expect(checkFileBasics(100, text)).toBe("unsupported");
  });
  it("flags oversized files", () => {
    expect(checkFileBasics(16 * 1024 * 1024, jpeg)).toBe("too_big");
  });
});

describe("fitWithin", () => {
  it("scales the long side down to the limit", () => {
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitWithin(3000, 4000, 1000)).toEqual({ width: 750, height: 1000 });
  });
  it("never upscales", () => {
    expect(fitWithin(667, 1000, 1000)).toEqual({ width: 667, height: 1000 });
    expect(fitWithin(500, 400, 1000)).toEqual({ width: 500, height: 400 });
  });
});

describe("isTooSmall", () => {
  it("uses the shorter side against 320 px", () => {
    expect(isTooSmall(319, 900)).toBe(true);
    expect(isTooSmall(320, 320)).toBe(false);
  });
});
