'use strict';
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { mapFrame, mapEvents, StateStore } = require('./mapper');

const SERVICE = 'GameTelemetryService';

function listProtos(dir) {
  const out = [];
  (function walk(d) { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.proto')) out.push(path.relative(dir, p)); } })(dir);
  return out;
}
function findService(root, name = SERVICE) {
  for (const [k, v] of Object.entries(root)) {
    if (k === name && typeof v === 'function' && v.service) return v;
    if (v && typeof v === 'object' && !v.service) { const r = findService(v, name); if (r) return r; }
  }
  return null;
}
/** Loads *.proto files from the schema folder. Returns the generated service constructor. */
function loadSchema(schemaDir) {
  const files = listProtos(schemaDir);
  if (!files.length) throw Object.assign(new Error('No .proto files found in ' + schemaDir), { code: 'NO_SCHEMA' });
  const def = protoLoader.loadSync(files, { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true, includeDirs: [schemaDir] });
  const Svc = findService(grpc.loadPackageDefinition(def));
  if (!Svc) throw Object.assign(new Error('The schema has no ' + SERVICE + ' service.'), { code: 'NO_SERVICE' });
  return Svc;
}

class GameClient extends EventEmitter {
  /** opts: { schemaDir, address } */
  constructor(opts) {
    super();
    this.schemaDir = opts.schemaDir; this.address = opts.address || '127.0.0.1:2942';
    this.store = new StateStore(); this.stream = null; this.client = null; this.stopped = true; this.retry = 1000; this.connected = false; this.lastFrame = 0; this.watchdog = null; this.frames = 0;
  }
  start() {
    this.stopped = false;
    try { this.Svc = loadSchema(this.schemaDir); } catch (e) { this.emit('status', { game: 'schema', text: e.message }); return false; }
    this.connect(); return true;
  }
  stop() { this.stopped = true; clearTimeout(this.timer); clearInterval(this.watchdog); this.teardown(); this.setConnected(false); }
  teardown() { try { this.stream && this.stream.cancel(); } catch { /* */ } try { this.client && this.client.close(); } catch { /* */ } this.stream = null; this.client = null; }
  setConnected(v, text) { if (v !== this.connected) { this.connected = v; if (!v) this.store.reset(); } this.emit('status', { game: v ? 'connected' : 'waiting', text: text || (v ? 'Receiving telemetry' : 'Waiting for Star Citizen…') }); }
  connect() {
    if (this.stopped) return;
    // Cleartext HTTP/2 to the game on this PC only; the address is never user-editable to a remote host here.
    this.client = new this.Svc(this.address, grpc.credentials.createInsecure(), { 'grpc.keepalive_time_ms': 10000 });
    this.client.waitForReady(Date.now() + 3000, (err) => {
      if (this.stopped) return;
      if (err) return this.scheduleRetry();
      this.stream = this.client.TelemetryStream({});
      this.stream.on('data', (frame) => this.onFrame(frame));
      this.stream.on('error', (e) => { if (!this.stopped && e.code !== grpc.status.CANCELLED) this.emit('status', { game: 'waiting', text: 'Stream ended: ' + (e.details || e.message) }); this.scheduleRetry(); });
      this.stream.on('end', () => this.scheduleRetry());
    });
    clearInterval(this.watchdog);
    this.watchdog = setInterval(() => { if (this.connected && Date.now() - this.lastFrame > 10000) { this.teardown(); this.setConnected(false); this.scheduleRetry(); } }, 2000);
  }
  scheduleRetry() {
    if (this.stopped || this.retryPending) return; this.retryPending = true;
    this.teardown(); if (this.connected) this.setConnected(false); else this.emit('status', { game: 'waiting', text: 'Waiting for Star Citizen…' });
    this.timer = setTimeout(() => { this.retryPending = false; this.connect(); }, this.retry);
    this.retry = Math.min(10000, this.retry * 1.5);
  }
  onFrame(frame) {
    this.lastFrame = Date.now(); this.frames++;
    if (!this.connected) { this.retry = 1000; this.setConnected(true); }
    const mapped = mapFrame(frame); const events = mapEvents(frame, mapped.actor && mapped.actor.seat_name);
    const state = this.store.merge(mapped);
    this.emit('state', state); if (events.length) this.emit('events', events);
    if (this.frames === 1 && process.env.SC_TELEMETRY_DEBUG) this.emit('raw', frame);
  }
}
module.exports = { GameClient, loadSchema, listProtos };
