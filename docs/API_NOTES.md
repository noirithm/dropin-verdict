# YouCam API notes (Gate 0 draft)

Status legend: **[docs]** = from https://docs.perfectcorp.com/, not yet called. **[called]** = verified by a real call (none yet).
Docs read on 11 Oct 2026 (Introduction v1.16). Sections 1 to 7 below are still docs-derived; this results section wins wherever they disagree.

## Gate 0 results (verified by call, 11 Oct 2026)
Test input: one AI-generated portrait (667x1000 JPEG, 158 KB), not a real person. Units used: 21.
- [called] Key works on `https://yce-api-01.makeupar.com` (key created on the yce.makeupar.com console). No region issue.
- [called] `GET /s2s/v1.0/client/credit` returns `results[]` of pots `{type:"ApiPaygToken", amount, expiry(ms epoch)}`; total balance is the sum. Observed 1000 -> 980 -> 979 (earliest-expiring pot is charged first). A second 40-unit pot with a later expiry appeared between runs; source unknown.
- [called] `GET /s2s/v2.0/credit/feature-cost` is free but page 1 did not list skin-tone or makeup-vto; measure costs by balance delta instead.
- [called] File API + PUT: works with `image/jpeg`. Upload host is `yce-us.s3-accelerate.amazonaws.com` (US region), path contains `ttl30`. PUT took 1.7 s.
- [called] skin-tone-analysis: body `{src_file_id}` accepted. **20 units.** Create 0.4 s, finished within 6.5 s total polling. Result: `data.results.color` = skin_color, eye_color (+ name), lip_color, eyebrow_color, hair_color (+ name). Also `data.results.face_quality` = `{has_face, area, frontal, lighting, faceangle}`, each categorical ("good" here), not in the reference page. `data.error` is null. **No undertone, no numeric confidence.**
- [called] makeup-vto: body `{src_file_id, effects:[skin_smooth 0/0, foundation palette], version:"1.0"}` accepted. **1 unit.** Finished in 4.3 s. Result is an object: `data.results.url` (the docs' array schema did not apply). 667x1000 accepted.
- Not yet checked: visual quality of the foundation preview; behaviour on real phone photos, deeper skin tones, poor light; error responses and whether failed tasks cost units; max image size for makeup-vto.

## 1. Server, auth, regions
- [docs] Single documented API server: `https://yce-api-01.makeupar.com`
- [docs] Auth: `Authorization: Bearer <API_KEY>`; keys are created in the console (`yce.makeupar.com/api-console/en/api-keys/`).
- [docs] The docs header links to `yce.perfectcorp.com/ai-api`; the quick start links to `yce.makeupar.com`. **UNKNOWN:** whether an India-portal key works against `yce-api-01.makeupar.com` or needs another base URL. Resolve with one balance call.

## 2. Common flow (all tasks)
1. [docs] `POST /s2s/v2.0/file` body `{"files":[{"content_type","file_name","file_size"}]}` -> `data.files[0].file_id` + `requests[0].url` (pre-signed PUT, with required headers).
2. [docs] `PUT` the bytes to that URL (same Content-Type/Content-Length). Skipping this gives 500 `unknown_internal_error` or 404 later.
3. [docs] `POST /s2s/v2.0/task/<feature>` with `src_file_id` (or a public URL field) -> `data.task_id`.
4. [docs] `GET /s2s/v2.0/task/<feature>/<task_id>` until `task_status` is `success` or `error`. While `running`, no units are consumed.
5. [docs] Units are consumed only on `success`. Errors (query or engine) consume nothing.
6. [docs] Polling is mandatory within the retention period; an unpolled task times out even if processed (units still consumed) and later returns `InvalidTaskId` / `TaskTimeout`.
- [docs] Rate limit: 250 requests / 300 s per IP **and** 250 / 300 s per token; both must pass; 429 on breach; recommended ~5 QPS. Our server's egress IP is shared by all visitors.
- [docs] Retention: uploaded files and `file_id` kept 30 days; `task_id` valid 30 days; result download URL valid 2 hours; all uploaded and generated media auto-removed after 30 days.
- [docs] File API reference lists only "create"; **no delete endpoint documented**.

## 3. Candidate endpoints

### 3.1 AI Facial Color Tones Analyzer V1.0 (skin tone)
- [docs] `POST /s2s/v2.0/task/skin-tone-analysis`, poll `GET /s2s/v2.0/task/skin-tone-analysis/<task_id>`
- [docs] Cost: **20 units**
- [docs] Input: jpg/jpeg/png, < 10 MB, min 320 px, long side <= 4096, single person; images over 1080 px on a side are resized for analysis. Face width must exceed 60% of image width, face forward and centred.
- [docs] Optional `face_angle_strictness_level`: strict | high | medium | low | flexible (default high).
- [docs] Output `data.results.color`: `skin_color` (hex), `eye_color` (hex) + `eye_color_name`, `lip_color`, `eyebrow_color`, `hair_color` (hex) + `hair_color_name`.
- [docs] **No undertone field and no confidence field are documented.** Skin colour is a single hex.
- [docs] Errors: `error_below_min_image_size`, `error_face_position_invalid`, `error_face_position_too_small`, `error_face_position_out_of_boundary`, `error_face_not_forward_facing`, `error_face_angle_{upward,downward,leftward,rightward,left_tilt,right_tilt}`.
- [docs] No lighting error code is listed for this endpoint.

### 3.2 AI Makeup Virtual Try-On V1.0 (includes foundation + concealer)
- [docs] `POST /s2s/v2.0/task/makeup-vto`, poll `GET /s2s/v2.0/task/makeup-vto/<task_id>`
- [docs] Cost: **1 unit**
- [docs] Body: `{"src_file_url" | file id, "effects":[...], "version":"1.0"}`. The example uses `src_file_url`; the text says "URL or File ID". **UNKNOWN:** exact field name for a File API id (probably `src_file_id` as in skin analysis). Verify by call.
- [docs] `foundation` effect: `palettes:[{color:"#RRGGBB", colorIntensity, glowIntensity, coverageIntensity}]` (ints 0..100). `concealer` also exists.
- [docs] `skin_smooth` defaults to 50 unless included; set `skinSmoothStrength` and `skinSmoothColorIntensity` to 0 for no smoothing. Matters for an honest shade preview.
- [docs] Input: jpg/jpeg/png, < 10 MB, face width >= 100 px, min 100x100. **Docs conflict:** table says long side < 1920; error text says width < 1920 and height < 1080. Verify by call.
- [docs] Errors: `error_below_min_image_size`, `error_exceed_max_image_size`, `error_face_position_invalid`, `error_face_position_too_small`, `error_face_position_out_of_boundary`, `error_face_angle_invalid` (front-facing: within 10 deg).
- [docs] **Response shape conflict:** schema shows `results: [{download_url}]`, the example shows `results: {url}`. Normalizer must handle or reject; verify by call.

### 3.3 AI Skin Analysis (v2.0 / v2.1), for reference only
- [docs] `POST /s2s/v2.0/task/skin-analysis`; returns concern scores and masks (wrinkle, pore, texture, acne, redness, etc.), `skin_age`. No tone or undertone output documented. Not planned for this product (cosmetic scores/age are outside the brief). Unit cost not yet read.

### 3.4 Clothes / jewellery try-on (secondary vertical)
- [docs] Exist in the reference (AI Clothes, Hat, Scarf, Bag, Shoes, Fabric, Ring, Bracelet, Watch, Earrings, Necklace). **Not read yet**; read only if the primary vertical fails.

## 4. Unit and balance endpoints
- [docs] `GET /s2s/v1.0/client/credit` (balance), `GET /s2s/v1.0/client/credit/history`, `GET /s2s/v2.0/credit/feature-cost` (paged; per-feature costs). Whether these cost units: **UNKNOWN**, presumably not.

## 5. Client-side capture kit (optional)
- [docs] JS Camera Kit v2.5: `https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js`, global `YMK`, mandatory `<div id="YMK-module">`, mode `shadefinder` for skin tone. Presets relaxed/moderate/strict with lighting thresholds (relaxed 0.55 to 0.8) and pose limits.
- Fit concerns (design, not docs): global mount id and global object fit poorly with a shadow-DOM widget; its lighting thresholds are not documented as tone-calibrated, so fairness is **UNKNOWN** and must be tested before use.

## 6. Cost model (arithmetic on docs numbers; unverified)
- 1 full session = 20 (tone) + up to 3 x 1 (try-on) = **23 units max**; with one preview, 21.
- 1,000 units - 250 reserve = 750 usable, minus development and Gate 0 testing. At 23 units/session that is about 32 sessions before any testing spend, so live judge usage must fall back to recorded sample mode quickly.

## 7. Open questions to settle by real call
1. Does the key work on `yce-api-01.makeupar.com`? Starting balance?
2. Actual unit cost of skin-tone and makeup-vto (balance before/after).
3. makeup-vto: File ID field name, result shape, size limits, effect of `skin_smooth: 0`.
4. skin-tone-analysis: latency, behaviour on dark/uneven lighting, any hidden confidence or undertone fields in the real response.
5. Does a 429 or error consume units? Does feature-cost / credit call cost units?
