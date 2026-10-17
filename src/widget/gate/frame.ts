import { CAPTURE } from "../../config/capture";
import { QUALITY as Q } from "../../config/quality";
import type { Box } from "./pose";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where to crop so the face fills about half the width. Null when no useful crop exists. */
export function planFrameCrop(box: Box, imageWidth: number, imageHeight: number): Rect | null {
  const frac = box.width / imageWidth;
  if (frac >= Q.frame.triggerBelowFrac) return null;

  // Cropping cannot repair a face that is already cut off by the photo's edge.
  const m = Q.face.edgeMarginFrac;
  const inside =
    box.x >= m * imageWidth &&
    box.y >= m * imageHeight &&
    box.x + box.width <= imageWidth * (1 - m) &&
    box.y + box.height <= imageHeight * (1 - m);
  if (!inside) return null;

  const aspect = Q.frame.aspect; // crop width / height
  const cw = Math.min(box.width / Q.frame.targetFaceFrac, imageWidth, imageHeight * aspect);
  const ch = cw / aspect;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const x = Math.min(Math.max(cx - cw / 2, 0), imageWidth - cw);
  const y = Math.min(Math.max(cy - ch / 2, 0), imageHeight - ch);

  const rect: Rect = { x: Math.round(x), y: Math.round(y), width: Math.round(cw), height: Math.round(ch) };
  rect.x = Math.max(0, Math.min(rect.x, imageWidth - rect.width));
  rect.y = Math.max(0, Math.min(rect.y, imageHeight - rect.height));

  const holdsFace =
    box.x >= rect.x &&
    box.y >= rect.y &&
    box.x + box.width <= rect.x + rect.width &&
    box.y + box.height <= rect.y + rect.height;
  if (!holdsFace) return null;
  if (box.width / rect.width - frac < Q.frame.minGain) return null;
  if (Math.min(rect.width, rect.height) < CAPTURE.minSide) return null;
  return rect;
}
