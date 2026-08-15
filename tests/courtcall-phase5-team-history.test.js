'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require(path.join(root, 'courtcall-core.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const designCss = fs.readFileSync(path.join(root, 'courtcall-design-system.css'), 'utf8');
const phase5Css = fs.readFileSync(path.join(root, 'courtcall-team-history.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'basketball-sw.js'), 'utf8');

const { OUTCOMES } = core;

function player(id, name, value) {
  return {
    id,
    name,
    attrs: { shoot: value, def: value, speed: value, stamina: value }
  };
}

test('Phase 5 player ratings normalize legacy fields to the 1–10 contract', () => {
  assert.equal(core.calculatePlayerRating({ shoot: 5, def: 4, speed: 3, stamina: 2 }), 7);
  const normalized = core.normalizeBuilderPlayer({
    id: 'p1', name: '  Maya  ', nick: 'Jet',
    attrs: { shooting: 5, defence: 4, speed: 3, stamina: 2 }, rating: 1
  });

  assert.equal(normalized.id, 'p1');
  assert.equal(normalized.name, 'Maya');
  assert.equal(normalized.nickname, 'Jet');
  assert.deepEqual(normalized.attrs, { shoot: 5, def: 4, speed: 3, stamina: 2 });
  assert.equal(normalized.rating, 7);
});

test('Phase 5 balanced generation minimizes RMSD without mutating players', () => {
  const players = [player('p1', 'A', 5), player('p2', 'B', 4), player('p3', 'C', 3), player('p4', 'D', 2)];
  const original = structuredClone(players);
  const result = core.generateBalancedTeams(players, 2, { iterations: 10, random: () => 0.25 });

  assert.deepEqual(result.totals, [14, 14]);
  assert.equal(result.rmsd, 0);
  assert.equal(result.teams.flat().length, 4);
  assert.deepEqual(players, original);
});

test('Phase 5 random generation assigns every player once without using ratings', () => {
  const players = [player('p1', 'A', 5), player('p2', 'B', 4), player('p3', 'C', 3), player('p4', 'D', 2), player('p5', 'E', 1)];
  const result = core.generateRandomTeams(players, 2, { random: () => 0 });
  const ids = result.teams.flat().map(entry => entry.id);

  assert.equal(ids.length, players.length);
  assert.equal(new Set(ids).size, players.length);
  assert.equal(Math.abs(result.teams[0].length - result.teams[1].length), 1);
});

test('Phase 5 interactive draft uses a true snake order', () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => core.snakeDraftTeamIndex(index, 2)),
    [0, 1, 1, 0, 0, 1, 1, 0]
  );
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => core.snakeDraftTeamIndex(index, 3)),
    [0, 1, 2, 2, 1, 0, 0, 1, 2]
  );
});

test('Phase 5 queue rotations preserve compatible team objects', () => {
  const queue = [
    { id: 'a', name: 'Orange', players: [] },
    { id: 'b', name: 'Blue', players: [] },
    { id: 'c', name: 'Gold', players: [] },
    { id: 'd', name: 'Green', players: [] }
  ];
  const winnerAway = core.applyQueueAction(queue, { type: 'winners_stay', winnerIndex: 1 });
  const rotation = core.applyQueueAction(queue, { type: 'rotation' });
  const normalizedLegacy = core.normalizeQueueEntry('Legacy Team', 0);

  assert.deepEqual(winnerAway.queue.map(team => team.id), ['b', 'c', 'd', 'a']);
  assert.deepEqual(rotation.queue.map(team => team.id), ['c', 'd', 'a', 'b']);
  assert.equal(normalizedLegacy.name, 'Legacy Team');
  assert.deepEqual(normalizedLegacy.players, []);
  assert.deepEqual(queue.map(team => team.id), ['a', 'b', 'c', 'd']);
});

test('Phase 5 history filters and career summary use the home-side perspective explicitly', () => {
  const matches = [
    { id: 'w', teamA: { name: 'Home', score: 21 }, teamB: { name: 'Away', score: 10 }, outcome: OUTCOMES.TEAM_A_WIN },
    { id: 'l', teamA: { name: 'Home', score: 15 }, teamB: { name: 'Away', score: 21 }, outcome: OUTCOMES.TEAM_B_WIN },
    { id: 'd', teamA: { name: 'Home', score: 11 }, teamB: { name: 'Away', score: 11 }, outcome: OUTCOMES.TIE },
    { id: 'x', teamA: { name: 'Home', score: 0 }, teamB: { name: 'Away', score: 0 }, outcome: OUTCOMES.CANCELLED }
  ];
  const summary = core.calculateHistorySummary(matches, { perspectiveTeam: 'a' });

  assert.deepEqual({
    totalGames: summary.totalGames,
    wins: summary.wins,
    losses: summary.losses,
    draws: summary.draws,
    winRate: summary.winRate
  }, { totalGames: 3, wins: 1, losses: 1, draws: 1, winRate: 33 });
  assert.equal(Number(summary.averageDifferential.toFixed(1)), 1.7);
  assert.deepEqual(core.filterMatchHistory(matches, 'wins').map(match => match.id), ['w']);
  assert.deepEqual(core.filterMatchHistory(matches, 'losses').map(match => match.id), ['l']);
  assert.deepEqual(core.filterMatchHistory(matches, 'draws').map(match => match.id), ['d']);
  assert.equal(core.filterMatchHistory(matches, 'all').length, 4);
});

test('Phase 5 player careers prefer stable IDs and track wins, losses, draws and averages', () => {
  const matches = [
    {
      teamA: { name: 'Home', score: 5, players: [{ id: 'p1', name: 'Maya', score: 5, fouls: 1 }] },
      teamB: { name: 'Away', score: 2, players: [{ id: 'p2', name: 'Noah', score: 2, fouls: 0 }] },
      outcome: OUTCOMES.TEAM_A_WIN
    },
    {
      teamA: { name: 'Home', score: 3, players: [{ id: 'p1', name: 'Maya', score: 3, fouls: 0 }] },
      teamB: { name: 'Away', score: 3, players: [{ id: 'p2', name: 'Noah', score: 3, fouls: 2 }] },
      outcome: OUTCOMES.TIE
    }
  ];
  const careers = core.calculatePlayerCareerStats(matches);
  const maya = careers.find(entry => entry.id === 'p1');
  const noah = careers.find(entry => entry.id === 'p2');

  assert.deepEqual(
    { games: maya.games, points: maya.points, fouls: maya.fouls, wins: maya.wins, losses: maya.losses, draws: maya.draws, averagePoints: maya.averagePoints, winRate: maya.winRate },
    { games: 2, points: 8, fouls: 1, wins: 1, losses: 0, draws: 1, averagePoints: 4, winRate: 50 }
  );
  assert.deepEqual(
    { games: noah.games, wins: noah.wins, losses: noah.losses, draws: noah.draws },
    { games: 2, wins: 0, losses: 1, draws: 1 }
  );
});

test('Phase 5 markup exposes exact Team Builder, queue and History contracts', () => {
  assert.match(html, /courtcall-core-game\.css[\s\S]*courtcall-team-history\.css/);
  assert.match(html, /id="tb-tabs-bar"[\s\S]*Players[\s\S]*Teams[\s\S]*Queue/);
  assert.match(html, /id="tb-player-nickname"/);
  assert.match(html, /id="tb-save-player"/);
  assert.match(html, /id="tb-reshuffle"[\s\S]*onclick="reshuffleTeams\(\)"/);
  assert.match(html, /Snake Draft — Interactive Picks/);
  assert.match(html, /data-v="winners-stay"[\s\S]*data-v="rotation"/);
  assert.match(html, /onclick="queueMoveSlot\(\$\{i\},'up'\)"/);
  assert.match(html, /onclick="startNextQueuedGame\(\)"/);
  assert.match(html, /id="history-career-grid"/);
  assert.match(html, /data-f="all"[\s\S]*data-f="wins"[\s\S]*data-f="losses"[\s\S]*data-f="draws"/);
  assert.match(html, /id="md-periods"/);
  assert.match(html, /id="md-tournament"/);
});

test('Phase 5 runtime preserves storage compatibility and wires all completed workflows', () => {
  assert.match(html, /builderState=normalizeBuilderState\(getObj\(K\.builder,BUILDER_DEFAULT\)\)/);
  assert.match(html, /if\(bs\)builderState=normalizeBuilderState\(bs\)/);
  assert.match(html, /Array\.isArray\(builder\.queue\)\?builder\.queue\.map\(\(entry,index\)=>Phase5Core\.normalizeQueue\(entry,index\)\):\[\]/);
  assert.match(html, /function tbEditPlayer\(id\)/);
  assert.match(html, /async function tbDeletePlayer\(id\)/);
  assert.match(html, /Phase5Core\.teams\(builderState\.players,n,mode\)/);
  assert.match(html, /ds\.turn=Phase5Core\.snakeIndex\(ds\.pickIndex,ds\.teamCount\)/);
  assert.match(html, /function queueMoveSlot\(index,direction\)/);
  assert.match(html, /function applyQueueOutcome\(entry\)/);
  assert.match(html, /function restoreQueueOutcome\(\)/);
  assert.match(html, /Phase5Core\.filter\(complete,historyFilterMode\)/);
  assert.match(html, /Phase5Core\.careers\(getNormalizedHistoryMatches\(\)\)/);
  assert.match(html, /playersA=\(state\.teamA\.players\|\|\[\]\)\.map\(p=>\(\{id:p\.id/);
  assert.match(html, /const returnFocus=_pickerReturnFocus;_pickerReturnFocus=null;/);
});

test('Phase 5 remains functional while an older cached core module is replaced', () => {
  assert.match(html, /const Phase5Core=\{/);
  assert.match(html, /const method=mode==='balanced'\?'generateBalancedTeams':'generateRandomTeams';if\(typeof CourtCallCore\[method\]==='function'\)/);
  assert.match(html, /if\(typeof CourtCallCore\.filterMatchHistory==='function'\)/);
  assert.match(html, /Phase5Core\.normalizePlayer\(player,index\)/);
  assert.match(serviceWorker, /CACHE_VERSION = 'v44'/);
  assert.match(serviceWorker, /'\.\/courtcall-team-history\.css'/);
});

test('Phase 5 stylesheet covers responsive, reduced-motion and forced-color states', () => {
  [
    '#s-teams .premium-player-card', '#s-teams .draft-teams-row', '#s-teams .q-slot',
    '.history-career-grid', '#s-history .match-card', '.career-panel',
    'body:has(#s-history.active) > .sync-indicator #sync-label',
    'body:has(#s-history.active) > .help-fab',
    '#s-teams .q-add-row { display: grid;',
    '@media (max-width: 29.9375rem)', '@media (prefers-reduced-motion: reduce)', '@media (forced-colors: active)'
  ].forEach(selector => assert.ok(phase5Css.includes(selector), `missing ${selector}`));
  const declared = new Set([...`${designCss}\n${phase5Css}`.matchAll(/(--cc-[a-z0-9-]+)\s*:/gi)].map(match => match[1]));
  const referenced = new Set([...phase5Css.matchAll(/var\((--cc-[a-z0-9-]+)/gi)].map(match => match[1]));
  assert.deepEqual([...referenced].filter(token => !declared.has(token)), []);
  let depth = 0;
  for (const char of phase5Css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    assert.ok(depth >= 0, 'Phase 5 CSS closes a block before it opens');
  }
  assert.equal(depth, 0);
});
