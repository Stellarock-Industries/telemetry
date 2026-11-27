'use strict';
// Fake Star Citizen telemetry server (gRPC over cleartext HTTP/2) used by the tests and for trying the app without the game.
//   node test/mockGame.js      -> listens on 127.0.0.1:2942
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

function start(port = 2942, intervalMs = 50) {
  const dir = path.join(__dirname, 'schema');
  const def = protoLoader.loadSync(['sc/game/telemetry/v1/api.proto'], { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true, includeDirs: [dir] });
  const svc = grpc.loadPackageDefinition(def).sc.game.telemetry.v1.GameTelemetryService.service;
  const server = new grpc.Server(); let t = 0;
  const nope = (c, cb) => cb({ code: grpc.status.UNIMPLEMENTED });
  server.addService(svc, {
    TriggerGameAction: nope, ListTriggerableActions: nope,
    TelemetryStream(call) {
      const timer = setInterval(() => {
        t++;
        const frame = {
          actor: { vitals: { health: { current: 91.5, max: 100 }, oxygen: { current: 98, max: 100 }, hunger: { current: 42, max: 100 }, thirst: { current: 37, max: 100 }, body_temperature: { current: 36.8, max: 45 }, heart_rate: 70 + (t % 5), gravity: 9.8, pressure: 101.3, intoxication_level: 0 },
            state: { locomotion: 'ACTOR_LOCOMOTION_STATE_SEATED', crew_role: 'ACTOR_CREW_ROLE_PILOT', seat_name: 'pilot_seat', uec_balance: 250000 + t },
            environment: { external_temperature: 21, ambient_radiation_rate: 0.1, breathable_atmosphere: true } },
          vehicle: { state: { name: 'AEGS Gladius', class_name: 'AEGS_Gladius', manufacturer: 'Aegis Dynamics', type: 'VEHICLE_TYPE_SPACESHIP', lights_enabled: true, health: 1,
            doors: { open_state: 'DOOR_OPEN_STATE_CLOSED', lock_state: 'DOOR_LOCK_STATE_LOCKED' },
            annunciators: { pwr: 'ANNUNCIATOR_STATE_NOMINAL', wpn: 'ANNUNCIATOR_STATE_NOMINAL', qdrv: 'ANNUNCIATOR_STATE_MINOR_FLASHING', misl: 'ANNUNCIATOR_STATE_OFF' },
            power: { powerplants: true, engines: true, weapons: true, shield_generators: true, sensors: false },
            shields: { level: 0.75, faces: [0.7, 0.8] }, master_mode: { mode: 'VEHICLE_MASTER_MODE_SCM', spooled: false },
            flight: { state: { is_landed: false, gear: 'VEHICLE_COMPONENT_DEPLOYMENT_STATE_RETRACTED' },
              settings: { ifcs_coupled: { enabled: true, active: true }, ifcs_esp: { enabled: true, active: false }, ifcs_cruise_mode: { enabled: false, active: false }, ifcs_spacebreak_enables_boost: true, course_prediction: false },
              instruments: { speed: 5, hydrogen_fuel: 0.8, quantum_fuel: 0.66, g_meter: { current: 1.1, max: 9 }, boost: { engaged: false, output: 0, reserves: 1, critical: false }, altitude: 1500 + t, radar_altitude: 1400, vertical_speed_indicator: 0.5, atmospheric_density: 0.8, heading: 90 } } } },
          weapons: { preset_index: 1, preset_name: 'group1', weapons: [{ name: 'S3 Laser Repeater', is_powered: true, ready_to_fire: true }, { name: 'S2 Cannon', is_powered: true, ready_to_fire: false }],
            countermeasures: [{ type: 'COUNTERMEASURE_TYPE_DECOY', amount: 12 }, { type: 'COUNTERMEASURE_TYPE_NOISE', amount: 8 }] },
          turret: { light_amplification: false }, force_feedback: { angular: { x: { resistance: 0.4, damping: 0.2 } }, gunfire: 0, stick_shaker: 0 },
        };
        if (t === 5) frame.events = { events: [{ type: 'GAME_EVENT_TYPE_ACTOR_ENTER_SEAT' }] };
        call.write(frame);
      }, intervalMs);
      call.on('cancelled', () => clearInterval(timer)); call.on('error', () => clearInterval(timer)); call.on('close', () => clearInterval(timer));
    },
  });
  return new Promise((resolve, reject) => server.bindAsync('127.0.0.1:' + port, grpc.ServerCredentials.createInsecure(), (err, p) => err ? reject(err) : resolve({ server, port: p })));
}
module.exports = { start };
if (require.main === module) start().then(({ port }) => console.log('mock game telemetry on 127.0.0.1:' + port));
