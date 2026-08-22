const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const css = read('courtcall-global-visual-system.css');
const js = read('courtcall-global-visual-system.js');
const sw = read('basketball-sw.js');

test('global visual layer loads after cinematic styles and remains in the offline shell', () => {
  assert.ok(html.indexOf('courtcall-global-visual-system.css') > html.indexOf('courtcall-cinematic.css'));
  assert.ok(html.indexOf('courtcall-global-visual-system.js') > html.indexOf('courtcall-cinematic.js'));
  assert.match(sw, /CACHE_VERSION = 'v53'/);
  assert.match(sw, /courtcall-global-visual-system\.css/);
  assert.match(sw, /courtcall-global-visual-system\.js/);
});

test('every production screen has a route-aware Midnight Arena configuration', () => {
  const screenRoutes = [...html.matchAll(/id="s-([a-z-]+)" class="screen/g)].map(match => match[1]);
  for (const route of screenRoutes.filter(route => route !== 'landing')) {
    const property = route.includes('-') ? `'${route}'` : route;
    assert.match(js, new RegExp(`${property}:\\s*\\{\\s*atmosphere:`), `missing atmosphere for ${route}`);
  }
  assert.doesNotMatch(js, /landing:\s*\{\s*atmosphere:/);
  assert.match(js, /if \(route === 'landing'\)[\s\S]*?classList\.remove\('cc-visual-route'\)/);
  assert.match(html, /CourtCallGlobalVisuals\?\.onRouteChange\(name\)/);
});

test('shared visual primitives cover atmosphere, court, broadcast, card and empty-state materials', () => {
  for (const primitive of [
    'cc-arena-gradient', 'cc-team-aura', 'cc-court-lines', 'cc-floor-reflection',
    'cc-broadcast-stat', 'cc-score-card', 'cc-player-card', 'cc-tournament-card',
    'cc-championship-glow', 'cc-court-hud', 'cc-basketball-badge',
    'cc-premium-divider', 'cc-route-hero'
  ]) assert.match(css, new RegExp(`\\.${primitive}\\b`));
  assert.match(css, /\.tourn-empty, \.history-empty/);
  assert.match(css, /\.comm-empty, \.lb-empty, \.evt-empty, \.gal-empty, \.pulse-empty/);
});

test('Higgsfield-derived atmosphere crops are lightweight and complete', () => {
  for (const family of ['arena', 'locker', 'sideline', 'clutch', 'championship']) {
    for (const suffix of ['.webp', '-mobile.webp']) {
      const asset = path.join(root, 'assets', 'atmospheres', `${family}${suffix}`);
      assert.equal(fs.existsSync(asset), true, `${family}${suffix} is missing`);
      assert.ok(fs.statSync(asset).size < 64 * 1024, `${family}${suffix} should remain below 64 KB`);
    }
  }
});

test('community subviews receive basketball-specific visual heroes', () => {
  for (const tab of ['feed', 'members', 'players', 'gallery', 'events', 'leaderboard', 'settings']) {
    assert.match(js, new RegExp(`\\b${tab}: \\[`));
  }
  assert.match(html, /onCommunityTabChange\(activeCommTab\)/);
  assert.match(css, /\.cc-subview-hero/);
});

test('visual layer is presentation-only, loop-free and data-saver aware', () => {
  assert.doesNotMatch(js, /localStorage|sessionStorage|Supabase|\bsupa\b|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(js, /requestAnimationFrame|setInterval|setTimeout|<video|\.play\(/);
  assert.doesNotMatch(`${css}\n${js}`, /gsap|lenis|three\.js/i);
  assert.match(js, /navigator\.connection\?\.saveData/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-reduced-motion='true'/);
  assert.match(css, /data-cc-save-data/);
});

test('global visual files have balanced block braces', () => {
  const balanced = source => {
    let depth = 0;
    for (const char of source) {
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      assert.ok(depth >= 0);
    }
    assert.equal(depth, 0);
  };
  balanced(css);
  balanced(js);
});
