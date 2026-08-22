const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const auth = require(path.join(root, 'courtcall-auth.js'));
const core = require(path.join(root, 'courtcall-core.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'courtcall-auth.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'basketball-sw.js'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'courtcall-auth.js'), 'utf8');

function functionBody(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unbalanced ${name}`);
}

test('send OTP uses the official Supabase email request contract', async () => {
  const calls = [];
  const client = { auth: { signInWithOtp: async request => { calls.push(request); return { data: { user: null, session: null }, error: null }; } } };
  const result = await auth.requestEmailOtp(client, ' Player@Example.COM ', { emailRedirectTo: 'https://courtcall13.win/' });
  assert.equal(result.error, null);
  assert.deepEqual(calls, [{
    email: 'player@example.com',
    options: { shouldCreateUser: true, emailRedirectTo: 'https://courtcall13.win/' }
  }]);
});

test('verify OTP sends one normalized six-digit token with email type', async () => {
  const calls = [];
  const session = { access_token: 'session-token', user: { id: 'user-1' } };
  const client = { auth: { verifyOtp: async request => { calls.push(request); return { data: { session, user: session.user }, error: null }; } } };
  await auth.verifyEmailOtp(client, ' Player@Example.com ', '12 34-56');
  assert.deepEqual(calls, [{ email: 'player@example.com', token: '123456', type: 'email' }]);
});

test('resend gate blocks overlap and enforces the full cooldown', () => {
  let now = 1000;
  const gate = auth.createRequestGate({ now: () => now, cooldownMs: 60000 });
  assert.equal(gate.beginSend(), true);
  assert.equal(gate.beginSend(), false, 'an in-flight request cannot overlap');
  gate.finishSend(true);
  assert.equal(gate.remainingMs(), 60000);
  assert.equal(gate.beginSend(), false);
  now += 60000;
  assert.equal(gate.beginSend(), true);
});

test('auth errors map to safe generic messages', () => {
  assert.equal(auth.mapAuthError({ message: 'User not found' }, 'send', true), 'We couldn’t send a code right now. Try again shortly.');
  assert.equal(auth.mapAuthError({ message: 'Token has expired for known@example.com' }, 'verify', true), 'Incorrect or expired code.');
  assert.equal(auth.mapAuthError({ status: 429, message: 'rate limit' }, 'send', true), 'Too many attempts. Please wait and try again.');
  assert.doesNotMatch(auth.mapAuthError({ message: 'User not found' }, 'send', true), /user|found|email/i);
});

test('profile hydration reuses the established Supabase UUID and cloud profile', () => {
  const result = auth.resolveProfile({
    user: { id: 'uuid-1', email: 'player@example.com', user_metadata: {} },
    remoteProfile: { id: 'uuid-1', name: 'Cloud Player', nickname: 'CP', games_played: 8, position: 'PG' },
    cachedProfile: { id: 'uuid-1', name: 'Cached Player', gamesPlayed: 12, avatar: '🏀' }
  });
  assert.equal(result.profile.id, 'uuid-1');
  assert.equal(result.profile.name, 'Cloud Player');
  assert.equal(result.profile.gamesPlayed, 12);
  assert.equal(result.profile.avatar, '🏀');
  assert.equal(result.reusedExisting, true);
});

test('a cached profile is reused only when its durable user ID matches', () => {
  const result = auth.resolveProfile({
    user: { id: 'uuid-2', email: 'new@example.com', user_metadata: {} },
    cachedProfile: { id: 'uuid-other', name: 'Other Account', gamesPlayed: 99, pinVerifier: 'secret' }
  });
  assert.equal(result.profile.id, 'uuid-2');
  assert.equal(result.profile.name, 'new');
  assert.equal(result.profile.gamesPlayed, 0);
  assert.equal('pinVerifier' in result.profile, false);
  assert.equal(result.reusedExisting, false);
});

test('new identities take the existing onboarding/profile-creation path', () => {
  const result = auth.resolveProfile({ user: { id: 'new-user', email: 'rookie@example.com', user_metadata: {} } });
  assert.equal(result.needsRemoteCreate, true);
  assert.equal(result.profile.name, 'rookie');
  assert.match(functionBody(html, 'routeAfterIdentity'), /_identityNeedsOnboarding.*showScreen\('onboarding'\)/s);
  assert.match(functionBody(html, '_finishAuthenticatedIdentity'), /_identityNeedsOnboarding=!localStorage\.getItem\(OB_KEY\)/);
  assert.match(html, /\.from\('profiles'\)\.upsert\(row,\{onConflict:'id'\}\)/);
});

test('guest remains explicit and never calls the OTP verification path', () => {
  const guest = functionBody(html, 'guestLogin');
  assert.match(html, /id="guest-continue-btn"[\s\S]*?onclick="guestLogin\(\)"/);
  assert.match(guest, /id:'guest'/);
  assert.doesNotMatch(guest, /verifyOtp|signInWithOtp|_remapLocalIdentity|_completeLocalDataSync/);
  assert.match(html, /Sync this device’s local profile and game history to your account\?/);
});

test('active sessions restore without requesting another OTP', async () => {
  const session = { access_token: 'restored', user: { id: 'user-restore' } };
  const calls = [];
  const client = { auth: { getSession: async () => { calls.push('getSession'); return { data: { session }, error: null }; } } };
  assert.equal(await auth.restoreSession(client), session);
  assert.deepEqual(calls, ['getSession']);
});

test('logout is non-destructive and removes only profile/session identity', () => {
  const logout = functionBody(html, 'logOut');
  const sessionCleanup = functionBody(html, '_removeLocalSupaSession');
  assert.match(logout, /supaSignOut\(\)/);
  assert.match(logout, /removeItem\(K\.profile\)/);
  assert.doesNotMatch(logout, /_wipeLocalStorage|K\.matches|K\.tournaments|KC\./);
  assert.match(sessionCleanup, /sb-\$\{projectRef\}-auth-token/);
  assert.doesNotMatch(sessionCleanup, /^(?=[\s\S]*function).*cc_|courtcall_/);
});

test('private routes remain identity-gated while public auth and landing stay reachable', () => {
  assert.equal(core.resolveHashRoute('#/hub', { hasProfile: false }).screen, 'profile');
  assert.equal(core.resolveHashRoute('#/landing', { hasProfile: false }).screen, 'landing');
  assert.equal(core.resolveHashRoute('#/profile', { hasProfile: false }).screen, 'profile');
  assert.equal(core.resolveHashRoute('#/hub', { isGuest: true }).screen, 'hub');
  assert.match(functionBody(html, '_routeFromHash'), /decision\.reason==='auth_required'.*_authRequestedHash=location\.hash/s);
});

test('OTP values are neither persisted nor logged', () => {
  assert.doesNotMatch(authSource, /localStorage|sessionStorage|console\./);
  const verify = functionBody(html, 'verifyOtpCode');
  assert.doesNotMatch(verify, /localStorage|sessionStorage|console\.|setObj|setCol/);
  assert.doesNotMatch(html, /localStorage\.(?:setItem|getItem)\([^\n]*(?:otp|token)/i);
});

test('legacy cloud PIN screens are retired while old local PIN profiles stay available', () => {
  const retired = core.resolveHashRoute('#/reset-pin', { hasProfile: true, hasRecoverySession: true });
  assert.equal(retired.screen, 'profile');
  assert.equal(retired.reason, 'legacy_pin_retired');
  assert.doesNotMatch(html, /id="s-reset-pin"|signInWithPassword|resetPasswordForEmail|updateUser\(\{password/);
  assert.match(html, /id="legacy-local-toggle"[\s\S]*?Use a legacy local-profile PIN/);
  assert.match(html, /PBKDF2/);
});

test('OTP UI is accessible, responsive, and cached in the offline shell', () => {
  assert.match(html, /id="inp-si-email"[^>]*aria-describedby="auth-status auth-network-note"/);
  assert.match(html, /id="inp-otp-code"[^>]*inputmode="numeric"[^>]*autocomplete="one-time-code"/);
  assert.match(html, /id="auth-status" role="status" aria-live="polite"/);
  assert.match(html, /id="otp-change-email"[^>]*>← Change email</);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /orientation: landscape/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(sw, /CACHE_VERSION = 'v58'/);
  assert.match(sw, /courtcall-auth\.css\?v=20260822/);
  assert.match(sw, /courtcall-auth\.js\?v=20260822/);
});
