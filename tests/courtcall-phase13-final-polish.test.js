'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const sw = read('basketball-sw.js');
const discoverCss = read('courtcall-discover-india.css');
const cinematicCss = read('courtcall-cinematic.css');
const visualSystem = read('courtcall-global-visual-system.js');

// ── Heading hierarchy: exactly one primary heading per route ──

test('screens that receive an injected route hero do not also carry an h1 page title', () => {
  // These routes get their <h1> from the global visual system's route hero,
  // so their nav-bar label must stay a plain navigation label.
  for (const route of ['comm-create', 'settings', 'analytics', 'help-center']) {
    // hyphenated route keys are quoted in the config object
    const at = Math.max(visualSystem.indexOf(`${route}: {`), visualSystem.indexOf(`'${route}': {`));
    assert.ok(at >= 0, `${route} is missing from the route config`);
    assert.match(visualSystem.slice(at, at + 260), /title:/, `${route} should define a hero title`);
  }
  for (const label of ['New Community', 'Analytics', 'Help Center']) {
    assert.ok(html.includes(`<div class="page-title">${label}</div>`), `${label} must not be a second h1`);
    assert.ok(!html.includes(`<h1 class="page-title">${label}</h1>`), `${label} still duplicates the hero h1`);
  }
});

test('screens with no hero heading expose their own single primary heading', () => {
  assert.match(html, /<h1 class="page-title">Communities<\/h1>/);
  assert.match(html, /<h1 class="cc-sr-only">Live game scoreboard<\/h1>/);
  // The live-game h1 must stay invisible so the scoreboard design is untouched.
  const gameStart = html.indexOf('id="s-game"');
  assert.ok(html.indexOf('<h1 class="cc-sr-only">Live game scoreboard</h1>') > gameStart);
});

test('routes that are their own heading keep their h1 page title', () => {
  for (const label of ['Basketball World', 'CourtCall Pulse', 'Privacy Policy', 'Terms of Service']) {
    assert.ok(html.includes(`<h1 class="page-title">${label}</h1>`), `${label} lost its primary heading`);
  }
});

// ── Mobile reachability of primary navigation ──

test('all four tournament sections are reachable on phones without sideways scrolling', () => {
  assert.match(discoverCss, /@media\(max-width:699px\)\{[\s\S]*?\.tourn-mode-tabs\{display:grid;grid-template-columns:1fr 1fr;overflow-x:visible\}/);
  assert.match(discoverCss, /\.tourn-mode-tab\{min-height:44px\}/);
  // The desktop centred row is untouched.
  assert.match(discoverCss, /@media\(min-width:700px\)\{\.tourn-mode-tabs\{justify-content:center\}/);
});

// ── Touch targets ──

test('sub-minimum touch targets meet 24px without changing the visible design', () => {
  assert.match(cinematicCss, /\.cc-cinema-chapters button\{width:24px;height:24px;min-width:24px/);
  // inset grows with the button so the visible dot stays 6px across.
  assert.match(cinematicCss, /\.cc-cinema-chapters button::before\{content:'';position:absolute;inset:9px/);
  assert.match(html, /\.consent-row input\{margin-top:1px;width:24px;height:24px/);
  assert.match(html, /\.settings-range\{min-width:0;flex:1;min-height:44px/);
});

// ── Copy consistency ──

test('cloud-failure toasts share one non-technical phrasing', () => {
  assert.equal(html.includes('secure cloud sync failed'), false, '"secure" is technical noise');
  assert.equal(/\bsaved locally; cloud sync failed/.test(html), false, 'legacy phrasing remains');
  assert.equal(/is saved locally;/.test(html), false, 'inconsistent "is saved locally" remains');
  const unified = html.match(/on this device · cloud sync failed/g) || [];
  assert.ok(unified.length >= 15, `expected the unified phrase throughout, saw ${unified.length}`);
});

test('local-storage copy avoids the redundant "locally on this device"', () => {
  assert.equal(html.includes('saved locally on this device'), false);
  assert.ok(html.includes("'Submission saved on this device as pending'"));
});

test('failure copy never claims a successful sync', () => {
  for (const match of html.match(/'[^']*cloud sync failed[^']*'/g) || []) {
    assert.doesNotMatch(match, /synced|Synced/);
  }
});

// ── PWA coherence ──

test('every changed stylesheet is version-pinned and precached at the identical URL', () => {
  for (const asset of ['courtcall-core-game.css', 'courtcall-cinematic.css', 'courtcall-discover-india.css']) {
    const link = html.match(new RegExp(`<link rel="stylesheet" href="\\./(${asset}\\?v=[0-9a-z]+)"`));
    assert.ok(link, `${asset} must be version-pinned in index.html`);
    assert.ok(sw.includes(`'./${link[1]}'`), `${asset} precache URL must match the link exactly (${link[1]})`);
  }
  assert.match(sw, /CACHE_VERSION = 'v58'/);
});

test('the Phase 11 service-worker architecture is unchanged', () => {
  assert.match(sw, /response\.status >= 500/);
  assert.match(sw, /const shellCached = /);
  assert.match(sw, /event\.data\?\.type === 'SKIP_WAITING'/);
  assert.match(sw, /await caches\.delete\(CACHE\);\s*throw error;/);
});

// ── Phase 11 / Phase 12 guards ──

test('Phase 12 direct player scoring is untouched by the polish pass', () => {
  assert.match(html, /_addScorePlayer\(team,pts,playerButton\.dataset\.player\)/);
  assert.match(html, /btn-pscore/);
  assert.match(html, /if\(pad\.dataset\.scoreControls!==signature\)\{/);
  assert.match(html, /id="scorer-tabs" role="tablist"/);
});

test('Phase 11 offline and local-first safeguards are untouched', () => {
  assert.match(html, /function getCol\(key\)\{return CourtCallCloudState\.dedupeById\(/);
  assert.match(html, /let _retryCloudSyncInFlight=null/);
  assert.match(html, /if\(!navigator\.onLine\)return false;/);
});
