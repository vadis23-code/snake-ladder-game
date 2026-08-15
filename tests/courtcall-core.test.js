'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../courtcall-core.js');

const { OUTCOMES } = core;

function newestFirst(events) {
  return events.slice().reverse();
}

test('0-0 manual end requires the exact cancel-or-continue decision', () => {
  const decision = core.decideManualEnd({ scoreA: 0, scoreB: 0, timeline: [] });

  assert.equal(decision.status, 'needs_confirmation');
  assert.equal(decision.outcome, null);
  assert.equal(decision.prompt, 'No points have been scored. Cancel this game?');
  assert.deepEqual(decision.options, [
    { action: 'continue', label: 'Continue Game' },
    { action: 'cancel', label: 'Cancel Game' }
  ]);
  assert.equal(core.decideManualEnd({ scoreA: 0, scoreB: 0 }, 'continue').status, 'continue');
});

test('1-0 manual end produces one Team A winner', () => {
  const decision = core.decideManualEnd({
    scoreA: 1,
    scoreB: 0,
    timeline: [{ type: 'score', team: 'a', pts: 1 }]
  });

  assert.equal(decision.status, 'complete');
  assert.equal(decision.outcome, OUTCOMES.TEAM_A_WIN);
});

test('10-10 manual end is a tie and never assigns a winner', () => {
  const decision = core.decideManualEnd({ scoreA: 10, scoreB: 10 });
  const match = core.normalizeMatch({
    teamA: { name: 'Orange', score: 10 },
    teamB: { name: 'Blue', score: 10 },
    outcome: decision.outcome
  });

  assert.equal(decision.outcome, OUTCOMES.TIE);
  assert.equal(match.winner, null);
  assert.equal(match.loser, null);
});

test('normal first-to-21 game ends only when a leading team reaches 21', () => {
  assert.equal(core.evaluateAutomaticOutcome({ scoreA: 20, scoreB: 17, winScore: 21 }), null);
  assert.equal(
    core.evaluateAutomaticOutcome({ scoreA: 21, scoreB: 17, winScore: 21 }),
    OUTCOMES.TEAM_A_WIN
  );
  assert.equal(
    core.evaluateAutomaticOutcome({ scoreA: 21, scoreB: 22, winScore: 21 }),
    OUTCOMES.TEAM_B_WIN
  );
});

test('win-by-two keeps playing at a one-point margin and ends at two', () => {
  assert.equal(
    core.evaluateAutomaticOutcome({ scoreA: 21, scoreB: 20, winScore: 21, winByTwo: true }),
    null
  );
  assert.equal(
    core.evaluateAutomaticOutcome({ scoreA: 22, scoreB: 20, winScore: 21, winByTwo: true }),
    OUTCOMES.TEAM_A_WIN
  );
  assert.equal(
    core.evaluateAutomaticOutcome({ scoreA: 20, scoreB: 22, winScore: 21, winBy2: true }),
    OUTCOMES.TEAM_B_WIN
  );
});

test('undo after a game-winning score reopens the game and recomputes the score', () => {
  const chronological = [];
  for (let index = 0; index < 10; index += 1) chronological.push({ type: 'score', team: 'a', pts: 2 });
  for (let index = 0; index < 8; index += 1) chronological.push({ type: 'score', team: 'b', pts: 2 });
  chronological.push({ type: 'score', team: 'b', pts: 1 });
  chronological.push({ type: 'score', team: 'a', pts: 1 });
  const timeline = newestFirst(chronological);

  const beforeUndo = core.recomputeTimeline(timeline);
  assert.equal(core.evaluateAutomaticOutcome({ ...beforeUndo, winScore: 21 }), OUTCOMES.TEAM_A_WIN);

  const afterUndo = core.undoLatestAction(timeline, { winScore: 21 });
  assert.equal(afterUndo.scoreA, 20);
  assert.equal(afterUndo.scoreB, 17);
  assert.equal(afterUndo.outcome, null);
  assert.equal(timeline.length, chronological.length, 'the original timeline is not mutated');
});

test('cancelled blank game is non-competitive', () => {
  const decision = core.decideManualEnd({ scoreA: 0, scoreB: 0, timeline: [] }, 'cancel');

  assert.equal(decision.status, 'complete');
  assert.equal(decision.outcome, OUTCOMES.CANCELLED);
  assert.equal(decision.shouldRecordCompetitiveResult, false);
});

test('biggest lead starts at zero when no scoring occurred', () => {
  const stats = core.recomputeTimeline([
    { type: 'timeout', team: 'a' },
    { type: 'foul', team: 'b' }
  ]);

  assert.deepEqual(stats.scores, { a: 0, b: 0 });
  assert.deepEqual(stats.maxLead, { a: 0, b: 0 });
  assert.deepEqual(stats.biggestLead, { team: null, points: 0 });
  assert.equal(stats.leadChanges, 0);
});

test('biggest lead and lead changes are rebuilt from a newest-first timeline', () => {
  const stats = core.recomputeTimeline(newestFirst([
    { type: 'score', team: 'a', pts: 2 }, // 2-0
    { type: 'score', team: 'b', pts: 3 }, // 2-3
    { type: 'score', team: 'a', pts: 3 }, // 5-3
    { type: 'score', team: 'b', pts: 2 }, // 5-5
    { type: 'score', team: 'b', pts: 3 }, // 5-8
    { type: 'score', team: 'a', pts: 2 }, // 7-8
    { type: 'score', team: 'a', pts: 2 }  // 9-8
  ]));

  assert.equal(stats.scoreA, 9);
  assert.equal(stats.scoreB, 8);
  assert.deepEqual(stats.maxLead, { a: 2, b: 3 });
  assert.deepEqual(stats.biggestLead, { team: 'b', points: 3 });
  assert.equal(stats.leadChanges, 4);
});

test('history exposes exactly one trophy for the actual winner', () => {
  const legacy = {
    id: 'legacy-b-win',
    nameA: 'Orange',
    nameB: 'Blue',
    scoreW: 17,
    scoreL: 21,
    winner: 'Blue',
    loser: 'Orange'
  };
  const normalized = core.normalizeMatch(legacy);
  const history = core.getHistoryResult(legacy);
  const contribution = core.getStatsContribution(legacy);

  assert.equal(normalized.outcome, OUTCOMES.TEAM_B_WIN);
  assert.equal(normalized.winner.name, 'Blue');
  assert.equal(history.showTrophy, true);
  assert.equal(history.trophyTeam, 'b');
  assert.equal(history.winnerName, 'Blue');
  assert.deepEqual(contribution.teamA, { played: 1, wins: 0, losses: 1, ties: 0 });
  assert.deepEqual(contribution.teamB, { played: 1, wins: 1, losses: 0, ties: 0 });
});

test('tie history has no trophy or winner and contributes no win/loss', () => {
  const tied = {
    teamA: { name: 'Orange', score: 15 },
    teamB: { name: 'Blue', score: 15 },
    outcome: 'tie'
  };
  const history = core.getHistoryResult(tied);
  const contribution = core.getStatsContribution(tied);

  assert.equal(history.label, 'Tie');
  assert.equal(history.showTrophy, false);
  assert.equal(history.winnerName, null);
  assert.deepEqual(contribution.teamA, { played: 1, wins: 0, losses: 0, ties: 1 });
  assert.deepEqual(contribution.teamB, { played: 1, wins: 0, losses: 0, ties: 1 });
  assert.equal(history.narrative, 'Orange and Blue finished tied at 15\u201315.');
});

test('cancelled-game history is labelled, trophy-free, and excluded from statistics', () => {
  const cancelled = {
    teamA: { name: 'Orange', score: 0 },
    teamB: { name: 'Blue', score: 0 },
    outcome: 'canceled',
    winner: { name: 'Orange & Blue' },
    maxLead: { a: 1, b: 0 }
  };
  const normalized = core.normalizeMatch(cancelled);
  const history = core.getHistoryResult(cancelled);
  const contribution = core.getStatsContribution(cancelled);

  assert.equal(normalized.outcome, OUTCOMES.CANCELLED);
  assert.equal(normalized.winner, null);
  assert.deepEqual(normalized.maxLead, { a: 0, b: 0 });
  assert.equal(history.label, 'Cancelled');
  assert.equal(history.showTrophy, false);
  assert.equal(history.isCompetitiveResult, false);
  assert.equal(history.narrative, 'Game cancelled before scoring began.');
  assert.deepEqual(contribution.teamA, { played: 0, wins: 0, losses: 0, ties: 0 });
  assert.deepEqual(contribution.teamB, { played: 0, wins: 0, losses: 0, ties: 0 });
});

test('legacy 0-0 shared-winner records normalize to no contest, never two winners', () => {
  const brokenLegacy = {
    teamA: { name: 'Team A', score: 0 },
    teamB: { name: 'Team B', score: 0 },
    winner: { name: 'Team A & Team B' },
    loser: { name: 'Team B' },
    maxLead: { a: 1, b: 0 }
  };
  const normalized = core.normalizeMatch(brokenLegacy);
  const history = core.getHistoryResult(brokenLegacy);

  assert.equal(normalized.outcome, OUTCOMES.NO_CONTEST);
  assert.equal(normalized.winner, null);
  assert.equal(history.showTrophy, false);
  assert.equal(history.label, 'No contest');
});

test('Supabase winner text preserves no-contest without a schema change', () => {
  const normalized = core.normalizeMatch({
    team_a_name: 'Orange',
    team_b_name: 'Blue',
    score_a: 21,
    score_b: 20,
    winner: 'No contest'
  });

  assert.equal(normalized.outcome, OUTCOMES.NO_CONTEST);
  assert.equal(normalized.winner, null);
  assert.equal(core.getHistoryResult(normalized).showTrophy, false);
});

test('result narratives cover both winner orientations and explicit outcomes', () => {
  assert.equal(core.resultNarrative({
    teamA: { name: 'Team A', score: 21 },
    teamB: { name: 'Team B', score: 17 },
    outcome: OUTCOMES.TEAM_A_WIN
  }), 'Team A defeated Team B 21\u201317.');

  assert.equal(core.resultNarrative({
    teamA: { name: 'Team A', score: 18 },
    teamB: { name: 'Team B', score: 21 },
    outcome: OUTCOMES.TEAM_B_WIN
  }), 'Team B defeated Team A 21\u201318.');

  assert.equal(core.resultNarrative({
    teamA: { name: 'Team A', score: 0 },
    teamB: { name: 'Team B', score: 0 },
    outcome: OUTCOMES.NO_CONTEST
  }), 'Game declared no contest.');
});

test('standard winner/loser legacy records remain readable', () => {
  const normalized = core.normalizeMatch({
    winner: 'Brawlers',
    loser: 'Titans',
    scoreW: 21,
    scoreL: 17,
    gameType: '5v5'
  });

  assert.equal(normalized.teamA.name, 'Brawlers');
  assert.equal(normalized.teamB.name, 'Titans');
  assert.equal(normalized.outcome, OUTCOMES.TEAM_A_WIN);
  assert.equal(normalized.winner.name, 'Brawlers');
  assert.equal(normalized.gameType, '5v5');
});

test('five-team knockout brackets distribute byes without BYE-vs-BYE fixtures', () => {
  const teams = ['A', 'B', 'C', 'D', 'E'];
  const fixtures = core.generateKnockoutFixtures(teams, { base: 'test' });
  const firstRound = fixtures.filter(fixture => fixture.round === 1);

  assert.equal(fixtures.length, 7);
  assert.equal(firstRound.length, 4);
  assert.equal(firstRound.some(fixture => fixture.teamA === 'BYE' && fixture.teamB === 'BYE'), false);
  assert.deepEqual(
    firstRound.flatMap(fixture => [fixture.teamA, fixture.teamB]).filter(team => team !== 'BYE').sort(),
    teams.slice().sort()
  );
  assert.equal(firstRound.filter(fixture => fixture.played).length, 3);
});

test('power-of-two knockout brackets contain no byes and wire every next match', () => {
  const fixtures = core.generateKnockoutFixtures(['A', 'B', 'C', 'D'], { base: 'four' });
  const firstRound = fixtures.filter(fixture => fixture.round === 1);
  const final = fixtures.find(fixture => fixture.round === 2);

  assert.equal(fixtures.length, 3);
  assert.equal(fixtures.some(fixture => fixture.teamA === 'BYE' || fixture.teamB === 'BYE'), false);
  assert.ok(firstRound.every(fixture => fixture.nextMatchId === final.id));
  assert.deepEqual(firstRound.map(fixture => fixture.nextSlot), ['home', 'away']);
});

test('foul increment and undo update team and player counts without going negative', () => {
  const original = {
    teamA: { name: 'Orange', fouls: 0, players: [{ id: 'p1', name: 'Alex', fouls: 0 }] },
    teamB: { name: 'Blue', fouls: 2, players: [] }
  };
  const incremented = core.applyFoulChange(original, { team: 'a', delta: 1, playerId: 'p1' });
  const undone = core.applyFoulChange(incremented, { team: 'a', delta: -1, playerId: 'p1' });
  const clamped = core.applyFoulChange(undone, { team: 'a', delta: -1, playerId: 'p1' });

  assert.equal(incremented.teamA.fouls, 1);
  assert.equal(incremented.teamA.players[0].fouls, 1);
  assert.equal(undone.teamA.fouls, 0);
  assert.equal(undone.teamA.players[0].fouls, 0);
  assert.equal(clamped.teamA.fouls, 0);
  assert.equal(clamped.teamA.players[0].fouls, 0);
  assert.equal(core.adjustFoulCount(10, 1, 10), 10);
  assert.equal(original.teamA.fouls, 0, 'the supplied game is not mutated');
});

test('rematch preserves rules and rosters while resetting all result state', () => {
  const completed = {
    id: 'match-1',
    gameType: '5v5',
    winScore: 15,
    winBy2: true,
    ptsSmall: 1,
    ptsLarge: 2,
    shotClockDuration: 24,
    gameClockMode: 'timed',
    periodsEnabled: true,
    timeoutsPerTeam: 2,
    teamA: {
      name: 'Orange', colorKey: 'orange', score: 15, fouls: 3,
      players: [{ id: 'a1', name: 'Alex', rating: 4, score: 9, fouls: 2 }]
    },
    teamB: {
      name: 'Blue', colorKey: 'blue', score: 11, fouls: 4,
      players: [{ id: 'b1', name: 'Blair', rating: 5, score: 11, fouls: 1 }]
    },
    outcome: OUTCOMES.TEAM_A_WIN,
    resultOutcome: OUTCOMES.TEAM_A_WIN,
    status: 'complete',
    score_a: 15,
    score_b: 11,
    winner: { name: 'Orange' },
    history: [{ type: 'score', team: 'a', pts: 2 }],
    timeline: [{ type: 'score', team: 'a', pts: 2 }],
    maxLead: { a: 4, b: 1 },
    leadChanges: 3,
    biggestRun: 5,
    gameOver: true,
    timeoutsUsedA: 1,
    timeoutsUsedB: 2,
    tournamentId: 'tournament-1',
    fixtureId: 'fixture-1'
  };
  const rematch = core.createRematch(completed, {
    id: 'rematch-1', startTime: 500, date: '2026-07-13T00:00:00.000Z'
  });

  assert.equal(rematch.id, 'rematch-1');
  assert.equal(rematch.gameType, '5v5');
  assert.equal(rematch.winScore, 15);
  assert.equal(rematch.winBy2, true);
  assert.equal(rematch.shotClockDuration, 24);
  assert.equal(rematch.timeoutsPerTeam, 2);
  assert.equal(rematch.teamA.name, 'Orange');
  assert.equal(rematch.teamA.colorKey, 'orange');
  assert.equal(rematch.teamA.players[0].rating, 4);
  assert.equal(rematch.teamA.score, 0);
  assert.equal(rematch.teamA.fouls, 0);
  assert.equal(rematch.teamA.players[0].score, 0);
  assert.equal(rematch.teamA.players[0].fouls, 0);
  assert.equal(rematch.outcome, null);
  assert.equal(rematch.resultOutcome, null);
  assert.equal(rematch.status, null);
  assert.equal(rematch.score_a, 0);
  assert.equal(rematch.score_b, 0);
  assert.equal(rematch.winner, null);
  assert.deepEqual(rematch.history, []);
  assert.deepEqual(rematch.timeline, []);
  assert.deepEqual(rematch.maxLead, { a: 0, b: 0 });
  assert.equal(rematch.gameOver, false);
  assert.equal(rematch.timeoutsUsedA, 0);
  assert.equal(rematch.timeoutsUsedB, 0);
  assert.equal(rematch.tournamentId, null);
  assert.equal(rematch.fixtureId, null);
  assert.equal(completed.teamA.score, 15, 'the completed game is not mutated');
  assert.equal(completed.history.length, 1);
});

test('swap rematch exchanges complete teams but keeps rules and resets player results', () => {
  const completed = {
    winScore: 21,
    scoringRule: '1s2s',
    teamA: {
      name: 'Orange', colorKey: 'orange', score: 21, fouls: 2,
      players: [{ id: 'a1', name: 'Alex', rating: 4, score: 10, fouls: 1 }]
    },
    teamB: {
      name: 'Blue', colorKey: 'blue', score: 18, fouls: 3,
      players: [{ id: 'b1', name: 'Blair', rating: 5, score: 12, fouls: 2 }]
    },
    outcome: OUTCOMES.TEAM_A_WIN,
    timeline: [{ type: 'score', team: 'a', pts: 1 }]
  };
  const swapped = core.createSwapRematch(completed);

  assert.equal(swapped.winScore, 21);
  assert.equal(swapped.scoringRule, '1s2s');
  assert.equal(swapped.teamA.name, 'Blue');
  assert.equal(swapped.teamA.colorKey, 'blue');
  assert.equal(swapped.teamA.players[0].id, 'b1');
  assert.equal(swapped.teamA.players[0].rating, 5);
  assert.equal(swapped.teamA.players[0].score, 0);
  assert.equal(swapped.teamB.name, 'Orange');
  assert.equal(swapped.teamB.players[0].id, 'a1');
  assert.equal(swapped.teamA.score, 0);
  assert.equal(swapped.teamB.score, 0);
  assert.deepEqual(swapped.timeline, []);
  assert.equal(swapped.id, null);
});

test('round-robin generator schedules every even-team pairing exactly once', () => {
  const teams = ['A', 'B', 'C', 'D'];
  const fixtures = core.generateRoundRobinFixtures(teams, { base: 'even' });
  const pairs = fixtures.map(fixture => [fixture.teamA, fixture.teamB].sort().join('-'));

  assert.equal(fixtures.length, 6);
  assert.equal(fixtures.some(fixture => fixture.isBye), false);
  assert.deepEqual([...new Set(fixtures.map(fixture => fixture.round))], [1, 2, 3]);
  assert.equal(new Set(pairs).size, 6);
  teams.forEach(team => {
    assert.equal(fixtures.filter(fixture => fixture.teamA === team || fixture.teamB === team).length, 3);
  });
});

test('odd round-robin schedules one explicit bye per team and no duplicate matchup', () => {
  const teams = ['A', 'B', 'C', 'D', 'E'];
  const fixtures = core.generateRoundRobinFixtures(teams, { base: 'odd' });
  const byes = fixtures.filter(fixture => fixture.isBye);
  const games = fixtures.filter(fixture => !fixture.isBye);
  const pairs = games.map(fixture => [fixture.teamA, fixture.teamB].sort().join('-'));

  assert.equal(fixtures.length, 15);
  assert.equal(games.length, 10);
  assert.equal(byes.length, 5);
  assert.equal(new Set(pairs).size, 10);
  assert.equal(fixtures.some(fixture => fixture.teamA === 'BYE' && fixture.teamB === 'BYE'), false);
  teams.forEach(team => {
    assert.equal(byes.filter(fixture => fixture.teamA === team).length, 1);
    assert.equal(games.filter(fixture => fixture.teamA === team || fixture.teamB === team).length, 4);
  });
  assert.equal(core.generateRoundRobinFixtures(teams, { base: 'odd-no-bye', includeByes: false }).length, 10);
});

test('fixture result rejects a tie by default and records it explicitly when allowed', () => {
  const fixtures = [{
    id: 'f1', teamA: 'Orange', teamB: 'Blue', scoreA: null, scoreB: null,
    winner: null, outcome: null, played: false
  }];
  const rejected = core.recordFixtureResult(fixtures, 'f1', 15, 15);
  const accepted = core.recordFixtureResult(fixtures, 'f1', 15, 15, { allowTies: true });
  const standings = core.calculateStandings(accepted.fixtures, ['Orange', 'Blue']);

  assert.equal(rejected.status, 'tie_rejected');
  assert.equal(rejected.outcome, OUTCOMES.TIE);
  assert.equal(rejected.fixture.played, false);
  assert.equal(fixtures[0].played, false, 'the supplied fixture list is not mutated');
  assert.equal(accepted.status, 'applied');
  assert.equal(accepted.fixture.outcome, OUTCOMES.TIE);
  assert.equal(accepted.fixture.winner, null);
  assert.equal(accepted.fixture.played, true);
  assert.deepEqual(standings.map(row => ({ name: row.name, tied: row.tied, pts: row.pts })), [
    { name: 'Blue', tied: 1, pts: 1 },
    { name: 'Orange', tied: 1, pts: 1 }
  ]);
});

test('recorded results progress standings and advance knockout winners immutably', () => {
  const roundRobin = [
    { id: 'ab', teamA: 'A', teamB: 'B', scoreA: null, scoreB: null, played: false },
    { id: 'bc', teamA: 'B', teamB: 'C', scoreA: null, scoreB: null, played: false }
  ];
  const first = core.recordFixtureResult(roundRobin, 'ab', 21, 18);
  const second = core.recordFixtureResult(first.fixtures, 'bc', 17, 21);
  const table = core.calculateStandings(second.fixtures, ['A', 'B', 'C']);

  assert.equal(first.status, 'applied');
  assert.equal(second.status, 'applied');
  assert.deepEqual(table.map(row => row.name), ['C', 'A', 'B']);
  assert.deepEqual(table.map(row => row.pts), [2, 2, 0]);
  assert.deepEqual(table.map(row => row.difference), [4, 3, -7]);
  assert.equal(roundRobin[0].played, false);

  const bracket = core.generateKnockoutFixtures(['A', 'B', 'C', 'D'], { base: 'advance' });
  const openingRound = bracket.filter(fixture => fixture.round === 1);
  const opener = openingRound[0];
  const progressed = core.recordFixtureResult(bracket, opener.id, 11, 8);
  assert.equal(progressed.status, 'applied');
  assert.equal(progressed.fixture.winner, opener.teamA);
  assert.ok(progressed.advancedTo);
  assert.equal(progressed.advancedTo.teamA, opener.teamA);
  assert.equal(bracket.find(fixture => fixture.id === progressed.advancedTo.id).teamA, 'TBD');

  const awayOpener = openingRound[1];
  const finalProgress = core.recordFixtureResult(progressed.fixtures, awayOpener.id, 7, 11);
  assert.equal(finalProgress.fixture.winner, awayOpener.teamB);
  assert.equal(finalProgress.advancedTo.teamB, awayOpener.teamB);
});

test('queue actions move up, move down, and remove without mutating the queue', () => {
  const queue = ['A', 'B', 'C', 'D'];
  const movedDown = core.applyQueueAction(queue, { type: 'move-down', index: 0 });
  const movedUp = core.applyQueueAction(queue, { type: 'move up', index: 2 });
  const removed = core.applyQueueAction(queue, { type: 'remove', index: 1 });
  const boundary = core.applyQueueAction(queue, { type: 'move_up', index: 0 });

  assert.deepEqual(movedDown.queue, ['B', 'A', 'C', 'D']);
  assert.deepEqual(movedUp.queue, ['A', 'C', 'B', 'D']);
  assert.deepEqual(removed.queue, ['A', 'C', 'D']);
  assert.equal(removed.removed, 'B');
  assert.equal(boundary.status, 'noop');
  assert.deepEqual(boundary.queue, queue);
  assert.deepEqual(queue, ['A', 'B', 'C', 'D']);
});

test('start-next creates a matchup and consumes only the selected queue entries', () => {
  const queue = ['Orange', 'Blue', 'Gold'];
  const started = core.applyQueueAction(queue, { type: 'start_next' });
  const retained = core.applyQueueAction(queue, { type: 'start_next', consume: false });
  const waiting = core.applyQueueAction(['Orange'], { type: 'start_next' });

  assert.equal(started.status, 'started');
  assert.deepEqual(started.matchup, {
    teams: ['Orange', 'Blue'], teamA: 'Orange', teamB: 'Blue'
  });
  assert.deepEqual(started.queue, ['Gold']);
  assert.deepEqual(retained.queue, queue);
  assert.equal(waiting.status, 'not_ready');
  assert.equal(waiting.required, 2);
  assert.equal(waiting.matchup, null);
  assert.deepEqual(queue, ['Orange', 'Blue', 'Gold']);
});

test('hash resolver maps direct private and public routes deterministically', () => {
  const privateRoute = core.resolveHashRoute('#/teams', { hasProfile: true });
  const publicRoute = core.resolveHashRoute('#/terms', { hasProfile: false });
  const landingRoute = core.resolveHashRoute('#/landing', { hasProfile: false });

  assert.deepEqual(privateRoute, {
    handled: true,
    action: 'navigate',
    screen: 'teams',
    route: 'teams',
    reason: 'direct_route',
    communityId: null
  });
  assert.equal(publicRoute.action, 'navigate');
  assert.equal(publicRoute.screen, 'terms');
  assert.equal(publicRoute.reason, 'direct_route');
  assert.equal(landingRoute.screen, 'landing');
  assert.equal(landingRoute.reason, 'direct_route');
});

test('hash resolver keeps hub private after landing is separated', () => {
  const visitor = core.resolveHashRoute('#/hub', {
    hasProfile: false,
    publicScreens: ['landing', 'profile', 'privacy', 'terms', 'communities', 'world']
  });
  const returning = core.resolveHashRoute('#/hub', { hasProfile: true });

  assert.equal(visitor.screen, 'profile');
  assert.equal(visitor.reason, 'auth_required');
  assert.equal(returning.screen, 'hub');
  assert.equal(returning.reason, 'direct_route');
});

test('hash resolver gates visitors but permits a local guest profile', () => {
  const visitor = core.resolveHashRoute('#/history', { hasProfile: false });
  const localGuest = core.resolveHashRoute('#/history', { isGuest: true });
  const explicitGate = core.resolveHashRoute('#/history', { hasProfile: false, isGuest: true });

  assert.equal(visitor.screen, 'profile');
  assert.equal(visitor.reason, 'auth_required');
  assert.equal(localGuest.screen, 'history');
  assert.equal(localGuest.reason, 'direct_route');
  assert.equal(explicitGate.screen, 'profile', 'an explicit missing-profile signal wins over the guest hint');
});

test('hash resolver returns a distinct decision for known community deep links', () => {
  const known = core.resolveHashRoute('#/community/court%201', {
    hasProfile: false,
    communityIds: ['court 1', 'court-2']
  });
  const unknown = core.resolveHashRoute('#/community/missing', {
    hasProfile: false,
    communityIds: [{ id: 'court-2' }]
  });
  const missing = core.resolveHashRoute('#/community/', { hasProfile: true });

  assert.deepEqual(known, {
    handled: true,
    action: 'open_community',
    screen: 'comm-detail',
    route: 'community',
    reason: 'community_deep_link',
    communityId: 'court 1'
  });
  assert.equal(unknown.action, 'navigate');
  assert.equal(unknown.screen, 'communities');
  assert.equal(unknown.reason, 'unknown_community');
  assert.equal(unknown.communityId, 'missing');
  assert.equal(missing.screen, 'communities');
  assert.equal(missing.reason, 'missing_community_id');
});

test('hash resolver resumes an active game after refresh', () => {
  const fromSavedState = core.resolveHashRoute('#/game', {
    hasProfile: true,
    savedGame: { gameOver: false, teamA: { score: 8 }, teamB: { score: 7 } }
  });
  const explicit = core.resolveHashRoute('#/game', { hasProfile: true, hasActiveGame: true });

  assert.equal(fromSavedState.action, 'resume_game');
  assert.equal(fromSavedState.screen, 'game');
  assert.equal(fromSavedState.reason, 'active_game');
  assert.deepEqual(explicit, fromSavedState);
});

test('hash resolver redirects an inactive game refresh to the authenticated hub', () => {
  const completed = core.resolveHashRoute('#/game', {
    hasProfile: true,
    savedGame: { gameOver: true }
  });
  const absent = core.resolveHashRoute('#/game', { hasProfile: true });

  assert.equal(completed.action, 'navigate');
  assert.equal(completed.screen, 'hub');
  assert.equal(completed.reason, 'inactive_game');
  assert.deepEqual(absent, completed);
});

test('empty hash returns an unhandled no-op decision', () => {
  ['', '#', '#/'].forEach(hash => {
    assert.deepEqual(core.resolveHashRoute(hash, { hasProfile: true }), {
      handled: false,
      action: 'none',
      screen: null,
      route: null,
      reason: 'empty_hash',
      communityId: null
    });
  });
});

test('invalid and malformed routes fall back safely', () => {
  const invalid = core.resolveHashRoute('#/not-a-screen', { hasProfile: true });
  const malformed = core.resolveHashRoute('#/%E0%A4%A', { hasProfile: true });
  const visitor = core.resolveHashRoute('#/not-a-screen', { hasProfile: false });

  assert.equal(invalid.screen, 'hub');
  assert.equal(invalid.reason, 'invalid_route');
  assert.equal(malformed.screen, 'hub');
  assert.equal(malformed.reason, 'invalid_route');
  assert.equal(visitor.screen, 'profile');
  assert.equal(visitor.reason, 'auth_required');
});

test('changelog hash resolves to a modal action only for a known identity', () => {
  const signedIn = core.resolveHashRoute('#/changelog', { hasProfile: true });
  const visitor = core.resolveHashRoute('#/changelog', { hasProfile: false });

  assert.equal(signedIn.action, 'open_changelog');
  assert.equal(signedIn.screen, null);
  assert.equal(signedIn.reason, 'changelog_deep_link');
  assert.equal(visitor.action, 'navigate');
  assert.equal(visitor.screen, 'profile');
  assert.equal(visitor.reason, 'auth_required');
});

test('reset PIN route requires an active recovery session', () => {
  const guestWithoutRecovery = core.resolveHashRoute('#/reset-pin', {
    hasProfile: true,
    hasRecoverySession: false
  });
  const visitorWithoutRecovery = core.resolveHashRoute('#/reset-pin', {
    hasProfile: false,
    hasRecoverySession: false
  });
  const activeRecovery = core.resolveHashRoute('#/reset-pin', {
    hasProfile: true,
    hasRecoverySession: true
  });

  assert.equal(guestWithoutRecovery.screen, 'hub');
  assert.equal(guestWithoutRecovery.reason, 'recovery_required');
  assert.equal(visitorWithoutRecovery.screen, 'profile');
  assert.equal(visitorWithoutRecovery.reason, 'auth_required');
  assert.equal(activeRecovery.screen, 'reset-pin');
  assert.equal(activeRecovery.reason, 'direct_route');
});
