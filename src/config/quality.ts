// Capture-quality thresholds. All values are PROVISIONAL until calibrated on real photos
// (Gate 3 step 3). A fail threshold of 0 means "disabled, warn only".
//
// Fairness rule: nothing here may depend on how dark or light the skin itself is.
// "Too dark" is judged on the whole frame; shadows, evenness and blur are ratios.
export const QUALITY = {
  face: {
    // The docs claim skin tone needs a face wider than 60% of the image, but a real call accepted
    // a face at 52.5% with face_quality.area "good". The true lower limit is still unknown, so
    // these are provisional. Makeup try-on needs at least 100 px (from docs).
    minWidthFracFail: 0.4,
    minWidthFracWarn: 0.45, // typical selfies measured 0.48 to 0.53
    minWidthPx: 100,
    edgeMarginFrac: 0.01, // face must sit inside the frame with this margin
  },
  pose: { warnDeg: 6, failDeg: 10, pitchBiasDeg: 5 }, // straight-on photos read 3.7 to 8.3 degrees pitch // docs: front-facing within about 10 degrees
  exposure: {
    frameP98Fail: 90, // whole-frame 98th percentile luma (0-255). Samples: dark photo 67, good 185 to 199
    frameP98Warn: 130,
    faceMeanFail: 20, // near-black floor on the face; far below any real skin tone in light
    clippedWarn: 0.04, // share of face pixels with luma >= 245
    clippedFail: 0.1,
    shadowWarn: 0.2, // share of face pixels under 40% of the face's own median
    shadowFail: 0.35,
  },
  evenness: { warn: 0.35, fail: 0.5 }, // left/right mean luma difference as a share
  // Blur is measured on the eye band (crisp edges at every skin tone). Provisional: from 3 photos
  // plus emulated webcam softness. Edge crispness: sharp 0.24 to 0.27, webcam-like 0.16 to 0.20,
  // motion blur 0.15. Direction ratio (min/max gradient): sharp 0.95+, soft webcam 0.83+, motion blur 0.47.
  sharpness: { warnBelow: 0.17, failBelow: 0.1 },
  motion: { warnBelow: 0.7, failBelow: 0.55 },
  cast: { hueMin: 15, hueMax: 85, maxChroma: 45, minChromaForHue: 6 }, // warn only
  score: { warnPenalty: 0.1, failPenalty: 0.35, minToProceed: 0.6, high: 0.9, medium: 0.7 },
} as const;
