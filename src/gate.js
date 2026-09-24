/* =============================================================================
 * press gate.js — the portable direct-entry passkey gate for the personal apps.
 *
 * A single self-contained block a personal app inlines into its build. It gives
 * the app TWO globals:
 *   - window.PressVault  — the proven vault module, embedded here VERBATIM from
 *                          src/vault.js between the @@VAULT_INLINE@@ markers. That
 *                          region is machine-injected and guarded byte-for-byte by
 *                          `tools/inline-vault.mjs --check` against src/vault.js and
 *                          the inlined copy in index.html. NEVER hand-edit it here —
 *                          edit src/vault.js and re-run the tool.
 *   - window.PressGate   — a full-page passkey gate an app mounts on boot.
 *
 * Design: this is a DELIBERATE duplicate of the wing's inline gate, not an
 * oversight. The crypto CORE is shared and guarded identical; the UI chrome is
 * intentionally its own thing (an app is not the marquee). The gate is UNLOCK
 * ONLY — never a passphrase field, never an enrol button. Enrolment lives in the
 * wing; an un-enrolled device sees a friendly line and a link back to the marquee.
 *
 * The apps read their {sync_id, pass} from the sealed keyring in memory only and
 * never surface them. This file re-keys nothing.
 * ========================================================================== */

// @@VAULT_INLINE@@
// (injected verbatim from src/vault.js by tools/inline-vault.mjs — do not edit between the markers)
/* =============================================================================
 * press vault module — the personal-wing key store.
 *
 * ONE source of truth for both the Node unit tests and the browser: this file has
 * no import/export and simply assigns `globalThis.PressVault`. SLICE 3 inlines it
 * verbatim into index.html (sets window.PressVault); the Node tests load it with a
 * side-effect `import` and read the same global. The site keeps NO build step.
 *
 * Crypto: the AES-256-GCM key is derived IN THE BROWSER from the 32-byte WebAuthn
 * PRF output via HKDF-SHA-256 (RFC 5869). HKDF — not the apps' PBKDF2 — is the right
 * KDF here: the input is high-entropy PRF output, not a low-entropy passphrase, so
 * no work factor is needed. seal/open FAIL CLOSED: a wrong key, a tampered blob or a
 * malformed record returns null, never a partial or a thrown plaintext.
 *
 * Session rationale: today each personal app persists its own passphrase in
 * localStorage INDEFINITELY (e.g. `fsa:pass`). This module keeps the decrypted
 * keyring in ONE place — `press:vault:v1` — that EXPIRES (8h TTL) and is revocable,
 * which is strictly stronger than the status quo and is what lets "open any personal
 * app in a new tab" work without re-prompting.
 * ========================================================================== */
(function (root) {
  'use strict';

  var subtle = (globalThis.crypto && globalThis.crypto.subtle) || null;

  // --- config (all public / embeddable) --------------------------------------
  var SUPA_URL = 'https://eepjhpyziczrxvirczio.supabase.co';
  var SUPA_KEY = 'sb_publishable__iv3bI7xDAsOdHUlXzbVZQ_2yyFS4uX';
  var VAULT_EP = SUPA_URL + '/rest/v1/press_vault';

  // rp.id is the origin's effective domain. In production that is 'schnubsy.github.io'
  // (so 1Password binds the passkey to the live site); under a localhost test origin it
  // is 'localhost'. Deriving it from location.hostname is equivalent to omitting rpId and
  // keeps the WebAuthn calls valid on both origins. Node (no location) keeps the prod value.
  var RP_ID = (typeof location !== 'undefined' && location.hostname) ? location.hostname : 'schnubsy.github.io';
  var INFO = 'press-vault-v1';
  // Fixed 32-byte PRF salt constant — the same input is evaluated for every passkey
  // so the PRF output is stable per credential. NOT a secret (it only selects which
  // PRF value the authenticator returns); the confidentiality is the PRF output.
  var PRF_SALT = new Uint8Array([
    0x70, 0x72, 0x65, 0x73, 0x73, 0x2d, 0x76, 0x61, 0x75, 0x6c, 0x74, 0x2d, 0x70, 0x72, 0x66, 0x2d,
    0x76, 0x31, 0x2d, 0x73, 0x61, 0x6c, 0x74, 0x2d, 0x32, 0x30, 0x32, 0x36, 0x30, 0x39, 0x31, 0x38
  ]);

  var SESSION_KEY = 'press:vault:v1';
  var ENROLLED_FLAG = 'press:vault:enrolled';
  var TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, fixed from unlock

  // In-memory ONLY: the NON-EXTRACTABLE AES key derived at unlock/enrol, cached so a follow-on
  // reseal (updateKeyring) can re-seal the row WITHOUT another passkey tap. Never persisted; a
  // CryptoKey created with extractable:false cannot be read out even from here. Cleared on lock().
  var _live = null; // { key: CryptoKey, vaultId: string }

  // --- byte helpers (Node + browser) -----------------------------------------
  function asBytes(x) {
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    // 1Password's navigator.credentials shim hands the PRF output back as a base64url
    // STRING, not an ArrayBuffer. Decode it (base64url -> bytes) so callers still get
    // bytes. This is the ONLY string we accept — arbitrary objects still throw below.
    if (typeof x === 'string') {
      var s = x.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      var bin = atob(s), out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    // Two cheap recoveries for a shim that wraps the bytes in an OBJECT rather than a real
    // ArrayBufferView (some builds of the 1Password shim do this). Both still reject
    // anything that isn't clearly a byte container.
    //   - an ArrayBufferView-LIKE object exposing a real .buffer
    if (x && typeof x === 'object' && x.buffer instanceof ArrayBuffer) {
      var off = x.byteOffset || 0;
      return (x.byteLength != null) ? new Uint8Array(x.buffer, off, x.byteLength) : new Uint8Array(x.buffer, off);
    }
    //   - a plain object with CONTIGUOUS numeric keys ({0:..,1:..,..})
    if (x && typeof x === 'object') {
      var keys = Object.keys(x);
      if (keys.length && keys.every(function (k, i) { return k === String(i); })) {
        return Uint8Array.from(Object.values(x));
      }
    }
    throw new TypeError('expected bytes'); // anything else is not bytes
  }
  function b64(bytes) {
    var b = asBytes(bytes), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function ub64(str) {
    var s = atob(str), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function hex(bytes) {
    var b = asBytes(bytes), s = '';
    for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
    return s;
  }
  function randomBytes(n) {
    var out = new Uint8Array(n);
    globalThis.crypto.getRandomValues(out);
    return out;
  }

  async function sha256hex(bytes) {
    var d = await subtle.digest('SHA-256', asBytes(bytes));
    return hex(new Uint8Array(d));
  }

  // --- key derivation: HKDF-SHA-256 over the PRF output ----------------------
  async function deriveKey(prfOutput, salt) {
    var ikm = asBytes(prfOutput);
    var baseKey = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: asBytes(salt), info: new TextEncoder().encode(INFO) },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // --- seal / open (AES-256-GCM, fresh 12-byte IV, fail closed) ---------------
  async function sealKeyring(keyring, key) {
    var iv = randomBytes(12);
    var pt = new TextEncoder().encode(JSON.stringify(keyring));
    var ct = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, pt);
    return { ciphertext: b64(ct), iv: b64(iv) };
  }
  async function openKeyring(record, key) {
    try {
      if (!record || typeof record.ciphertext !== 'string' || typeof record.iv !== 'string') return null;
      var pt = await subtle.decrypt({ name: 'AES-GCM', iv: ub64(record.iv) }, key, ub64(record.ciphertext));
      var obj = JSON.parse(new TextDecoder().decode(pt));
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    } catch (e) {
      return null; // wrong key, tampered blob, malformed record — all fail closed
    }
  }

  async function vaultIdFor(rawCredentialId) {
    return sha256hex(rawCredentialId);
  }

  var emptyKeyring = function () {
    return {
      v: 1,
      apps: {
        'fsa.html': { sync_id: '', pass: '' },
        'giving.html': { sync_id: '', pass: '' },
        'retirement.html': { sync_id: '', pass: '' },
        'card-scout.html': { sync_id: '' }
      }
    };
  };

  // --- session (localStorage, 8h TTL) ----------------------------------------
  function store() { return (typeof globalThis.localStorage !== 'undefined') ? globalThis.localStorage : null; }

  function saveSession(keyring, vaultId) {
    var s = store(); if (!s) return null;
    var now = Date.now();
    var sess = { keyring: keyring, unlockedAt: now, expiresAt: now + TTL_MS, vaultId: vaultId };
    try {
      s.setItem(SESSION_KEY, JSON.stringify(sess));
      s.setItem(ENROLLED_FLAG, '1');
    } catch (e) {}
    return sess;
  }
  function loadSession() {
    var s = store(); if (!s) return null;
    try {
      var sess = JSON.parse(s.getItem(SESSION_KEY) || 'null');
      if (!sess || !sess.expiresAt || Date.now() > sess.expiresAt) {
        if (sess) s.removeItem(SESSION_KEY); // drop an expired session
        return null;
      }
      return sess;
    } catch (e) { return null; }
  }
  function lock() {
    _live = null; // drop the cached key so a locked space cannot reseal
    var s = store(); if (!s) return;
    try { s.removeItem(SESSION_KEY); } catch (e) {}
    // Nudge other open tabs to drop the session too. A same-tab write to localStorage
    // does not fire `storage` in that tab, so we also dispatch it locally.
    try {
      if (typeof globalThis.dispatchEvent === 'function' && typeof StorageEvent === 'function') {
        globalThis.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, newValue: null }));
      }
    } catch (e) {}
  }
  function everEnrolled() { var s = store(); if (!s) return false; try { return s.getItem(ENROLLED_FLAG) === '1'; } catch (e) { return false; } }

  // --- REST helpers (header-gated on x-vault-id) -----------------------------
  function headers(vaultId, extra) {
    var h = { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'x-vault-id': vaultId };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  async function fetchRow(vaultId) {
    var r = await fetch(VAULT_EP + '?id=eq.' + encodeURIComponent(vaultId) + '&select=*', { headers: headers(vaultId) });
    if (!r.ok) return null;
    var rows = await r.json();
    return (rows && rows[0]) || null;
  }
  async function putRow(vaultId, sealed, label) {
    var body = { id: vaultId, ciphertext: sealed.ciphertext, iv: sealed.iv, salt: sealed.salt, kdf: 'hkdf-sha256', version: 1, label: label || null };
    var r = await fetch(VAULT_EP, {
      method: 'POST',
      headers: headers(vaultId, { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(body)
    });
    return r.ok;
  }

  // --- Card Scout sync-id verification (press_deals, header-gated on x-plan-id) -----
  // Card Scout has a sync id and NO passphrase, so it cannot be verified by decrypting
  // like fsa/giving/retirement. Instead we PROBE press_deals with the entered sync id as
  // the x-plan-id header (page=eq.card-scout, minimal select, limit 1).
  //
  // THE TRAP (this morning's silent failure): press_deals RLS is `x-plan-id = sync_id`, so
  // a WRONG key does not error — it returns HTTP 200 with an EMPTY array. Reading that as
  // success is exactly what let Card Scout's feed go quietly empty. Therefore ZERO rows on a
  // 200 MUST be treated as a WRONG key, never as verified. Only >=1 row is "verified".
  //   'verified'    — 200 with at least one row (the key opens Card Scout's deals)
  //   'wrong'       — 200 with zero rows (RLS filtered everything: the key is wrong)
  //   'unreachable' — network error, non-200, or an unparseable body
  var DEALS_EP = SUPA_URL + '/rest/v1/press_deals';
  function dealsVerdict(ok, rows) {
    if (!ok) return 'unreachable';
    if (Array.isArray(rows) && rows.length > 0) return 'verified';
    return 'wrong'; // 200 + zero rows (or a non-array body) => the key does NOT open the deals
  }
  // fetch wrapper around dealsVerdict. `opts.fetch` is injectable for the unit tests; the
  // browser uses the global fetch. NEVER logs the sync id.
  async function verifyCardScout(syncId, opts) {
    opts = opts || {};
    var f = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f || !syncId) return 'unreachable';
    var url = DEALS_EP + '?page=eq.card-scout&select=item_id&limit=1';
    var r;
    try {
      r = await f(url, { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'x-plan-id': syncId } });
    } catch (e) { return 'unreachable'; }
    if (!r || !r.ok) return dealsVerdict(false, null);
    var rows;
    try { rows = await r.json(); } catch (e) { return 'unreachable'; }
    return dealsVerdict(true, rows);
  }

  // --- WebAuthn (browser only; exercised via Playwright virtual authenticator) --
  function prfExt() { return { prf: { eval: { first: PRF_SALT } } }; }
  // Log the real shape of an unreadable PRF value ONCE so a third failure is self-
  // diagnosing. Never throws itself.
  function logShape(first) {
    try {
      console.debug('[private-wing] prf shape', Object.prototype.toString.call(first),
        (first && typeof first === 'object') ? Object.keys(first).slice(0, 8) : typeof first);
    } catch (e) {}
  }

  // Normalise the PRF output to bytes at the boundary so every caller (enrol/unlock) gets
  // a Uint8Array regardless of the shim: the CDP virtual authenticator returns an
  // ArrayBuffer, 1Password returns a base64url STRING (and at CREATE time may return an
  // unreadable object with no usable value at all).
  //
  // TOTAL by design: it must NEVER throw for an unreadable shape. An absent, zero-length,
  // or unconvertible `first` is treated as ABSENT (null) so enrol falls through to the
  // ASSERTION path (prfViaGet) — the path that handles "PRF delivered at assertion time",
  // which is exactly what 1Password does. The ONLY throw is the explicit "can't hold the
  // key" refusal for a REAL PRF container (ArrayBuffer / view / base64url string) that
  // converted cleanly but is the wrong length — a genuine authenticator problem worth
  // surfacing. A wrong-length value merely RECOVERED from a speculative object shim is
  // treated as unreadable (null), not surfaced.
  function prfResult(cred) {
    var ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
    var first = (ext && ext.prf && ext.prf.results) ? ext.prf.results.first : null;
    if (!first) return null;                 // absent: missing, null, or ''
    var isRealPrf = (first instanceof ArrayBuffer) || ArrayBuffer.isView(first) || (typeof first === 'string');
    var bytes;
    try {
      bytes = asBytes(first);                // buffer | view | base64url string | shim object -> bytes
    } catch (e) {
      logShape(first);                       // won't convert -> absent, and NEVER let the throw escape
      return null;
    }
    if (bytes.length === 0) return null;      // a zero-length result is absent, not success
    if (bytes.length !== 32) {
      if (isRealPrf) throw new Error("This browser or authenticator can't hold the key for the personal space.");
      logShape(first);                        // wrong-length from an object shim -> unreadable, fall through
      return null;
    }
    return bytes;
  }
  // Some authenticators (and some browsers) return the PRF output only at ASSERTION
  // time, exposing just { prf: { enabled: true } } at creation. Fall back to one get()
  // so enrol works regardless of when the PRF value is delivered.
  async function prfViaGet(rawId) {
    try {
      var a = await navigator.credentials.get({
        publicKey: {
          rpId: RP_ID, challenge: randomBytes(32),
          allowCredentials: rawId ? [{ type: 'public-key', id: rawId }] : [],
          userVerification: 'required', extensions: prfExt()
        }
      });
      return prfResult(a);
    } catch (e) { return null; }
  }

  async function enrol(opts) {
    opts = opts || {};
    var userId = randomBytes(16);
    var cred = await navigator.credentials.create({
      publicKey: {
        rp: { id: RP_ID, name: 'press — the private wing' },
        user: { id: userId, name: opts.label || 'private-wing', displayName: opts.label || 'Private Wing' },
        challenge: randomBytes(32),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        extensions: prfExt()
      }
    });
    var prf = prfResult(cred);
    if (!prf) {
      // EXPECTED PATH for 1Password (not an edge case): at CREATE, getClientExtensionResults()
      // returns { prf: { enabled: true } } with no usable results.first, so prfResult() is null.
      // 1Password delivers the actual PRF at ASSERTION time — obtain it with one get().
      prf = await prfViaGet(cred.rawId);
    }
    if (!prf) throw new Error("This browser or authenticator can't hold the key for the personal space.");
    var vaultId = await vaultIdFor(cred.rawId);
    var salt = randomBytes(32);
    var key = await deriveKey(prf, salt);
    var keyring = (opts.keyring && opts.keyring.apps) ? opts.keyring : emptyKeyring();
    var sealed = await sealKeyring(keyring, key); sealed.salt = b64(salt);
    var ok = await putRow(vaultId, sealed, opts.label || null);
    if (!ok) throw new Error('Could not save the new key to the vault.');
    _live = { key: key, vaultId: vaultId };
    saveSession(keyring, vaultId);
    return { vaultId: vaultId, keyring: keyring };
  }

  async function unlock() {
    var assertion = await navigator.credentials.get({
      publicKey: {
        rpId: RP_ID,
        challenge: randomBytes(32),
        allowCredentials: [],        // discoverable — 1Password offers any enrolled passkey
        userVerification: 'required',
        extensions: prfExt()
      }
    });
    var prf = prfResult(assertion);
    if (!prf) throw new Error("This browser or authenticator can't hold the key for the personal space.");
    var vaultId = await vaultIdFor(assertion.rawId);
    var record = await fetchRow(vaultId);
    if (!record) throw new Error('No enrolled passkey found for the personal space on this device.');
    var key = await deriveKey(prf, ub64(record.salt));
    var keyring = await openKeyring(record, key);
    if (!keyring) throw new Error('Could not open the personal space with this passkey.');
    _live = { key: key, vaultId: vaultId };
    saveSession(keyring, vaultId);
    return { vaultId: vaultId, keyring: keyring, record: record };
  }

  // Re-seal an UPDATED keyring into the SAME row, under the SAME credential — used by the wing's
  // "Connect your tools" step to add a verified {sync_id, pass} without re-keying anything. Prefers
  // the in-memory key cached at unlock (no extra tap); falls back to one assertion if it is absent.
  // NEVER regenerates an empty keyring: the caller passes the full, updated keyring.
  async function updateKeyring(newKeyring) {
    if (!newKeyring || !newKeyring.apps) throw new Error('updateKeyring needs a full keyring.');
    var sess = loadSession();
    if (!sess || !sess.vaultId) throw new Error('Unlock the personal space before saving.');
    var vaultId = sess.vaultId;
    var record = await fetchRow(vaultId);
    if (!record) throw new Error('No enrolled passkey found for the personal space on this device.');
    var key;
    if (_live && _live.vaultId === vaultId) {
      key = _live.key;
    } else {
      var assertion = await navigator.credentials.get({
        publicKey: { rpId: RP_ID, challenge: randomBytes(32), allowCredentials: [], userVerification: 'required', extensions: prfExt() }
      });
      var prf = prfResult(assertion);
      if (!prf) throw new Error("This browser or authenticator can't hold the key for the personal space.");
      key = await deriveKey(prf, ub64(record.salt));
      _live = { key: key, vaultId: vaultId };
    }
    var sealed = await sealKeyring(newKeyring, key); sealed.salt = record.salt; // reuse the row's salt
    var ok = await putRow(vaultId, sealed, record.label || null);
    if (!ok) throw new Error('Could not save to the vault.');
    saveSession(newKeyring, vaultId);
    return newKeyring;
  }

  // Enrol a SECOND credential and write the SAME keyring, sealed under the new key,
  // as a NEW row. Never re-keys or touches existing rows. Requires an open keyring.
  async function addPasskey(opts) {
    opts = opts || {};
    var sess = loadSession();
    if (!sess || !sess.keyring) throw new Error('Unlock the personal space before adding a device.');
    return enrol({ label: opts.label || 'added-device', keyring: sess.keyring });
  }

  async function revoke(vaultId) {
    var r = await fetch(VAULT_EP + '?id=eq.' + encodeURIComponent(vaultId), { method: 'DELETE', headers: headers(vaultId, { 'Prefer': 'return=representation' }) });
    if (!r.ok) return false;
    var gone = await r.json();
    return Array.isArray(gone) && gone.length > 0;
  }

  root.PressVault = {
    // config / constants
    SUPA_URL: SUPA_URL, SUPA_KEY: SUPA_KEY, VAULT_EP: VAULT_EP, RP_ID: RP_ID, INFO: INFO,
    PRF_SALT: PRF_SALT, SESSION_KEY: SESSION_KEY, ENROLLED_FLAG: ENROLLED_FLAG, TTL_MS: TTL_MS,
    // crypto
    deriveKey: deriveKey, sealKeyring: sealKeyring, openKeyring: openKeyring, vaultIdFor: vaultIdFor,
    emptyKeyring: emptyKeyring,
    // byte helpers (exposed for tests / inlining)
    asBytes: asBytes, b64: b64, ub64: ub64, hex: hex, sha256hex: sha256hex, randomBytes: randomBytes,
    // webauthn PRF normalisation (exposed for tests)
    prfResult: prfResult,
    // session
    saveSession: saveSession, loadSession: loadSession, lock: lock, everEnrolled: everEnrolled,
    // webauthn + rest
    enrol: enrol, unlock: unlock, addPasskey: addPasskey, revoke: revoke, fetchRow: fetchRow,
    updateKeyring: updateKeyring,
    // card-scout deals-probe verification (exposed for the connect flow + unit tests)
    DEALS_EP: DEALS_EP, dealsVerdict: dealsVerdict, verifyCardScout: verifyCardScout
  };
})(globalThis);
// @@/VAULT_INLINE@@

(function (root) {
  'use strict';

  var V = root.PressVault;
  if (!V) { console.error('[press-gate] PressVault missing — gate.js must be inlined WITH the vault region'); return; }

  // Where "← the marquee" and a not-enrolled device point. The apps live beside
  // index.html on the same origin (…/press/<app>.html), so a relative link to the
  // wing is correct on both the live site and a localhost test origin.
  var MARQUEE = 'index.html?view=personal';

  // --- friendly errors — the SAME plain-language mapping the wing uses ---------
  function friendlyErr(e) {
    var name = (e && e.name) || '', msg = (e && e.message) || '';
    if (name === 'NotAllowedError') return 'Cancelled — or the prompt timed out. Try again.';
    if (/can.?t hold the key/i.test(msg)) return "This browser or authenticator can't hold the key for the personal space.";
    if (/No enrolled passkey/i.test(msg)) return 'No passkey for the personal space on this device yet.';
    if (name === 'TypeError' || name === 'RangeError') return "Couldn't read the passkey response on this device. Please try again.";
    return msg || 'Something went wrong. Try again.';
  }
  function notEnrolled(e) { return /No enrolled passkey/i.test((e && e.message) || ''); }

  // --- self-contained styles (injected once; scoped under #press-gate) ---------
  // Hardcoded palette (the wing's rose/violet) so the gate looks right over ANY
  // app's own theme. Full-screen fixed overlay with its own dark backdrop.
  var STYLE_ID = 'press-gate-style';
  var CSS =
    '#press-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
    'padding:24px;background:radial-gradient(120% 90% at 50% 0%,#181227 0%,#0e0b18 70%);' +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#efeaf6}" +
    '#press-gate *{box-sizing:border-box}' +
    '#press-gate .pg-card{width:100%;max-width:380px;text-align:center;padding:34px 26px;border-radius:20px;' +
    'background:rgba(24,18,39,.72);border:1px solid rgba(231,166,199,.28);box-shadow:0 24px 60px rgba(0,0,0,.5)}' +
    '#press-gate .pg-icon{width:46px;height:46px;margin:0 auto 14px;color:#e7a6c7;' +
    'filter:drop-shadow(0 0 10px rgba(231,166,199,.4))}' +
    '#press-gate .pg-icon svg{width:46px;height:46px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}' +
    '#press-gate h1{font-size:19px;font-weight:600;margin:0 0 8px;letter-spacing:.2px}' +
    '#press-gate p{font-size:13px;line-height:1.5;color:#b7aec8;margin:0 auto 22px;max-width:300px}' +
    '#press-gate .pg-btn{display:inline-flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.08em;' +
    'text-transform:uppercase;color:#fff;cursor:pointer;border:0;border-radius:999px;padding:13px 24px;' +
    'background:linear-gradient(92deg,#8e7be8,#e7a6c7);box-shadow:0 8px 24px rgba(142,123,232,.35)}' +
    '#press-gate .pg-btn:hover{filter:brightness(1.08)}' +
    '#press-gate .pg-btn[disabled]{opacity:.6;cursor:progress}' +
    '#press-gate .pg-msg{font-size:12.5px;margin-top:14px;min-height:1em;color:#efeaf6}' +
    '#press-gate .pg-msg.err{color:#f2a0be}' +
    '#press-gate .pg-back{display:inline-block;margin-top:18px;font-size:12px;color:#b7aec8;text-decoration:none;' +
    'border-bottom:1px solid rgba(183,174,200,.35)}' +
    '#press-gate .pg-back:hover{color:#efeaf6}';

  // A lock icon (matches the wing's "Secure" glyph family).
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"></rect>' +
    '<path d="M8 10V7a4 4 0 0 1 8 0v3"></path><circle cx="12" cy="15.5" r="1.4"></circle></svg>';

  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // --- the gate singleton ------------------------------------------------------
  var current = null; // { page, onUnlock, onLock, el, wired }

  function credsFor(page) {
    var sess = V.loadSession();
    var v = sess && sess.keyring && sess.keyring.apps && sess.keyring.apps[page];
    return (v && v.sync_id && v.pass) ? { syncId: v.sync_id, passphrase: v.pass } : null;
  }

  function removeGate() {
    var el = document.getElementById('press-gate');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function render() {
    injectStyle();
    removeGate();
    var host = document.createElement('div');
    host.id = 'press-gate';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-label', 'Unlock the personal space');
    host.innerHTML =
      '<div class="pg-card">' +
        '<div class="pg-icon">' + ICON + '</div>' +
        '<h1>Behind the passkey.</h1>' +
        '<p>Use your passkey to open this personal tool. Nothing here loads until you unlock.</p>' +
        '<button class="pg-btn" id="pg-unlock" type="button">Use your passkey</button>' +
        '<div class="pg-msg" id="pg-msg" aria-live="polite"></div>' +
        '<a class="pg-back" href="' + MARQUEE + '">← the marquee</a>' +
      '</div>';
    document.body.appendChild(host);
    var btn = host.querySelector('#pg-unlock'), msg = host.querySelector('#pg-msg');
    btn.addEventListener('click', function () {
      btn.disabled = true; msg.className = 'pg-msg'; msg.textContent = 'Waiting for your passkey…';
      V.unlock().then(function () {
        var creds = credsFor(current.page);
        if (creds) { removeGate(); current.onUnlock(creds); return; }
        // The passkey OPENED the vault, but this tool has no stored credentials yet — a DISTINCT
        // state from a failed unlock (the space DID open). Point at the wing's Connect step; never
        // conflate this with "could not open the personal space".
        btn.disabled = false; msg.className = 'pg-msg err';
        msg.textContent = 'No credentials stored for this tool yet — connect it in the Private Wing →';
      }).catch(function (e) {
        console.error('[press-gate] unlock failed:', e);
        btn.disabled = false; msg.className = 'pg-msg err'; msg.textContent = friendlyErr(e);
        if (notEnrolled(e)) msg.textContent += ' Set it up in the marquee →';
      });
    });
    return host;
  }

  // Watch for the vault session going away (Lock now — from the wing, another tab,
  // or this app). A same-tab lock() dispatches a synthetic storage event, so this
  // one handler covers all three. When the session for THIS page vanishes, fall
  // back to the gate and let the app blank its sensitive UI.
  function wireLockWatch() {
    if (current.wired || typeof root.addEventListener !== 'function') return;
    current.wired = true;
    root.addEventListener('storage', function (ev) {
      if (ev && ev.key && ev.key !== V.SESSION_KEY) return; // ignore unrelated keys
      if (!current) return;
      if (credsFor(current.page)) return;                   // still unlocked — nothing to do
      if (document.getElementById('press-gate')) return;    // gate already up
      try { if (current.onLock) current.onLock(); } catch (e) {}
      render();
    });
  }

  // guard({page, onUnlock, onLock}) — the one call an app makes on boot.
  //   live session with creds for `page` -> onUnlock(creds) immediately, no gate.
  //   otherwise                         -> mount the gate; on unlock -> onUnlock(creds).
  // onLock (optional) is called when a live session is later lost, before the gate
  // re-appears, so the app can clear what's on screen.
  function guard(opts) {
    opts = opts || {};
    current = { page: opts.page, onUnlock: opts.onUnlock || function () {}, onLock: opts.onLock || null, wired: false };
    wireLockWatch();
    var creds = credsFor(current.page);
    if (creds) { current.onUnlock(creds); return { gated: false }; }
    render();
    return { gated: true };
  }

  root.PressGate = {
    guard: guard,
    // exposed for tests / callers
    credsFor: credsFor, friendlyErr: friendlyErr, MARQUEE: MARQUEE,
    render: render, removeGate: removeGate
  };
})(globalThis);
