import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// Raw shape of GET /s2s/v2.0/task/skin-tone-analysis/<id> (verified by call).
export const SkinToneRawSchema = z.object({
  data: z.object({
    error: z.unknown().optional(),
    task_status: z.string(),
    results: z.object({
      color: z.object({
        skin_color: hex,
        eye_color: hex.optional(),
        lip_color: hex.optional(),
        eyebrow_color: hex.optional(),
        hair_color: hex.optional(),
      }),
      face_quality: z
        .object({
          has_face: z.boolean(),
          area: z.string(),
          frontal: z.string(),
          lighting: z.string(),
          faceangle: z.string(),
        })
        .optional(),
    }),
  }),
});

// Raw shape of GET /s2s/v2.0/task/makeup-vto/<id> (verified by call: results is an object).
export const MakeupRawSchema = z.object({
  data: z.object({
    error: z.unknown().optional(),
    task_status: z.string(),
    results: z.object({ url: z.string().min(1) }),
  }),
});

export type FaceQuality = NonNullable<
  z.infer<typeof SkinToneRawSchema>["data"]["results"]["face_quality"]
>;

export interface ToneMeasurement {
  skinHex: string;
  faceQuality: FaceQuality | null;
  allGood: boolean;
}

export function normalizeSkinTone(raw: unknown): ToneMeasurement {
  const p = SkinToneRawSchema.parse(raw);
  if (p.data.task_status !== "success") {
    throw new Error(`skin tone task not successful: ${p.data.task_status}`);
  }
  const fq = p.data.results.face_quality ?? null;
  const allGood =
    fq !== null &&
    fq.has_face &&
    [fq.area, fq.frontal, fq.lighting, fq.faceangle].every((v) => v === "good");
  return { skinHex: p.data.results.color.skin_color.toLowerCase(), faceQuality: fq, allGood };
}

export function normalizeTryOn(raw: unknown): { imageUrl: string } {
  const p = MakeupRawSchema.parse(raw);
  if (p.data.task_status !== "success") {
    throw new Error(`try-on task not successful: ${p.data.task_status}`);
  }
  return { imageUrl: p.data.results.url };
}
