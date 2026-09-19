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
  var TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

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
    saveSession(keyring, vaultId);
    return { vaultId: vaultId, keyring: keyring, record: record };
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
    enrol: enrol, unlock: unlock, addPasskey: addPasskey, revoke: revoke, fetchRow: fetchRow
  };
})(globalThis);
