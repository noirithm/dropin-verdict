// Gate 0 smoke test for the YouCam API. Standalone, no dependencies, Node >= 20.6.
//
// Free calls only (balance, feature costs):
//   node --env-file=.env scripts/gate0/smoke.mjs
// Paid calls too (skin tone = 20 units, makeup try-on = 1 unit by the docs):
//   node --env-file=.env scripts/gate0/smoke.mjs photos/test.jpg --yes
// Only one paid step:
//   ... --yes --only=tone     or     ... --yes --only=vto
//
// Saves REDACTED responses to scripts/gate0/out/ (gitignored). Never prints the key.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.YOUCAM_API_BASE || 'https://yce-api-01.makeupar.com';
const KEY = process.env.YOUCAM_API_KEY;
const args = process.argv.slice(2);
const photoPath = args.find((a) => !a.startsWith('--')) || 'photos/test.jpg';
const SPEND = args.includes('--yes');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const OUT = 'scripts/gate0/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!KEY) {
  console.error('YOUCAM_API_KEY is empty. Fill .env and run with: node --env-file=.env ...');
  process.exit(1);
}

function redact(v) {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redact(x)]));
  }
  if (typeof v === 'string') {
    if (/^https?:\/\//.test(v)) {
      try {
        const u = new URL(v);
        return `${u.origin}${u.pathname.replace(/[^/]+$/, '<file>')}?<redacted>`;
      } catch {
        return '<url>';
      }
    }
    if (v.length > 40 && /^[A-Za-z0-9+/_=-]+$/.test(v)) return '<id-redacted>';
  }
  return v;
}

async function save(name, obj) {
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, `${name}.redacted.json`), JSON.stringify(redact(obj), null, 2));
}

async function api(method, p, body) {
  const t0 = performance.now();
  const res = await fetch(BASE + p, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _nonJson: text.slice(0, 300) };
  }
  return { status: res.status, ms: Math.round(performance.now() - t0), json };
}

function show(label, r) {
  console.log(`\n== ${label} -> HTTP ${r.status} in ${r.ms} ms`);
  console.log(JSON.stringify(redact(r.json), null, 2));
}

function imageInfo(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
        return { type: 'image/jpeg', ext: 'jpg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return { type: 'image/jpeg', ext: 'jpg' };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { type: 'image/png', ext: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  throw new Error('Photo must be a real JPEG or PNG');
}

async function poll(feature, id, maxMs = 120000) {
  const t0 = performance.now();
  let delay = 1000;
  let last;
  while (performance.now() - t0 < maxMs) {
    last = await api('GET', `/s2s/v2.0/task/${feature}/${id}`);
    const st = last.json?.data?.task_status;
    if (st === 'success' || st === 'error' || last.status >= 400) break;
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), 5000);
  }
  return { ...last, totalMs: Math.round(performance.now() - t0) };
}

async function balance(label) {
  const r = await api('GET', '/s2s/v1.0/client/credit');
  show(`balance (${label})`, r);
  await save(`balance-${label}`, r.json);
  return r;
}

async function uploadPhoto() {
  const buf = await readFile(photoPath);
  const info = imageInfo(buf);
  console.log(`\nPhoto: ${info.type}, ${info.w ?? '?'}x${info.h ?? '?'}, ${buf.length} bytes`);
  if (info.w && Math.max(info.w, info.h) >= 1080) {
    console.log('NOTE: makeup-vto docs conflict on max size (long side < 1920, or height < 1080). If it fails on size, resize to a long side of about 1000 and rerun with --only=vto.');
  }
  const reg = await api('POST', '/s2s/v2.0/file', {
    files: [{ content_type: info.type, file_name: `test.${info.ext}`, file_size: buf.length }],
  });
  show('file register', reg);
  await save('file-register', reg.json);
  const f = reg.json?.data?.files?.[0];
  const req = f?.requests?.[0];
  if (!f?.file_id || !req?.url) throw new Error('File API did not return file_id and upload url');
  const t0 = performance.now();
  const put = await fetch(req.url, { method: req.method || 'PUT', headers: { 'Content-Type': info.type }, body: buf });
  console.log(`\n== upload PUT -> HTTP ${put.status} in ${Math.round(performance.now() - t0)} ms`);
  if (!put.ok) throw new Error(`Upload failed with HTTP ${put.status}`);
  return f.file_id;
}

// ---- run ----
console.log(`Base URL: ${BASE}`);
await balance('before');
const costs = await api('GET', '/s2s/v2.0/credit/feature-cost?page_size=20');
show('feature-cost (page 1)', costs);
await save('feature-cost', costs.json);

if (!SPEND) {
  console.log('\nFree calls done. Nothing spent. Add --yes to run the paid calls.');
  process.exit(0);
}

const fileId = await uploadPhoto();

if (!ONLY || ONLY === 'tone') {
  const create = await api('POST', '/s2s/v2.0/task/skin-tone-analysis', { src_file_id: fileId });
  show('skin-tone create', create);
  const taskId = create.json?.data?.task_id;
  if (taskId) {
    const done = await poll('skin-tone-analysis', taskId);
    show(`skin-tone result (total ${done.totalMs} ms)`, done);
    await save('skin-tone-result', done.json);
    await balance('after-tone');
  } else {
    await save('skin-tone-create-error', create.json);
  }
}

if (!ONLY || ONLY === 'vto') {
  const body = {
    src_file_id: fileId, // field name is UNVERIFIED in the docs; a 400 here costs nothing
    effects: [
      { category: 'skin_smooth', skinSmoothStrength: 0, skinSmoothColorIntensity: 0 },
      { category: 'foundation', palettes: [{ color: '#B88F76', colorIntensity: 60, glowIntensity: 30, coverageIntensity: 50 }] },
    ],
    version: '1.0',
  };
  const create = await api('POST', '/s2s/v2.0/task/makeup-vto', body);
  show('makeup-vto create', create);
  const taskId = create.json?.data?.task_id;
  if (taskId) {
    const done = await poll('makeup-vto', taskId);
    show(`makeup-vto result (total ${done.totalMs} ms)`, done);
    await save('makeup-vto-result', done.json);
    await balance('after-vto');
  } else {
    await save('makeup-vto-create-error', create.json);
  }
}

console.log('\nDone. Compare the balance-*.redacted.json files in scripts/gate0/out/ to get the real unit cost of each step.');
