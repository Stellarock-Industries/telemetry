'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULTS = { siteUrl: '', mode: 'full', gameDir: '', cfgVariant: 'dotted', tokenEnc: '' };
/** JSON settings in the user-data folder. The device token is stored encrypted with the OS keystore (Electron safeStorage / Windows DPAPI). */
class Settings {
  constructor(dir, safeStorage) { this.file = path.join(dir, 'settings.json'); this.safe = safeStorage; this.data = { ...DEFAULTS }; this.memToken = ''; this.load(); }
  load() { try { const j = JSON.parse(fs.readFileSync(this.file, 'utf8')); for (const k of Object.keys(DEFAULTS)) if (typeof j[k] === 'string') this.data[k] = j[k]; } catch { /* first run */ } }
  save() { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), { mode: 0o600 }); }
  get encryptionAvailable() { return !!(this.safe && this.safe.isEncryptionAvailable()); }
  getToken() {
    if (this.memToken) return this.memToken;
    if (this.data.tokenEnc && this.encryptionAvailable) { try { return this.safe.decryptString(Buffer.from(this.data.tokenEnc, 'base64')); } catch { return ''; } }
    return '';
  }
  setToken(t) {
    this.memToken = t || ''; this.data.tokenEnc = '';
    if (t && this.encryptionAvailable) { this.data.tokenEnc = this.safe.encryptString(t).toString('base64'); this.memToken = ''; }   // never written in plain text
    this.save(); return this.encryptionAvailable || !t;
  }
  hasToken() { return !!this.getToken(); }
  set(patch) {
    if (typeof patch.siteUrl === 'string') this.data.siteUrl = patch.siteUrl.trim();
    if (patch.mode === 'full' || patch.mode === 'shared') this.data.mode = patch.mode;
    if (typeof patch.gameDir === 'string') this.data.gameDir = patch.gameDir;
    if (patch.cfgVariant === 'dotted' || patch.cfgVariant === 'hyphen') this.data.cfgVariant = patch.cfgVariant;
    this.save();
  }
  view() { return { siteUrl: this.data.siteUrl, mode: this.data.mode, gameDir: this.data.gameDir, cfgVariant: this.data.cfgVariant, hasToken: this.hasToken(), encryptionAvailable: this.encryptionAvailable }; }
}
module.exports = { Settings };
