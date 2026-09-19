/* =============================================================================
 * press gate.testkit.mjs — the SHARED Playwright kit for the passkey gate.
 *
 * Dev/test only; never inlined into a build. Each personal app copies this file
 * into its own test/ and imports it, so all three exercise the SAME harness:
 *   - a CDP virtual authenticator with PRF (the happy path), AND
 *   - the two 1Password shim shapes that shipped two broken builds — the base64url
 *     STRING PRF, and the "enabled-only, no value at CREATE" shape.
 *
 * IMPORTANT (recorded in press docs/lessons.md): a virtual authenticator proves
 * the HAPPY PATH ONLY. It returns clean ArrayBuffers; 1Password does not. A passkey
 * change is not verified until it has run against the real password manager on a
 * real device. These shims narrow — but do not close — that gap.
 *
 * Works with both @playwright/test (fsa) and the raw `playwright` library
 * (giving/retirement): every helper takes (context, page) explicitly.
 * ========================================================================== */

// --- CDP virtual authenticator with PRF (modelled on press/test/marquee.spec.mjs) ---
export async function setupVirtualAuthenticator(context, page) {
  const client = await context.newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', transport: 'internal',
      hasResidentKey: true, hasUserVerification: true, hasPrf: true,
      isUserVerified: true, automaticPresenceSimulation: true,
    },
  });
  return { client, authenticatorId };
}

// --- 1Password shim #1: PRF arrives as a base64url STRING (not an ArrayBuffer) ---
// Wraps BOTH create() and get() so enrol AND unlock traverse the asBytes(string) path.
export async function install1PasswordStringShim(page) {
  await page.addInitScript(() => {
    const toB64url = (buf) => {
      const b = new Uint8Array(buf); let s = '';
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const restring = (cred) => {
      const origGCER = cred.getClientExtensionResults.bind(cred);
      cred.getClientExtensionResults = () => {
        const ext = origGCER();
        if (ext && ext.prf && ext.prf.results && ext.prf.results.first) {
          return { ...ext, prf: { ...ext.prf, results: { ...ext.prf.results, first: toB64url(ext.prf.results.first) } } };
        }
        return ext;
      };
      return cred;
    };
    const oc = navigator.credentials.create.bind(navigator.credentials);
    navigator.credentials.create = async (o) => restring(await oc(o));
    const og = navigator.credentials.get.bind(navigator.credentials);
    navigator.credentials.get = async (o) => restring(await og(o));
  });
}

// --- 1Password shim #2: CREATE returns { prf:{ enabled:true, results:{ first:{} } } } ---
// (no usable value at create; the real PRF only arrives at assertion). get() is left
// intact so enrol must fall through to prfViaGet() and still complete.
export async function installEnabledOnlyShim(page) {
  await page.addInitScript(() => {
    const oc = navigator.credentials.create.bind(navigator.credentials);
    navigator.credentials.create = async (o) => {
      const cred = await oc(o);
      cred.getClientExtensionResults = () => ({ prf: { enabled: true, results: { first: {} } } });
      return cred;
    };
  });
}

// --- in-memory press_vault mock (RLS-gated on x-vault-id), from marquee.spec.mjs ---
export async function mockPressVault(context) {
  const state = { requests: 0, rows: new Map() };
  await context.route('**/rest/v1/press_vault**', (route) => {
    state.requests++;
    const req = route.request(); const method = req.method();
    const vid = req.headers()['x-vault-id'] || '';
    if (method === 'GET') {
      const row = state.rows.get(vid);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) });
    }
    if (method === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (!body.id || body.id !== vid) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'row-level security' }) });
      const row = { ...body, kdf: body.kdf || 'hkdf-sha256', version: body.version || 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      state.rows.set(body.id, row);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
    }
    if (method === 'DELETE') {
      const row = state.rows.get(vid); if (row) state.rows.delete(vid);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  return state;
}

// --- generic hermetic mock for an app data table -----------------------------
// getRows(req) -> array of rows for a GET; writes are accepted and echoed so a
// stray save never escapes to production. `pattern` is a Playwright glob.
export async function mockAppTable(context, { pattern, getRows }) {
  const state = { gets: 0, writes: 0, lastWrite: null };
  await context.route(pattern, (route) => {
    const req = route.request(); const method = req.method();
    if (method === 'GET') {
      state.gets++;
      const rows = (getRows ? getRows(req) : []) || [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    // POST / PATCH — accept, echo, never touch production
    state.writes++;
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    state.lastWrite = body;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ...body, version: (body.version ?? 0) }]) });
  });
  return state;
}

// --- build a { ciphertext, iv, salt, kdf_iters } envelope IN-PAGE -------------
// Mirrors the apps' crypto.js encryptDoc BYTE-FOR-BYTE (AES-256-GCM, PBKDF2-SHA-256
// 310k, salt16/iv12, base64 fields). Kept in the shared kit because all three apps
// share that envelope; the transport is frozen this arc, so this cannot drift.
export async function buildEnvelope(page, { doc, passphrase, kdf_iters = 310000 }) {
  return page.evaluate(async ({ doc, passphrase, iters }) => {
    const b64 = (bytes) => { let s = ''; const b = new Uint8Array(bytes); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const base = await crypto.subtle.importKey('raw', enc.encode(String(passphrase)), { name: 'PBKDF2' }, false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(doc)));
    return { ciphertext: b64(ct), iv: b64(iv), salt: b64(salt), kdf_iters: iters };
  }, { doc, passphrase, iters: kdf_iters });
}

// --- seed an enrolled vault row + live session IN-PAGE ------------------------
// Uses the virtual authenticator's real PRF via PressVault.enrol, so the SAME
// credential later unlocks. keyring = { apps: { '<page>': { sync_id, pass } } }.
export async function enrolInPage(page, keyring) {
  return page.evaluate(async (kr) => {
    if (!window.PressVault) throw new Error('PressVault missing in page');
    const res = await window.PressVault.enrol({ label: 'test-device', keyring: kr });
    return { vaultId: res.vaultId };
  }, { v: 1, apps: keyring.apps });
}

// clear only the vault SESSION (keeps the enrolled row) — simulates "Lock now".
export async function lockInPage(page) {
  return page.evaluate(() => { window.PressVault && window.PressVault.lock(); });
}

// read the current localStorage keys (to assert no passphrase / sync id remains).
export async function localStorageDump(page) {
  return page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
}
