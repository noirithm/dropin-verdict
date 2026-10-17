import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const WASM_SRC = "node_modules/@mediapipe/tasks-vision/wasm";
const WASM_DST = "public/mediapipe/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const MODEL_DST = "public/models/face_landmarker.task";

if (!existsSync(WASM_SRC)) {
  console.error("Missing @mediapipe/tasks-vision. Run: npm install");
  process.exit(1);
}
mkdirSync(WASM_DST, { recursive: true });
cpSync(WASM_SRC, WASM_DST, { recursive: true });

mkdirSync("public/models", { recursive: true });
if (!existsSync(MODEL_DST) || statSync(MODEL_DST).size < 1_000_000) {
  console.log("Downloading face_landmarker.task ...");
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    console.error(`Model download failed: HTTP ${res.status}`);
    process.exit(1);
  }
  await writeFile(MODEL_DST, Buffer.from(await res.arrayBuffer()));
}
const bytes = await readFile(MODEL_DST);
console.log(
  `face_landmarker.task: ${(bytes.length / 1e6).toFixed(2)} MB, sha256 ${createHash("sha256").update(bytes).digest("hex")}`,
);
