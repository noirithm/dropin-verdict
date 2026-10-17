import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { assetUrl } from "../assets";
import { evaluateGate, type GateResult } from "./evaluate";
import { blurStats, castStats, exposureStats, type BlurStats, type Pixels } from "./metrics";
import { faceBox, poseFromLandmarks, type Pt } from "./pose";

export interface GateReport {
  result: GateResult;
  debug: Record<string, number | string>;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    const p = (async () => {
      const vision = await FilesetResolver.forVisionTasks(assetUrl("mediapipe/wasm"));
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: assetUrl("models/face_landmarker.task") },
        runningMode: "IMAGE",
        numFaces: 2, // two, so we can refuse a photo with more than one person
      });
    })();
    p.catch(() => {
      landmarkerPromise = null; // allow a retry after a failed load
    });
    landmarkerPromise = p;
  }
  return landmarkerPromise;
}

function readPixels(
  src: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outW: number,
  outH: number,
): ImageData {
  const c = document.createElement("canvas");
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, outW, outH);
  return ctx.getImageData(0, 0, outW, outH);
}

function patchAround(bmp: ImageBitmap, p: Pt, size: number): ImageData | null {
  const sx = Math.max(0, Math.round(p.x * bmp.width - size / 2));
  const sy = Math.max(0, Math.round(p.y * bmp.height - size / 2));
  const sw = Math.min(bmp.width - sx, Math.round(size));
  const sh = Math.min(bmp.height - sy, Math.round(size));
  if (sw < 4 || sh < 4) return null;
  return readPixels(bmp, sx, sy, sw, sh, Math.min(sw, 32), Math.min(sh, 32));
}

function concat(a: Pixels, b: Pixels): Pixels {
  const data = new Uint8ClampedArray(a.data.length + b.data.length);
  data.set(a.data as ArrayLike<number>);
  data.set(b.data as ArrayLike<number>, a.data.length);
  return { data, width: a.width + b.width, height: 1 }; // only the pixel list matters for stats
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export async function detectFaces(blob: Blob): Promise<GateReport> {
  const [landmarker, bmp] = await Promise.all([getLandmarker(), createImageBitmap(blob)]);
  try {
    const W = bmp.width;
    const H = bmp.height;
    const res = landmarker.detect(bmp);
    const faces = res.faceLandmarks;

    if (faces.length !== 1) {
      const result = evaluateGate({ faceCount: faces.length, imageWidth: W, imageHeight: H });
      return { result, debug: { faceCount: faces.length, score: result.score } };
    }

    const lm = faces[0] as Pt[];
    const box = faceBox(lm, W, H);
    const pose = poseFromLandmarks(lm, W, H);

    // Whole-frame brightness (small copy): used to judge "too dark" without looking at skin tone.
    const scale = 96 / Math.max(W, H);
    const frame = readPixels(bmp, 0, 0, W, H, Math.max(1, Math.round(W * scale)), Math.max(1, Math.round(H * scale)));
    const frameP98 = exposureStats(frame).p98;

    // Two cheek patches for lighting and colour. The forehead is skipped on purpose:
    // hair or a fringe there would be mistaken for shadow.
    const size = box.width * 0.14;
    const left = patchAround(bmp, lm[50], size);
    const right = patchAround(bmp, lm[280], size);
    const face = left && right ? concat(left, right) : null;
    const faceStats = face ? exposureStats(face) : undefined;
    let imbalance: number | undefined;
    if (left && right) {
      const ml = exposureStats(left).mean;
      const mr = exposureStats(right).mean;
      imbalance = Math.abs(ml - mr) / Math.max(ml, mr, 1);
    }

    // Blur is measured on the eye band: iris, lids and brows give crisp edges at every skin tone.
    const eyeY = ((lm[33].y + lm[263].y) / 2) * H;
    const bx0 = Math.max(0, Math.round(Math.min(lm[33].x, lm[263].x) * W - 0.09 * box.width));
    const bx1 = Math.min(W, Math.round(Math.max(lm[33].x, lm[263].x) * W + 0.09 * box.width));
    const by0 = Math.max(0, Math.round(eyeY - 0.12 * box.width));
    const by1 = Math.min(H, Math.round(eyeY + 0.12 * box.width));
    let blur: BlurStats | undefined;
    if (bx1 - bx0 >= 32 && by1 - by0 >= 16) {
      const outW = 192;
      const outH = Math.max(8, Math.round((outW * (by1 - by0)) / (bx1 - bx0)));
      blur = blurStats(readPixels(bmp, bx0, by0, bx1 - bx0, by1 - by0, outW, outH));
    }

    const result = evaluateGate({
      faceCount: 1,
      imageWidth: W,
      imageHeight: H,
      box,
      pose,
      face: faceStats,
      frameP98,
      imbalance,
      edge: blur?.edge,
      motion: blur?.motion,
      cast: face ? castStats(face) : undefined,
    });

    const debug: Record<string, number | string> = {
      image: `${W}x${H}`,
      faceWidthFrac: round(box.width / W),
      yaw: round(pose.yaw),
      pitch: round(pose.pitch),
      roll: round(pose.roll),
      frameP98: round(frameP98),
      faceMean: round(faceStats?.mean ?? -1),
      clippedFrac: round(faceStats?.clippedFrac ?? -1),
      shadowFrac: round(faceStats?.shadowFrac ?? -1),
      imbalance: round(imbalance ?? -1),
      edge: round(blur?.edge ?? -1),
      motion: round(blur?.motion ?? -1),
      score: result.score,
      confidence: result.confidence,
    };
    for (const c of result.checks) debug[`check:${c.id}`] = c.status;
    return { result, debug };
  } finally {
    bmp.close();
  }
}
