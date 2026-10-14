// Capture-quality thresholds. All values are PROVISIONAL until calibrated on real photos
// (Gate 3 step 3). A fail threshold of 0 means "disabled, warn only".
//
// Fairness rule: nothing here may depend on how dark or light the skin itself is.
// "Too dark" is judged on the whole frame; shadows, evenness and blur are ratios.
export const QUALITY = {
  face: {
    // From the YouCam docs (not yet verified by call): skin tone needs face width above 60% of
    // the image width, makeup try-on needs at least 100 px.
    minWidthFracFail: 0.6,
    minWidthFracWarn: 0.65,
    minWidthPx: 100,
    edgeMarginFrac: 0.01, // face must sit inside the frame with this margin
  },
  pose: { warnDeg: 6, failDeg: 10, pitchBiasDeg: 0 }, // docs: front-facing within about 10 degrees
  exposure: {
    frameP98Fail: 45, // whole-frame 98th percentile luma (0-255); below this the scene is dark
    frameP98Warn: 70,
    faceMeanFail: 20, // near-black floor on the face; far below any real skin tone in light
    clippedWarn: 0.04, // share of face pixels with luma >= 245
    clippedFail: 0.1,
    shadowWarn: 0.2, // share of face pixels under 40% of the face's own median
    shadowFail: 0.35,
  },
  evenness: { warn: 0.35, fail: 0.5 }, // left/right mean luma difference as a share
  sharpness: { warnBelow: 0.0003, failBelow: 0 }, // normalised Laplacian variance; fail disabled
  cast: { hueMin: 15, hueMax: 85, maxChroma: 45, minChromaForHue: 6 }, // warn only
  score: { warnPenalty: 0.1, failPenalty: 0.35, minToProceed: 0.6, high: 0.9, medium: 0.7 },
} as const;
