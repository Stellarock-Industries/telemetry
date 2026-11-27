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
  ['dash', 'org', 'events', 'setup'].forEach((id) => { $(id).hidden = b.dataset.tab !== id; });
  clearInterval(orgTimer); if (b.dataset.tab === 'org') { loadOrg(); orgTimer = setInterval(loadOrg, 5000); }   // only talk to the site while the tab is open
}));

// ---- Org tab: who is online, as each member allows ----
const T = window.TelUI;
const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
function memberCard(m, mine) {
  const v = m.view || {}, c = el('div', 'card member' + (m.key && m.key === mine ? ' with-me' : ''));
  const head = el('div', 'mhead'); head.appendChild(el('span', 'avatar', initials(m.name)));
  const t = el('div', 'mtitle'), n = el('div', 'mname'); n.appendChild(el('span', 'dot')); n.appendChild(document.createTextNode(m.name + (m.me ? ' (you)' : '')));
  t.appendChild(n); if (m.rank) { const rr = el('div', 'rankline'); rr.appendChild(T.rank(m.rank, m.rank_color)); t.appendChild(rr); }
  const ch = T.chips(m); if (ch) t.appendChild(ch);
  const hp = v.vitals && T.hpBar(v.vitals.health); if (hp) t.appendChild(hp);      // health as a bar under the name
  head.appendChild(t); c.appendChild(head); c.appendChild(T.memberBody(v));
  return c;
}
let orgLast = null;
function fillSel(sel, label, vals) { const cur = sel.value; sel.textContent = ''; const o = el('option', '', label); o.value = ''; sel.appendChild(o); vals.forEach((v) => { const x = el('option', '', v); x.value = v; sel.appendChild(x); }); sel.value = vals.includes(cur) ? cur : ''; }
const orgKeep = (m) => (!$('orgDiv').value || m.division === $('orgDiv').value) && (!$('orgTeam').value || (m.teams || []).includes($('orgTeam').value));
function webCard(m) {
  const c = el('div', 'card member web' + (m.me ? ' with-me' : '')), head = el('div', 'mhead'); head.appendChild(el('span', 'avatar', initials(m.name)));
  const t = el('div', 'mtitle'), n = el('div', 'mname'); n.appendChild(el('span', 'pdot site')); n.appendChild(document.createTextNode(m.name + (m.me ? ' (you)' : ''))); t.appendChild(n);
  const rr = el('div', 'rankline'); rr.appendChild(T.rank(m.rank, m.rank_color)); t.appendChild(rr); const ch = T.chips(m); if (ch) t.appendChild(ch);
  head.appendChild(t); c.appendChild(head); return c;
}
function renderOrg(r) {
  const all = r.members, members = all.filter(orgKeep), web = (r.web || []).filter(orgKeep);
  const grid = $('org-grid'); grid.textContent = '';
  members.forEach((m) => grid.appendChild(memberCard(m, r.myKey)));
  if (!members.length) grid.appendChild(el('div', 'muted', all.length ? 'Nobody matches this filter.' : 'Nobody is in game and sharing right now.'));
  const wg = $('org-web-grid'); wg.textContent = ''; web.forEach((m) => wg.appendChild(webCard(m))); $('org-web').hidden = !web.length;
  const oc = $('orgCount'), total = all.length + (r.web || []).length; oc.hidden = !total; oc.textContent = total;
  const sg = $('org-ship-grid'); sg.textContent = ''; $('org-ships').hidden = !r.ships.length;
  const byId = {}; all.forEach((m) => { byId[m.id] = m; });
  r.ships.forEach((s) => {
    const c = el('div', 'card ship-card' + (s.with_me ? ' with-me' : '')); const h = el('div', 'mhead');
    h.appendChild(T.shipHead(s.ship)); if (s.with_me) h.appendChild(el('span', 'badge', 'Your ship')); c.appendChild(h);
    const crew = el('div', 'crew'); s.ids.forEach((id) => { const m = byId[id]; if (!m) return; const cr = m.view.crew || {}; crew.appendChild(T.crewRow(m.name + (m.me ? ' (you)' : ''), cr.seat_role)); });
    if (crew.children.length) c.appendChild(crew);
    sg.appendChild(c);
  });
}
async function loadOrg() {
  const r = await window.sct.roster(), msg = $('org-msg');
  if (!r.ok) { msg.hidden = false; msg.textContent = 'Could not load the org list: ' + r.error + (/https|token/i.test(r.error) ? ' — check Setup.' : ''); return; }
  msg.hidden = true; orgLast = r;
  fillSel($('orgDiv'), 'All divisions', r.divisions || []); fillSel($('orgTeam'), 'All teams', (r.teams || []).map((t) => t.name));
  $('org-filters').hidden = !(r.divisions || []).length && !(r.teams || []).length;
  renderOrg(r);
}
$('orgDiv').addEventListener('change', () => orgLast && renderOrg(orgLast)); $('orgTeam').addEventListener('change', () => orgLast && renderOrg(orgLast));

function say(id, text, ok) { const m = $(id); m.textContent = text || ''; m.className = 'msg ' + (ok ? 'ok' : 'bad'); }

function renderMe(me) {
  const c = $('me-chip'); c.textContent = ''; if (!me || !me.name) { c.hidden = true; return; }
  c.hidden = false; c.appendChild(el('b', '', me.name)); if (me.rank) c.appendChild(T.rank(me.rank.name, me.rank.color));
  const extra = [me.division].concat(me.teams || []).filter(Boolean).join(' · '); if (extra) c.appendChild(el('span', '', extra));
  c.title = 'Rank, division and teams are set by the site, not by this app.' + (me.perms && me.perms.length ? ' Permissions: ' + me.perms.length : '');
}
function renderStatus(s) {
  const g = $('pill-game'); g.textContent = 'Game: ' + (s.game.game === 'connected' ? 'connected' : s.game.game === 'schema' ? 'schema missing' : 'waiting'); g.className = 'pill ' + (s.game.game === 'connected' ? 'ok' : s.game.game === 'schema' ? 'bad' : '');
  g.title = s.game.text || '';
  const w = $('pill-site'); w.textContent = 'Site: ' + (s.site.text || ''); w.className = 'pill ' + (s.site.ok ? 'ok' : s.site.fatal ? 'bad' : ''); w.title = s.site.text || '';
  if (s.prefs) { prefs = s.prefs; renderPrefs(); }
  renderMe(s.me);
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

// ---- dashboard ----
function card(title, icon) { const c = el('div', 'card'), h = el('h3'); if (icon) h.appendChild(T.ico(icon)); h.appendChild(document.createTextNode(title)); c.appendChild(h); return c; }
function renderDash({ state, events }) {
  const grid = $('dash-grid'), strip = $('dash-strip'); grid.textContent = ''; strip.textContent = '';
  const a = state.actor || {}, s = state.ship || {}, f = s.flight || {}, v = a.vitals || {};
  const add = (c, body) => { if (!body) return; c.appendChild(body); grid.appendChild(c); return c; };
  const ps = T.playerStrip(a); if (ps) { strip.appendChild(el('span', 'strip-cap', 'Current stance / position')); strip.appendChild(ps); }
  let c = card('Vitals', 'heart'); const vg = T.dialGrid(T.vitalDials(v), true), bg = T.dialGrid(T.bodyDials(v), true);
  if (vg) c.appendChild(vg); if (bg) c.appendChild(bg); if (vg || bg) { c.classList.add('span2'); grid.appendChild(c); }
  c = card('Environment', 'thermo'); const eg = T.dialGrid(T.envDials(a.env)); if (eg) { c.appendChild(eg); grid.appendChild(c); }
  if (state.ship) { c = card('Ship', 'ship'); c.classList.add('ship-card'); add(c, T.shipPanel(s)); }
  add(card('Flight', 'pilot'), T.flightPanel(f));
  add(card('Power', 'bolt'), T.ledList(s.power));
  add(card('Warnings', 'skull'), T.annunciators(s.warnings));
  add(card('Flight assist', 'crew'), T.toggles(f.assist));
  add(card('Weapons', 'gunner'), T.weaponPanel(state.weapons));
  add(card('Doors', 'enter'), T.doors(s.doors));
  add(card('Force feedback', 'refresh'), T.tags(state.ff));
  // events tab
  const list = (events || []).map((e) => ({ time: new Date(e.t).toLocaleTimeString(), kind: e.kind, detail: e.detail }));
  const box = $('events-list'); box.textContent = ''; if (list.length) box.appendChild(T.eventList(list)); $('events-empty').hidden = list.length > 0;
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

// ---- updates ----
function renderUpdate(u) {
  const bar = $('update-bar'), btn = $('update-btn'), t = $('update-text'); btn.hidden = true; btn.onclick = null;
  let text = '', show = true;
  if (u.state === 'ready') { text = 'Update v' + u.latest + ' is ready.'; btn.textContent = 'Restart & update'; btn.hidden = false; btn.onclick = () => window.sct.updateInstall(); }
  else if (u.state === 'downloading') text = 'Downloading update v' + u.latest + '… ' + u.percent + '%';
  else if (u.state === 'available') { text = 'A new version (v' + u.latest + ') is available.'; btn.textContent = 'Download'; btn.hidden = false; btn.onclick = () => window.sct.updateDownload(); }
  else show = false;
  if (u.required && u.state !== 'ready' && u.state !== 'downloading') { text = (text ? text + ' ' : '') + 'This version is too old for the website — update to keep sharing.'; show = true; if (btn.hidden) { btn.textContent = u.mode === 'auto' ? 'Check now' : 'Download'; btn.hidden = false; btn.onclick = () => (u.mode === 'auto' ? window.sct.updateCheck() : window.sct.updateDownload()); } }
  bar.hidden = !show; bar.classList.toggle('required', !!u.required); t.textContent = text;
  const s = { idle: 'Not checked yet.', checking: 'Checking for updates…', uptodate: 'You have the latest version (v' + u.current + ').', downloading: 'Downloading v' + u.latest + '… ' + u.percent + '%', ready: 'v' + u.latest + ' is downloaded and will install when you restart.', available: 'v' + u.latest + ' is available — this copy cannot update itself, download it from the website.', error: 'Could not check for updates' + (u.message ? ' (' + u.message + ')' : '') + '.' }[u.state] || '';
  $('updState').textContent = s + (u.mode === 'manual' && u.state !== 'available' ? ' This copy (portable or unpackaged) does not update itself; the website tells it when a newer version exists.' : '');
}
$('updCheck').addEventListener('click', async () => { say('updMsg', 'Checking…', true); const u = await window.sct.updateCheck(); renderUpdate(u); say('updMsg', '', true); });
async function refreshEnv() { const e = await window.sct.envStatus(); $('envState').className = 'msg'; $('envState').textContent = !e.supported ? 'Windows only.' : e.set ? 'Set ✓' + (e.inThisApp ? '' : ' — restart the RSI Launcher and the game so they pick it up') : 'Not set'; $('envOn').disabled = $('envOff').disabled = !e.supported; }
$('envOn').addEventListener('click', async () => { const r = await window.sct.envSet(); if (r.ok) { await refreshEnv(); say('envState', 'Set ✓ — now close the RSI Launcher and the game completely, then open them again.', true); } else say('envState', r.error, false); });
$('envOff').addEventListener('click', async () => { const r = await window.sct.envRemove(); if (r.ok) refreshEnv(); else say('envState', r.error, false); });
window.sct.onUpdate(renderUpdate); window.sct.updateGet().then(renderUpdate); refreshEnv();
window.sct.onStatus(renderStatus); window.sct.onState(renderDash);
window.sct.info().then((i) => { $('ver').textContent = 'v' + i.version; applySettings(i.settings); renderStatus(i.status); refreshCfg(); if (!i.settings.hasToken) document.querySelector('[data-tab=setup]').click(); });
