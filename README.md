# Stellarock Telemetry (desktop app)

Reads the Star Citizen 5.0 telemetry server on **your own PC** (`127.0.0.1:2942`), shows your stats, and sends them to the org website over signed HTTPS.

## Use it
The website has a full illustrated guide at `/guide/telemetry/` (the app's **Setup guide** button opens it).

1. Website: **My account → Game telemetry → Add a device**, copy the token (shown once).
2. App → **Setup**: paste the site address (`https://…`) and the token, *Save & test connection*.
3. App → Setup step 3: the game's `.proto` schema (from github.com/magmahindenburg/StarCitizenTelemetry, reconstructed from the 5.0 PTU client) is bundled in `schema/`. If a patch changes it, use *Download schema* or drop newer files in the schema folder (yours take priority). Then *Enable in user.cfg* (backup made) and restart the game.
   If the game doesn't open port 2942, change `cfgVariant` in settings.json to `hyphen` (writes `server-game-telemetry-enabled = 1`). Two different spellings are documented by the community; this is unverified.
4. Start Star Citizen. The Dashboard fills in; the site's **Online now** and **My telemetry** pages follow.

## Build the Windows installer
Use Node 20 or 22 (Node 18 works but warns). Signing is switched off in `package.json` (`signAndEditExecutable: false`) because electron-builder's signing toolkit can't unpack on Windows without Developer Mode/admin rights. If you add a code-signing certificate later, set it back to `true` and run the build from an Administrator terminal (or enable Developer Mode).
Needs Windows (or CI): `npm install && npm run dist`. The included GitHub Actions workflow (`.github/workflows/build.yml`) builds `.exe` files on a Windows runner. Unsigned builds trigger SmartScreen warnings; code-signing needs your own certificate.

## Try it without the game
`node test/mockGame.js` starts a fake telemetry server on 2942 using `test/schema`. `npm test` runs the unit tests and (if `TEL_SITE`, `TEL_TOKEN`, `TEL_SESS` are set) a full end-to-end test against a dev site.

## Security design
- HTTPS only (plain http only for localhost dev). TLS certificates are always verified.
- Per-device token; each request is signed with HMAC-SHA256 (method, path, timestamp, nonce, body hash). The secret is never sent.
- Server rejects stale timestamps (±60 s), replayed nonces, oversized bodies, unknown fields; rate-limits per device; stores the secret encrypted; token can be revoked on the site at once.
- Token stored with Windows encryption (Electron `safeStorage`); if unavailable it is kept in memory only.
- Electron hardening: sandbox, context isolation, no Node in the page, strict CSP, no navigation, all permissions denied, single instance.
- Privacy is enforced on the server too; "shared only" mode keeps private data off the network entirely.
- Honest limit: no system is "unhackable". This removes the common attacks (sniffing, replay, tampering, token theft from the DB, leaking private fields). Someone with malware on your PC can still read the game's open local port and your memory.

## Caveats
The game's telemetry API is unofficial and may change. The mapper matches field names loosely, but if a patch renames things a field may go blank until the mapper aliases (`src/mapper.js`, table `A`) are updated. Set `SC_TELEMETRY_DEBUG=1` to log a raw frame.

The app only reads the stream. It never calls `TriggerGameAction`, so it cannot press buttons or send input to the game.
