'use strict';
const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');
const { sign, newNonce, parseToken, normalizeSiteUrl } = require('./signing');
const { filterForUpload } = require('./privacy');

const PATH = '/api/telemetry/';

/** Plain HTTPS POST with a hard timeout and response cap. TLS certificates are always verified. */
function httpPost(origin, headers, body, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const u = new URL(origin + PATH);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({ method: 'POST', hostname: u.hostname, port: u.port || undefined, path: u.pathname, headers: { ...headers, 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'StellarockTelemetry' }, timeout: timeoutMs }, (res) => {
      const chunks = []; let n = 0;
      res.on('data', (c) => { n += c.length; if (n > 65536) { req.destroy(new Error('response too large')); return; } chunks.push(c); });
      res.on('end', () => { let json = {}; try { json = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { /* not json */ } resolve({ status: res.statusCode, json, headers: res.headers }); });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

class Uploader extends EventEmitter {
  /** opts.getConfig() -> { siteUrl, token, mode }  |  opts.post (test hook) | opts.appVersion */
  constructor(opts) {
    super();
    this.getConfig = opts.getConfig; this.post = opts.post || httpPost; this.appVersion = opts.appVersion || '1.0.0';
    this.minInterval = opts.minInterval || 1000; this.heartbeat = opts.heartbeat || 15000;
    this.state = null; this.lastSent = ''; this.lastSentAt = 0; this.events = []; this.prefs = null;
    this.timer = null; this.backoff = 0; this.nextAt = 0; this.busy = false; this.fatal = null; this.gameUp = false; this.wentOffline = true;
  }
  start() { if (!this.timer) this.timer = setInterval(() => this.tick().catch(() => {}), 250); }
  stop() { clearInterval(this.timer); this.timer = null; }
  setState(s) { this.state = s; }
  setGameUp(up) { this.gameUp = up; }
  pushEvents(evts) { this.events.push(...evts); if (this.events.length > 100) this.events.splice(0, this.events.length - 100); }
  clearFatal() { this.fatal = null; this.backoff = 0; this.nextAt = 0; }

  async request(body) {
    const cfg = this.getConfig(); const origin = normalizeSiteUrl(cfg.siteUrl); const tok = parseToken(cfg.token);
    if (!origin) throw Object.assign(new Error('Site address must be https://…'), { fatal: true });
    if (!tok) throw Object.assign(new Error('Device token is missing or malformed.'), { fatal: true });
    const raw = JSON.stringify(body), ts = String(Math.floor(Date.now() / 1000)), nonce = newNonce();
    const sig = sign(tok.secret, 'POST', PATH, ts, nonce, raw);
    return this.post(origin, { 'Content-Type': 'application/json', 'X-SC-Device': tok.deviceId, 'X-SC-Timestamp': ts, 'X-SC-Nonce': nonce, 'X-SC-Signature': sig }, raw);
  }
  async send(body) {
    const r = await this.request(body);
    if (r.json && r.json.update) this.emit('update-info', r.json.update);
    if (r.status === 200 && r.json && r.json.me && r.json.me.name) { this.me = r.json.me; this.emit('me', this.me); }   // rank, permissions, division, teams - always read from the site     // newest / oldest-allowed version, from the site
    if (r.status === 200) { if (r.json.prefs) { this.prefs = r.json.prefs; this.emit('prefs', this.prefs); } this.backoff = 0; return r.json; }
    const err = new Error(r.json.error || ('HTTP ' + r.status)); err.status = r.status; err.json = r.json;
    if (r.status === 401 || r.status === 426) err.fatal = true;            // 426 = this version is too old for the site
    if (r.status === 429) err.retryAfter = Number(r.headers['retry-after']) || 10;
    throw err;
  }
  /** Used by the settings screen: verifies the token and returns the member's name + sharing rules. */
  async hello() { return this.send({ type: 'hello', app_version: this.appVersion }); }
  /** Online members as this member is allowed to see them (the site applies every member's sharing rules). */
  async roster() { return this.send({ type: 'roster', app_version: this.appVersion }); }
  async chatChannels() { return this.send({ type: 'chat_channels', app_version: this.appVersion }); }
  async chatFetch(channel, after) { return this.send({ type: 'chat_fetch', channel, after: after || 0, app_version: this.appVersion }); }
  async chatSend(channel, body) { return this.send({ type: 'chat_send', channel, body, app_version: this.appVersion }); }
  async setPrefs(prefs) { return this.send({ type: 'prefs', prefs, app_version: this.appVersion }); }

  async tick() {
    if (this.busy || this.fatal || Date.now() < this.nextAt) return;
    const cfg = this.getConfig(); if (!cfg.siteUrl || !cfg.token) return;
    if (!this.gameUp) {                                                   // game closed -> tell the site once
      if (!this.wentOffline) { this.busy = true; try { await this.send({ type: 'offline' }); this.wentOffline = true; this.lastSent = ''; this.emit('status', { ok: true, text: 'Game not running' }); } catch (e) { this.fail(e); } finally { this.busy = false; } }
      return;
    }
    if (!this.state) return;
    if (!this.prefs) { try { this.busy = true; await this.hello(); } catch (e) { this.fail(e); return; } finally { this.busy = false; } }
    const payload = filterForUpload(this.state, this.prefs, cfg.mode);
    if (payload === null) { this.emit('status', { ok: true, text: 'Online status hidden — nothing is being sent' }); return; }
    const key = JSON.stringify(payload), now = Date.now();
    const changed = key !== this.lastSent;
    if (!(changed && now - this.lastSentAt >= this.minInterval) && !(now - this.lastSentAt >= this.heartbeat) && !(this.events.length && now - this.lastSentAt >= this.minInterval)) return;
    const evts = this.events.splice(0, 20);
    this.busy = true;
    try {
      await this.send({ type: 'state', app_version: this.appVersion, ...payload, events: evts });
      this.lastSent = key; this.lastSentAt = Date.now(); this.wentOffline = false;
      this.emit('status', { ok: true, text: 'Connected — last upload ' + new Date().toLocaleTimeString() });
    } catch (e) { this.events.unshift(...evts); this.fail(e); }
    finally { this.busy = false; }
  }
  fail(e) {
    if (e.fatal) { this.fatal = e; this.emit('status', { ok: false, fatal: true, text: e.status === 401 ? (e.json && e.json.server_time ? e.message : 'Rejected by the site — the token was revoked or is wrong. Create a new one.') : e.message }); return; }
    this.backoff = e.retryAfter ? e.retryAfter * 1000 : Math.min(30000, this.backoff ? this.backoff * 2 : 2000);
    this.nextAt = Date.now() + this.backoff;
    this.emit('status', { ok: false, text: 'Upload failed (' + (e.message || 'network') + ') — retrying in ' + Math.round(this.backoff / 1000) + ' s' });
  }
}
module.exports = { Uploader, httpPost, PATH };
