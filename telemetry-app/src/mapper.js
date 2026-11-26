'use strict';
/**
 * Maps a decoded TelemetryStreamResponse (sc.game.telemetry.v1, Star Citizen 5.0) to the compact JSON the website accepts.
 * Field names follow the game's api.proto / types.proto. Frames are loaded with defaults:true, so a message that is
 * not present in the frame arrives as null (e.g. `vehicle` while on foot) and optional fields stay undefined.
 * Every frame is a full snapshot, so sections that are missing are removed, not carried over.
 */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// The game sends float "no value" markers (FLT_MAX, about 3.4e38) for things that do not exist here - e.g. altitude inside a station hangar. Never forward those.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e30 ? v : undefined);
const near = (v) => { const n = num(v); return n !== undefined && Math.abs(n) < 1e9 ? n : undefined; };   // flight instruments: anything beyond 1e9 m (or m/s, G...) is a marker, not a reading
const pct = (v) => (num(v) === undefined ? undefined : Math.round(v * 1000) / 10);          // 0..1 -> percent
const gaugePct = (g) => (isObj(g) && num(g.max) > 0 ? Math.round((g.current / g.max) * 1000) / 10 : undefined);
const enumName = (v, prefix) => {
  if (typeof v !== 'string') return undefined;
  const s = v.startsWith(prefix) ? v.slice(prefix.length) : v;
  return s === 'UNSPECIFIED' || s === '' ? undefined : s;
};
const title = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_(\w)/g, (_, c) => ' ' + c.toUpperCase()) : s);
const put = (o, k, v) => { if (v !== undefined && v !== null) o[k] = v; return o; };
const nonEmpty = (o) => (o && Object.keys(o).length ? o : undefined);

function mapActor(a) {
  if (!isObj(a)) return undefined;
  const out = {}, st = isObj(a.state) ? a.state : {}, vi = isObj(a.vitals) ? a.vitals : {}, en = isObj(a.environment) ? a.environment : {};
  put(out, 'loco', enumName(st.locomotion, 'ACTOR_LOCOMOTION_STATE_'));
  put(out, 'seat_role', title(enumName(st.crew_role, 'ACTOR_CREW_ROLE_')));
  put(out, 'seat_name', typeof st.seat_name === 'string' && st.seat_name ? st.seat_name : undefined);
  put(out, 'uec', num(st.uec_balance));
  const v = {};
  put(v, 'health', gaugePct(vi.health)); put(v, 'oxygen', gaugePct(vi.oxygen)); put(v, 'hunger', gaugePct(vi.hunger)); put(v, 'thirst', gaugePct(vi.thirst));
  if (isObj(vi.body_temperature)) put(v, 'body_temp', num(vi.body_temperature.current));
  put(v, 'heart_rate', num(vi.heart_rate)); put(v, 'intox', num(vi.intoxication_level)); put(v, 'radiation', num(en.ambient_radiation_rate));
  const e = {};
  put(e, 'gravity', num(vi.gravity)); put(e, 'pressure', num(vi.pressure)); put(e, 'outside_temp', num(en.external_temperature));
  if (typeof en.breathable_atmosphere === 'boolean') e.breathable = en.breathable_atmosphere;
  out.vitals = nonEmpty(v); out.env = nonEmpty(e);
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return nonEmpty(out);
}

function mapShip(vf) {
  const s = isObj(vf) && isObj(vf.state) ? vf.state : null; if (!s) return undefined;
  const out = {};
  put(out, 'name', s.name || undefined); put(out, 'class', s.class_name || undefined); put(out, 'manufacturer', s.manufacturer || undefined);
  put(out, 'type', title(enumName(s.type, 'VEHICLE_TYPE_')));
  if (typeof s.lights_enabled === 'boolean') out.lights = s.lights_enabled;
  put(out, 'hull', pct(s.health));
  if (isObj(s.shields)) put(out, 'shields', pct(s.shields.level));
  if (isObj(s.master_mode)) put(out, 'master_mode', enumName(s.master_mode.mode, 'VEHICLE_MASTER_MODE_'));
  if (isObj(s.doors)) { const d = {}; put(d, 'open', enumName(s.doors.open_state, 'DOOR_OPEN_STATE_')); put(d, 'lock', enumName(s.doors.lock_state, 'DOOR_LOCK_STATE_')); out.doors = nonEmpty(d); }
  if (isObj(s.power)) { const p = {}; for (const [k, v] of Object.entries(s.power)) if (typeof v === 'boolean') p[k] = v; out.power = nonEmpty(p); }
  if (isObj(s.annunciators)) { const w = {}; for (const [k, v] of Object.entries(s.annunciators)) { const n = enumName(v, 'ANNUNCIATOR_STATE_'); if (n) w[k.toUpperCase()] = n; } out.warnings = nonEmpty(w); }
  const fl = isObj(s.flight) ? s.flight : null;
  if (fl) {
    const st = isObj(fl.state) ? fl.state : {}, ins = isObj(fl.instruments) ? fl.instruments : {}, f = {};
    if (typeof st.is_landed === 'boolean') out.landed = st.is_landed;
    put(out, 'gear', enumName(st.gear, 'VEHICLE_COMPONENT_DEPLOYMENT_STATE_')); put(out, 'vtol', enumName(st.vtol, 'VEHICLE_COMPONENT_DEPLOYMENT_STATE_'));
    put(f, 'speed', near(ins.speed)); put(f, 'fuel_h2', pct(ins.hydrogen_fuel)); put(f, 'fuel_qt', pct(ins.quantum_fuel));
    if (isObj(ins.g_meter)) put(f, 'gforce', near(ins.g_meter.current));
    if (isObj(ins.boost)) f.boost = !!ins.boost.engaged;
    put(f, 'altitude', near(ins.altitude)); put(f, 'radar_altitude', near(ins.radar_altitude)); put(f, 'vspeed', near(ins.vertical_speed_indicator));
    put(f, 'air_density', near(ins.atmospheric_density)); put(f, 'heading', near(ins.heading));
    if (isObj(fl.settings)) {          // every flight-assist toggle: Availability{enabled,active} -> ACTIVE / ENABLED / OFF, plain bools stay bools
      const a = {};
      for (const [k, v] of Object.entries(fl.settings)) {
        const key = k.replace(/^ifcs_/, '');
        if (typeof v === 'boolean') a[key] = v; else if (isObj(v)) a[key] = v.active ? 'ACTIVE' : v.enabled ? 'ENABLED' : 'OFF';
      }
      f.assist = nonEmpty(a);
    }
    out.flight = nonEmpty(f);
  }
  return nonEmpty(out);
}

function mapWeapons(w, turret) {
  const out = {};
  if (isObj(w)) {
    put(out, 'preset', w.preset_name || undefined);
    out.items = (Array.isArray(w.weapons) ? w.weapons : []).slice(0, 24).map((x) => ({ name: String(x.name || 'Weapon'), powered: !!x.is_powered, ready: !!x.ready_to_fire }));
    const cm = {};
    for (const c of Array.isArray(w.countermeasures) ? w.countermeasures : []) { const n = enumName(c.type, 'COUNTERMEASURE_TYPE_'); if (n) cm[n.toLowerCase()] = num(c.amount) ?? 0; }
    out.countermeasures = nonEmpty(cm);
    if (!out.items.length) delete out.items;
  }
  if (isObj(turret) && typeof turret.light_amplification === 'boolean') out.turret_amp = turret.light_amplification;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return nonEmpty(out);
}

function mapFF(f) {
  if (!isObj(f)) return undefined; const out = {};
  put(out, 'gunfire', num(f.gunfire)); put(out, 'stick_shaker', num(f.stick_shaker));
  for (const [grp, short] of [['angular', 'ang'], ['linear', 'lin']]) for (const ax of ['x', 'y', 'z']) {
    const a = isObj(f[grp]) && isObj(f[grp][ax]) ? f[grp][ax] : null; if (!a) continue;
    put(out, `${short}_${ax}_res`, num(a.resistance)); put(out, `${short}_${ax}_damp`, num(a.damping));
  }
  return nonEmpty(out);
}

function mapFrame(frame) {
  if (!isObj(frame)) return {};
  const out = {};
  const a = mapActor(frame.actor); if (a) out.actor = a;
  const s = mapShip(frame.vehicle); if (s) out.ship = s;
  const w = mapWeapons(frame.weapons, frame.turret); if (w) out.weapons = w;
  const f = mapFF(frame.force_feedback); if (f) out.ff = f;
  return out;
}

const EVENT_NAMES = { ACTOR_SPAWN: 'spawn', ACTOR_DEAD: 'death', ACTOR_ENTER_SEAT: 'seat_enter', ACTOR_LEAVE_SEAT: 'seat_leave', ACTOR_RESPAWN: 'respawn', ACTOR_DOWNED: 'downed' };
function mapEvents(frame, seatName) {
  const ev = frame && frame.events && Array.isArray(frame.events.events) ? frame.events.events : [];
  const out = [];
  for (const e of ev.slice(0, 20)) {
    const n = enumName(e && e.type, 'GAME_EVENT_TYPE_'); if (!n) continue;
    const kind = EVENT_NAMES[n] || n.toLowerCase().replace(/^actor_/, '');
    out.push({ kind, detail: kind === 'seat_enter' && seatName ? seatName : '' });
  }
  return out;
}

// Frames are complete snapshots: whatever is not in the latest frame (e.g. the ship after you step out) is dropped.
class StateStore {
  constructor() { this.state = {}; this.updated = 0; }
  merge(mapped) { this.state = mapped; this.updated = Date.now(); return this.state; }
  reset() { this.state = {}; this.updated = 0; }
}
module.exports = { mapFrame, mapEvents, StateStore };
