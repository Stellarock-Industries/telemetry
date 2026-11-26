'use strict';
// All DOM is built with textContent / createElement - data from the game is never parsed as HTML.
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
const num = (v, d = 1) => (typeof v === 'number' ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString() : String(v));
const label = (k) => String(k).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const PREF_LABELS = { share_online: 'Show me online', share_ship: 'Ship I am flying', share_crew: 'Seat / crew role', share_vitals: 'Vitals & environment', share_flight: 'Flight data & weapons', share_uec: 'aUEC balance' };
let prefs = null;

let orgTimer = null;
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
  ['dash', 'org', 'setup'].forEach((id) => { $(id).hidden = b.dataset.tab !== id; });
  clearInterval(orgTimer); if (b.dataset.tab === 'org') { loadOrg(); orgTimer = setInterval(loadOrg, 5000); }   // only talk to the site while the tab is open
}));

// ---- Org tab: who is online, as each member allows ----
const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
function memberCard(m, mine) {
  const v = m.view || {}, c = el('div', 'card member' + (m.key && m.key === mine ? ' with-me' : ''));
  const head = el('div', 'mhead'); head.appendChild(el('span', 'avatar', initials(m.name)));
  const t = el('div', 'mtitle'); const n = el('div', 'mname'); n.appendChild(el('span', 'dot')); n.appendChild(document.createTextNode(m.name + (m.me ? ' (you)' : ''))); t.appendChild(n); t.appendChild(el('div', 'muted small', m.rank || '')); head.appendChild(t); c.appendChild(head);
  const bits = []; if (v.ship && v.ship.name) bits.push(v.ship.name); if (v.crew) { const r = v.crew.seat_role || (v.crew.loco ? label(v.crew.loco) : ''); if (r) bits.push(r); }
  if (bits.length) c.appendChild(el('div', 'mline', bits.join(' · '))); else if (!v.ship) c.appendChild(el('div', 'muted small', 'Ship not shared'));
  if (v.vitals) {
    const vv = v.vitals, g = el('div', 'dial-grid cols4'); let d;
    ['health', 'oxygen', 'hunger', 'thirst'].forEach((k) => { if ((d = dial({ value: vv[k], label: label(k), unit: '%', decimals: 0, cls: vitalClass(vv[k]), mini: true }))) g.appendChild(d); });
    if (g.children.length) c.appendChild(g);
    const extra = []; if (typeof vv.heart_rate === 'number') extra.push('♥ ' + num(vv.heart_rate, 0) + ' bpm'); if (typeof vv.body_temp === 'number') extra.push(num(vv.body_temp, 1) + ' °C'); if (typeof vv.intox === 'number' && vv.intox > 0) extra.push('intoxicated'); if (typeof vv.radiation === 'number' && vv.radiation > 0.05) extra.push('radiation ' + num(vv.radiation, 2));
    if (extra.length) c.appendChild(el('div', 'mline small', extra.join(' · ')));
  } else c.appendChild(el('div', 'muted small', 'Vitals not shared'));
  const fl = v.flight && v.flight.flight; const bits2 = [];
  if (fl && typeof fl.speed === 'number') bits2.push(num(fl.speed, 0) + ' m/s'); if (v.flight && v.flight.landed === true) bits2.push('landed'); if (typeof v.uec === 'number') bits2.push(num(v.uec, 0) + ' aUEC');
  if (bits2.length) c.appendChild(el('div', 'mline small gold', bits2.join(' · ')));
  return c;
}
async function loadOrg() {
  const r = await window.sct.roster(), msg = $('org-msg');
  if (!r.ok) { msg.hidden = false; msg.textContent = 'Could not load the org list: ' + r.error + (/https|token/i.test(r.error) ? ' — check Setup.' : ''); return; }
  msg.hidden = true; const grid = $('org-grid'); grid.textContent = '';
  r.members.forEach((m) => grid.appendChild(memberCard(m, r.myKey)));
  if (!r.members.length) grid.appendChild(el('div', 'muted', 'Nobody is sharing right now.'));
  const oc = $('orgCount'); oc.hidden = !r.members.length; oc.textContent = r.members.length;
  const sg = $('org-ship-grid'); sg.textContent = ''; $('org-ships').hidden = !r.ships.length;
  const byId = {}; r.members.forEach((m) => { byId[m.id] = m; });
  r.ships.forEach((s) => {
    const c = el('div', 'card' + (s.with_me ? ' with-me' : '')); const h = el('div', 'mhead');
    const t = el('div', 'mtitle'); t.appendChild(el('div', 'mname', (s.ship && s.ship.name) || 'Unknown ship')); t.appendChild(el('div', 'muted small', [s.ship && s.ship.manufacturer, s.ship && s.ship.type].filter(Boolean).join(' · '))); h.appendChild(t);
    if (s.with_me) h.appendChild(el('span', 'badge', 'Your ship')); c.appendChild(h);
    s.ids.forEach((id) => { const m = byId[id]; if (!m) return; const row = el('dl'); row.appendChild(el('dt', '', m.name + (m.me ? ' (you)' : ''))); row.appendChild(el('dd', '', (m.view.crew && (m.view.crew.seat_role || m.view.crew.seat_name)) || '')); c.appendChild(row); });
    sg.appendChild(c);
  });
}

function say(id, text, ok) { const m = $(id); m.textContent = text || ''; m.className = 'msg ' + (ok ? 'ok' : 'bad'); }

function renderStatus(s) {
  const g = $('pill-game'); g.textContent = 'Game: ' + (s.game.game === 'connected' ? 'connected' : s.game.game === 'schema' ? 'schema missing' : 'waiting'); g.className = 'pill ' + (s.game.game === 'connected' ? 'ok' : s.game.game === 'schema' ? 'bad' : '');
  g.title = s.game.text || '';
  const w = $('pill-site'); w.textContent = 'Site: ' + (s.site.text || ''); w.className = 'pill ' + (s.site.ok ? 'ok' : s.site.fatal ? 'bad' : ''); w.title = s.site.text || '';
  if (s.prefs) { prefs = s.prefs; renderPrefs(); }
  const n = $('dash-empty');
  if (s.game.game === 'schema') { n.hidden = false; n.textContent = 'The game schema files are missing. Open Setup → “Download schema” (or put api.proto and types.proto in the schema folder).'; }
  else if (s.game.game !== 'connected') { n.hidden = false; n.textContent = 'Waiting for Star Citizen. Start the game with telemetry enabled (Setup → step 3), then log in to the Persistent Universe.'; }
  else n.hidden = true;
}
function renderPrefs() {
  const box = $('prefs'); box.textContent = '';
  Object.keys(PREF_LABELS).forEach((k) => {
    const l = el('label', 'check'); const c = el('input'); c.type = 'checkbox'; c.dataset.key = k; c.checked = !!(prefs && prefs[k]); l.appendChild(c); l.appendChild(document.createTextNode(PREF_LABELS[k])); box.appendChild(l);
  });
}

  /* ---- dials & lungs (SVG, built with DOM calls; colours come from CSS classes) ---- */
var SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, cls) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (cls) e.setAttribute('class', cls); return e; }
function polar(deg) { var r = deg * Math.PI / 180; return [50 + 40 * Math.cos(r), 50 + 40 * Math.sin(r)]; }
function arc(from, to) { var a = polar(from), b = polar(to); return 'M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + ' A40 40 0 ' + (to - from > 180 ? 1 : 0) + ' 1 ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2); }
function niceMax(v) { var c = [1, 2, 5, 10, 20, 50, 100, 150, 200, 500, 1000, 2000, 5000, 10000, 100000]; for (var i = 0; i < c.length; i++) if (c[i] >= v * 1.2) return c[i]; return Math.ceil(v * 1.2); }
function vitalClass(v) { return v < 25 ? 'dial-bad' : v < 50 ? 'dial-warn' : 'dial-gold'; }
function tempZone(t) { return t <= -20 ? ['dial-cold', 'Freezing'] : t < 5 ? ['dial-cool', 'Cold'] : t <= 35 ? ['dial-ok', 'Comfortable'] : t <= 60 ? ['dial-warn', 'Hot'] : ['dial-bad', 'Scorching']; }
function icon(name, cls) {
  var g = svg('g', { transform: 'translate(41 14) scale(0.75)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, 'dial-ico ' + (cls || 'dial-gold') + (name === 'radiation' ? ' fill' : ''));
  if (name === 'thermo') { g.appendChild(svg('path', { d: 'M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z' })); g.appendChild(svg('path', { d: 'M12 9v7' })); }
  else if (name === 'heart') g.appendChild(svg('path', { d: 'M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.8 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11z' }));
  else if (name === 'cocktail') { g.appendChild(svg('path', { d: 'M4 5h16l-8 9z' })); g.appendChild(svg('path', { d: 'M12 14v6M8 20h8' })); }
  else if (name === 'radiation') {
    [-90, 30, 150].forEach(function (a) { var p = function (r, d) { var t = d * Math.PI / 180; return (12 + r * Math.cos(t)).toFixed(2) + ' ' + (12 + r * Math.sin(t)).toFixed(2); };
      g.appendChild(svg('path', { d: 'M' + p(3.6, a - 30) + ' L' + p(10, a - 30) + ' A10 10 0 0 1 ' + p(10, a + 30) + ' L' + p(3.6, a + 30) + ' A3.6 3.6 0 0 0 ' + p(3.6, a - 30) + ' Z', 'stroke-width': 1 })); });
    g.appendChild(svg('circle', { cx: 12, cy: 12, r: 2, 'stroke-width': 1 }));
  }
  return g;
}
/** o: { value, min, max, label, unit, decimals, cls, sub, icon } -> a dial with the number in the centre (and an icon above it) */
function dial(o) {
  if (typeof o.value !== 'number' || !isFinite(o.value)) return null;
  var min = o.min || 0, max = o.max || 100, f = Math.max(0, Math.min(1, (o.value - min) / ((max - min) || 1)));
  var wrap = el('div', 'dial' + (o.mini ? ' dial-mini' : '')), s = svg('svg', { viewBox: '0 0 100 86', role: 'img', 'aria-label': o.label + ' ' + num(o.value, o.decimals || 0) + (o.unit ? ' ' + o.unit : '') + (o.sub ? ', ' + o.sub : '') });
  s.appendChild(svg('path', { d: arc(135, 405), fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round' }, 'dial-track'));
  if (f > 0.004) s.appendChild(svg('path', { d: arc(135, 135 + 270 * f), fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round' }, 'dial-arc ' + (o.cls || 'dial-gold')));
  if (o.icon) s.appendChild(icon(o.icon, o.cls));
  var t = svg('text', { x: 50, y: o.icon ? 56 : (o.unit ? 49 : 54), 'text-anchor': 'middle' }, 'dial-num'); t.textContent = num(o.value, o.decimals || 0); s.appendChild(t);
  if (o.unit) { var u = svg('text', { x: 50, y: o.icon ? 68 : 63, 'text-anchor': 'middle' }, 'dial-unit'); u.textContent = o.unit; s.appendChild(u); }
  wrap.appendChild(s); wrap.appendChild(el('div', 'dial-label', o.label)); if (o.sub) wrap.appendChild(el('div', 'dial-sub ' + (o.cls || ''), o.sub));
  return wrap;
}
// zones: [css class, word]. Thresholds are sensible guesses - the game's own scales for intoxication and radiation are undocumented.
function bodyTempZone(t) { return t < 33 ? ['dial-cold', 'Hypothermic'] : t < 35.5 ? ['dial-cool', 'Chilly'] : t <= 37.5 ? ['dial-ok', 'Normal'] : t <= 39 ? ['dial-warn', 'Fever'] : ['dial-bad', 'Dangerous']; }
function heartZone(v) { return v < 50 ? ['dial-cool', 'Low'] : v <= 100 ? ['dial-ok', 'Normal'] : v <= 140 ? ['dial-warn', 'Elevated'] : ['dial-bad', 'Racing']; }
function intoxZone(v) { return v <= 0 ? ['dial-ok', 'Sober'] : v <= 2 ? ['dial-warn', 'Tipsy'] : ['dial-bad', 'Drunk']; }
function radZone(v) { return v <= 0.05 ? ['dial-ok', 'Clear'] : v < 1 ? ['dial-warn', 'Elevated'] : ['dial-bad', 'Dangerous']; }
/** The four "body" dials with their icons, from a vitals object. Returns an array of dial elements (missing values are skipped). */
function bodyDials(v, mini) {
  var out = [], d, z;
  if (typeof v.body_temp === 'number') { z = bodyTempZone(v.body_temp); out.push(dial({ value: v.body_temp, min: 28, max: 44, label: 'Body temp', unit: '°C', decimals: 1, cls: z[0], sub: z[1], icon: 'thermo', mini: mini })); }
  if (typeof v.heart_rate === 'number') { z = heartZone(v.heart_rate); out.push(dial({ value: v.heart_rate, min: 30, max: 200, label: 'Heart rate', unit: 'bpm', decimals: 0, cls: z[0], sub: z[1], icon: 'heart', mini: mini })); }
  if (typeof v.intox === 'number') { z = intoxZone(v.intox); out.push(dial({ value: v.intox, min: 0, max: niceMax(Math.max(v.intox, 4)), label: 'Intoxication', decimals: 0, cls: z[0], sub: z[1], icon: 'cocktail', mini: mini })); }
  if (typeof v.radiation === 'number') { z = radZone(v.radiation); out.push(dial({ value: v.radiation, min: 0, max: niceMax(Math.max(v.radiation, 2)), label: 'Radiation', decimals: 2, cls: z[0], sub: z[1], icon: 'radiation', mini: mini })); }
  return out;
}

function lungs(breathable) {
  var cls = breathable === true ? 'lungs-ok' : breathable === false ? 'lungs-bad' : 'lungs-na';
  var wrap = el('div', 'dial lungs ' + cls), s = svg('svg', { viewBox: '0 0 64 64', role: 'img', 'aria-label': breathable === true ? 'Air is breathable' : breathable === false ? 'Air is not breathable' : 'Air unknown' });
  s.appendChild(svg('path', { d: 'M32 5 V27', fill: 'none', 'stroke-width': 4, 'stroke-linecap': 'round' }, 'lungs-line'));
  s.appendChild(svg('path', { d: 'M32 27 L26 34 M32 27 L38 34', fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round' }, 'lungs-line'));
  s.appendChild(svg('path', { d: 'M27 26 C18 24 6 36 6 51 C6 59 13 61 19 58 C25 55 27 48 27 40 Z' }, 'lungs-lobe'));
  s.appendChild(svg('path', { d: 'M37 26 C46 24 58 36 58 51 C58 59 51 61 45 58 C39 55 37 48 37 40 Z' }, 'lungs-lobe'));
  wrap.appendChild(s); wrap.appendChild(el('div', 'dial-label', 'Breathable air')); wrap.appendChild(el('div', 'dial-sub', breathable === true ? 'Safe to breathe' : breathable === false ? 'NOT breathable' : 'Unknown'));
  return wrap;
}

// ---- dashboard cards ----
function card(title) { const c = el('div', 'card'); c.appendChild(el('h3', '', title)); return c; }
function kv(c, rows) { const dl = el('dl'); rows.forEach(([k, v]) => { if (v === undefined || v === null || v === '') return; dl.appendChild(el('dt', '', k)); dl.appendChild(el('dd', '', typeof v === 'number' ? num(v, 2) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v))); }); if (!dl.children.length) return false; c.appendChild(dl); return true; }
function chips(c, map) { const w = el('div', 'chips'); Object.entries(map || {}).forEach(([k, v]) => { const bad = typeof v === 'string' && /^(MAJOR|MINOR)/.test(v); const on = v === true || v === 'NOMINAL' || v === 'ACTIVE' || v === 'ENABLED' || (typeof v === 'number' && v > 0); w.appendChild(el('span', 'chip ' + (bad ? 'bad' : on ? 'on' : ''), label(k) + (typeof v === 'boolean' ? '' : ': ' + (typeof v === 'number' ? num(v) : label(v))))); }); if (!w.children.length) return false; c.appendChild(w); return true; }

function renderDash({ state, events }) {
  const grid = $('dash-grid'); grid.textContent = '';
  const a = state.actor || {}, s = state.ship || {}, f = s.flight || {}, w = state.weapons || {}, v = a.vitals || {}, en = a.env || {};
  let c, add = (x, ok) => { if (ok !== false) grid.appendChild(x); };
  c = card('Player'); add(c, kv(c, [['Movement', a.loco && label(a.loco)], ['Seat', a.seat_name], ['Role', a.seat_role], ['aUEC', a.uec]]));
  c = card('Vitals'); const vg = el('div', 'dial-grid');
  ['health', 'oxygen', 'hunger', 'thirst'].forEach((k) => { const d = dial({ value: v[k], label: label(k), unit: '%', decimals: 0, cls: vitalClass(v[k]) }); if (d) vg.appendChild(d); });
  if (vg.children.length) c.appendChild(vg); const bd = bodyDials(v); if (bd.length) { const bg = el('div', 'dial-grid cols4'); bd.forEach((x) => bg.appendChild(x)); c.appendChild(bg); } c.classList.add('span2'); vg.classList.add('cols4'); add(c, c.children.length > 1);
  c = card('Environment'); const eg = el('div', 'dial-grid'); let d;
  if ((d = dial({ value: en.gravity, min: 0, max: 20, label: 'Gravity', unit: 'm/s²', decimals: 1 }))) eg.appendChild(d);
  if ((d = dial({ value: en.pressure, min: 0, max: niceMax(en.pressure || 0), label: 'Pressure', decimals: 1 }))) eg.appendChild(d);
  if (typeof en.outside_temp === 'number') { const z = tempZone(en.outside_temp); eg.appendChild(dial({ value: en.outside_temp, min: -100, max: 100, label: 'Outside temp', unit: '°C', decimals: 0, cls: z[0], sub: z[1] })); }
  if (typeof en.breathable === 'boolean') eg.appendChild(lungs(en.breathable));
  if (eg.children.length) c.appendChild(eg); add(c, eg.children.length > 0);
  c = card('Ship'); add(c, kv(c, [['Name', s.name], ['Class', s.class], ['Manufacturer', s.manufacturer], ['Type', s.type], ['Hull %', s.hull], ['Shields', s.shields], ['Master mode', s.master_mode], ['Landed', s.landed], ['Gear', s.gear], ['VTOL', s.vtol], ['Lights', s.lights]]));
  c = card('Flight'); add(c, kv(c, [['Speed (m/s)', f.speed], ['Altitude', f.altitude], ['Radar altitude', f.radar_altitude], ['Vertical speed', f.vspeed], ['Heading', f.heading], ['G-force', f.gforce], ['Boost', f.boost], ['Hydrogen fuel', f.fuel_h2], ['Quantum fuel', f.fuel_qt], ['Air density', f.air_density]]));
  c = card('Power'); add(c, chips(c, s.power)); c = card('Warnings'); add(c, chips(c, s.warnings)); c = card('Flight assist'); add(c, chips(c, f.assist)); c = card('Doors'); add(c, chips(c, s.doors));
  c = card('Weapons'); let ok = kv(c, [['Fire preset', w.preset], ['Turret light amp', w.turret_amp]]);
  (w.items || []).forEach((it) => { const r = el('dl'); r.appendChild(el('dt', '', it.name)); r.appendChild(el('dd', '', it.ready ? 'ready' : it.powered ? 'powered' : 'off')); c.appendChild(r); ok = true; });
  if (chips(c, w.countermeasures)) ok = true; add(c, ok);
  c = card('Force feedback'); add(c, chips(c, state.ff));
  c = card('Recent events'); (events || []).slice(0, 10).forEach((e) => { const r = el('dl'); r.appendChild(el('dt', '', new Date(e.t).toLocaleTimeString())); r.appendChild(el('dd', '', label(e.kind) + (e.detail ? ' – ' + e.detail : ''))); c.appendChild(r); }); add(c, c.children.length > 1);
}

// ---- setup actions ----
async function refreshCfg() {
  const r = await window.sct.cfgStatus(); const sel = $('dirSel'); sel.textContent = '';
  (r.found || []).forEach((d) => { const o = el('option', '', d.split('\\').slice(-1)[0] + ' — ' + d); o.value = d; o.selected = d === r.dir; sel.appendChild(o); });
  sel.hidden = (r.found || []).length < 1;
  $('cfgState').textContent = !r.dir ? 'Game folder not found — click “Choose game folder” and pick your LIVE or PTU folder.' : r.dir + ' — ' + (r.status && r.status.enabled ? 'telemetry is ENABLED in user.cfg' : 'telemetry is not enabled');
}
$('dirSel').addEventListener('change', async () => { await window.sct.useGameDir($('dirSel').value); refreshCfg(); });
$('guideBtn').addEventListener('click', async () => { const r = await window.sct.openGuide(); if (!r.ok) { document.querySelector('[data-tab=setup]').click(); say('linkMsg', 'Enter your website address first, then the guide will open.', false); } });
function applySettings(s) {
  $('siteUrl').value = s.siteUrl; document.querySelectorAll('input[name=mode]').forEach((r) => { r.checked = r.value === s.mode; });
  $('tokenState').textContent = s.hasToken ? 'A token is saved on this PC.' : 'No token saved yet.'; if (!s.encryptionAvailable) $('tokenState').textContent += ' Secure storage is unavailable here, so the token is kept only in memory.';
}
$('saveLink').addEventListener('click', async () => {
  const url = $('siteUrl').value.trim(), tok = $('token').value.trim(); const mode = (document.querySelector('input[name=mode]:checked') || {}).value;
  let r = await window.sct.saveSettings({ siteUrl: url, mode }); if (!r.ok) return say('linkMsg', r.error, false);
  if (tok) { r = await window.sct.setToken(tok); if (!r.ok && !r.kept) return say('linkMsg', r.error, false); $('token').value = ''; if (r.settings) applySettings(r.settings); }
  r = await window.sct.testSite(); if (!r.ok) return say('linkMsg', r.error, false);
  prefs = r.prefs; renderPrefs(); say('linkMsg', 'Linked as ' + r.user, true); applySettings((await window.sct.info()).settings);
});
document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => window.sct.saveSettings({ mode: r.value })));
$('savePrefs').addEventListener('click', async () => {
  const p = {}; document.querySelectorAll('#prefs input').forEach((c) => { p[c.dataset.key] = c.checked; });
  const r = await window.sct.savePrefs(p); if (r.ok) { prefs = r.prefs; renderPrefs(); say('prefMsg', 'Saved', true); } else say('prefMsg', r.error, false);
});
$('dlSchema').addEventListener('click', async () => { say('schemaMsg', 'Downloading…', true); const r = await window.sct.downloadSchema(); say('schemaMsg', r.ok ? 'Schema installed (' + r.files + ' files).' : 'Download failed: ' + r.error + ' — copy the .proto files into the schema folder instead.', r.ok); });
$('openGuide').addEventListener('click', async () => { const x = await window.sct.openGuide(); say('guideMsg', x.ok ? '' : x.error, false); });
$('openSchema').addEventListener('click', () => window.sct.openSchemaFolder());
$('reloadSchema').addEventListener('click', async () => { await window.sct.reloadSchema(); say('schemaMsg', 'Reloaded', true); });
$('pickDir').addEventListener('click', async () => { await window.sct.pickGameDir(); refreshCfg(); });
$('cfgOn').addEventListener('click', async () => { const r = await window.sct.cfgSet(true); $('cfgState').textContent = r.ok ? 'Enabled. Restart Star Citizen for it to take effect.' : r.error; });
$('cfgOff').addEventListener('click', async () => { const r = await window.sct.cfgSet(false); $('cfgState').textContent = r.ok ? 'Disabled.' : r.error; });

window.sct.onStatus(renderStatus); window.sct.onState(renderDash);
window.sct.info().then((i) => { $('ver').textContent = 'v' + i.version; applySettings(i.settings); renderStatus(i.status); refreshCfg(); if (!i.settings.hasToken) document.querySelector('[data-tab=setup]').click(); });
