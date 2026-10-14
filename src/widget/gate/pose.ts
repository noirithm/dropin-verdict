export interface Pt {
  x: number; // normalised 0-1 by image width
  y: number; // normalised 0-1 by image height
  z: number; // roughly the same scale as x
}

// MediaPipe Face Mesh indices
export const LM = {
  rightCheek: 234,
  leftCheek: 454,
  forehead: 10,
  chin: 152,
  rightEyeOuter: 33,
  leftEyeOuter: 263,
} as const;

const deg = (rad: number): number => (rad * 180) / Math.PI;

export interface Pose {
  yaw: number;
  pitch: number;
  roll: number;
}

/** Rough head pose from 3D landmark geometry. Angles in degrees, 0 = facing the camera. */
export function poseFromLandmarks(lm: ArrayLike<Pt>, imageWidth: number, imageHeight: number): Pose {
  const px = (i: number) => ({ x: lm[i].x * imageWidth, y: lm[i].y * imageHeight, z: lm[i].z * imageWidth });
  const rc = px(LM.rightCheek);
  const lc = px(LM.leftCheek);
  const fh = px(LM.forehead);
  const ch = px(LM.chin);
  const re = px(LM.rightEyeOuter);
  const le = px(LM.leftEyeOuter);
  return {
    yaw: deg(Math.atan2(lc.z - rc.z, lc.x - rc.x)),
    pitch: deg(Math.atan2(ch.z - fh.z, ch.y - fh.y)),
    roll: deg(Math.atan2(le.y - re.y, le.x - re.x)),
  };
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of all landmarks, in pixels. */
export function faceBox(lm: ArrayLike<Pt>, imageWidth: number, imageHeight: number): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i];
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX * imageWidth,
    y: minY * imageHeight,
    width: (maxX - minX) * imageWidth,
    height: (maxY - minY) * imageHeight,
  };
}
