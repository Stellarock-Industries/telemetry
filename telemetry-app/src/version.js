'use strict';
/** Compare dotted version numbers ("1.0.12" > "1.0.9"). Returns -1, 0 or 1; anything unparseable counts as 0.0.0. */
const parts = (v) => String(v || '').replace(/^v/i, '').split('.').slice(0, 4).map((x) => (/^\d{1,6}$/.test(x) ? Number(x) : 0));
function cmp(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 4; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
const valid = (v) => /^\d{1,4}(\.\d{1,5}){0,3}$/.test(String(v || ''));
module.exports = { cmp, valid };
