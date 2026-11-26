'use strict';
const crypto = require('crypto');

// Must match tel_sign() in the website's src/telemetry.php.
function sign(secret, method, path, ts, nonce, body) {
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  return crypto.createHmac('sha256', secret).update(['SCT1', method.toUpperCase(), path, ts, nonce, bodyHash].join('\n')).digest('hex');
}
function newNonce() { return crypto.randomBytes(18).toString('base64url'); }

// Token shown once on the website: sctd1.<deviceId>.<48 hex secret>
function parseToken(token) {
  const m = /^sctd1\.(\d{1,12})\.([a-f0-9]{48})$/.exec(String(token || '').trim());
  return m ? { deviceId: m[1], secret: m[2] } : null;
}
// HTTPS only. Plain http is accepted solely for a local development site.
function normalizeSiteUrl(input) {
  let u;
  try { u = new URL(String(input || '').trim()); } catch { return null; }
  if (u.username || u.password) return null;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null;
  return u.origin;
}
module.exports = { sign, newNonce, parseToken, normalizeSiteUrl };
