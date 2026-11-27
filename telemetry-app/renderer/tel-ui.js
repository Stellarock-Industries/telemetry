'use strict';
/**
 * Stellarock telemetry UI kit - ONE source shared by the desktop app (renderer/tel-ui.js) and the website (public/assets/js/tel-ui.js).
 * Keep both copies identical (the build test compares them). Everything is built with createElement / textContent / SVG attributes,
 * so data coming from the game is never parsed as HTML. Colours come from the CSS classes in tel-ui.css.
 */
(function (root) {
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------ basics */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; }
  function svg(tag, attrs, cls) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (cls) e.setAttribute('class', cls); return e; }
  function num(v, d) { return typeof v === 'number' ? (Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString() : String(v); }
  function label(k) { return String(k).replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function tidy(k) { var s = label(k); return /^[A-Za-z]{1,3}$/.test(s) ? s.toUpperCase() : s; }     // "esp" -> "ESP", "g_safe" -> "G safe"
  function ok(v) { return typeof v === 'number' && isFinite(v); }

  /* ------------------------------------------------------------------ names */
  // Manufacturer codes used in the game's class names. Only codes listed here are treated as a manufacturer prefix.
  var MAKERS = { AEGS: 'Aegis Dynamics', ANVL: 'Anvil Aerospace', AOPOA: 'Aopoa', ARGO: 'Argo Astronautics', BANU: 'Banu', CNOU: 'Consolidated Outland', CRUS: 'Crusader Industries',
    DRAK: 'Drake Interplanetary', ESPR: 'Esperia', GAMA: 'Gatac Manufacture', GLSN: 'Gallenson Tactical Systems', GRIN: 'Greycat Industrial', KRIG: 'Kruger Intergalactic',
    MISC: 'Musashi Industrial & Starflight Concern', MRAI: 'Mirai', ORIG: 'Origin Jumpworks', RSI: 'Roberts Space Industries', TMBL: 'Tumbril Land Systems', VNCL: 'Vanduul', XIAN: "Xi'an" };
  function words(parts) {
    return parts.map(function (w) { w = w.replace(/([a-z])([A-Z])/g, '$1 $2'); return w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).join(' ').replace(/\s+/g, ' ').trim();
  }
  function split(raw) {                               // "GLSN_Shiv_955867376956" -> { parts:['GLSN','Shiv'], serial:'955867376956' }
    raw = String(raw || '').trim(); var serial = '', m = raw.match(/^(.*?)[_\s-](\d{5,})$/);
    if (m) { raw = m[1]; serial = m[2]; }
    return { parts: raw.split(/[_\s]+/).filter(Boolean), serial: serial };
  }
  /** {name, class, manufacturer, type} as the game reports it -> what to show: {maker, name, serial, type, full} */
  function shipInfo(s) {
    s = s || {};
    var a = split(s.name || s.class), b = split(s.class), maker = typeof s.manufacturer === 'string' ? s.manufacturer : '';
    var code = a.parts.length > 1 && MAKERS[a.parts[0].toUpperCase()] ? a.parts.shift().toUpperCase() : (b.parts.length > 1 && MAKERS[b.parts[0].toUpperCase()] ? b.parts[0].toUpperCase() : '');
    if (!maker && code) maker = MAKERS[code];
    return { maker: maker, name: words(a.parts) || 'Unknown ship', serial: a.serial || b.serial, type: s.type || '', full: String(s.name || '') };
  }
  /** "GLSN_BallisticGatling_S4_955867377080" -> "Ballistic Gatling S4" */
  function weaponName(n) {
    var a = split(n); if (a.parts.length > 1 && /^[A-Z]{3,5}$/.test(a.parts[0]) && !/^S\d+$/.test(a.parts[0])) a.parts.shift();
    return words(a.parts) || 'Weapon';
  }
  /** metres -> ['12.4','km'] ; null when the game sends its "no value" marker (about 3.4e38) or anything absurd (e.g. altitude in a hangar) */
  function dist(m) {
    if (!ok(m) || Math.abs(m) >= 1e9) return null;
    return Math.abs(m) >= 10000 ? [num(m / 1000, 1), 'km'] : [num(m, 1), 'm'];
  }

  /* ------------------------------------------------------------------ icons (24x24, stroke) */
  function C(x, y, r) { return 'M' + (x - r) + ' ' + y + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0'; }
  var ICONS = {
    foot: [C(12, 4.5, 2), 'M12 7.5v6.5', 'M8 10.5l4-2.5 4 2.5', 'M12 14l-3.2 6', 'M12 14l3.2 6'],
    seat: ['M8 3.5L6.5 13h9.5l2.5 5.5', 'M6.5 13v6.5', 'M4.5 19.5h6', 'M14.5 18.5h5'],
    eva: [C(12, 6.5, 3), 'M8.5 11.5h7a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 16.5V13a1.5 1.5 0 0 1 1.5-1.5z', 'M7 13l-3 2.5', 'M17 13l3 2.5', 'M9.5 18l-1 3', 'M14.5 18l1 3'],
    pilot: ['M12 2.5l1.8 7L21 13v2l-7.2-1.8-.6 4 2 1.6v1.7L12 20l-3.2 1.5v-1.7l2-1.6-.6-4L3 15v-2l7.2-3.5z'],
    gunner: [C(12, 12, 6.5), 'M12 2.5v5', 'M12 16.5v5', 'M2.5 12h5', 'M16.5 12h5'],
    crew: [C(9, 8, 2.8), C(17, 9.5, 2.2), 'M3.5 19c0-3.2 2.4-5.5 5.5-5.5s5.5 2.3 5.5 5.5', 'M15.5 14c2.9 0 5 2 5 4.8'],
    user: [C(12, 8, 3.5), 'M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5'],
    ship: ['M12 2.5c3 2 4.8 5.6 4.8 9.5l-1.8 3.5H9L7.2 12c0-3.9 1.8-7.5 4.8-9.5z', 'M9 15.5l-2.8 3.8', 'M15 15.5l2.8 3.8', 'M12 15.5v5', C(12, 9, 1.6)],
    heart: ['M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.8 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11z'],
    thermo: ['M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z', 'M12 9v7'],
    cocktail: ['M4 5h16l-8 9z', 'M12 14v6M8 20h8'],
    bolt: ['M13 2.5L5 13.5h6l-1 8 8-11h-6z'],
    skull: ['M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3z', C(9.3, 10.5, 1.2), C(14.7, 10.5, 1.2), 'M10.5 19v2M13.5 19v2'],
    refresh: ['M20 11a8 8 0 0 0-14.3-4', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.3 4', 'M20 20v-4h-4'],
    down: ['M12 4v14', 'M6 12l6 6 6-6'],
    spark: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'],
    enter: ['M4 12h11', 'M11 7l5 5-5 5', 'M20 4v16'],
    leave: ['M20 12H9', 'M13 7l-5 5 5 5', 'M4 4v16'],
    clock: [C(12, 12, 8.5), 'M12 7v5l3 2']
  };
  function radiationPaths() {            // trefoil, drawn filled
    var out = []; [-90, 30, 150].forEach(function (a) { var p = function (r, d) { var t = d * Math.PI / 180; return (12 + r * Math.cos(t)).toFixed(2) + ' ' + (12 + r * Math.sin(t)).toFixed(2); };
      out.push('M' + p(3.6, a - 30) + ' L' + p(10, a - 30) + ' A10 10 0 0 1 ' + p(10, a + 30) + ' L' + p(3.6, a + 30) + ' A3.6 3.6 0 0 0 ' + p(3.6, a - 30) + ' Z'); });
    out.push(C(12, 12, 2)); return out;
  }
  /** small inline icon that takes the text colour */
  function ico(name, cls) {
    var s = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, 'ico' + (cls ? ' ' + cls : ''));
    (name === 'radiation' ? radiationPaths() : ICONS[name] || ICONS.user).forEach(function (d) { s.appendChild(svg('path', { d: d })); }); return s;
  }

  /* ------------------------------------------------------------------ pills */
  function pill(kind, iconName, text, title) {
    var p = el('span', 'tpill tpill-' + kind); if (iconName) p.appendChild(ico(iconName)); p.appendChild(el('span', 'tpill-t', text));
    if (title) { p.title = title; p.setAttribute('aria-label', title + ': ' + text); } return p;
  }
  var LOCO = { ON_FOOT: ['foot', 'On foot'], SEATED: ['seat', 'Seated'], EVA: ['eva', 'Floating (EVA)'] };
  function stancePill(loco) { if (!loco) return null; var m = LOCO[String(loco).toUpperCase()] || ['user', label(String(loco).toLowerCase())]; return pill('stance', m[0], m[1], 'Current stance / position'); }
  var ROLES = { pilot: 'pilot', gunner: 'gunner', crew: 'crew' };
  function rolePill(role) { return role ? pill('role', ROLES[String(role).toLowerCase()] || 'crew', String(role), 'Seat role') : null; }
  function uecPill(uec) { return ok(uec) ? pill('uec', null, '¤ ' + num(uec, 0), 'aUEC balance') : null; }
  function pillRow(list) { var r = el('div', 'tpills'); list.forEach(function (p) { if (p) r.appendChild(p); }); return r.children.length ? r : null; }
  /** the player strip: stance, role and wallet as pills */
  function playerStrip(a) { a = a || {}; return pillRow([stancePill(a.loco), rolePill(a.seat_role), uecPill(a.uec)]); }

  /* ------------------------------------------------------------------ bars */
  /** Division + team chips for a member ({division, teams}); null when there is nothing to show. */
  function chips(m) {
    const w = el('div', 'tel-chips'); (m.divisions || (m.division ? [m.division] : [])).forEach(function (d) { w.appendChild(el('span', 'tel-chip div', d)); });
    (m.teams || []).forEach(function (t) { w.appendChild(el('span', 'tel-chip', t)); });
    return w.childNodes.length ? w : null;
  }
  /** Rank pill; the colour comes from the site's rank settings and is applied through the CSSOM (allowed by a strict CSP). */
  function rank(name, color) {
    const p = el('span', 'tel-rank', name); if (/^#[0-9a-f]{6}$/i.test(String(color || ''))) p.style.setProperty('--rk', color); return p;
  }
  function hpBar(v) {
    if (!ok(v)) return null; var p = Math.max(0, Math.min(100, v));
    var w = el('div', 'hpbar ' + (p >= 66 ? 'hp-ok' : p >= 33 ? 'hp-warn' : 'hp-bad')); w.setAttribute('role', 'img'); w.setAttribute('aria-label', 'Health ' + Math.round(p) + '%'); w.title = 'Health ' + Math.round(p) + '%';
    w.appendChild(ico('heart')); var tr = el('div', 'hpbar-track'), f = el('div', 'hpbar-fill'); f.style.width = p + '%'; tr.appendChild(f); w.appendChild(tr);
    w.appendChild(el('span', 'hpbar-num', String(Math.round(p)))); return w;
  }
  function meter(text, v, tone) {
    if (!ok(v)) return null; var p = Math.max(0, Math.min(100, v)), m = el('div', 'meter'), h = el('div', 'meter-h');
    h.appendChild(el('span', '', text)); h.appendChild(el('b', '', num(p, 0) + '%')); m.appendChild(h);
    var tr = el('div', 'meter-track'), f = el('div', 'meter-fill ' + (tone || (p < 20 ? 'm-bad' : p < 45 ? 'm-warn' : 'm-gold'))); f.style.width = p + '%'; tr.appendChild(f); m.appendChild(tr); return m;
  }

  /* ------------------------------------------------------------------ dials, lungs */
  function polar(deg) { var r = deg * Math.PI / 180; return [50 + 40 * Math.cos(r), 50 + 40 * Math.sin(r)]; }
  function arc(from, to) { var a = polar(from), b = polar(to); return 'M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + ' A40 40 0 ' + (to - from > 180 ? 1 : 0) + ' 1 ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2); }
  function niceMax(v) { var c = [1, 2, 5, 10, 20, 50, 100, 150, 200, 500, 1000, 2000, 5000, 10000, 100000]; for (var i = 0; i < c.length; i++) if (c[i] >= v * 1.2) return c[i]; return Math.ceil(v * 1.2); }
  function vitalClass(v) { return v < 25 ? 'dial-bad' : v < 50 ? 'dial-warn' : 'dial-gold'; }
  function tempZone(t) { return t <= -20 ? ['dial-cold', 'Freezing'] : t < 5 ? ['dial-cool', 'Cold'] : t <= 35 ? ['dial-ok', 'Comfortable'] : t <= 60 ? ['dial-warn', 'Hot'] : ['dial-bad', 'Scorching']; }
  // zones: [css class, word]. Thresholds are sensible guesses - the game's own scales for intoxication and radiation are undocumented.
  function bodyTempZone(t) { return t < 33 ? ['dial-cold', 'Hypothermic'] : t < 35.5 ? ['dial-cool', 'Chilly'] : t <= 37.5 ? ['dial-ok', 'Normal'] : t <= 39 ? ['dial-warn', 'Fever'] : ['dial-bad', 'Dangerous']; }
  function heartZone(v) { return v < 50 ? ['dial-cool', 'Low'] : v <= 100 ? ['dial-ok', 'Normal'] : v <= 140 ? ['dial-warn', 'Elevated'] : ['dial-bad', 'Racing']; }
  function intoxZone(v) { return v <= 0 ? ['dial-ok', 'Sober'] : v <= 2 ? ['dial-warn', 'Tipsy'] : ['dial-bad', 'Drunk']; }
  function radZone(v) { return v <= 0.05 ? ['dial-ok', 'Clear'] : v < 1 ? ['dial-warn', 'Elevated'] : ['dial-bad', 'Dangerous']; }
  function dialIcon(name, cls) {
    var g = svg('g', { transform: 'translate(41 14) scale(0.75)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, 'dial-ico ' + (cls || 'dial-gold') + (name === 'radiation' ? ' fill' : ''));
    (name === 'radiation' ? radiationPaths() : ICONS[name] || []).forEach(function (d) { g.appendChild(svg('path', name === 'radiation' ? { d: d, 'stroke-width': 1 } : { d: d })); }); return g;
  }
  /** o: { value, min, max, label, unit, decimals, cls, sub, icon, mini } -> a dial with the number in the centre */
  function dial(o) {
    if (!ok(o.value)) return null;
    var min = o.min || 0, max = o.max || 100, f = Math.max(0, Math.min(1, (o.value - min) / ((max - min) || 1)));
    var wrap = el('div', 'dial' + (o.mini ? ' dial-mini' : '')), s = svg('svg', { viewBox: '0 0 100 86', role: 'img', 'aria-label': o.label + ' ' + num(o.value, o.decimals || 0) + (o.unit ? ' ' + o.unit : '') + (o.sub ? ', ' + o.sub : '') });
    s.appendChild(svg('path', { d: arc(135, 405), fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round' }, 'dial-track'));
    if (f > 0.004) s.appendChild(svg('path', { d: arc(135, 135 + 270 * f), fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round' }, 'dial-arc ' + (o.cls || 'dial-gold')));
    if (o.icon) s.appendChild(dialIcon(o.icon, o.cls));
    var t = svg('text', { x: 50, y: o.icon ? 56 : (o.unit ? 49 : 54), 'text-anchor': 'middle' }, 'dial-num'); t.textContent = num(o.value, o.decimals || 0); s.appendChild(t);
    if (o.unit) { var u = svg('text', { x: 50, y: o.icon ? 68 : 63, 'text-anchor': 'middle' }, 'dial-unit'); u.textContent = o.unit; s.appendChild(u); }
    wrap.appendChild(s); wrap.appendChild(el('div', 'dial-label', o.label)); if (o.sub) wrap.appendChild(el('div', 'dial-sub ' + (o.cls || ''), o.sub));
    return wrap;
  }
  function dialGrid(list, cols4) { var g = el('div', 'dial-grid' + (cols4 ? ' cols4' : '')); list.forEach(function (d) { if (d) g.appendChild(d); }); return g.children.length ? g : null; }
  function vitalDials(v, mini) {
    return ['health', 'oxygen', 'hunger', 'thirst'].map(function (k) { return dial({ value: v[k], label: label(k), unit: '%', decimals: 0, cls: vitalClass(v[k]), mini: mini }); });
  }
  function bodyDials(v, mini) {
    var out = [], z;
    if (ok(v.body_temp)) { z = bodyTempZone(v.body_temp); out.push(dial({ value: v.body_temp, min: 28, max: 44, label: 'Body temp', unit: '°C', decimals: 1, cls: z[0], sub: z[1], icon: 'thermo', mini: mini })); }
    if (ok(v.heart_rate)) { z = heartZone(v.heart_rate); out.push(dial({ value: v.heart_rate, min: 30, max: 200, label: 'Heart rate', unit: 'bpm', decimals: 0, cls: z[0], sub: z[1], icon: 'heart', mini: mini })); }
    if (ok(v.intox)) { z = intoxZone(v.intox); out.push(dial({ value: v.intox, min: 0, max: niceMax(Math.max(v.intox, 4)), label: 'Intoxication', decimals: 0, cls: z[0], sub: z[1], icon: 'cocktail', mini: mini })); }
    if (ok(v.radiation)) { z = radZone(v.radiation); out.push(dial({ value: v.radiation, min: 0, max: niceMax(Math.max(v.radiation, 2)), label: 'Radiation', decimals: 2, cls: z[0], sub: z[1], icon: 'radiation', mini: mini })); }
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
  function envDials(en) {
    en = en || {}; var out = [];
    out.push(dial({ value: en.gravity, min: 0, max: 20, label: 'Gravity', unit: 'm/s²', decimals: 1 }));
    out.push(dial({ value: en.pressure, min: 0, max: niceMax(en.pressure || 0), label: 'Pressure', decimals: 1 }));
    if (ok(en.outside_temp)) { var z = tempZone(en.outside_temp); out.push(dial({ value: en.outside_temp, min: -100, max: 100, label: 'Outside temp', unit: '°C', decimals: 0, cls: z[0], sub: z[1] })); }
    if (typeof en.breathable === 'boolean') out.push(lungs(en.breathable));
    return out;
  }

  /* ------------------------------------------------------------------ ship */
  function tag(text, title, mono) { var t = el('span', 'tag' + (mono ? ' tag-mono' : ''), text); if (title) t.title = title; return t; }
  /** manufacturer / name / type + serial - used for the dashboard ship card and "ships in use" */
  function shipHead(s) {
    var i = shipInfo(s), h = el('div', 'shiphead');
    if (i.maker) h.appendChild(el('div', 'sh-maker', i.maker)).title = i.maker;
    var n = el('div', 'sh-name', i.name); n.title = i.full || i.name; h.appendChild(n);
    var m = el('div', 'sh-meta'); if (i.serial) m.appendChild(tag('Serial ' + i.serial, 'Serial ' + i.serial, true)); if (i.type) m.appendChild(tag(i.type, 'Vehicle type'));
    if (m.children.length) h.appendChild(m); return h;
  }
  function led(text, state, title) { var l = el('span', 'led led-' + (state || 'off'), text); if (title) l.title = title; return l; }
  function ledList(map, stateOf) {
    var w = el('div', 'leds'); Object.keys(map || {}).forEach(function (k) { var v = map[k]; w.appendChild(led(tidy(k), stateOf ? stateOf(v) : (v === true ? 'on' : 'off'))); }); return w.children.length ? w : null;
  }
  function shipPanel(s) {
    s = s || {}; var box = el('div', 'stack'); box.appendChild(shipHead(s));
    var ms = el('div', 'meters'); [meter('Hull', s.hull), meter('Shields', s.shields, 'm-cool')].forEach(function (m) { if (m) ms.appendChild(m); }); if (ms.children.length) box.appendChild(ms);
    var l = el('div', 'leds'), dep = function (v) { return v ? (/DEPLOY/i.test(v) ? 'on' : 'off') : null; };
    if (s.master_mode) l.appendChild(led('Mode: ' + label(String(s.master_mode).toLowerCase()), 'on'));
    if (typeof s.landed === 'boolean') l.appendChild(led(s.landed ? 'Landed' : 'Airborne', s.landed ? 'on' : 'off'));
    if (s.gear) l.appendChild(led('Gear ' + label(String(s.gear).toLowerCase()), dep(s.gear)));
    if (s.vtol) l.appendChild(led('VTOL ' + label(String(s.vtol).toLowerCase()), dep(s.vtol)));
    if (typeof s.lights === 'boolean') l.appendChild(led('Lights', s.lights ? 'on' : 'off'));
    if (l.children.length) box.appendChild(l); return box;
  }
  function stat(text, v, unit) { var s = el('div', 'stat'), x = el('div', 'stat-v', v); if (unit) x.appendChild(el('small', '', unit)); s.appendChild(x); s.appendChild(el('div', 'stat-l', text)); return s; }
  function flightPanel(f) {
    f = f || {}; var box = el('div', 'stack'), g = el('div', 'stats'), d;
    if (ok(f.speed)) g.appendChild(stat('Speed', num(f.speed, 1), 'm/s'));
    if ((d = dist(f.altitude))) g.appendChild(stat('Altitude', d[0], d[1]));
    if ((d = dist(f.radar_altitude))) g.appendChild(stat('Radar alt', d[0], d[1]));
    if (ok(f.vspeed) && Math.abs(f.vspeed) < 1e6) g.appendChild(stat('Vertical', num(f.vspeed, 1), 'm/s'));
    if (ok(f.heading) && Math.abs(f.heading) < 1e4) g.appendChild(stat('Heading', num(f.heading, 0), '°'));
    if (ok(f.gforce) && Math.abs(f.gforce) < 1e4) g.appendChild(stat('G-force', num(f.gforce, 1), 'G'));
    if (ok(f.air_density) && Math.abs(f.air_density) < 1e6) g.appendChild(stat('Air density', num(f.air_density, 2)));
    if (g.children.length) box.appendChild(g);
    var ms = el('div', 'meters'); [meter('Hydrogen fuel', f.fuel_h2), meter('Quantum fuel', f.fuel_qt, 'm-cool')].forEach(function (m) { if (m) ms.appendChild(m); }); if (ms.children.length) box.appendChild(ms);
    if (typeof f.boost === 'boolean') { var l = el('div', 'leds'); l.appendChild(led('Boost', f.boost ? 'on' : 'off')); box.appendChild(l); }
    return box.children.length ? box : null;
  }
  var ANN_NAMES = { PWR: 'Power', WPN: 'Weapons', THR: 'Thrusters', SHLD: 'Shields', COOL: 'Cooling', QDRV: 'Quantum drive', RADR: 'Radar', PROX: 'Proximity', HIT: 'Hit', MISL: 'Missile' };
  /** cockpit annunciator panel: one small lamp tile per warning */
  function annunciators(map) {
    var g = el('div', 'anns'); Object.keys(map || {}).forEach(function (k) {
      var v = String(map[k]), st = /^MAJOR/.test(v) ? 'bad' : /^MINOR/.test(v) ? 'warn' : v === 'NOMINAL' ? 'ok' : 'off';
      var a = el('div', 'ann ann-' + st); a.title = (ANN_NAMES[k] || k) + ': ' + label(v.toLowerCase()); a.setAttribute('aria-label', a.title); a.appendChild(el('i', 'ann-led')); a.appendChild(el('b', '', k)); g.appendChild(a);
    });
    if (!g.children.length) return null; var w = el('div', 'stack'); w.appendChild(g);
    var lg = el('div', 'legend'); [['ok', 'Nominal'], ['warn', 'Minor'], ['bad', 'Major'], ['off', 'Off']].forEach(function (x) { var s = el('span', 'lg lg-' + x[0], x[1]); lg.appendChild(s); }); w.appendChild(lg); return w;
  }
  /** flight-assist switches: ACTIVE (green, on), ENABLED (gold, armed), OFF */
  function toggles(map) {
    var g = el('div', 'tgls'); Object.keys(map || {}).forEach(function (k) {
      var v = map[k], st = v === 'ACTIVE' || v === true ? 'active' : v === 'ENABLED' ? 'enabled' : 'off';
      var t = el('div', 'tgl tgl-' + st), nm = el('span', 'tgl-l', tidy(k)); nm.title = tidy(k); t.title = tidy(k) + ': ' + (st === 'active' ? 'active' : st === 'enabled' ? 'enabled' : 'off');
      var sw = el('span', 'tgl-sw'); sw.appendChild(el('i')); t.appendChild(nm); t.appendChild(sw); g.appendChild(t);
    });
    if (!g.children.length) return null; var w = el('div', 'stack'); w.appendChild(g);
    var lg = el('div', 'legend'); [['ok', 'Active'], ['gold', 'Enabled'], ['off', 'Off']].forEach(function (x) { lg.appendChild(el('span', 'lg lg-' + x[0], x[1])); }); w.appendChild(lg); return w;
  }
  function weaponPanel(w) {
    w = w || {}; var box = el('div', 'stack'), top = el('div', 'tpills');
    if (w.preset) top.appendChild(pill('plain', 'gunner', 'Preset: ' + w.preset));
    if (typeof w.turret_amp === 'boolean') top.appendChild(pill(w.turret_amp ? 'stance' : 'plain', null, 'Turret light amp ' + (w.turret_amp ? 'on' : 'off')));
    if (top.children.length) box.appendChild(top);
    if ((w.items || []).length) {
      var list = el('div', 'wlist');
      w.items.forEach(function (it) {
        var st = it.ready ? 'ready' : it.powered ? 'powered' : 'off', r = el('div', 'wrow wrow-' + st), n = el('span', 'wname', weaponName(it.name)); n.title = it.name || '';
        r.appendChild(ico('gunner')); r.appendChild(n); r.appendChild(el('span', 'wstat', st === 'ready' ? 'Ready' : st === 'powered' ? 'Powered' : 'Off')); list.appendChild(r);
      });
      box.appendChild(list);
    }
    var cm = w.countermeasures || {}, cg = el('div', 'cms');
    Object.keys(cm).forEach(function (k) { var c = el('div', 'cm' + (cm[k] > 0 ? '' : ' cm-0')); c.appendChild(el('b', '', num(cm[k], 0))); c.appendChild(el('span', '', label(k))); cg.appendChild(c); });
    if (cg.children.length) box.appendChild(cg);
    return box.children.length ? box : null;
  }
  function tags(map) { var w = el('div', 'tagrow'); Object.keys(map || {}).forEach(function (k) { var v = map[k]; w.appendChild(tag(tidy(k) + ' ' + (typeof v === 'number' ? num(v, 2) : String(v)), '', false)); }); return w.children.length ? w : null; }
  function doors(d) { var l = []; if (d && d.open) l.push(led('Doors ' + label(String(d.open).toLowerCase()), /^OPEN/i.test(d.open) ? 'warn' : 'on')); if (d && d.lock) l.push(led(label(String(d.lock).toLowerCase()), /^LOCK/i.test(d.lock) ? 'on' : 'off')); if (!l.length) return null; var w = el('div', 'leds'); l.forEach(function (x) { w.appendChild(x); }); return w; }

  /* ------------------------------------------------------------------ events */
  var EV = { spawn: ['spark', 'Spawned', 'ok'], death: ['skull', 'Died', 'bad'], seat_enter: ['enter', 'Entered a seat', ''], seat_leave: ['leave', 'Left the seat', ''], respawn: ['refresh', 'Respawned', 'ok'], downed: ['down', 'Downed', 'bad'] };
  /** list: [{ time:'12:28:43', kind:'seat_enter', detail:'' }], newest first */
  function eventList(list) {
    var w = el('div', 'evlist');
    (list || []).forEach(function (e) {
      var m = EV[e.kind] || ['clock', label(e.kind || 'event'), ''], r = el('div', 'ev'), i = el('span', 'ev-ico' + (m[2] ? ' ev-' + m[2] : '')), t = el('div', 'ev-t');
      i.appendChild(ico(m[0])); t.appendChild(el('div', 'ev-name', m[1])); if (e.detail) t.appendChild(el('div', 'ev-detail', e.detail));
      r.appendChild(i); r.appendChild(t); r.appendChild(el('span', 'ev-time', e.time || '')); w.appendChild(r);
    });
    return w;
  }

  /* ------------------------------------------------------------------ org members */
  /** pills, dials and little stats for one member's view (what they chose to share). The host draws avatar + name + hp bar. */
  function memberBody(v) {
    var frag = document.createDocumentFragment(); v = v || {};
    var crew = v.crew || {}, ship = v.ship ? shipInfo(v.ship) : null, sp = ship ? pill('ship', 'ship', ship.name, [ship.maker, ship.name, ship.serial ? '#' + ship.serial : '', ship.type].filter(Boolean).join(' · ')) : null;
    var row = pillRow([stancePill(crew.loco), rolePill(crew.seat_role), sp, uecPill(v.uec)]); if (row) frag.appendChild(row);
    if (!v.ship && !v.crew) frag.appendChild(el('div', 'muted-s', 'Ship and seat not shared'));
    if (v.vitals) {
      var g = dialGrid(vitalDials(v.vitals, true), true); if (g) frag.appendChild(g);
      var x = el('div', 'mini-stats'), vv = v.vitals, fl = v.flight && v.flight.flight;
      var bit = function (icon, text, title) { var b = el('span', 'mini-stat'); b.appendChild(ico(icon)); b.appendChild(document.createTextNode(text)); if (title) b.title = title; x.appendChild(b); };
      if (ok(vv.heart_rate)) bit('heart', num(vv.heart_rate, 0) + ' bpm', 'Heart rate'); if (ok(vv.body_temp)) bit('thermo', num(vv.body_temp, 1) + ' °C', 'Body temperature');
      if (ok(vv.intox) && vv.intox > 0) bit('cocktail', 'Intoxicated'); if (ok(vv.radiation) && vv.radiation > 0.05) bit('radiation', num(vv.radiation, 2), 'Radiation');
      if (fl && ok(fl.speed)) bit('pilot', num(fl.speed, 0) + ' m/s', 'Speed'); if (x.children.length) frag.appendChild(x);
    } else frag.appendChild(el('div', 'muted-s', 'Vitals not shared'));
    return frag;
  }
  function crewRow(name, role) { var r = el('div', 'crew-row'); r.appendChild(el('span', 'crew-name', name)); var p = rolePill(role); if (p) r.appendChild(p); return r; }

  var T = { el: el, svg: svg, num: num, label: label, tidy: tidy, ico: ico, shipInfo: shipInfo, weaponName: weaponName, dist: dist,
    pill: pill, stancePill: stancePill, rolePill: rolePill, uecPill: uecPill, pillRow: pillRow, playerStrip: playerStrip,
    chips: chips, rank: rank, hpBar: hpBar, meter: meter, dial: dial, dialGrid: dialGrid, vitalDials: vitalDials, bodyDials: bodyDials, envDials: envDials, lungs: lungs,
    shipHead: shipHead, shipPanel: shipPanel, flightPanel: flightPanel, led: led, ledList: ledList, annunciators: annunciators, toggles: toggles, weaponPanel: weaponPanel,
    tags: tags, doors: doors, eventList: eventList, memberBody: memberBody, crewRow: crewRow, tag: tag };
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  root.TelUI = T;
})(typeof window !== 'undefined' ? window : globalThis);
