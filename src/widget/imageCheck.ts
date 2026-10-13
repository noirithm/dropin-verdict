import { CAPTURE } from "../config/capture";

export type ImageType = "image/jpeg" | "image/png";
export type FileProblem = "unsupported" | "too_big";

// File type is decided by content, never by extension.
export function sniffImageType(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

export function checkFileBasics(size: number, head: Uint8Array): FileProblem | null {
  if (sniffImageType(head) === null) return "unsupported";
  if (size > CAPTURE.maxUploadBytes) return "too_big";
  return null;
}

export function fitWithin(w: number, h: number, maxSide: number): { width: number; height: number } {
  const longSide = Math.max(w, h);
  if (longSide <= maxSide) return { width: w, height: h };
  const scale = maxSide / longSide;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function isTooSmall(w: number, h: number): boolean {
  return Math.min(w, h) < CAPTURE.minSide;
}
