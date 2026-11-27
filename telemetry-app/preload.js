'use strict';
const { contextBridge, ipcRenderer } = require('electron');
// The page gets a small, fixed set of functions - never ipcRenderer itself or Node.
const invoke = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('sct', {
  info: invoke('app:info'), saveSettings: invoke('settings:save'), setToken: invoke('token:set'), testSite: invoke('site:test'), savePrefs: invoke('prefs:save'), roster: invoke('roster:get'),
  downloadSchema: invoke('schema:download'), openSchemaFolder: invoke('schema:open'), reloadSchema: invoke('schema:reload'),
  pickGameDir: invoke('cfg:pick'), useGameDir: invoke('cfg:use'), openGuide: invoke('open:guide'), cfgStatus: invoke('cfg:status'), cfgSet: invoke('cfg:set'), openExternal: invoke('open:external'), openGuide: invoke('guide:open'),
  updateGet: invoke('update:get'), updateCheck: invoke('update:check'), updateInstall: invoke('update:install'), updateDownload: invoke('update:download'),
  envStatus: invoke('env:status'), envSet: invoke('env:set'), envRemove: invoke('env:remove'),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, p) => cb(p)),
  onState: (cb) => ipcRenderer.on('state', (_e, p) => cb(p)), onStatus: (cb) => ipcRenderer.on('status', (_e, p) => cb(p)),
});
