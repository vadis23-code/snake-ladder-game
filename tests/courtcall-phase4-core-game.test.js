const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require(path.join(root, 'courtcall-core.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const designCss = fs.readFileSync(path.join(root, 'courtcall-design-system.css'), 'utf8');
const gameCss = fs.readFileSync(path.join(root, 'courtcall-core-game.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'basketball-sw.js'), 'utf8');

test('Phase 4 validates every bounded custom setup decision', () => {
  const valid = core.validateGameSetup({
    winScore: 21,
    ptsSmall: 1,
    ptsLarge: 2,
    shotClockDuration: 24,
    timeoutsPerTeam: 2
  });
  const invalid = core.validateGameSetup({
    winScore: 1,
    ptsSmall: 3,
    ptsLarge: 3,
    shotClockDuration: 4,
    timeoutsPerTeam: 4
  });

  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, []);
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.errors, [
    'Win score must be a whole number from 2 to 999.',
    'Small and large basket values must be different.',
    'Shot clock must be off or a whole number from 5 to 60 seconds.',
    'Timeouts per team must be between 0 and 3.'
  ]);
});

test('Phase 4 state creation preserves the compatible game shape', () => {
  const player = { id: 'p1', name: 'Avery', score: 4, fouls: 1 };
  const state = core.createGameState({
    gameType: '5v5',
    winScore: 15,
    ptsSmall: 2,
    ptsLarge: 3,
    allowFreeThrow: true,
    shotClockDuration: 24,
    shotClockAutoReset: false,
    gameClockMode: 'up',
    periodsEnabled: true,
    winBy2: true,
    withPlayers: true,
    timeoutsPerTeam: 3,
    teamA: { name: 'North', colorKey: 'green', players: [player] },
    teamB: { name: 'South', colorKey: 'blue', players: [] }
  });

  assert.deepEqual(Object.keys(state), [
    'gameType', 'winScore', 'ptsSmall', 'ptsLarge', 'allowFreeThrow',
    'shotClockDuration', 'shotClockAutoReset', 'gameClockMode', 'periodsEnabled',
    'winBy2', 'withPlayers', 'timeoutsPerTeam', 'timeoutsUsedA', 'timeoutsUsedB',
    'teamA', 'teamB', 'quarter', 'possession', 'history', 'maxLead',
    'voiceActive', 'gameOver', 'startTime'
  ]);
  assert.equal(state.startTime, null);
  assert.equal(state.periodsEnabled, true);
  assert.equal(state.teamA.name, 'North');
  assert.deepEqual(state.teamA.players[0], player);
  assert.notEqual(state.teamA.players[0], player);
});

test('score controls and haptics follow the configured rule', () => {
  assert.deepEqual(core.allowedScoreValues({ ptsSmall: 1, ptsLarge: 2, allowFreeThrow: true }), [1, 2]);
  assert.deepEqual(core.allowedScoreValues({ ptsSmall: 2, ptsLarge: 3, allowFreeThrow: true }), [1, 2, 3]);
  assert.deepEqual(core.allowedScoreValues({ ptsSmall: 2, ptsLarge: 3, allowFreeThrow: false }), [2, 3]);
  assert.deepEqual(core.scoreHapticPattern(1), [36]);
  assert.deepEqual(core.scoreHapticPattern(2), [28, 28, 34]);
  assert.deepEqual(core.scoreHapticPattern(3), [22, 24, 22, 24, 42]);
});

test('period progression advances through regulation and repeated overtime', () => {
  assert.equal(core.nextGamePeriod(1, false), 1);
  assert.equal(core.nextGamePeriod(1, true), 2);
  assert.equal(core.nextGamePeriod(3, true), 4);
  assert.equal(core.nextGamePeriod(4, true), 'OT');
  assert.equal(core.nextGamePeriod('OT', true), 'OT2');
  assert.equal(core.nextGamePeriod('OT2', true), 'OT3');
});

test('persisted running clocks account for background time without duplicating intervals', () => {
  const paused = core.resumeClockSnapshot({ elapsed: 18, running: false, savedAt: 1_000 }, 8_000);
  const running = core.resumeClockSnapshot({ elapsed: 18, running: true, savedAt: 1_000 }, 8_900);

  assert.deepEqual(paused, { elapsed: 18, running: false });
  assert.deepEqual(running, { elapsed: 25, running: true });
});

test('last-action copy identifies scores, fouls and timeouts without color alone', () => {
  const teams = { a: { name: 'North' }, b: { name: 'South' } };
  assert.equal(core.describeGameAction({ type: 'score', team: 'a', pts: 2 }, teams), '+2 · North');
  assert.equal(core.describeGameAction({ type: 'foul', team: 'b', playerName: 'Jordan' }, teams), 'Foul · Jordan');
  assert.equal(core.describeGameAction({ type: 'timeout', team: 'a' }, teams), 'Timeout · North');
});

test('Phase 4 markup exposes the complete core-game interaction contract', () => {
  const designLink = html.indexOf('<link rel="stylesheet" href="./courtcall-design-system.css">');
  const gameLink = html.indexOf('<link rel="stylesheet" href="./courtcall-core-game.css">');

  assert.ok(gameLink > designLink);
  assert.match(html, /<details class="setup-advanced" id="setup-advanced"/);
  assert.match(html, /id="cr-periods"/);
  assert.match(html, /id="setup-error" role="alert"/);
  assert.match(html, /<button class="q-chip" id="q-chip"[^>]+onclick="nextQuarter\(\)"/);
  assert.match(html, /id="t-name-a"[^>]+onclick="openTeamRename\('a'\)"/);
  assert.match(html, /id="game-save-state" role="status"/);
  assert.match(html, /id="last-action"/);
  assert.match(html, /id="team-rename-dialog"[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(html, /id="pg-overlay" role="dialog" aria-modal="true"/);
  assert.match(html, /id="pg-save-exit" onclick="saveAndExitGame\(\)"/);
});

test('Phase 4 runtime wires state, clocks, voice, persistence and victory safely', () => {
  assert.match(html, /function freshState\(\)\{return Phase4GameCore\.createState\(\)\}/);
  assert.match(html, /Phase4GameCore\.validateSetup\(draft\)/);
  assert.match(html, /setCol\(K\.matches,list\.slice\(0,200\)\)/);
  assert.match(html, /_sc:SC\.snapshot\(\),_gcc:gameClock/);
  assert.match(html, /this\._tmr=setInterval\(\(\)=>this\.refreshFromTime\(\),100\)/);
  assert.match(html, /this\._tmr=setInterval\(\(\)=>this\.render\(\),250\)/);
  assert.match(html, /document\.addEventListener\('visibilitychange'/);
  assert.match(html, /Phase4GameCore\.scoreValues\(state\)/);
  assert.doesNotMatch(html, /const rule=state\.scoringRule/);
  assert.match(html, /_setModalBackground\(overlay,true\)/);
  assert.match(html, /document\.getElementById\('pg-save-exit'\)\?\.focus\(\)/);
  assert.match(html, /if\(gameReducedMotion\(\)\)return/);
  assert.match(html, /function saveAndExitGame\(\)\{[\s\S]*?showScreen\('hub'\);renderHub\(\);/);
  assert.match(html, /function newGame\(\)\{[\s\S]*?showScreen\('setup'\);goSetup\(\)\}/);
  assert.match(html, /const returnFocus=_renameReturnFocus;_renameReturnFocus=null;\s*if\(returnFocus\?\.isConnected\)/);
});

test('Phase 4 remains functional while an older cached core module is being replaced', () => {
  assert.match(html, /const Phase4GameCore=\{/);
  assert.match(html, /if\(typeof CourtCallCore\.createGameState==='function'\)/);
  assert.match(html, /if\(typeof CourtCallCore\.resumeClockSnapshot==='function'\)/);
  assert.match(html, /Object\.assign\(state,Phase4GameCore\.createState\(gameState\)\)/);
});

test('Phase 4 stylesheet is cached and defines every required game surface', () => {
  assert.match(serviceWorker, /CACHE_VERSION = 'v38'/);
  assert.match(serviceWorker, /'\.\/courtcall-core-game\.css'/);
  [
    '.setup-hero', '.setup-advanced', '#s-game.active', '.team-leader-label',
    '.last-action', '.score-fx', '.team-rename-dialog', '#pg-overlay',
    '@media (orientation: landscape)', '@media (prefers-reduced-motion: reduce)'
  ].forEach((selector) => assert.ok(gameCss.includes(selector), `missing ${selector}`));
  assert.match(gameCss, /#s-game \.vs-col \{[\s\S]*?display: flex;/);
});

test('Phase 4 CSS uses only declared semantic design tokens', () => {
  const combined = `${designCss}\n${gameCss}`;
  const declared = new Set([...combined.matchAll(/(--cc-[a-z0-9-]+)\s*:/gi)].map((match) => match[1]));
  const referenced = new Set([...gameCss.matchAll(/var\((--cc-[a-z0-9-]+)/gi)].map((match) => match[1]));
  const missing = [...referenced].filter((token) => !declared.has(token));
  assert.deepEqual(missing, []);
});

test('Phase 4 stylesheet has balanced block braces', () => {
  const withoutComments = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const char of withoutComments) {
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    assert.ok(depth >= 0, 'closing brace appears before an opening brace');
  }
  assert.equal(depth, 0);
});
