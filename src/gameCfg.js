'use strict';
/** Helper that adds/removes the line that switches on the game's telemetry server in user.cfg (with a backup). */
const fs = require('fs');
const path = require('path');

const VARIANTS = { dotted: 'server.game.telemetry.enabled', hyphen: 'server-game-telemetry-enabled' };
const ALL = Object.values(VARIANTS);
// Telemetry first shipped in the 5.0 PTU, so look in PTU folders as well as LIVE.
const ROOTS = ['C:\\Program Files\\Roberts Space Industries\\StarCitizen', 'D:\\Roberts Space Industries\\StarCitizen', 'C:\\Games\\StarCitizen', 'D:\\StarCitizen'];
const CHANNELS = ['LIVE', 'PTU', 'EPTU', 'TECH-PREVIEW'];

/** Every game channel folder that exists on this PC (LIVE, PTU ...). */
function detectGameDirs(exists = fs.existsSync) {
  const out = [];
  for (const r of ROOTS) for (const c of CHANNELS) { const d = path.join(r, c); if (exists(d)) out.push(d); }
  return out;
}
function detectGameDir(exists = fs.existsSync) { return detectGameDirs(exists)[0] || null; }
const lineKey = (l) => l.split(/[=\s]/)[0].trim().toLowerCase();

function status(dir) {
  const f = path.join(dir, 'user.cfg'); if (!fs.existsSync(f)) return { exists: false, enabled: false };
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const hit = lines.find((l) => ALL.includes(lineKey(l)) && !l.trim().startsWith('--') && !l.trim().startsWith(';'));
  return { exists: true, enabled: !!hit && /[=\s]\s*1\s*$/.test(hit.trim()), line: hit || null };
}
function setEnabled(dir, enabled, variant = 'dotted') {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error('That folder does not exist.');
  const f = path.join(dir, 'user.cfg'); let text = '';
  if (fs.existsSync(f)) { text = fs.readFileSync(f, 'utf8'); fs.writeFileSync(f + '.stellarock-backup-' + Date.now(), text); }
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const kept = text.split(/\r?\n/).filter((l) => !ALL.includes(lineKey(l)));
  while (kept.length && kept[kept.length - 1] === '') kept.pop();
  if (enabled) kept.push(VARIANTS[variant] ? VARIANTS[variant] + ' = 1' : VARIANTS.dotted + ' = 1');
  fs.writeFileSync(f, kept.join(eol) + eol);
  return status(dir);
}
module.exports = { status, setEnabled, detectGameDir, detectGameDirs, VARIANTS };
