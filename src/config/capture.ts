export const CAPTURE = {
  maxUploadBytes: 15 * 1024 * 1024, // we resize on the device, so this only guards the input
  outputMaxSide: 1000, // verified in Gate 0: 667x1000 is accepted by both endpoints
  minSide: 320, // docs: skin tone needs at least 320 px
  jpegQuality: 0.9,
} as const;
