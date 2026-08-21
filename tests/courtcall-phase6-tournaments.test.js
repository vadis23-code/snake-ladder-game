const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const core = require(path.join(root, 'courtcall-core.js'));
const html = read('index.html');
const css = read('courtcall-tournaments.css');
const sw = read('basketball-sw.js');

test('legacy tournament records normalize at read time without losing compatible fields', () => {
  const normalized = core.normalizeTournament({
    id: 'legacy-cup',
    title: 'Legacy Cup',
    type: 'round-robin',
    win_score: 15,
    teams: ['Alpha', { team_name: 'Beta', colour: 'blue' }],
    fixtures: [{
      fixture_id: 'old-final', home: 'Alpha', away: 'Beta',
      home_score: 15, away_score: 12, status: 'final', match_id: 'match-old'
    }],
    ownerId: 'owner-1',
    created_at: '2026-01-01T00:00:00.000Z'
  });

  assert.equal(normalized.name, 'Legacy Cup');
  assert.equal(normalized.format, 'roundrobin');
  assert.equal(normalized.winScore, 15);
  assert.deepEqual(normalized.teams.map(team => team.name), ['Alpha', 'Beta']);
  assert.equal(normalized.teams[1].colour, 'blue');
  assert.equal(normalized.fixtures[0].id, 'old-final');
  assert.equal(normalized.fixtures[0].played, true);
  assert.equal(normalized.fixtures[0].resultMatchId, 'match-old');
  assert.equal(normalized.ownerId, 'owner-1');
});

test('minimum size, duplicate teams and same or similar tournament names validate explicitly', () => {
  assert.equal(core.validateTournamentTeams(['Solo']).valid, false);
  assert.equal(core.validateTournamentTeams(['Alpha', 'Beta']).valid, true);
  const duplicate = core.validateTournamentTeams(['Falcons', 'falcons', 'Falcons 2']);
  const valid = core.validateTournamentTeams(['Falcons', 'Falcons 2']);
  assert.equal(duplicate.valid, false);
  assert.deepEqual(duplicate.duplicateNames, ['falcons']);
  assert.equal(valid.valid, true);
  assert.equal(core.validateTournamentName('Summer Cup', [{ name: 'summer cup' }]).valid, false);
  assert.equal(core.validateTournamentName('Summer Cup 2', [{ name: 'Summer Cup' }]).valid, true);
  assert.match(html, /CourtCallCore\.validateTournamentName\(name,getCol\(K\.tournaments\)\)/);
});

test('round-robin results persist full standings and determine a unique champion once', () => {
  let tournament = core.deriveTournamentState({
    id: 'rr', name: 'Round Robin', format: 'roundrobin', winScore: 21,
    teams: ['A', 'B', 'C'],
    fixtures: [
      { id: 'ab', teamA: 'A', teamB: 'B', played: false },
      { id: 'ac', teamA: 'A', teamB: 'C', played: false },
      { id: 'bc', teamA: 'B', teamB: 'C', played: false }
    ]
  });
  const results = [
    ['ab', 'm1', 21, 10],
    ['ac', 'm2', 21, 11],
    ['bc', 'm3', 21, 12]
  ];
  for (const [fixtureId, matchId, scoreA, scoreB] of results) {
    const applied = core.applyTournamentResult(tournament, { fixtureId, matchId, scoreA, scoreB });
    assert.equal(applied.status, 'applied');
    tournament = applied.tournament;
  }

  assert.equal(tournament.completed, true);
  assert.equal(tournament.winner, 'A');
  assert.equal(tournament.tieBreakPending, false);
  assert.deepEqual(tournament.standings.map(row => row.name), ['A', 'B', 'C']);
  assert.deepEqual(
    Object.keys(tournament.standings[0]).sort(),
    ['difference', 'lost', 'name', 'pa', 'pf', 'played', 'pts', 'tied', 'won'].sort()
  );

  const duplicate = core.applyTournamentResult(tournament, { fixtureId: 'ab', matchId: 'm1', scoreA: 21, scoreB: 10 });
  assert.equal(duplicate.status, 'duplicate');
  assert.deepEqual(duplicate.tournament.standings, tournament.standings);
});

test('specification tie-breaks stop at points, differential and points scored', () => {
  const tied = core.deriveTournamentState({
    id: 'rr-tied', format: 'roundrobin', teams: ['A', 'B', 'C'],
    fixtures: [
      { id: 'ab', teamA: 'A', teamB: 'B', scoreA: 10, scoreB: 9, winner: 'A', played: true },
      { id: 'bc', teamA: 'B', teamB: 'C', scoreA: 10, scoreB: 9, winner: 'B', played: true },
      { id: 'ca', teamA: 'C', teamB: 'A', scoreA: 10, scoreB: 9, winner: 'C', played: true }
    ]
  });
  assert.equal(tied.completed, true);
  assert.equal(tied.status, 'tiebreak_required');
  assert.equal(tied.tieBreakPending, true);
  assert.equal(tied.winner, null);
});

test('deterministic knockout byes advance every team exactly once and produce one champion', () => {
  const teams = ['A', 'B', 'C', 'D', 'E'];
  let tournament = core.deriveTournamentState({
    id: 'ko-five', name: 'Five Team Cup', format: 'knockout', teams,
    fixtures: core.generateKnockoutFixtures(teams, { base: 'phase6' })
  });
  const firstRound = tournament.fixtures.filter(fixture => fixture.round === 1);
  assert.deepEqual(
    firstRound.flatMap(fixture => [fixture.teamA, fixture.teamB]).filter(team => team !== 'BYE'),
    teams
  );
  assert.equal(firstRound.filter(fixture => fixture.isBye).length, 3);

  let match = 0;
  while (!tournament.completed) {
    const fixture = tournament.nextFixture;
    assert.ok(fixture, 'every incomplete bracket should expose a ready fixture');
    const applied = core.applyTournamentResult(tournament, {
      fixtureId: fixture.id,
      matchId: `ko-match-${match++}`,
      teamAName: fixture.teamA,
      teamBName: fixture.teamB,
      scoreA: 11,
      scoreB: 7
    });
    assert.equal(applied.status, 'applied');
    tournament = applied.tournament;
  }

  assert.equal(tournament.winner, 'A');
  assert.equal(tournament.fixtures.filter(fixture => fixture.round === 3 && fixture.played).length, 1);
  assert.equal(new Set(tournament.fixtures.filter(fixture => fixture.resultMatchId).map(fixture => fixture.resultMatchId)).size, 4);
});

test('undo clears an unconsumed advancement but never rewrites a played downstream match', () => {
  const fixtures = core.generateKnockoutFixtures(['A', 'B', 'C', 'D'], { base: 'undo' });
  let tournament = core.deriveTournamentState({ id: 'ko-undo', format: 'knockout', teams: ['A', 'B', 'C', 'D'], fixtures });
  const first = tournament.nextFixture;
  tournament = core.applyTournamentResult(tournament, { fixtureId: first.id, matchId: 'u1', scoreA: 11, scoreB: 5 }).tournament;
  const finalId = tournament.fixtures.find(fixture => fixture.round === 2).id;
  assert.equal(tournament.fixtures.find(fixture => fixture.id === finalId).teamA, first.teamA);

  const undone = core.undoTournamentResult(tournament, first.id, { matchId: 'u1' });
  assert.equal(undone.status, 'applied');
  assert.equal(undone.tournament.fixtures.find(fixture => fixture.id === finalId).teamA, 'TBD');

  let replayed = core.applyTournamentResult(undone.tournament, { fixtureId: first.id, matchId: 'u2', scoreA: 11, scoreB: 5 }).tournament;
  const other = replayed.fixtures.find(fixture => fixture.round === 1 && fixture.id !== first.id);
  replayed = core.applyTournamentResult(replayed, { fixtureId: other.id, matchId: 'u3', scoreA: 11, scoreB: 6 }).tournament;
  replayed = core.applyTournamentResult(replayed, { fixtureId: finalId, matchId: 'u4', scoreA: 11, scoreB: 9 }).tournament;
  assert.equal(core.undoTournamentResult(replayed, first.id, { matchId: 'u2' }).status, 'downstream_played');
});

test('round labels cover final, semifinal, quarterfinal and larger brackets', () => {
  assert.equal(core.tournamentRoundLabel(1, 1), 'Final');
  assert.equal(core.tournamentRoundLabel(1, 2), 'Semifinal');
  assert.equal(core.tournamentRoundLabel(1, 3), 'Quarterfinal');
  assert.equal(core.tournamentRoundLabel(1, 4), 'Round of 16');
});

test('tournament detail deep links preserve hash routing and reject unknown IDs', () => {
  const known = core.resolveHashRoute('#/tournament/cup%201', {
    hasProfile: true, tournamentIds: ['cup 1']
  });
  const legacyDetail = core.resolveHashRoute('#/tourn-detail/cup%201', {
    hasProfile: true, tournamentIds: ['cup 1']
  });
  const unknown = core.resolveHashRoute('#/tournament/missing', {
    hasProfile: true, tournamentIds: ['cup 1']
  });
  assert.equal(known.action, 'open_tournament');
  assert.equal(known.screen, 'tourn-detail');
  assert.equal(known.tournamentId, 'cup 1');
  assert.equal(legacyDetail.action, 'open_tournament');
  assert.equal(unknown.action, 'navigate');
  assert.equal(unknown.screen, 'tournament');
});

test('production markup separates the tournament hub, detail, history and real-game return path', () => {
  assert.equal((html.match(/id="s-tournament"/g) || []).length, 1);
  assert.equal((html.match(/id="s-tourn-detail"/g) || []).length, 1);
  assert.match(html, /id="tourn-current-list"/);
  assert.match(html, /id="tourn-history-list"/);
  assert.match(html, /class="tourn-new-inline"[^>]+onclick="showTournForm\(\)"/);
  assert.match(html, /function openTournament\(tournamentId\)[\s\S]*?showScreen\('tourn-detail'\)/);
  assert.match(html, /name==='tourn-detail'\)renderTournamentDetail\(\)/);
  assert.match(html, /gameContext\.type==='tournament'\?gameContext\.tournamentId:null/);
  assert.match(html, /showScreen\(tournamentId\?'tourn-detail':'hub'\)/);
  assert.match(html, /duplicateTournamentResult=\['duplicate','duplicate_match'\]/);
  assert.doesNotMatch(html, /const shuffled=\[\.\.\.teams\]\.sort/);
});

test('responsive bracket and standings movement is contained locally and available offline', () => {
  assert.match(html, /class="tournament-bracket-scroll"[\s\S]*?tabindex="0"/);
  assert.match(html, /class="standings-scroll"[\s\S]*?tabindex="0"/);
  assert.match(css, /\.tournament-bracket-scroll[\s\S]*?overflow-x:\s*auto/);
  assert.match(css, /\.tournament-bracket[\s\S]*?width:\s*max-content/);
  assert.match(css, /@media \(max-width: 43\.75rem\)/);
  assert.match(css, /@media \(max-height: 31rem\) and \(orientation: landscape\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(sw, /CACHE_VERSION = 'v48'/);
  assert.match(html, /function cancelActiveGame\(\)[\s\S]*?showScreen\(wasTournament&&tournamentId\?'tourn-detail':'hub'\);[\s\S]*?clearSave\(\);/);
  assert.match(html, /const resumeCard=document\.getElementById\('resume-card'\);\s*if\(resumeCard\)resumeCard\.classList\.toggle/);
  assert.match(sw, /'\.\/courtcall-tournaments\.css'/);
  assert.ok(html.indexOf('courtcall-tournaments.css') > html.indexOf('courtcall-global-visual-system.css'));
});

test('storage and Supabase tournament contracts retain their established names', () => {
  assert.match(html, /tournaments:'cc_tournaments'/);
  for (const column of ['id', 'user_id', 'name', 'format', 'win_score', 'teams', 'fixtures', 'standings', 'completed', 'winner', 'settings', 'created_at', 'updated_at']) {
    assert.match(html, new RegExp(`\\b${column}:`), `missing ${column} mapping`);
  }
  assert.match(html, /standings:\s+Array\.isArray\(tournament\.standings\)/);
  assert.match(html, /standings: t\.standings \?\? lc\.standings \?\? \[\]/);
});

test('Phase 6 CSS has balanced blocks', () => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((clean.match(/\{/g) || []).length, (clean.match(/\}/g) || []).length);
});
