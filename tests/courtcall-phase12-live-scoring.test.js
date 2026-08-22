'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const core = require('../courtcall-core.js');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const gameCss = fs.readFileSync(path.join(root, 'courtcall-core-game.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'basketball-sw.js'), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is missing`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} has an unbalanced body`);
}

// ── A: direct one-tap player scoring, no picker step ─────

test('player rows expose always-visible +1/+2/+3 with explicit accessible names', () => {
  const rowBuilder = functionBody(html, '_scorerRowHTML');
  assert.match(rowBuilder, /btn-pscore/);
  assert.match(rowBuilder, /data-player=/);
  assert.match(rowBuilder, /aria-label="Add \$\{p\} point\$\{p>1\?'s':''\} to \$\{escAttr\(label\)\} \(\$\{escAttr\(tName\)\}\)"/);
  assert.match(rowBuilder, /scorer-pts/);
  assert.match(rowBuilder, /data-role="fouls"/);
  // Every allowed score value renders a button in every row.
  assert.match(rowBuilder, /pts\.map\(/);
});

test('tapping a player button routes straight through the established score engine', () => {
  const wiring = functionBody(html, 'wireScorePads');
  const playerBranch = wiring.slice(wiring.indexOf('.btn-pscore'), wiring.indexOf('.btn-score'));
  assert.match(playerBranch, /_addScorePlayer\(team,pts,playerButton\.dataset\.player\)/);
  assert.match(playerBranch, /else addScore\(team,pts\)/);
  assert.doesNotMatch(playerBranch, /openPlayerPicker/);
  // The engine call itself already runs persistence, feedback, and victory.
  const engine = functionBody(html, '_addScorePlayer');
  for (const step of ['ensureGameStarted', 'state.history.unshift', 'recomputeGameFromHistory', 'save()', 'renderGame()', 'runScoreFeedback', 'checkWin()']) {
    assert.ok(engine.includes(step), `_addScorePlayer must run ${step}`);
  }
  assert.match(engine, /if\(player\)player\.score\+=pts/);
});

test('no scoring path duplicates score math outside the shared state engine', () => {
  // Voice, team buttons, and player buttons all land in addScore/_addScorePlayer.
  assert.match(html, /addScore\(team,pts\)/);
  const voice = functionBody(html, 'parseVoiceCmd');
  assert.match(voice, /addScore\(team,pts\)/);
  assert.doesNotMatch(voice, /\.score\+=|score\s*=\s*score\s*\+/);
});

test('an unattributed team-basket row preserves the old picker escape hatch in one tap', () => {
  const rowBuilder = functionBody(html, '_scorerRowHTML');
  assert.match(rowBuilder, /Team basket/);
  assert.match(rowBuilder, /no player attribution/);
  assert.match(html, /scorer-row--team/);
});

test('the common basket for the active rule set is visually emphasized', () => {
  const emphasis = functionBody(html, '_emphasisScoreValue');
  assert.match(emphasis, /state\.ptsSmall/);
  assert.match(gameCss, /\.btn-pscore\.emph \{/);
  const emph = gameCss.slice(gameCss.indexOf('.btn-pscore.emph {'));
  assert.match(emph, /min-height: 3\.8rem/);
});

// ── B: scoreboard hierarchy preserved ────────────────────

test('the giant team scoreboard remains above and independent of player rows', () => {
  const scoreboard = html.indexOf('class="scoreboard"');
  const scorerTabs = html.indexOf('id="scorer-tabs"');
  const scoreZone = html.indexOf('id="score-zone"');
  const controls = html.indexOf('class="controls-bar"');
  const feed = html.indexOf('class="feed-wrap"');
  assert.ok(scoreboard > 0 && scoreboard < scorerTabs && scorerTabs < scoreZone && scoreZone < controls && controls < feed,
    'hierarchy must be scoreboard → player scoring → controls → feed');
  assert.match(html, /id="t-score-a" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /id="t-score-b" aria-live="polite" aria-atomic="true"/);
});

// ── D/L: structured last call and feed copy ──────────────

test('last call copy names team, player, and value explicitly', () => {
  const lastCall = functionBody(html, 'describeLastCall');
  assert.match(lastCall, /const parts=\[teamName\]/);
  assert.match(lastCall, /if\(action\.playerName\)parts\.push\(action\.playerName\)/);
  assert.match(lastCall, /parts\.push\(`\+\$\{action\.pts\}`\)/);
  assert.match(lastCall, /'Last score':'Last call'/);
  assert.match(lastCall, /parts\.join\(' · '\)/);
  assert.match(html, /id="last-action-kicker"/);
});

test('feed entries include the team name in text for attributed events', () => {
  assert.match(html, /`\$\{escHtml\(name\)\} · \$\{escHtml\(e\.playerName\)\}`/);
  const feed = functionBody(html, 'renderFeed');
  assert.match(feed, /fe-q/);
  assert.match(feed, /\+\$\{e\.pts\}/);
});

// ── E/M: feedback and complete undo ──────────────────────

test('player score feedback pulses the row and announces player, team, and totals', () => {
  const feedback = functionBody(html, 'runScoreFeedback');
  assert.match(feedback, /scorer-row\[data-player=/);
  assert.match(feedback, /classList\.add\('scored'\)/);
  assert.match(feedback, /scores \$\{points\} for \$\{name\}/);
  assert.match(feedback, /gameReducedMotion\(\)/);
});

test('undo reverses player points, team points, and game-clock bootstrap together', () => {
  const undo = functionBody(html, 'undoScore');
  assert.match(undo, /p\.score=Math\.max\(0,p\.score-\(last\.pts\|\|0\)\)/);
  assert.match(undo, /recomputeGameFromHistory\(true\)/);
  assert.match(undo, /state\.startTime=null/);
  // Winning-score rollback stays available from the post-game overlay.
  assert.match(html, /id="pg-undo-score"/);
  assert.match(html, /canUndoLastScore/);
});

// ── F/R: rapid input correctness via the shared timeline ──

test('rapid mixed sequences recompute exact team totals from history', () => {
  const rapid = [
    { type: 'score', team: 'b', pts: 1 },
    { type: 'score', team: 'b', pts: 2 },
    { type: 'score', team: 'a', pts: 3 },
    { type: 'score', team: 'a', pts: 2 },
    { type: 'foul', team: 'a' },
    { type: 'score', team: 'a', pts: 2 },
    { type: 'score', team: 'b', pts: 3 },
    { type: 'score', team: 'a', pts: 1 }
  ];
  const stats = core.recomputeTimeline(rapid);
  assert.equal(stats.scoreA, 8);
  assert.equal(stats.scoreB, 6);
  assert.equal(stats.hasScoringActions, true);
});

test('repeated same-player taps accumulate without loss and undo one step at a time', () => {
  const history = [];
  for (let i = 0; i < 12; i += 1) history.unshift({ type: 'score', team: 'a', pts: 2, playerId: 'p1' });
  assert.equal(core.recomputeTimeline(history).scoreA, 24);
  history.shift();
  assert.equal(core.recomputeTimeline(history).scoreA, 22);
});

test('score pads rebuild only on roster changes so taps never race innerHTML swaps', () => {
  const pads = functionBody(html, 'renderScorePads');
  assert.match(pads, /if\(pad\.dataset\.scoreControls!==signature\)\{/);
  const roster = functionBody(html, 'renderPlayerRosters');
  assert.match(roster, /data-role="pts"/);
  assert.doesNotMatch(roster, /row\.innerHTML|pad\.innerHTML/);
});

// ── N: win rules remain authoritative ────────────────────

test('first-to target, win-by-two, and one-point margins behave exactly as before', () => {
  const O = core.OUTCOMES;
  assert.equal(core.evaluateAutomaticOutcome({ scoreA: 21, scoreB: 15, winScore: 21 }), O.TEAM_A_WIN);
  assert.equal(core.evaluateAutomaticOutcome({ scoreA: 20, scoreB: 15, winScore: 21 }), null);
  assert.equal(core.evaluateAutomaticOutcome({ scoreA: 21, scoreB: 21, winScore: 21 }), null);
  assert.equal(core.evaluateAutomaticOutcome({ scoreA: 21, scoreB: 20, winScore: 21, winBy2: true }), null);
  assert.equal(core.evaluateAutomaticOutcome({ scoreA: 22, scoreB: 20, winScore: 21, winBy2: true }), O.TEAM_A_WIN);
  assert.equal(core.evaluateAutomaticOutcome({ scoreA: 20, scoreB: 22, winScore: 21, winBy2: true }), O.TEAM_B_WIN);
});

test('player attribution does not alter winner evaluation or match compatibility', () => {
  assert.equal(core.describeGameAction({ type: 'score', team: 'a', pts: 2 }, { a: { name: 'North' }, b: { name: 'South' } }), '+2 · North');
  const entry = core.normalizeMatch({
    teamA: { name: 'A', score: 8, players: [{ id: 'p1', name: 'C', score: 5, fouls: 0 }] },
    teamB: { name: 'B', score: 4, players: [{ id: 'p2', name: 'D', score: 4, fouls: 1 }] },
    winScore: 8
  });
  assert.equal(entry.teamA.players[0].name, 'C');
  assert.equal(entry.teamB.players[0].score, 4);
});

// ── G/O: responsive roster switcher and accessibility ────

test('narrow screens show one roster with accessible team tabs; wide screens show both', () => {
  assert.match(html, /id="scorer-tabs" role="tablist" aria-label="Choose which team's players to score"/);
  assert.match(html, /id="scorer-tab-a"[^>]*role="tab" aria-selected="true"/);
  assert.match(html, /id="scorer-tab-b"[^>]*role="tab" aria-selected="false" tabindex="-1"/);
  assert.match(gameCss, /@media \(max-width: 47\.9375rem\) \{[\s\S]*?\.score-zone--players\[data-scorer='a'\] #pad-b \{ display: none; \}/);
  assert.match(gameCss, /@media \(min-width: 48rem\) \{\n  \.scorer-tabs \{ display: none; \}/);
  // Arrow-key roving tabindex reuses the shared tablist wiring.
  assert.match(html, /_wireTablist\(tabs\)/);
});

test('switching the scorer roster never touches possession or any game state', () => {
  const switcher = functionBody(html, 'setScorerTeam');
  assert.doesNotMatch(switcher, /possession|state\.|save\(|history/);
  assert.match(switcher, /aria-selected/);
  assert.match(switcher, /dataset\.scorer=team/);
});

// ── J: every existing game control survives ──────────────

test('undo, voice, fouls, possession, timeout, period, clocks, and end game all remain', () => {
  for (const control of [
    'onclick="undoScore()"', 'onclick="toggleVoice()"', "onclick=\"handleFoulTap('a')\"",
    "onclick=\"handleFoulTap('b')\"", 'onclick="handleEndGame()"', 'onclick="togglePossession()"',
    "onclick=\"addTimeout('a')\"", 'onclick="nextQuarter()"', 'id="sc-digits"', 'id="gc-digits"',
    'id="player-picker"', 'onclick="_pickerSkip()"'
  ]) assert.ok(html.includes(control), `${control} is missing from the game screen`);
});

// ── P/Q: touch targets, spacing, and calm motion ─────────

test('scoring buttons are large, separated, and calm under reduced motion', () => {
  assert.match(gameCss, /\.btn-pscore \{[\s\S]*?min-height: 3\.4rem/);
  assert.match(gameCss, /\.scorer-btns \{[\s\S]*?gap: 0\.55rem/);
  assert.match(gameCss, /\.scorer-tab \{[\s\S]*?min-height: 2\.9rem/);
  assert.match(gameCss, /@media \(prefers-reduced-motion: reduce\) \{\n  \.scorer-row\.scored \{ animation: none; \}/);
  assert.match(gameCss, /html\[data-reduced-motion='true'\] \.scorer-row\.scored \{ animation: none; \}/);
  assert.match(gameCss, /@media \(forced-colors: active\) \{\n  \.btn-pscore, \.scorer-tab \{ background: Canvas; \}/);
});

// ── Compatibility: shell versioning stays coherent ───────

test('the changed game stylesheet is version-pinned and precached exactly as requested', () => {
  const tag = html.match(/<link rel="stylesheet" href="\.\/(courtcall-core-game\.css[^"]*)">/);
  assert.ok(tag && tag[1].includes('?v='), 'game css link must be version-pinned');
  assert.ok(sw.includes(`'./${tag[1]}'`), `service worker must precache ${tag[1]}`);
  assert.match(sw, /CACHE_VERSION = 'v57'/);
});

test('desktop broadcast rail keeps the scorer tabs in the main column', () => {
  assert.match(gameCss, /:is\(\.momentum-bar, \.run-banner, \.scoreboard, \.game-status, \.clock-bar, \.scorer-tabs, \.score-zone, \.last-action, \.controls-bar, \.voice-panel\) \{ grid-column: 1; \}/);
});
