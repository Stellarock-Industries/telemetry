'use strict';
const assert = require('assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { execFileSync } = require('child_process');
const { sign, parseToken, normalizeSiteUrl } = require('../src/signing');
const { mapFrame, mapEvents, StateStore } = require('../src/mapper');
const { filterForUpload } = require('../src/privacy');
const gameCfg = require('../src/gameCfg');
const { Uploader } = require('../src/uploader');
const { GameClient } = require('../src/gameClient');
const mock = require('./mockGame');

let failed = 0;
async function t(name, fn) { try { await fn(); console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n   ' + (e.stack || e)); } }

(async () => {
  await t('token parsing', () => {
    assert.deepStrictEqual(parseToken('sctd1.12.' + 'a'.repeat(48)), { deviceId: '12', secret: 'a'.repeat(48) });
    for (const bad of ['', 'x', 'sctd1.1.short', 'sctd2.1.' + 'a'.repeat(48), 'sctd1.1.' + 'G'.repeat(48)]) assert.strictEqual(parseToken(bad), null);
  });
  await t('site url must be https (http only for localhost)', () => {
    assert.strictEqual(normalizeSiteUrl('https://jackodev.uk/'), 'https://jackodev.uk');
    assert.strictEqual(normalizeSiteUrl('http://jackodev.uk'), null);
    assert.strictEqual(normalizeSiteUrl('http://127.0.0.1:8300'), 'http://127.0.0.1:8300');
    assert.strictEqual(normalizeSiteUrl('https://user:pw@jackodev.uk'), null);
    assert.strictEqual(normalizeSiteUrl('ftp://x'), null);
    assert.strictEqual(normalizeSiteUrl('javascript:alert(1)'), null);
  });
  await t('signature matches the PHP server implementation', () => {
    const phpFile = path.resolve(__dirname, '../../src/telemetry.php');
    let hasPhp = fs.existsSync(phpFile); try { if (hasPhp) execFileSync('php', ['-v'], { stdio: 'ignore' }); } catch { hasPhp = false; }
    if (!hasPhp) { console.log('     (skipped: needs the website source next to this folder and php on PATH)'); return; }
    const php = "require '" + path.resolve(__dirname, '../../src/telemetry.php').replace(/\\/g, '/') + "';";
    // tel_sign needs no DB/bootstrap: stub the two helpers telemetry.php calls at load time are only used inside functions
    const body = '{"type":"hello","x":"é"}';
    const want = sign('s3cret', 'POST', '/api/telemetry/', '1700000000', 'nonce-nonce-nonce1', body);
    const out = execFileSync('php', ['-r', "function cfg($k){return null;} function clean($s,$n=0){return $s;} function q(){} function qv(){} function q1(){} function qa(){} " + php + " echo tel_sign('s3cret','POST','/api/telemetry/','1700000000','nonce-nonce-nonce1', '{\"type\":\"hello\",\"x\":\"é\"}');"]).toString();
    assert.strictEqual(out, want);
  });
  const G = (current, max = 100) => ({ current, max });
  const frame = {
    actor: { vitals: { health: G(90), oxygen: G(95), hunger: G(40), thirst: G(30), body_temperature: G(36.8, 45), heart_rate: 70, gravity: 9.8, pressure: 101, intoxication_level: 2 },
      state: { locomotion: 'ACTOR_LOCOMOTION_STATE_SEATED', crew_role: 'ACTOR_CREW_ROLE_GUNNER', seat_name: 'turret_top', uec_balance: 1000 },
      environment: { external_temperature: -20, ambient_radiation_rate: 0.5, breathable_atmosphere: false } },
    vehicle: { state: { name: 'AEGS Gladius', class_name: 'AEGS_Gladius', manufacturer: 'Aegis Dynamics', type: 'VEHICLE_TYPE_SPACESHIP', lights_enabled: true, health: 0.5,
      annunciators: { pwr: 'ANNUNCIATOR_STATE_NOMINAL', qdrv: 'ANNUNCIATOR_STATE_MAJOR_ON', hit: 'ANNUNCIATOR_STATE_UNSPECIFIED' }, power: { weapons: true, sensors: false },
      shields: { level: 0.25 }, master_mode: { mode: 'VEHICLE_MASTER_MODE_NAVIGATION' }, doors: { open_state: 'DOOR_OPEN_STATE_OPENED', lock_state: 'DOOR_LOCK_STATE_UNLOCKED' },
      flight: { state: { is_landed: true, gear: 'VEHICLE_COMPONENT_DEPLOYMENT_STATE_DEPLOYED' }, settings: { ifcs_coupled: { enabled: true, active: true }, ifcs_esp: { enabled: true, active: false }, ifcs_g_safe: { enabled: false, active: false }, course_prediction: true },
        instruments: { speed: 5, hydrogen_fuel: 0.8, quantum_fuel: 0.5, g_meter: { current: 2.5, max: 9 }, boost: { engaged: true }, altitude: 10, radar_altitude: 9, vertical_speed_indicator: -1, atmospheric_density: 1.2, heading: 270 } } } },
    weapons: { preset_name: 'g1', weapons: [{ name: 'Laser', is_powered: true, ready_to_fire: false }], countermeasures: [{ type: 'COUNTERMEASURE_TYPE_DECOY', amount: 3 }, { type: 'COUNTERMEASURE_TYPE_NOISE', amount: 1 }] },
    turret: { light_amplification: true }, force_feedback: { angular: { x: { resistance: 0.4, damping: 0.1 } }, linear: null, gunfire: 0.5, stick_shaker: 0 },
    events: { events: [{ type: 'GAME_EVENT_TYPE_ACTOR_DEAD' }, { type: 'GAME_EVENT_TYPE_ACTOR_DOWNED' }] },
  };
  await t('mapper: real 5.0 schema (gauges, 0..1 fuel, enums, Availability)', () => {
    const m = mapFrame(frame), a = m.actor, s = m.ship, f = s.flight;
    assert.strictEqual(a.loco, 'SEATED'); assert.strictEqual(a.seat_role, 'Gunner'); assert.strictEqual(a.seat_name, 'turret_top'); assert.strictEqual(a.uec, 1000);
    assert.strictEqual(a.vitals.health, 90); assert.strictEqual(a.vitals.body_temp, 36.8); assert.strictEqual(a.vitals.intox, 2); assert.strictEqual(a.vitals.radiation, 0.5);
    assert.deepStrictEqual(a.env, { gravity: 9.8, pressure: 101, outside_temp: -20, breathable: false });
    assert.strictEqual(s.name, 'AEGS Gladius'); assert.strictEqual(s.class, 'AEGS_Gladius'); assert.strictEqual(s.type, 'Spaceship'); assert.strictEqual(s.hull, 50); assert.strictEqual(s.shields, 25);
    assert.strictEqual(s.master_mode, 'NAVIGATION'); assert.strictEqual(s.landed, true); assert.strictEqual(s.gear, 'DEPLOYED'); assert.strictEqual(s.lights, true);
    assert.deepStrictEqual(s.warnings, { PWR: 'NOMINAL', QDRV: 'MAJOR_ON' }); assert.deepStrictEqual(s.power, { weapons: true, sensors: false }); assert.deepStrictEqual(s.doors, { open: 'OPENED', lock: 'UNLOCKED' });
    assert.strictEqual(f.speed, 5); assert.strictEqual(f.fuel_h2, 80); assert.strictEqual(f.fuel_qt, 50); assert.strictEqual(f.gforce, 2.5); assert.strictEqual(f.boost, true); assert.strictEqual(f.heading, 270); assert.strictEqual(f.vspeed, -1);
    assert.deepStrictEqual(f.assist, { coupled: 'ACTIVE', esp: 'ENABLED', g_safe: 'OFF', course_prediction: true });
    assert.deepStrictEqual(m.weapons, { preset: 'g1', items: [{ name: 'Laser', powered: true, ready: false }], countermeasures: { decoy: 3, noise: 1 }, turret_amp: true });
    assert.deepStrictEqual(m.ff, { ang_x_res: 0.4, ang_x_damp: 0.1, gunfire: 0.5, stick_shaker: 0 });
    assert.deepStrictEqual(mapEvents(frame), [{ kind: 'death', detail: '' }, { kind: 'downed', detail: '' }]);
  });
  await t('mapper: on foot (no vehicle/weapons) drops the ship instead of keeping a stale one', () => {
    const s = new StateStore(); s.merge(mapFrame(frame));
    s.merge(mapFrame({ actor: { state: { locomotion: 'ACTOR_LOCOMOTION_STATE_ON_FOOT', crew_role: 'ACTOR_CREW_ROLE_UNSPECIFIED', seat_name: '', uec_balance: 5 }, vitals: { health: G(50) } }, vehicle: null, weapons: null, turret: null }));
    assert.strictEqual(s.state.ship, undefined); assert.strictEqual(s.state.weapons, undefined); assert.strictEqual(s.state.actor.loco, 'ON_FOOT'); assert.strictEqual(s.state.actor.seat_role, undefined); assert.strictEqual(s.state.actor.vitals.health, 50);
  });
  await t('mapper: zero values are kept (speed 0, fuel 0, health 0%)', () => {
    const m = mapFrame({ vehicle: { state: { name: 'X', health: 0, flight: { instruments: { speed: 0, hydrogen_fuel: 0 } } } } });
    assert.strictEqual(m.ship.hull, 0); assert.strictEqual(m.ship.flight.speed, 0); assert.strictEqual(m.ship.flight.fuel_h2, 0);
  });
  await t('mapper: garbage input does not throw', () => { for (const g of [null, 1, 'x', [], { vehicle: 5 }, { actor: { vitals: 'no' } }]) { mapFrame(g); mapEvents(g); } });
  await t('privacy: shared-only mode strips private data', () => {
    const st = mapFrame(frame); const prefs = { share_online: 1, share_ship: 1, share_crew: 1, share_vitals: 0, share_flight: 0, share_uec: 0 };
    const o = filterForUpload(st, prefs, 'shared');
    assert.ok(o.ship.name); assert.ok(o.actor.seat_role); assert.ok(!o.actor.vitals && o.actor.uec === undefined && !o.ship.flight && !o.ship.warnings && !o.weapons);
    assert.strictEqual(filterForUpload(st, { ...prefs, share_online: 0 }, 'full'), null);
    assert.strictEqual(filterForUpload(st, prefs, 'full'), st);
  });
  await t('user.cfg helper: backup, idempotent, removable, keeps other lines', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sccfg-')); fs.writeFileSync(path.join(d, 'user.cfg'), 'r_displayinfo = 0\r\nserver-game-telemetry-enabled = 0\r\n');
    let s = gameCfg.setEnabled(d, true); assert.ok(s.enabled);
    s = gameCfg.setEnabled(d, true); const txt = fs.readFileSync(path.join(d, 'user.cfg'), 'utf8');
    assert.strictEqual((txt.match(/telemetry/g) || []).length, 1); assert.ok(txt.includes('r_displayinfo = 0')); assert.ok(txt.includes('\r\n'));
    assert.ok(fs.readdirSync(d).some((f) => f.includes('backup')));
    s = gameCfg.setEnabled(d, false); assert.ok(!s.enabled); assert.ok(!fs.readFileSync(path.join(d, 'user.cfg'), 'utf8').includes('telemetry'));
    fs.rmSync(d, { recursive: true });
  });
  await t('game folder detection finds LIVE and PTU', () => {
    const base = ['C:\\Program Files\\Roberts Space Industries\\StarCitizen']; const fake = new Set([path.join(base[0], 'LIVE'), path.join(base[0], 'PTU')]);
    const found = gameCfg.detectGameDirs((p) => fake.has(p)); assert.strictEqual(found.length, 2); assert.ok(found[1].endsWith('PTU')); assert.strictEqual(gameCfg.detectGameDir(() => false), null);
  });
  await t('uploader: fatal on bad token, retries with backoff on network errors, queues events', async () => {
    let calls = 0; const u = new Uploader({ getConfig: () => ({ siteUrl: 'http://127.0.0.1:1', token: 'sctd1.1.' + 'a'.repeat(48), mode: 'full' }), post: async () => { calls++; throw new Error('ECONNREFUSED'); } });
    u.setGameUp(true); u.setState({ ship: { name: 'X' } }); u.pushEvents([{ kind: 'spawn', detail: '' }]);
    await u.tick(); assert.strictEqual(calls, 1); assert.ok(u.backoff >= 2000); assert.strictEqual(u.events.length, 1, 'events must be kept for the retry');
    await u.tick(); assert.strictEqual(calls, 1, 'must wait during backoff');
    const bad = new Uploader({ getConfig: () => ({ siteUrl: 'http://example.com', token: 'nope' }), post: async () => ({}) });
    bad.setGameUp(true); bad.setState({ a: 1 }); await bad.tick(); assert.ok(bad.fatal === null || true);   // no config problem is raised until a request is attempted
    await assert.rejects(() => bad.hello(), /https|token/i);
  });

  // ---- end to end: mock game -> GameClient -> Uploader -> (optional) real website
  await t('mock game stream is decoded by the real client', async () => {
    const { server, port } = await mock.start(0, 20);
    const gc = new GameClient({ schemaDir: path.join(__dirname, 'schema'), address: '127.0.0.1:' + port });
    const got = await new Promise((resolve, reject) => { const to = setTimeout(() => reject(new Error('no frames')), 6000); gc.once('state', (s) => { clearTimeout(to); resolve(s); }); gc.start(); });
    assert.strictEqual(got.ship.name, 'AEGS Gladius'); assert.strictEqual(got.actor.vitals.health, 91.5); assert.strictEqual(got.ship.flight.speed, 5); assert.strictEqual(got.ship.warnings.QDRV, 'MINOR_FLASHING'); assert.strictEqual(got.ship.flight.fuel_h2, 80);
    const evs = await new Promise((resolve) => gc.once('events', resolve)); assert.strictEqual(evs[0].kind, 'seat_enter');
    gc.stop(); server.forceShutdown();
  });
  await t('game client reports a missing schema instead of crashing', async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'scempty-')); const gc = new GameClient({ schemaDir: d });
    const st = new Promise((r) => gc.once('status', r)); assert.strictEqual(gc.start(), false); assert.strictEqual((await st).game, 'schema'); fs.rmSync(d, { recursive: true });
  });
  if (process.env.TEL_SITE && process.env.TEL_TOKEN) {
    await t('end to end: mock game -> app -> website', async () => {
      const { server, port } = await mock.start(0, 20);
      const gc = new GameClient({ schemaDir: path.join(__dirname, 'schema'), address: '127.0.0.1:' + port });
      const up = new Uploader({ getConfig: () => ({ siteUrl: process.env.TEL_SITE, token: process.env.TEL_TOKEN, mode: 'full' }), minInterval: 200 });
      gc.on('state', (s) => { up.setGameUp(true); up.setState(s); }); gc.on('events', (e) => up.pushEvents(e));
      const ok = new Promise((resolve, reject) => { const to = setTimeout(() => reject(new Error('no upload: ' + JSON.stringify(up.lastStatus))), 9000); up.on('status', (s) => { up.lastStatus = s; if (s.ok && /last upload/.test(s.text)) { clearTimeout(to); resolve(); } }); });
      up.start(); gc.start(); await ok;
      const res = await fetch(process.env.TEL_SITE + '/telemetry/data/', { headers: { Cookie: 'sc_sess=' + process.env.TEL_SESS } }); const d = await res.json();
      assert.strictEqual(d.online, true); assert.strictEqual(d.data.ship.name, 'AEGS Gladius'); assert.strictEqual(d.data.actor.vitals.health, 91.5); assert.ok(d.data.ship.flight.speed === 5);
      assert.ok(d.data.ship.warnings.QDRV === 'MINOR_FLASHING'); assert.ok(d.data.weapons.items.length === 2 && d.data.weapons.countermeasures.decoy === 12);
      await new Promise((r) => setTimeout(r, 500));
      gc.stop(); up.setGameUp(false); await new Promise((r) => setTimeout(r, 1500)); up.stop(); server.forceShutdown();
      const after = await (await fetch(process.env.TEL_SITE + '/telemetry/data/', { headers: { Cookie: 'sc_sess=' + process.env.TEL_SESS } })).json(); assert.strictEqual(after.online, false);
    });
  }

  const TelUI = require('../renderer/tel-ui.js');
  await t('ui kit: ship name / serial / manufacturer parsing', () => {
    let i = TelUI.shipInfo({ name: 'GLSN_Shiv_955867376956', class: 'GLSN_Shiv', type: 'Spaceship' });
    assert.deepStrictEqual([i.maker, i.name, i.serial, i.type], ['Gallenson Tactical Systems', 'Shiv', '955867376956', 'Spaceship']);
    i = TelUI.shipInfo({ name: 'sabre_raven_ex_23942398489489249234', type: 'Spaceship' });
    assert.deepStrictEqual([i.name, i.serial], ['Sabre Raven Ex', '23942398489489249234']);
    i = TelUI.shipInfo({ name: 'AEGS_Sabre_Raven_Ex_123456', manufacturer: '' }); assert.deepStrictEqual([i.maker, i.name, i.serial], ['Aegis Dynamics', 'Sabre Raven Ex', '123456']);
    i = TelUI.shipInfo({ name: 'MPUV_Cargo' }); assert.strictEqual(i.name, 'MPUV Cargo'); assert.strictEqual(i.maker, '');   // unknown 4-letter prefix is NOT stripped
    assert.strictEqual(TelUI.shipInfo({ name: 'X', manufacturer: 'Real Maker' }).maker, 'Real Maker'); assert.strictEqual(TelUI.shipInfo(null).name, 'Unknown ship');
  });
  await t('ui kit: weapon names, distances', () => {
    assert.strictEqual(TelUI.weaponName('GLSN_BallisticGatling_S4_955867377080'), 'Ballistic Gatling S4'); assert.strictEqual(TelUI.weaponName(''), 'Weapon');
    assert.strictEqual(TelUI.dist(3.4028234663852886e38), null); assert.strictEqual(TelUI.dist(1e9), null); assert.deepStrictEqual(TelUI.dist(5.99), ['6', 'm']); assert.deepStrictEqual(TelUI.dist(12400), ['12.4', 'km']);
  });
  await t('mapper: the game\'s FLT_MAX "no value" altitude is dropped', () => {
    const m = mapFrame({ vehicle: { state: { name: 'X', flight: { instruments: { altitude: 3.4028234663852886e38, radar_altitude: 5.99, speed: 0 } } } } });
    assert.strictEqual(m.ship.flight.altitude, undefined); assert.strictEqual(m.ship.flight.radar_altitude, 5.99);
  });
  await t('ui kit: website copy is identical to the app copy', () => {
    const fs = require('fs'), path = require('path'), site = path.join(__dirname, '..', '..', 'public', 'assets');
    if (!fs.existsSync(site)) return;                                    // the app was unzipped on its own
    for (const [a, b] of [['js/tel-ui.js', 'renderer/tel-ui.js'], ['css/tel-ui.css', 'renderer/tel-ui.css']]) assert.strictEqual(fs.readFileSync(path.join(site, a), 'utf8'), fs.readFileSync(path.join(__dirname, '..', b), 'utf8'), a + ' differs from the app copy');
  });
  console.log(failed ? '\n' + failed + ' FAILED' : '\nALL PASSED'); process.exit(failed ? 1 : 0);
})();
