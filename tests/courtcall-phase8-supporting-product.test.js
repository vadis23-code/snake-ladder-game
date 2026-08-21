'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const support = require('../courtcall-supporting-product.js');
const core = require('../courtcall-core.js');
const html = read('index.html');
const css = read('courtcall-supporting-product.css');
const js = read('courtcall-supporting-product.js');
const sw = read('basketball-sw.js');

test('analytics is deterministic and derives only from supplied CourtCall records', () => {
  const matches = [
    { id: 'm1', date: '2026-08-01', teamA: { name: 'Orange', score: 11 }, teamB: { name: 'Blue', score: 9 }, outcome: 'team_a_win', playersA: [{ id: 'p1', name: 'Ari', score: 7 }], playersB: [] },
    { id: 'm2', date: '2026-08-02', teamA: { name: 'blue', score: 8 }, teamB: { name: 'Orange', score: 8 }, outcome: 'tie', playersA: [], playersB: [{ id: 'p1', name: 'Ari', score: 4 }] },
    { id: 'm3', date: '2026-08-03', teamA: { name: 'A', score: 0 }, teamB: { name: 'B', score: 0 }, outcome: 'cancelled' }
  ];
  const data = { matches, tournaments: [], communities: [{ id: 'c1' }], communityPlayers: [], communityPosts: [{ id: 'post1' }], communityEvents: [], usage: { totalVisits: 3 } };
  const first = support.buildAnalytics(data, { core, now: Date.parse('2026-08-22T00:00:00Z') });
  const second = support.buildAnalytics(data, { core, now: Date.parse('2026-08-22T00:00:00Z') });

  assert.deepEqual(first, second);
  assert.equal(first.games.saved, 3);
  assert.equal(first.games.competitive, 2);
  assert.equal(first.games.cancelled, 1);
  assert.equal(first.teams.length, 2, 'case variants must resolve to the same teams');
  assert.deepEqual(first.teams.find(team => team.name === 'Orange'), {
    name: 'Orange', played: 2, wins: 1, losses: 0, draws: 1,
    pointsFor: 19, pointsAgainst: 17, differential: 2, winRate: 50
  });
  assert.equal(first.players[0].name, 'Ari');
  assert.equal(first.players[0].points, 11);
  assert.equal(first.communities.total, 1);
  assert.equal(first.communities.posts, 1);
});

test('analytics preserves honest empty states when product records are unavailable', () => {
  const empty = support.buildAnalytics({}, { core, now: 0 });
  assert.equal(empty.games.saved, 0);
  assert.equal(empty.games.averageCombinedPoints, 0);
  assert.deepEqual(empty.teams, []);
  assert.deepEqual(empty.players, []);
  assert.equal(empty.tournaments.total, 0);
  assert.equal(empty.communities.total, 0);
  assert.match(html, /No team record yet/);
  assert.match(html, /No player box scores yet/);
});

test('Pulse local activity is read-only, record-backed, filtered, and deep-linkable', () => {
  const activity = support.buildLocalActivity({
    matches: [{ id: 'm1', date: '2026-08-20', teamA: { name: 'A', score: 11 }, teamB: { name: 'B', score: 7 }, outcome: 'team_a_win' }],
    tournaments: [{ id: 't1', name: 'Night Run', createdAt: '2026-08-19', teams: [{ name: 'A' }, { name: 'B' }], fixtures: [] }],
    communityPosts: [{ id: 'p1', communityId: 'c1', title: 'Court update', body: 'The nets were replaced.', createdAt: '2026-08-21' }],
    communityEvents: [{ id: 'e1', communityId: 'c1', title: 'Saturday run', date: '2026-08-23', location: 'North Court' }]
  }, { core });

  assert.equal(activity.length, 4);
  assert.equal(activity[0].title, 'Saturday run');
  assert.equal(activity[0].route, 'community/c1');
  assert.ok(activity.some(item => item.route === 'history'));
  assert.ok(activity.some(item => item.route === 'tournament/t1'));
  assert.ok(activity.every(item => ['basketball', 'tournament', 'community'].includes(item.category)));
});

test('Pulse search shortcuts sanitize location text and use encoded HTTPS search URLs', () => {
  const queries = support.buildSearchQueries({ country: 'India', city: 'Bengaluru & Rural', court: 'Court #1\n' });
  assert.ok(queries.length >= 7);
  for (const query of queries) {
    const url = new URL(query.url);
    assert.equal(url.protocol, 'https:');
    assert.ok(url.searchParams.get('q'));
    assert.equal(url.searchParams.get('hl'), 'en');
    assert.doesNotMatch(query.label, /[\r\n]/);
  }
  assert.ok(queries.some(query => query.url.includes('Bengaluru+%26+Rural')));
});

test('Pulse separates local records, developer samples, and external search content', () => {
  assert.match(html, /Local CourtCall activity/);
  assert.match(html, /Local record/);
  assert.match(html, /Demo content — these are sample stories, not real events or news/);
  assert.match(html, /if\(_isDevMode\(\)\)/);
  assert.match(html, /CourtCall does not fetch, rank, or verify live news/);
});

test('Help keyword matching returns known topics and an honest fallback signal', () => {
  const articles = [
    { id: 'analytics', keywords: ['analytics', 'team performance', 'usage counters'] },
    { id: 'pulse', keywords: ['pulse', 'external search'] }
  ];
  const known = support.matchHelpArticle(articles, 'How do team performance analytics work?');
  const unknown = support.matchHelpArticle(articles, 'quantum upholstery');
  assert.equal(known.article.id, 'analytics');
  assert.notEqual(known.confidence, 'low');
  assert.equal(unknown.article, null);
  assert.equal(unknown.confidence, 'low');
  assert.match(html, /I'm not fully sure about that yet/);
});

test('supporting routes, labels, Help behavior, and legal hierarchy are explicit', () => {
  assert.match(html, /_PUBLIC_SCREENS=new Set\(\[[^\]]*'help-center'/);
  assert.match(html, /function openHelpCenter\(\)/);
  assert.match(html, /function closeHelpCenter\(\)/);
  assert.match(html, /requestAnimationFrame\(\(\)=>\{\s*window\.scrollTo\(0,0\);\s*activeScreen\.scrollTop=0;/);
  assert.match(html, /Beta Help · Keyword matching · Not AI/);
  assert.match(html, /id="hc-results-status" role="status" aria-live="polite"/);
  assert.match(html, /CourtCall does not request device location/);
  assert.match(html, /Reset usage counters clears browser usage counters only/);
  assert.match(html, /CourtCallSupportingProduct\.matchHelpArticle\(COURTCALL_HELP_KB,query\)/);
  assert.equal((html.match(/<main class="legal-body">/g) || []).length, 2);
  assert.equal((html.match(/<h1 class="page-title">(?:Privacy Policy|Terms of Service)<\/h1>/g) || []).length, 2);
  const publicHelp = core.resolveHashRoute('#/help-center', { hasProfile: false });
  assert.equal(publicHelp.screen, 'help-center');
  assert.equal(publicHelp.reason, 'direct_route');
});

test('Basketball World stays curated and does not promise unsupported live product data', () => {
  const world = html.slice(html.indexOf('id="s-world"'), html.indexOf('id="s-communities"'));
  assert.match(world, /Official resources, not a live feed/);
  assert.doesNotMatch(world, /news feed coming soon|Local Pickup Runs near you/);
  for (const destination of ['nba.com', 'wnba.com', 'fiba.basketball', 'euroleaguebasketball.net/euroleague', 'ncaa.com', 'big3.com']) {
    assert.ok(world.includes(destination), `${destination} is missing`);
  }
  assert.equal((world.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 6);
});

test('supporting implementation has narrow dependencies and no backend mutation path', () => {
  assert.doesNotMatch(js, /localStorage|sessionStorage|Supabase|\bsupa\b|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(js, /insert\(|update\(|delete\(|upsert\(|rpc\(/);
  assert.match(html, /CourtCallSupportingProduct\.buildAnalytics/);
  assert.match(html, /CourtCallSupportingProduct\.buildLocalActivity/);
  assert.match(html, /CourtCallSupportingProduct\.buildSearchQueries/);
});

test('supporting surfaces collapse safely on phones and are cached for offline use', () => {
  assert.match(css, /@media\(max-width:520px\)[\s\S]*?\.league-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(max-width:520px\)[\s\S]*?\.pulse-loc-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /\.an-table-wrap\{[^}]*overflow-x:auto/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(sw, /CACHE_VERSION = 'v51'/);
  assert.match(sw, /courtcall-supporting-product\.css\?v=20260822/);
  assert.match(sw, /courtcall-supporting-product\.js\?v=20260822/);
  assert.match(html, /courtcall-supporting-product\.css\?v=20260822/);
  assert.match(html, /courtcall-supporting-product\.js\?v=20260822/);
});
