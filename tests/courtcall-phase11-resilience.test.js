'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cloud = require('../courtcall-cloud-state.js');
const auth = require('../courtcall-auth.js');
const Discover = require('../courtcall-discover-india.js');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'basketball-sw.js'), 'utf8');

// ── A/F: Supabase failure classification ─────────────────

test('every failure resolves to exactly one of the six contract classes', () => {
  assert.equal(cloud.classifyFailure(new Error('anything'), { online: false }), cloud.FAILURE.OFFLINE);
  assert.equal(cloud.classifyFailure({ name: 'TimeoutError', message: 'Community sync timed out' }), cloud.FAILURE.TIMEOUT);
  assert.equal(cloud.classifyFailure({ code: 'timeout' }), cloud.FAILURE.TIMEOUT);
  assert.equal(cloud.classifyFailure({ status: 401 }), cloud.FAILURE.AUTH_REQUIRED);
  assert.equal(cloud.classifyFailure(new Error('JWT expired')), cloud.FAILURE.AUTH_REQUIRED);
  assert.equal(cloud.classifyFailure({ code: '42501' }), cloud.FAILURE.PERMISSION_DENIED);
  assert.equal(cloud.classifyFailure(new Error('new row violates row-level security policy')), cloud.FAILURE.PERMISSION_DENIED);
  assert.equal(cloud.classifyFailure({ status: 503 }), cloud.FAILURE.SERVER_UNAVAILABLE);
  assert.equal(cloud.classifyFailure(new TypeError('Failed to fetch')), cloud.FAILURE.SERVER_UNAVAILABLE);
  assert.equal(cloud.classifyFailure(new Error('something novel broke')), cloud.FAILURE.UNKNOWN);
});

test('no failure class ever maps onto a success sync state', () => {
  for (const kind of Object.values(cloud.FAILURE)) {
    const state = cloud.syncStateForFailure(kind);
    assert.notEqual(state, cloud.SYNC.ONLINE_SYNCED, `${kind} must not claim synced`);
    assert.ok(Object.values(cloud.SYNC).includes(state), `${kind} maps to a known sync state`);
  }
  assert.equal(cloud.syncStateForFailure(cloud.FAILURE.OFFLINE), cloud.SYNC.OFFLINE_SAVED);
  assert.equal(cloud.syncStateForFailure(cloud.FAILURE.AUTH_REQUIRED), cloud.SYNC.AUTH_REQUIRED);
  assert.equal(cloud.syncStateForFailure(cloud.FAILURE.PERMISSION_DENIED), cloud.SYNC.PERMISSION_DENIED);
  assert.equal(cloud.syncStateForFailure(cloud.FAILURE.TIMEOUT), cloud.SYNC.FAILED);
});

test('auth and permission sync labels stay honest and every class has user copy', () => {
  assert.match(cloud.syncCopy(cloud.SYNC.AUTH_REQUIRED), /sign in/i);
  assert.match(cloud.syncCopy(cloud.SYNC.PERMISSION_DENIED), /not permitted/i);
  for (const state of [cloud.SYNC.AUTH_REQUIRED, cloud.SYNC.PERMISSION_DENIED]) {
    assert.doesNotMatch(cloud.syncCopy(state), /·\s*Synced/i);
  }
  for (const kind of Object.values(cloud.FAILURE)) {
    assert.ok(cloud.failureMessage(kind).length > 10, `${kind} has explanatory copy`);
    assert.doesNotMatch(cloud.failureMessage(kind), /synced/i);
  }
});

// ── A: timeouts can never leave loading stuck ────────────

test('withTimeout resolves fast operations and rejects stalled ones as timeout', async () => {
  assert.equal(await cloud.withTimeout(Promise.resolve('ok'), 1000, 'fast'), 'ok');
  await assert.rejects(
    cloud.withTimeout(new Promise(() => {}), 20, 'stalled'),
    error => error.code === 'timeout' && /stalled/.test(error.message)
  );
  await assert.rejects(cloud.withTimeout(Promise.reject(new Error('real failure')), 1000), /real failure/);
});

// ── G: bounded retry/backoff ─────────────────────────────

test('runWithRetry retries transient failures with bounded exponential backoff', async () => {
  const delays = [];
  let calls = 0;
  const result = await cloud.runWithRetry(async () => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error('service unavailable'), { status: 503 });
    return 'recovered';
  }, { attempts: 3, sleep: ms => { delays.push(ms); } });
  assert.equal(result, 'recovered');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [800, 1600]);
});

test('runWithRetry never retries authentication or permission failures', async () => {
  for (const error of [{ status: 401 }, { code: '42501' }]) {
    let calls = 0;
    await assert.rejects(cloud.runWithRetry(async () => { calls += 1; throw error; }, {
      attempts: 5, sleep: () => {}
    }));
    assert.equal(calls, 1, 'auth/permission failures stop after the first attempt');
  }
});

test('runWithRetry is hard-bounded and stops when the device goes offline', async () => {
  let calls = 0;
  await assert.rejects(cloud.runWithRetry(async () => { calls += 1; throw new Error('flaky'); }, {
    attempts: 99, sleep: () => {}
  }));
  assert.ok(calls <= 5, 'attempts are capped even when asked for more');

  calls = 0;
  await assert.rejects(cloud.runWithRetry(async () => { calls += 1; throw new Error('flaky'); }, {
    attempts: 4, sleep: () => {}, isOnline: () => false
  }));
  assert.equal(calls, 1, 'going offline stops the retry loop');
});

test('retry delays grow exponentially and respect the cap', () => {
  assert.equal(cloud.retryDelayMs(1), 800);
  assert.equal(cloud.retryDelayMs(2), 1600);
  assert.equal(cloud.retryDelayMs(3), 3200);
  assert.equal(cloud.retryDelayMs(10), 8000);
  assert.equal(cloud.retryDelayMs(2, 1000, 1500), 1500);
});

// ── B/K: local-first storage recovery ────────────────────

test('safeJsonParse tolerates corrupt, empty, and non-string input', () => {
  assert.deepEqual(cloud.safeJsonParse('{"a":1}', null), { a: 1 });
  assert.equal(cloud.safeJsonParse('{oops', 'fallback'), 'fallback');
  assert.equal(cloud.safeJsonParse('', 'fallback'), 'fallback');
  assert.equal(cloud.safeJsonParse(null, 'fallback'), 'fallback');
  assert.equal(cloud.safeJsonParse(undefined, 'fallback'), 'fallback');
});

test('dedupeById recovers collections with duplicates, junk entries, and missing ids', () => {
  const recovered = cloud.dedupeById([
    { id: 'a', v: 1 }, { id: 'a', v: 2 }, null, 'junk', 42, [1, 2],
    { id: 'b' }, { name: 'no id kept' }, { id: 'a', v: 3 }
  ]);
  assert.deepEqual(recovered, [{ id: 'a', v: 1 }, { id: 'b' }, { name: 'no id kept' }]);
  assert.deepEqual(cloud.dedupeById('not an array'), []);
  assert.deepEqual(cloud.dedupeById(undefined), []);
});

test('app storage helpers read through the shared recovery path and fail writes safely', () => {
  assert.match(html, /function getCol\(key\)\{return CourtCallCloudState\.dedupeById\(CourtCallCloudState\.safeJsonParse\(/);
  assert.match(html, /function setCol\([^)]*\)\{try\{[\s\S]*?return true\}catch\(error\)\{_storageWriteFailed\(error\);return false\}\}/);
  assert.match(html, /function setObj\([^)]*\)\{try\{[\s\S]*?return true\}catch\(error\)\{_storageWriteFailed\(error\);return false\}\}/);
  assert.match(html, /const LOCAL_WRITE_META_KEY='cc_local_write_meta'/);
  assert.match(html, /could not be saved on this device/i);
});

test('a failed active-game save stops advertising “Saved on device”', () => {
  assert.match(html, /Not saved — device storage is full/);
  assert.match(html, /_storageWriteFailed\(error\);\s*if\(status\)status\.innerHTML/);
});

test('cloud pulls still retain unmatched device records (newer local wins survival)', () => {
  assert.match(html, /local\.filter\(m => !dbIds\.has\(m\.id\)\)/);
  assert.match(html, /local\.filter\(t => !dbIds\.has\(t\.id\)\)/);
  assert.match(html, /retainedLocalComms/);
});

// ── A: failed fetch is never presented as empty ──────────

test('games fetch distinguishes failure (null) from an empty account', () => {
  assert.match(html, /async function supaFetchGames[\s\S]*?return null;[\s\S]*?\n\}/);
  assert.match(html, /supaFetchGames FAILED/);
});

test('community sync shares one in-flight promise and cannot load forever', () => {
  assert.match(html, /_syncCommInFlight = CourtCallCloudState\.withTimeout\(_doSyncCommunitiesFromDB\(\), 15000/);
  assert.match(html, /withTimeout\(_doSyncAllUserDataFromDB\(\), 45000/);
  assert.match(html, /withTimeout\(write\(\),12000/);
  assert.match(html, /withTimeout\(supa\.rpc\(name,args\),12000/);
});

// ── C: reconnect and single-flight sync ──────────────────

test('reconnect settles briefly and reuses a single-flight sync pass', () => {
  assert.match(html, /let _retryCloudSyncInFlight=null/);
  assert.match(html, /if\(_retryCloudSyncInFlight\)return _retryCloudSyncInFlight/);
  assert.match(html, /_reconnectSyncTimer=setTimeout\(\(\)=>\{if\(navigator\.onLine\)retryCloudSync\(\)\},800\)/);
});

// ── H: auth/session resilience ───────────────────────────

test('offline sign-out events and offline startup never destroy the local profile view', () => {
  const signedOutBlock = html.slice(html.indexOf("if (event === 'SIGNED_OUT')"), html.indexOf("if (event === 'SIGNED_OUT')") + 400);
  assert.match(signedOutBlock, /if \(!navigator\.onLine\) return;/);
  const restoreBlock = html.slice(html.indexOf('async function restoreAuthenticatedSession'), html.indexOf('async function restoreAuthenticatedSession') + 700);
  assert.match(restoreBlock, /if\(!navigator\.onLine\)return false;/);
});

test('auth module maps offline and rate-limit failures to honest guidance', () => {
  assert.match(auth.mapAuthError(null, 'send', false), /offline/i);
  assert.match(auth.mapAuthError(new TypeError('Failed to fetch'), 'verify', true), /offline/i);
  assert.match(auth.mapAuthError({ status: 429 }, 'send', true), /too many attempts/i);
});

test('session restore only accepts sessions with a token and user id', async () => {
  const fake = session => ({ auth: { getSession: async () => ({ data: { session } }) } });
  assert.equal(await auth.restoreSession(fake(null)), null);
  assert.equal(await auth.restoreSession(fake({ user: { id: 'u' } })), null);
  assert.equal(await auth.restoreSession(fake({ access_token: 't' })), null);
  const valid = { access_token: 't', user: { id: 'u' } };
  assert.equal(await auth.restoreSession(fake(valid)), valid);
  await assert.rejects(auth.restoreSession({ auth: { getSession: async () => ({ error: new Error('down') }) } }));
});

// ── L: accessible but quiet status announcements ─────────

test('rapid local-save flickers are not announced; meaningful states are', () => {
  assert.match(html, /_QUIET_SYNC_STATES/);
  assert.match(html, /aria-live',_QUIET_SYNC_STATES\.has\(nextState\)\?'off':'polite'/);
  assert.match(html, /id="sync-indicator"[^>]*role="status"/);
});

// ── D/E: service worker hardening ────────────────────────

test('Phase 11 advances the cache version atomically', () => {
  assert.match(sw, /CACHE_VERSION = 'v56'/);
  assert.match(sw, /await caches\.delete\(CACHE\);\s*throw error;/);
});

test('offline shell integrity no longer depends on the bounded runtime cache', () => {
  assert.match(sw, /caches\.open\(CACHE\)\)\.match\(request\)/);
  assert.match(sw, /const shellCached = /);
});

test('a 5xx navigation during deployment falls back to the cached shell; 404s pass through', () => {
  assert.match(sw, /response\.status >= 500/);
  assert.doesNotMatch(sw, /response\.status >= 400/);
});

test('missing static assets stay non-HTML failures instead of shell responses', () => {
  assert.match(sw, /new Response\('', \{ status: 504, statusText: 'Offline' \}\)/);
  assert.match(sw, /!isHtmlResponse\(response\)/);
  assert.match(sw, /asset !== '\.\/' && isHtmlResponse\(response\)/);
});

test('the versioned cloud-state module is precached exactly as the page requests it', () => {
  const tag = html.match(/<script src="\.\/(courtcall-cloud-state\.js[^"]*)"><\/script>/);
  assert.ok(tag, 'cloud-state script tag exists');
  assert.ok(sw.includes(`'./${tag[1]}'`), `service worker precaches ${tag[1]}`);
});

test('update flow stays user-driven: waiting worker activates only on request', () => {
  assert.match(sw, /event\.data\?\.type === 'SKIP_WAITING'/);
  assert.match(html, /_reloadForServiceWorker=true;\s*_waitingServiceWorker\.postMessage\(\{type:'SKIP_WAITING'\}\)/);
  assert.match(html, /if\(_reloadForServiceWorker\)\{_reloadForServiceWorker=false;location\.reload\(\)\}/);
});

// ── I: community resilience contract ─────────────────────

test('community view separates offline, error, auth, and permission from empty', () => {
  assert.match(html, /communityViewState===CourtCallCloudState\.VIEW\.PERMISSION_DENIED\?CourtCallCloudState\.SYNC\.PERMISSION_DENIED/);
  assert.match(html, /communityViewState===CourtCallCloudState\.VIEW\.AUTH_REQUIRED\?CourtCallCloudState\.SYNC\.AUTH_REQUIRED/);
  assert.equal(cloud.classifyError({ name: 'TimeoutError', message: 'Community sync timed out' }), cloud.VIEW.ERROR);
  assert.equal(cloud.communityCopy(cloud.VIEW.ERROR).action, 'Retry');
});

// ── J: Phase 10 offline and corruption safety ────────────

test('discover writes fail visibly and success is only claimed after the write lands', () => {
  assert.match(html, /function discoverWrite\(key,value\)\{\s*try\{localStorage\.setItem[\s\S]*?return true\}/);
  assert.match(html, /const saved=discoverWrite\(CourtCallDiscoverIndia\.STORAGE\.following,next\)/);
  assert.match(html, /if\(!discoverWrite\(CourtCallDiscoverIndia\.STORAGE\.submissions/);
  assert.match(html, /if\(!discoverWrite\(key,discoverRead\(key\)\.concat\(intent\)\)\)return/);
});

test('corrupt discovery data normalizes instead of crashing and follows stay stable', () => {
  const junk = [null, 'garbage', 42, { id: 'x<script>', name: 7 }, { id: 'dup' }, { id: 'dup' }];
  const collection = Discover.normalizeCollection(junk);
  assert.ok(Array.isArray(collection));
  assert.ok(collection.every(item => item.id && item.verification));
  assert.equal(collection.filter(item => item.id === 'dup').length, 1);
  assert.deepEqual(Discover.normalizeFollowing(['b', 'a', 'a', null, '']), ['a', 'b']);
});

test('failed cloud deletes are surfaced instead of silently resurrecting records', () => {
  assert.match(html, /supaDeleteGame\(detailMatchId\)\.then\(ok=>\{/);
  assert.match(html, /supaDeleteTournament\(tid\)\.then\(ok=>\{/);
  assert.match(html, /may reappear until sync succeeds/);
});
