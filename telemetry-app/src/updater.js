'use strict';
const { EventEmitter } = require('events');
const { cmp } = require('./version');

/**
 * Keeps the app current.
 *  - auto mode (installed build): electron-updater downloads the new release from GitHub in the background and
 *    installs it when the member presses "Restart & update" (or when the app is next closed).
 *  - manual mode (portable build / running from source): the app only knows a newer version exists (the site tells
 *    it) and offers a download link.
 * The website also tells the app the newest and the oldest-allowed version on every hello; `noteSite` handles that.
 */
class Updater extends EventEmitter {
  constructor({ currentVersion, autoUpdater = null, auto = false }) {
    super();
    this.au = autoUpdater; this.auto = !!(auto && autoUpdater);
    this.s = { state: 'idle', current: currentVersion, latest: '', percent: 0, mode: this.auto ? 'auto' : 'manual', required: false, message: '' };
  }
  get state() { return { ...this.s }; }
  set(p) { Object.assign(this.s, p); this.emit('change', this.state); }

  init() {
    const au = this.au; if (!this.auto) return;
    au.autoDownload = true; au.autoInstallOnAppQuit = true; au.allowPrerelease = false; au.allowDowngrade = false;
    au.on('checking-for-update', () => { if (this.s.state !== 'downloading' && this.s.state !== 'ready') this.set({ state: 'checking', message: '' }); });
    au.on('update-available', (i) => this.set({ state: 'downloading', latest: i.version, percent: 0, message: '' }));
    au.on('update-not-available', () => { if (this.s.state !== 'ready') this.set({ state: 'uptodate', message: '' }); });
    au.on('download-progress', (p) => this.set({ state: 'downloading', percent: Math.round(p.percent || 0) }));
    au.on('update-downloaded', (i) => this.set({ state: 'ready', latest: i.version, percent: 100 }));
    au.on('error', (e) => this.set({ state: this.s.state === 'ready' ? 'ready' : 'error', message: String((e && e.message) || e).split('\n')[0].slice(0, 160) }));
  }
  check() {
    if (!this.auto) { this.emit('change', this.state); return Promise.resolve(); }
    if (this.s.state === 'downloading' || this.s.state === 'ready') return Promise.resolve();
    return Promise.resolve(this.au.checkForUpdates()).catch(() => {});       // errors arrive through the 'error' event
  }
  /** Info from the website: { latest, min }. */
  noteSite(u) {
    if (!u) return;
    const patch = {};
    if (u.min) patch.required = cmp(this.s.current, u.min) < 0;
    if (u.latest && cmp(u.latest, this.s.current) > 0) {
      if (!this.auto) Object.assign(patch, { state: 'available', latest: u.latest });
      else if (['idle', 'uptodate', 'error'].includes(this.s.state)) { this.set(patch); return this.check(); }   // the site knows of a newer release -> look now
    } else if (!this.auto && this.s.state === 'available') Object.assign(patch, { state: 'uptodate' });
    if (Object.keys(patch).length) this.set(patch);
  }
  install() { if (this.auto && this.s.state === 'ready') { this.au.quitAndInstall(true, true); return true; } return false; }
}
module.exports = { Updater };
