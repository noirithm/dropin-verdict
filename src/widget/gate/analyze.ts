import type { GateReport } from "./detect";

export type { GateReport };

/** The heavy detector is a separate chunk, downloaded only when a photo needs checking. */
export async function analyzePhoto(blob: Blob): Promise<GateReport> {
  const { analyzeWithAutoFrame } = await import("./detect");
  return analyzeWithAutoFrame(blob);
}
