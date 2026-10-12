import { z } from "zod";

export const VerdictLabelSchema = z.enum([
  "good_match",
  "close_match",
  "poor_match",
  "cant_tell",
]);
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const VerdictSchema = z.object({
  label: VerdictLabelSchema,
  confidence: ConfidenceSchema,
  deltaE: z.number().nullable(), // CIEDE2000 distance, null when we can't tell
  reasons: z.array(z.string()).min(1), // built from templates, never free text
});

export type VerdictLabel = z.infer<typeof VerdictLabelSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
