'use strict';
const { app, BrowserWindow, ipcMain, safeStorage, dialog, session, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { Settings } = require('./src/settings');
const { GameClient } = require('./src/gameClient');
const { Uploader } = require('./src/uploader');
const { normalizeSiteUrl, parseToken } = require('./src/signing');
const gameCfg = require('./src/gameCfg');
const schemaFetch = require('./src/schemaFetch');

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.enableSandbox();

let win = null, settings, game, uploader;
const status = { game: { game: 'waiting', text: 'Waiting for Star Citizen…' }, site: { ok: false, text: 'Not linked yet' }, prefs: null, user: '' };
let lastState = {}, events = [];

// Bundled schema (read-only) and the user's own schema folder (writable). The user's wins.
const userSchemaDir = () => path.join(app.getPath('userData'), 'schema');
// The user's own schema folder wins; otherwise use the .proto files bundled with the app.
const schemaDir = () => (require('./src/gameClient').listProtos(userSchemaDir()).length ? userSchemaDir() : path.join(__dirname, 'schema'));
const send = (ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); };

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 760, minWidth: 420, minHeight: 360, backgroundColor: '#0a1017', title: 'Stellarock Telemetry', icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('closed', () => { win = null; });
}

function startServices() {
  game = new GameClient({ schemaDir: schemaDir() });
  uploader = new Uploader({ getConfig: () => ({ siteUrl: settings.data.siteUrl, token: settings.getToken(), mode: settings.data.mode }), appVersion: app.getVersion() });
  game.on('status', (s) => { status.game = s; uploader.setGameUp(s.game === 'connected'); send('status', status); });
  game.on('state', (s) => { lastState = s; uploader.setState(s); });
  game.on('events', (e) => { events = [...e.map((x) => ({ ...x, t: Date.now() })), ...events].slice(0, 30); uploader.pushEvents(e); });
  uploader.on('status', (s) => { status.site = s; send('status', status); });
  uploader.on('prefs', (p) => { status.prefs = p; send('status', status); });
  uploader.start(); game.start();
  setInterval(() => send('state', { state: lastState, events, connected: status.game.game === 'connected' }), 250);   // UI refresh rate, independent of the 50 ms stream
}
function restartGame() { game.stop(); game.schemaDir = schemaDir(); game.start(); }

function registerIpc() {
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), schemaDir: schemaDir(), settings: settings.view(), status }));
  ipcMain.handle('settings:save', async (_e, patch) => {
    if (patch.siteUrl !== undefined && patch.siteUrl !== '' && !normalizeSiteUrl(patch.siteUrl)) return { ok: false, error: 'The site address must start with https://' };
    settings.set(patch); uploader.clearFatal(); uploader.prefs = null; return { ok: true, settings: settings.view() };
  });
  ipcMain.handle('token:set', async (_e, token) => {
    if (token && !parseToken(token)) return { ok: false, error: 'That does not look like a device token (it starts with sctd1.).' };
    if (token && !settings.encryptionAvailable) return { ok: false, error: 'Secure storage is not available on this PC, so the token will not be saved to disk; it is kept in memory until you close the app.', kept: settings.setToken(token) };
    settings.setToken(token || ''); uploader.clearFatal(); uploader.prefs = null; return { ok: true, settings: settings.view() };
  });
  ipcMain.handle('site:test', async () => {
    try { uploader.clearFatal(); const r = await uploader.hello(); status.user = r.user; status.prefs = r.prefs; status.site = { ok: true, text: 'Linked as ' + r.user }; send('status', status); return { ok: true, user: r.user, prefs: r.prefs }; }
    catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('roster:get', async () => { try { const r = await uploader.roster(); return { ok: true, members: r.members || [], ships: r.ships || [], myKey: r.my_key || null }; } catch (e) { return { ok: false, error: /unknown type/i.test(e.message) ? 'Your website is running an older version that cannot list online members yet. Ask a leader to update the site (src/telemetry.php and public/api/telemetry/index.php).' : e.message }; } });
  ipcMain.handle('prefs:save', async (_e, prefs) => {
    try { const r = await uploader.setPrefs(prefs); status.prefs = r.prefs; send('status', status); return { ok: true, prefs: r.prefs }; } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('schema:download', async () => { try { const n = await schemaFetch.download(userSchemaDir()); restartGame(); return { ok: true, files: n }; } catch (e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('schema:open', () => { require('fs').mkdirSync(userSchemaDir(), { recursive: true }); return shell.openPath(userSchemaDir()); });
  ipcMain.handle('schema:reload', () => { restartGame(); return { ok: true }; });
  ipcMain.handle('cfg:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Select your Star Citizen game folder (LIVE or PTU)', properties: ['openDirectory'], defaultPath: settings.data.gameDir || gameCfg.detectGameDir() || undefined });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    settings.set({ gameDir: r.filePaths[0] }); return { ok: true, dir: r.filePaths[0], status: gameCfg.status(r.filePaths[0]) };
  });
  ipcMain.handle('cfg:status', () => { const found = gameCfg.detectGameDirs(); const dir = settings.data.gameDir || found[0] || ''; return { dir, found, status: dir ? gameCfg.status(dir) : null }; });
  ipcMain.handle('cfg:use', (_e, dir) => { const ok = gameCfg.detectGameDirs().includes(dir); if (ok) settings.set({ gameDir: dir }); return { ok }; });
  ipcMain.handle('cfg:set', (_e, enabled) => {
    const dir = settings.data.gameDir || gameCfg.detectGameDir(); if (!dir) return { ok: false, error: 'Choose your Star Citizen game folder (LIVE or PTU) first.' };
    try { return { ok: true, dir, status: gameCfg.setEnabled(dir, !!enabled, settings.data.cfgVariant) }; } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('guide:open', () => {
    const origin = normalizeSiteUrl(settings.data.siteUrl); if (!origin) return { ok: false, error: 'Enter your website address first.' };
    shell.openExternal(origin + '/guide/telemetry/'); return { ok: true };
  });
  ipcMain.handle('open:guide', () => { const o = normalizeSiteUrl(settings.data.siteUrl); if (o) shell.openExternal(o + '/guide/telemetry/'); return { ok: !!o }; });
  ipcMain.handle('open:external', (_e, url) => { if (typeof url === 'string' && /^https:\/\//.test(url)) shell.openExternal(url); });
}

app.whenReady().then(() => {
  // No network access from the UI at all, no permissions, strict CSP.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.webRequest.onHeadersReceived((d, cb) => cb({ responseHeaders: { ...d.responseHeaders, 'Content-Security-Policy': ["default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"] } }));
  settings = new Settings(app.getPath('userData'), safeStorage);
  registerIpc(); createWindow(); startServices();
  app.on('activate', () => { if (!win) createWindow(); });
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('before-quit', () => { try { game && game.stop(); uploader && uploader.setGameUp(false); } catch { /* */ } });
app.on('window-all-closed', async () => {
  // tell the site we are going offline before quitting (best effort, 2 s max)
  try { uploader.setGameUp(false); await Promise.race([uploader.tick(), new Promise((r) => setTimeout(r, 2000))]); } catch { /* */ }
  app.quit();
});
