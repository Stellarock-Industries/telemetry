'use strict';
/**
 * Local privacy filter. The website ALSO enforces each member's sharing rules when it serves data,
 * but data you never send can never leak, so "shared only" mode strips everything you have not opted to share.
 *   full   - send everything; the site stores it for your private "My telemetry" page and shows others only what you share.
 *   shared - send only the parts you share with the org.
 */
function filterForUpload(state, prefs, mode) {
  if (!prefs || prefs.share_online === 0) return null;                 // nothing leaves the PC
  if (mode !== 'shared') return state;
  const out = {};
  if (state.ship && prefs.share_ship) out.ship = { id: state.ship.id, name: state.ship.name, class: state.ship.class, manufacturer: state.ship.manufacturer, type: state.ship.type };
  if (state.actor) {
    const a = {};
    if (prefs.share_crew) Object.assign(a, { loco: state.actor.loco, seat_name: state.actor.seat_name, seat_role: state.actor.seat_role });
    if (prefs.share_vitals) { a.vitals = state.actor.vitals; a.env = state.actor.env; }
    if (prefs.share_uec) a.uec = state.actor.uec;
    out.actor = a;
  }
  if (prefs.share_flight) {
    if (state.ship) out.ship = { ...(out.ship || {}), ...state.ship };
    if (state.weapons) out.weapons = state.weapons;
    if (state.ff) out.ff = state.ff;
  }
  return JSON.parse(JSON.stringify(out));                                // drop undefined
}
module.exports = { filterForUpload };
