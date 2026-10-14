import { QUALITY as Q } from "../../config/quality";
import type { CastStats, ExposureStats } from "./metrics";
import type { Box, Pose } from "./pose";
import { TIPS } from "./tips";

export type Status = "pass" | "warn" | "fail";
export type CheckId =
  | "face_count" | "face_size" | "framing" | "yaw" | "pitch" | "roll"
  | "brightness" | "bright_spots" | "shadows" | "evenness" | "sharpness" | "colour_cast";

export interface Check {
  id: CheckId;
  status: Status;
  tip?: string;
}

export interface GateInput {
  faceCount: number;
  imageWidth: number;
  imageHeight: number;
  box?: Box;
  pose?: Pose;
  face?: ExposureStats; // exposure of the face region
  frameP98?: number; // 98th percentile luma of the whole frame
  imbalance?: number;
  sharpness?: number;
  cast?: CastStats;
}

export type Confidence = "high" | "medium" | "low";

export interface GateResult {
  checks: Check[];
  score: number; // capture-validity, 0-1
  passed: boolean;
  confidence: Confidence;
  tips: string[]; // fixes, most serious first
}

const worse = (a: Status, b: Status): Status =>
  a === "fail" || b === "fail" ? "fail" : a === "warn" || b === "warn" ? "warn" : "pass";

/** Bad when the value is high. A fail threshold of 0 is disabled. */
function high(v: number, warnAt: number, failAt: number): Status {
  if (failAt > 0 && v >= failAt) return "fail";
  if (warnAt > 0 && v >= warnAt) return "warn";
  return "pass";
}

/** Bad when the value is low. A fail threshold of 0 is disabled. */
function low(v: number, warnBelow: number, failBelow: number): Status {
  if (failBelow > 0 && v < failBelow) return "fail";
  if (warnBelow > 0 && v < warnBelow) return "warn";
  return "pass";
}

function finish(checks: Check[], forceZero = false): GateResult {
  let score = 1;
  for (const c of checks) {
    if (c.status === "warn") score -= Q.score.warnPenalty;
    if (c.status === "fail") score -= Q.score.failPenalty;
  }
  score = forceZero ? 0 : Math.max(0, Math.round(score * 100) / 100);
  const failed = checks.some((c) => c.status === "fail");
  const ordered = [...checks.filter((c) => c.status === "fail"), ...checks.filter((c) => c.status === "warn")];
  return {
    checks,
    score,
    passed: !failed && score >= Q.score.minToProceed,
    confidence: score >= Q.score.high ? "high" : score >= Q.score.medium ? "medium" : "low",
    tips: [...new Set(ordered.map((c) => c.tip).filter((t): t is string => !!t))],
  };
}

export function evaluateGate(input: GateInput): GateResult {
  const checks: Check[] = [];
  const add = (id: CheckId, status: Status, tip: string) =>
    checks.push({ id, status, tip: status === "pass" ? undefined : tip });

  if (input.faceCount === 0) {
    add("face_count", "fail", TIPS.noFace);
    return finish(checks, true);
  }
  if (input.faceCount > 1) {
    add("face_count", "fail", TIPS.multipleFaces);
    return finish(checks, true);
  }
  add("face_count", "pass", "");

  if (input.box) {
    const frac = input.box.width / input.imageWidth;
    let size: Status = "pass";
    if (frac < Q.face.minWidthFracFail || input.box.width < Q.face.minWidthPx) size = "fail";
    else if (frac < Q.face.minWidthFracWarn) size = "warn";
    add("face_size", size, TIPS.tooFar);

    const mx = Q.face.edgeMarginFrac * input.imageWidth;
    const my = Q.face.edgeMarginFrac * input.imageHeight;
    const cropped =
      input.box.x < mx ||
      input.box.y < my ||
      input.box.x + input.box.width > input.imageWidth - mx ||
      input.box.y + input.box.height > input.imageHeight - my;
    add("framing", cropped ? "fail" : "pass", TIPS.cropped);
  }

  if (input.pose) {
    const axes: [CheckId, number, string][] = [
      ["yaw", input.pose.yaw, TIPS.yaw],
      ["pitch", input.pose.pitch - Q.pose.pitchBiasDeg, TIPS.pitch],
      ["roll", input.pose.roll, TIPS.roll],
    ];
    for (const [id, v, tip] of axes) add(id, high(Math.abs(v), Q.pose.warnDeg, Q.pose.failDeg), tip);
  }

  if (input.frameP98 !== undefined || input.face) {
    let dark: Status = "pass";
    if (input.frameP98 !== undefined) dark = low(input.frameP98, Q.exposure.frameP98Warn, Q.exposure.frameP98Fail);
    if (input.face && input.face.mean < Q.exposure.faceMeanFail) dark = worse(dark, "fail");
    add("brightness", dark, TIPS.dark);
  }
  if (input.face) {
    add("bright_spots", high(input.face.clippedFrac, Q.exposure.clippedWarn, Q.exposure.clippedFail), TIPS.brightSpots);
    add("shadows", high(input.face.shadowFrac, Q.exposure.shadowWarn, Q.exposure.shadowFail), TIPS.shadows);
  }
  if (input.imbalance !== undefined) {
    add("evenness", high(input.imbalance, Q.evenness.warn, Q.evenness.fail), TIPS.uneven);
  }
  if (input.sharpness !== undefined) {
    add("sharpness", low(input.sharpness, Q.sharpness.warnBelow, Q.sharpness.failBelow), TIPS.blurry);
  }
  if (input.cast) {
    const hueOff =
      input.cast.chroma >= Q.cast.minChromaForHue &&
      (input.cast.hue < Q.cast.hueMin || input.cast.hue > Q.cast.hueMax);
    const tooVivid = input.cast.chroma > Q.cast.maxChroma;
    add("colour_cast", hueOff || tooVivid ? "warn" : "pass", TIPS.cast); // never a hard fail
  }
  return finish(checks);
}
