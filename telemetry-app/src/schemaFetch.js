'use strict';
/** Optional helper: downloads the community .proto files and saves them (only after they parse) into the schema folder. */
const https = require('https');
const fs = require('fs');
const path = require('path');
const protoLoader = require('@grpc/proto-loader');

const REPO = 'https://raw.githubusercontent.com/magmahindenburg/StarCitizenTelemetry/';
// The repo's layout is ambiguous (branch "proto" vs a proto/ folder on main), so try each in turn.
const BASES = ['main/proto/sc/game/telemetry/v1/', 'proto/sc/game/telemetry/v1/', 'proto/proto/sc/game/telemetry/v1/', 'main/sc/game/telemetry/v1/'].map((b) => REPO + b);
const FILES = ['api.proto', 'types.proto'];

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'raw.githubusercontent.com') return reject(new Error('Blocked URL'));
    https.get(u, { timeout: 10000, headers: { 'User-Agent': 'StellarockTelemetry' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' for ' + path.basename(u.pathname))); }
      const chunks = []; let n = 0;
      res.on('data', (c) => { n += c.length; if (n > 512 * 1024) res.destroy(new Error('file too large')); else chunks.push(c); });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}
async function download(schemaDir) {
  const dest = path.join(schemaDir, 'sc', 'game', 'telemetry', 'v1'); const texts = {};
  let lastErr;
  for (const base of BASES) {
    try { for (const f of FILES) texts[f] = await get(base + f); lastErr = null; break; } catch (e) { lastErr = e; }
  }
  if (lastErr) throw new Error(lastErr.message + ' (tried ' + BASES.length + ' locations)');
  // validate in a scratch folder first: a broken download must never replace a working schema
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'scschema-')); const tdest = path.join(tmp, 'sc', 'game', 'telemetry', 'v1'); fs.mkdirSync(tdest, { recursive: true });
  for (const f of FILES) fs.writeFileSync(path.join(tdest, f), texts[f]);
  try { protoLoader.loadSync(FILES.map((f) => 'sc/game/telemetry/v1/' + f), { includeDirs: [tmp] }); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  fs.mkdirSync(dest, { recursive: true });
  for (const f of FILES) fs.writeFileSync(path.join(dest, f), texts[f]);
  return FILES.length;
}
module.exports = { download };
