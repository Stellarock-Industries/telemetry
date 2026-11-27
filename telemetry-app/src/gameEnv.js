'use strict';
/**
 * Sets / checks / removes the per-user Windows environment variable GRPC_CLIENT_SERVER_ENABLED=true
 * (the same as running `setx GRPC_CLIENT_SERVER_ENABLED true`). Only this one fixed name and value can be written;
 * nothing from the UI reaches the command line. Programs started AFTER this (e.g. a restarted RSI Launcher) see it.
 */
const { execFile } = require('child_process');
const NAME = 'GRPC_CLIENT_SERVER_ENABLED', VALUE = 'true';

const run = (exec, file, args) => new Promise((resolve) => exec(file, args, { windowsHide: true, timeout: 10000 }, (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout || ''), err: String(stderr || (err && err.message) || '') })));

/** -> { supported, set, value, inThisApp } ; `set` means the saved user variable equals "true". */
async function status({ exec = execFile, platform = process.platform, env = process.env } = {}) {
  if (platform !== 'win32') return { supported: false, set: false, value: '', inThisApp: false };
  const r = await run(exec, 'reg', ['query', 'HKCU\\Environment', '/v', NAME]);
  const m = r.ok && r.out.match(new RegExp('^\\s*' + NAME + '\\s+REG_\\w+\\s+(.*?)\\s*$', 'im'));
  const value = m ? m[1] : '';
  return { supported: true, set: value.toLowerCase() === VALUE, value, inThisApp: String(env[NAME] || '').toLowerCase() === VALUE };
}
async function set({ exec = execFile, platform = process.platform } = {}) {
  if (platform !== 'win32') return { ok: false, error: 'This only works on Windows.' };
  const r = await run(exec, 'setx', [NAME, VALUE]);
  return r.ok ? { ok: true } : { ok: false, error: 'Windows refused: ' + (r.err.trim() || 'unknown error') };
}
async function remove({ exec = execFile, platform = process.platform } = {}) {
  if (platform !== 'win32') return { ok: false, error: 'This only works on Windows.' };
  const r = await run(exec, 'reg', ['delete', 'HKCU\\Environment', '/v', NAME, '/f']);
  return r.ok || /unable to find/i.test(r.err) ? { ok: true } : { ok: false, error: 'Windows refused: ' + (r.err.trim() || 'unknown error') };
}
module.exports = { NAME, VALUE, status, set, remove };
