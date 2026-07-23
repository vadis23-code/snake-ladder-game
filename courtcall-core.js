(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.CourtCallCore = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const OUTCOMES = Object.freeze({
    TEAM_A_WIN: 'team_a_win',
    TEAM_B_WIN: 'team_b_win',
    TIE: 'tie',
    CANCELLED: 'cancelled',
    NO_CONTEST: 'no_contest'
  });

  const NO_SCORE_PROMPT = 'No points have been scored. Cancel this game?';
  const NO_SCORE_OPTIONS = Object.freeze([
    Object.freeze({ action: 'continue', label: 'Continue Game' }),
    Object.freeze({ action: 'cancel', label: 'Cancel Game' })
  ]);
  const FINAL_OUTCOMES = new Set(Object.values(OUTCOMES));

  function firstDefined() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null) return value;
    }
    return undefined;
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asNonNegativeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : (fallback || 0);
  }

  function asPositiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function asBoolean(value) {
    if (typeof value === 'string') {
      return ['true', '1', 'on', 'yes'].includes(value.trim().toLowerCase());
    }
    return Boolean(value);
  }

  function readName(value) {
    const candidate = value && typeof value === 'object' ? value.name : value;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : '';
  }

  function firstName() {
    for (let index = 0; index < arguments.length; index += 1) {
      const name = readName(arguments[index]);
      if (name) return name;
    }
    return '';
  }

  function sameName(left, right) {
    return Boolean(left && right && left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase());
  }

  function normalizeTeamKey(value) {
    const key = String(value === undefined || value === null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
    if (['a', 'teama', 'home', '1'].includes(key)) return 'a';
    if (['b', 'teamb', 'away', '2'].includes(key)) return 'b';
    return null;
  }

  function readTimeline(source) {
    if (Array.isArray(source)) return source.slice();
    const match = asObject(source);
    const timeline = firstDefined(
      match.timeline,
      match.history,
      match.actions,
      match.scoreHistory,
      match.score_history
    );
    return Array.isArray(timeline) ? timeline.slice() : [];
  }

  function readScoringEvent(event) {
    if (!event || typeof event !== 'object') return null;
    const type = String(firstDefined(event.type, event.kind, '')).trim().toLowerCase();
    if (type && !['score', 'scoring', 'point', 'points', 'basket'].includes(type)) return null;

    const team = normalizeTeamKey(firstDefined(event.team, event.teamKey, event.team_key, event.side));
    const points = Number(firstDefined(event.pts, event.points, event.value, event.delta));
    if (!team || !Number.isFinite(points) || points <= 0) return null;
    return { team, points };
  }

  /**
   * Rebuild the score and lead statistics from CourtCall's newest-first event log.
   * Non-scoring actions (fouls, timeouts, possession changes) are ignored.
   */
  function recomputeTimeline(timeline) {
    const chronological = readTimeline(timeline).reverse();
    let scoreA = 0;
    let scoreB = 0;
    let previousLeader = null;
    let leadChanges = 0;
    let scoringActions = 0;
    const maxLead = { a: 0, b: 0 };
    let biggestLead = { team: null, points: 0 };

    chronological.forEach(function (event) {
      const score = readScoringEvent(event);
      if (!score) return;
      scoringActions += 1;
      if (score.team === 'a') scoreA += score.points;
      else scoreB += score.points;

      const difference = scoreA - scoreB;
      const leader = difference > 0 ? 'a' : difference < 0 ? 'b' : null;
      const lead = Math.abs(difference);
      if (leader) {
        maxLead[leader] = Math.max(maxLead[leader], lead);
        if (lead > biggestLead.points) biggestLead = { team: leader, points: lead };
        if (previousLeader && previousLeader !== leader) leadChanges += 1;
        previousLeader = leader;
      }
    });

    return {
      scoreA,
      scoreB,
      scores: { a: scoreA, b: scoreB },
      maxLead,
      biggestLead,
      leadChanges,
      scoringActions,
      hasScoringActions: scoringActions > 0
    };
  }

  function extractScores(source, preferTimeline) {
    const game = asObject(source);
    const teamA = asObject(game.teamA);
    const teamB = asObject(game.teamB);
    const timelineStats = recomputeTimeline(readTimeline(game));
    const rawA = firstDefined(game.scoreA, game.score_a, game.a, teamA.score);
    const rawB = firstDefined(game.scoreB, game.score_b, game.b, teamB.score);

    if (preferTimeline && timelineStats.hasScoringActions) {
      return { scoreA: timelineStats.scoreA, scoreB: timelineStats.scoreB, timelineStats };
    }
    return {
      scoreA: rawA === undefined ? timelineStats.scoreA : asNonNegativeNumber(rawA, 0),
      scoreB: rawB === undefined ? timelineStats.scoreB : asNonNegativeNumber(rawB, 0),
      timelineStats
    };
  }

  /** Return a winning outcome when the configured automatic win rule is met. */
  function evaluateAutomaticOutcome(game) {
    const source = asObject(game);
    const scores = extractScores(source, false);
    const winScore = asPositiveNumber(
      firstDefined(source.winScore, source.win_score, source.targetScore, source.target_score),
      21
    );
    const winByTwo = asBoolean(firstDefined(source.winByTwo, source.winBy2, source.win_by_two, false));
    const difference = scores.scoreA - scores.scoreB;

    if (difference === 0) return null;
    const leadingScore = difference > 0 ? scores.scoreA : scores.scoreB;
    if (leadingScore < winScore) return null;
    if (winByTwo && Math.abs(difference) < 2) return null;
    return difference > 0 ? OUTCOMES.TEAM_A_WIN : OUTCOMES.TEAM_B_WIN;
  }

  /**
   * Decide what the End action should do. A blank 0-0 game requires an explicit
   * cancel/continue choice; a scored tie is safely recorded as a tie.
   */
  function decideManualEnd(game, choice) {
    const source = asObject(game);
    const scores = extractScores(source, false);
    const normalizedChoice = String(choice || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    const wantsContinue = ['continue', 'continuegame'].includes(normalizedChoice);
    const wantsCancel = ['cancel', 'cancelgame'].includes(normalizedChoice);
    const noScoring = !scores.timelineStats.hasScoringActions;
    const isBlankGame = scores.scoreA === 0 && scores.scoreB === 0 && noScoring;

    if (isBlankGame) {
      if (wantsContinue) {
        return {
          status: 'continue',
          outcome: null,
          scoreA: 0,
          scoreB: 0,
          shouldRecordCompetitiveResult: false
        };
      }
      if (wantsCancel) {
        return {
          status: 'complete',
          outcome: OUTCOMES.CANCELLED,
          scoreA: 0,
          scoreB: 0,
          shouldRecordCompetitiveResult: false
        };
      }
      return {
        status: 'needs_confirmation',
        outcome: null,
        scoreA: 0,
        scoreB: 0,
        prompt: NO_SCORE_PROMPT,
        options: NO_SCORE_OPTIONS.map(function (option) { return Object.assign({}, option); }),
        shouldRecordCompetitiveResult: false
      };
    }

    const outcome = scores.scoreA === scores.scoreB
      ? OUTCOMES.TIE
      : scores.scoreA > scores.scoreB
        ? OUTCOMES.TEAM_A_WIN
        : OUTCOMES.TEAM_B_WIN;
    return {
      status: 'complete',
      outcome,
      scoreA: scores.scoreA,
      scoreB: scores.scoreB,
      shouldRecordCompetitiveResult: true
    };
  }

  /** Remove the newest action without mutating the supplied timeline. */
  function undoLatestAction(timeline, rules) {
    const source = readTimeline(timeline);
    const config = Array.isArray(timeline) ? asObject(rules) : asObject(timeline);
    const nextTimeline = source.slice(1);
    const totals = recomputeTimeline(nextTimeline);
    return Object.assign({}, totals, {
      timeline: nextTimeline,
      removedAction: source.length ? source[0] : null,
      outcome: evaluateAutomaticOutcome(Object.assign({}, config, {
        scoreA: totals.scoreA,
        scoreB: totals.scoreB
      }))
    });
  }

  function canonicalOutcome(value) {
    if (value && typeof value === 'object') value = firstDefined(value.outcome, value.status, value.type);
    if (value === undefined || value === null) return null;
    const key = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
    const aliases = {
      team_a_win: OUTCOMES.TEAM_A_WIN,
      teama_win: OUTCOMES.TEAM_A_WIN,
      a_win: OUTCOMES.TEAM_A_WIN,
      home_win: OUTCOMES.TEAM_A_WIN,
      team_b_win: OUTCOMES.TEAM_B_WIN,
      teamb_win: OUTCOMES.TEAM_B_WIN,
      b_win: OUTCOMES.TEAM_B_WIN,
      away_win: OUTCOMES.TEAM_B_WIN,
      tie: OUTCOMES.TIE,
      tied: OUTCOMES.TIE,
      draw: OUTCOMES.TIE,
      cancelled: OUTCOMES.CANCELLED,
      canceled: OUTCOMES.CANCELLED,
      no_contest: OUTCOMES.NO_CONTEST,
      nocontest: OUTCOMES.NO_CONTEST
    };
    return aliases[key] || null;
  }

  function hasOrientedTeamNames(match) {
    return Boolean(
      readName(match.teamA) ||
      readName(match.teamB) ||
      readName(match.nameA) ||
      readName(match.nameB) ||
      readName(match.team_a_name) ||
      readName(match.team_b_name)
    );
  }

  function inferOutcome(details) {
    const explicit = details.explicitOutcome;
    const scoreA = details.scoreA;
    const scoreB = details.scoreB;
    const legacyWinnerToken = (details.legacyWinnerName || '').trim().toLowerCase();

    if (explicit === OUTCOMES.CANCELLED || explicit === OUTCOMES.NO_CONTEST) return explicit;
    if (explicit === OUTCOMES.TIE) {
      return scoreA === scoreB ? OUTCOMES.TIE : OUTCOMES.NO_CONTEST;
    }
    if (explicit === OUTCOMES.TEAM_A_WIN || explicit === OUTCOMES.TEAM_B_WIN) {
      if (!details.hasScoreInformation) return explicit;
      if (scoreA === scoreB) return scoreA > 0 ? OUTCOMES.TIE : OUTCOMES.NO_CONTEST;
      return scoreA > scoreB ? OUTCOMES.TEAM_A_WIN : OUTCOMES.TEAM_B_WIN;
    }

    // Backward-compatible cloud encoding for result states when the existing
    // games table has only a text winner column and no outcome column.
    if (['tie', 'tied', 'draw'].includes(legacyWinnerToken)) return OUTCOMES.TIE;
    if (legacyWinnerToken.includes('cancel')) return OUTCOMES.CANCELLED;
    if (legacyWinnerToken === 'no contest' || legacyWinnerToken === 'no_contest') return OUTCOMES.NO_CONTEST;

    if (scoreA > scoreB) return OUTCOMES.TEAM_A_WIN;
    if (scoreB > scoreA) return OUTCOMES.TEAM_B_WIN;
    if (scoreA > 0) return OUTCOMES.TIE;

    if (!details.hasScoreInformation && details.legacyWinnerName) {
      const winnerToken = details.legacyWinnerName.toLowerCase();
      if (['tie', 'tied', 'draw'].includes(winnerToken)) return OUTCOMES.TIE;
      if (winnerToken.includes('cancel')) return OUTCOMES.CANCELLED;
      if (winnerToken.includes('no contest')) return OUTCOMES.NO_CONTEST;
      if (winnerToken.includes(' & ') || winnerToken.includes(' and ')) return OUTCOMES.NO_CONTEST;
      if (sameName(details.legacyWinnerName, details.teamAName)) return OUTCOMES.TEAM_A_WIN;
      if (sameName(details.legacyWinnerName, details.teamBName)) return OUTCOMES.TEAM_B_WIN;
    }
    return OUTCOMES.NO_CONTEST;
  }

  /**
   * Convert current, legacy localStorage, and Supabase-like match shapes to one
   * safe result model. Unknown fields are retained and the input is not mutated.
   */
  function normalizeMatch(input) {
    const match = asObject(input);
    const oldTeamA = asObject(match.teamA);
    const oldTeamB = asObject(match.teamB);
    const legacyWinnerName = readName(match.winner);
    const legacyLoserName = readName(match.loser);
    const orientedNames = hasOrientedTeamNames(match);
    const teamAName = firstName(
      match.teamA,
      match.nameA,
      match.team_a_name,
      match.homeTeam,
      match.home_team,
      orientedNames ? undefined : legacyWinnerName
    ) || 'Team A';
    const teamBName = firstName(
      match.teamB,
      match.nameB,
      match.team_b_name,
      match.awayTeam,
      match.away_team,
      orientedNames ? undefined : legacyLoserName
    ) || 'Team B';

    const rawScoreA = firstDefined(
      oldTeamA.score,
      match.scoreA,
      match.score_a,
      match.homeScore,
      match.home_score,
      match.scoreW
    );
    const rawScoreB = firstDefined(
      oldTeamB.score,
      match.scoreB,
      match.score_b,
      match.awayScore,
      match.away_score,
      match.scoreL
    );
    const timeline = readTimeline(match);
    const timelineStats = recomputeTimeline(timeline);
    const hasStoredScore = rawScoreA !== undefined || rawScoreB !== undefined;
    const hasScoreInformation = hasStoredScore || timelineStats.hasScoringActions;
    const scoreA = timelineStats.hasScoringActions
      ? timelineStats.scoreA
      : asNonNegativeNumber(rawScoreA, 0);
    const scoreB = timelineStats.hasScoringActions
      ? timelineStats.scoreB
      : asNonNegativeNumber(rawScoreB, 0);

    const explicitOutcome = canonicalOutcome(firstDefined(
      match.outcome,
      match.resultOutcome,
      match.result_outcome,
      asObject(match.result).outcome,
      match.status,
      match.state
    ));
    const outcome = inferOutcome({
      explicitOutcome,
      scoreA,
      scoreB,
      hasScoreInformation,
      legacyWinnerName,
      teamAName,
      teamBName
    });

    const storedMaxLead = asObject(firstDefined(match.maxLead, match.max_lead));
    const finalDifference = scoreA - scoreB;
    const maxLead = timelineStats.hasScoringActions
      ? timelineStats.maxLead
      : scoreA === 0 && scoreB === 0
        ? { a: 0, b: 0 }
        : {
          a: Math.max(asNonNegativeNumber(firstDefined(storedMaxLead.a, match.max_lead_a), 0), finalDifference > 0 ? finalDifference : 0),
          b: Math.max(asNonNegativeNumber(firstDefined(storedMaxLead.b, match.max_lead_b), 0), finalDifference < 0 ? -finalDifference : 0)
        };
    const biggestLeadPoints = Math.max(maxLead.a, maxLead.b);
    const biggestLead = {
      team: biggestLeadPoints === 0
        ? null
        : maxLead.a === maxLead.b
          ? null
          : maxLead.a > maxLead.b ? 'a' : 'b',
      points: biggestLeadPoints
    };
    const teamA = Object.assign({}, oldTeamA, { name: teamAName, score: scoreA });
    const teamB = Object.assign({}, oldTeamB, { name: teamBName, score: scoreB });
    const winnerTeam = outcome === OUTCOMES.TEAM_A_WIN
      ? 'a'
      : outcome === OUTCOMES.TEAM_B_WIN ? 'b' : null;
    const winner = winnerTeam === 'a'
      ? Object.assign({}, teamA)
      : winnerTeam === 'b' ? Object.assign({}, teamB) : null;
    const loser = winnerTeam === 'a'
      ? Object.assign({}, teamB)
      : winnerTeam === 'b' ? Object.assign({}, teamA) : null;

    return Object.assign({}, match, {
      outcome,
      teamA,
      teamB,
      winner,
      loser,
      winnerTeam,
      history: timeline,
      timeline,
      maxLead,
      biggestLead,
      leadChanges: timelineStats.hasScoringActions
        ? timelineStats.leadChanges
        : asNonNegativeNumber(firstDefined(match.leadChanges, match.lead_changes), 0),
      isCompetitiveResult: [OUTCOMES.TEAM_A_WIN, OUTCOMES.TEAM_B_WIN, OUTCOMES.TIE].includes(outcome),
      countsAsWinLoss: outcome === OUTCOMES.TEAM_A_WIN || outcome === OUTCOMES.TEAM_B_WIN
    });
  }

  function resultNarrative(match) {
    const result = normalizeMatch(match);
    const teamAName = result.teamA.name;
    const teamBName = result.teamB.name;
    const scoreA = result.teamA.score;
    const scoreB = result.teamB.score;
    const separator = '\u2013';

    switch (result.outcome) {
      case OUTCOMES.TEAM_A_WIN:
        return `${teamAName} defeated ${teamBName} ${scoreA}${separator}${scoreB}.`;
      case OUTCOMES.TEAM_B_WIN:
        return `${teamBName} defeated ${teamAName} ${scoreB}${separator}${scoreA}.`;
      case OUTCOMES.TIE:
        return `${teamAName} and ${teamBName} finished tied at ${scoreA}${separator}${scoreB}.`;
      case OUTCOMES.CANCELLED:
        return scoreA === 0 && scoreB === 0
          ? 'Game cancelled before scoring began.'
          : `Game cancelled at ${scoreA}${separator}${scoreB}.`;
      default:
        return scoreA === 0 && scoreB === 0
          ? 'Game declared no contest.'
          : `Game declared no contest at ${scoreA}${separator}${scoreB}.`;
    }
  }

  /** Presentation data that guarantees a trophy is shown only for one real winner. */
  function getHistoryResult(match) {
    const result = normalizeMatch(match);
    const showTrophy = result.winnerTeam !== null;
    const labels = {
      [OUTCOMES.TIE]: 'Tie',
      [OUTCOMES.CANCELLED]: 'Cancelled',
      [OUTCOMES.NO_CONTEST]: 'No contest'
    };
    return {
      outcome: result.outcome,
      winnerTeam: result.winnerTeam,
      winnerName: showTrophy ? result.winner.name : null,
      trophyTeam: showTrophy ? result.winnerTeam : null,
      showTrophy,
      label: showTrophy ? `${result.winner.name} won` : labels[result.outcome],
      narrative: resultNarrative(result),
      isCompetitiveResult: result.isCompetitiveResult,
      countsAsWinLoss: result.countsAsWinLoss
    };
  }

  /** Win/loss/tie contribution for aggregate history statistics. */
  function getStatsContribution(match) {
    const result = normalizeMatch(match);
    const teamA = { played: 0, wins: 0, losses: 0, ties: 0 };
    const teamB = { played: 0, wins: 0, losses: 0, ties: 0 };
    if (result.outcome === OUTCOMES.TEAM_A_WIN) {
      Object.assign(teamA, { played: 1, wins: 1 });
      Object.assign(teamB, { played: 1, losses: 1 });
    } else if (result.outcome === OUTCOMES.TEAM_B_WIN) {
      Object.assign(teamA, { played: 1, losses: 1 });
      Object.assign(teamB, { played: 1, wins: 1 });
    } else if (result.outcome === OUTCOMES.TIE) {
      Object.assign(teamA, { played: 1, ties: 1 });
      Object.assign(teamB, { played: 1, ties: 1 });
    }
    return { teamA, teamB };
  }

  function isFinalOutcome(value) {
    return FINAL_OUTCOMES.has(canonicalOutcome(value));
  }

  /** Return an integer foul count clamped to zero and an optional upper bound. */
  function adjustFoulCount(currentCount, delta, maximum) {
    const current = Number.isFinite(Number(currentCount))
      ? Math.max(0, Math.trunc(Number(currentCount)))
      : 0;
    const change = Number.isFinite(Number(delta)) ? Math.trunc(Number(delta)) : 0;
    let next = Math.max(0, current + change);
    if (Number.isFinite(Number(maximum)) && Number(maximum) >= 0) {
      next = Math.min(next, Math.trunc(Number(maximum)));
    }
    return next;
  }

  /**
   * Apply a team foul and, when supplied, the matching player's foul without
   * mutating the game state. The same helper handles undo with a negative delta.
   */
  function applyFoulChange(game, options) {
    const source = asObject(game);
    const config = asObject(options);
    const teamKey = normalizeTeamKey(config.team);
    if (!teamKey) return Object.assign({}, source);

    const teamProperty = teamKey === 'a' ? 'teamA' : 'teamB';
    const oldTeam = asObject(source[teamProperty]);
    const playerId = firstDefined(config.playerId, config.player_id);
    const delta = firstDefined(config.delta, 1);
    const maximum = firstDefined(config.maximum, config.max);
    const players = Array.isArray(oldTeam.players)
      ? oldTeam.players.map(function (player) {
        if (playerId === undefined || playerId === null || String(player.id) !== String(playerId)) {
          return player;
        }
        return Object.assign({}, player, {
          fouls: adjustFoulCount(player.fouls, delta, maximum)
        });
      })
      : [];
    const nextTeam = Object.assign({}, oldTeam, {
      fouls: adjustFoulCount(oldTeam.fouls, delta, maximum),
      players
    });
    return Object.assign({}, source, { [teamProperty]: nextTeam });
  }

  function resetRematchTeam(team) {
    const source = asObject(team);
    return Object.assign({}, source, {
      score: 0,
      fouls: 0,
      players: Array.isArray(source.players)
        ? source.players.map(function (player) {
          return Object.assign({}, player, { score: 0, fouls: 0 });
        })
        : []
    });
  }

  /** Build a fresh game from a completed game while retaining its rule settings. */
  function createRematch(game, options) {
    const source = asObject(game);
    const config = asObject(options);
    const originalA = resetRematchTeam(source.teamA);
    const originalB = resetRematchTeam(source.teamB);
    const teamA = config.swapTeams ? originalB : originalA;
    const teamB = config.swapTeams ? originalA : originalB;
    return Object.assign({}, source, {
      id: config.id === undefined ? null : config.id,
      teamA,
      teamB,
      scoreA: 0,
      scoreB: 0,
      score_a: 0,
      score_b: 0,
      homeScore: 0,
      awayScore: 0,
      home_score: 0,
      away_score: 0,
      foulsA: 0,
      foulsB: 0,
      fouls_a: 0,
      fouls_b: 0,
      playersA: teamA.players.map(function (player) { return Object.assign({}, player); }),
      playersB: teamB.players.map(function (player) { return Object.assign({}, player); }),
      outcome: null,
      resultOutcome: null,
      result_outcome: null,
      result: null,
      status: null,
      state: null,
      winner: null,
      loser: null,
      winnerTeam: null,
      history: [],
      timeline: [],
      maxLead: { a: 0, b: 0 },
      max_lead: { a: 0, b: 0 },
      max_lead_a: 0,
      max_lead_b: 0,
      biggestLead: { team: null, points: 0 },
      biggestRun: 0,
      biggest_run: 0,
      leadChanges: 0,
      lead_changes: 0,
      quarter: 1,
      possession: 'a',
      timeoutsUsedA: 0,
      timeoutsUsedB: 0,
      gameOver: false,
      played: false,
      completed: false,
      isCompetitiveResult: false,
      countsAsWinLoss: false,
      duration: null,
      startTime: config.startTime === undefined ? null : config.startTime,
      date: config.date === undefined ? null : config.date,
      tournamentId: config.tournamentId === undefined ? null : config.tournamentId,
      fixtureId: config.fixtureId === undefined ? null : config.fixtureId,
      voiceActive: false
    });
  }

  function createSwapRematch(game, options) {
    return createRematch(game, Object.assign({}, asObject(options), { swapTeams: true }));
  }

  /** Generate round-based round-robin fixtures with one explicit bye per odd-team round. */
  function generateRoundRobinFixtures(teamNames, options) {
    const teams = Array.isArray(teamNames)
      ? teamNames.map(readName).filter(Boolean)
      : [];
    if (teams.length < 2) return [];
    const config = asObject(options);
    const base = firstDefined(config.base, Date.now());
    const byeLabel = readName(config.byeLabel) || 'BYE';
    const includeByes = config.includeByes !== false;
    const rotation = teams.slice();
    if (rotation.length % 2 === 1) rotation.push(null);

    const fixtureCountPerRound = rotation.length / 2;
    const fixtures = [];
    let fixtureIndex = 0;
    for (let roundIndex = 0; roundIndex < rotation.length - 1; roundIndex += 1) {
      for (let pairIndex = 0; pairIndex < fixtureCountPerRound; pairIndex += 1) {
        let teamA = rotation[pairIndex];
        let teamB = rotation[rotation.length - 1 - pairIndex];
        if (teamA === null || teamB === null) {
          if (!includeByes) continue;
          const activeTeam = teamA === null ? teamB : teamA;
          fixtures.push({
            id: `rr_${base}_${fixtureIndex++}`,
            teamA: activeTeam,
            teamB: byeLabel,
            round: roundIndex + 1,
            scoreA: null,
            scoreB: null,
            winner: activeTeam,
            outcome: null,
            played: true,
            isBye: true
          });
          continue;
        }

        // Alternating orientation avoids fixing one team permanently at home.
        if ((roundIndex + pairIndex) % 2 === 1) {
          const swap = teamA;
          teamA = teamB;
          teamB = swap;
        }
        fixtures.push({
          id: `rr_${base}_${fixtureIndex++}`,
          teamA,
          teamB,
          round: roundIndex + 1,
          scoreA: null,
          scoreB: null,
          winner: null,
          outcome: null,
          played: false,
          isBye: false
        });
      }
      const last = rotation.pop();
      rotation.splice(1, 0, last);
    }
    return fixtures;
  }

  function parseFixtureScore(value) {
    if (value === '' || value === undefined || value === null) return null;
    const score = Number(value);
    return Number.isInteger(score) && score >= 0 ? score : null;
  }

  /**
   * Immutably record a fixture result. Ties are rejected by default for
   * tournament safety, or stored explicitly when allowTies is true.
   */
  function recordFixtureResult(fixtures, fixtureId, rawScoreA, rawScoreB, options) {
    const source = Array.isArray(fixtures)
      ? fixtures.map(function (fixture) { return Object.assign({}, fixture); })
      : [];
    const config = asObject(options);
    const index = source.findIndex(function (fixture) { return String(fixture.id) === String(fixtureId); });
    if (index < 0) return { status: 'not_found', fixtures: source, fixture: null, outcome: null };
    const fixture = source[index];
    if (fixture.isBye || fixture.teamA === 'BYE' || fixture.teamB === 'BYE') {
      return { status: 'bye', fixtures: source, fixture, outcome: null };
    }

    const scoreA = parseFixtureScore(rawScoreA);
    const scoreB = parseFixtureScore(rawScoreB);
    if (scoreA === null || scoreB === null) {
      return { status: 'invalid_score', fixtures: source, fixture, outcome: null };
    }
    if (scoreA === scoreB && config.allowTies !== true) {
      return {
        status: 'tie_rejected',
        fixtures: source,
        fixture,
        outcome: OUTCOMES.TIE,
        reason: 'A winner is required for this fixture.'
      };
    }

    const outcome = scoreA === scoreB
      ? OUTCOMES.TIE
      : scoreA > scoreB ? OUTCOMES.TEAM_A_WIN : OUTCOMES.TEAM_B_WIN;
    const winner = outcome === OUTCOMES.TEAM_A_WIN
      ? fixture.teamA
      : outcome === OUTCOMES.TEAM_B_WIN ? fixture.teamB : null;
    source[index] = Object.assign({}, fixture, {
      scoreA,
      scoreB,
      winner,
      outcome,
      played: true
    });

    let advancedTo = null;
    if (winner && fixture.nextMatchId) {
      const nextIndex = source.findIndex(function (candidate) {
        return String(candidate.id) === String(fixture.nextMatchId);
      });
      if (nextIndex >= 0 && !source[nextIndex].played) {
        const slot = String(fixture.nextSlot || '').toLowerCase();
        const teamProperty = ['home', 'a', 'teama'].includes(slot) ? 'teamA' : 'teamB';
        source[nextIndex] = Object.assign({}, source[nextIndex], { [teamProperty]: winner });
        advancedTo = source[nextIndex];
      }
    }
    return { status: 'applied', fixtures: source, fixture: source[index], outcome, advancedTo };
  }

  /** Calculate deterministic round-robin standings from explicitly played fixtures. */
  function calculateStandings(fixtures, teamNames, options) {
    const source = Array.isArray(fixtures) ? fixtures : [];
    const config = asObject(options);
    const winPoints = asNonNegativeNumber(firstDefined(config.winPoints, 2), 2);
    const tiePoints = asNonNegativeNumber(firstDefined(config.tiePoints, 1), 1);
    const lossPoints = asNonNegativeNumber(firstDefined(config.lossPoints, 0), 0);
    const suppliedNames = Array.isArray(teamNames) ? teamNames.map(readName).filter(Boolean) : [];
    const inferredNames = source.flatMap(function (fixture) {
      return [readName(fixture.teamA), readName(fixture.teamB)].filter(function (name) { return name && name !== 'BYE'; });
    });
    const uniqueNames = [];
    const seen = new Set();
    (suppliedNames.length ? suppliedNames : inferredNames).forEach(function (name) {
      const key = name.toLocaleLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueNames.push(name);
      }
    });
    const table = new Map(uniqueNames.map(function (name) {
      return [name.toLocaleLowerCase(), {
        name,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        pf: 0,
        pa: 0,
        difference: 0,
        pts: 0
      }];
    }));

    source.forEach(function (fixture) {
      if (!fixture || !fixture.played || fixture.isBye || fixture.teamA === 'BYE' || fixture.teamB === 'BYE') return;
      const teamAName = readName(fixture.teamA);
      const teamBName = readName(fixture.teamB);
      const teamA = table.get(teamAName.toLocaleLowerCase());
      const teamB = table.get(teamBName.toLocaleLowerCase());
      const scoreA = parseFixtureScore(fixture.scoreA);
      const scoreB = parseFixtureScore(fixture.scoreB);
      if (!teamA || !teamB || scoreA === null || scoreB === null) return;

      teamA.played += 1;
      teamB.played += 1;
      teamA.pf += scoreA;
      teamA.pa += scoreB;
      teamB.pf += scoreB;
      teamB.pa += scoreA;
      if (scoreA === scoreB) {
        teamA.tied += 1;
        teamB.tied += 1;
        teamA.pts += tiePoints;
        teamB.pts += tiePoints;
      } else if (scoreA > scoreB) {
        teamA.won += 1;
        teamB.lost += 1;
        teamA.pts += winPoints;
        teamB.pts += lossPoints;
      } else {
        teamB.won += 1;
        teamA.lost += 1;
        teamB.pts += winPoints;
        teamA.pts += lossPoints;
      }
    });

    return Array.from(table.values())
      .map(function (row) {
        return Object.assign({}, row, { difference: row.pf - row.pa });
      })
      .sort(function (left, right) {
        return right.pts - left.pts
          || right.difference - left.difference
          || right.pf - left.pf
          || left.name.localeCompare(right.name);
      });
  }

  /** Apply one queue command without mutating the supplied queue. */
  function applyQueueAction(queue, action) {
    const source = Array.isArray(queue) ? queue.slice() : [];
    const config = typeof action === 'string' ? { type: action } : asObject(action);
    const type = String(config.type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const index = Number(config.index);

    if (type === 'move_up' || type === 'move_down') {
      const direction = type === 'move_up' ? -1 : 1;
      const target = index + direction;
      if (!Number.isInteger(index) || index < 0 || index >= source.length || target < 0 || target >= source.length) {
        return { status: 'noop', action: type, queue: source, from: index, to: index };
      }
      const item = source[index];
      source[index] = source[target];
      source[target] = item;
      return { status: 'applied', action: type, queue: source, item, from: index, to: target };
    }

    if (type === 'remove') {
      if (!Number.isInteger(index) || index < 0 || index >= source.length) {
        return { status: 'noop', action: type, queue: source, removed: null };
      }
      const removed = source.splice(index, 1)[0];
      return { status: 'applied', action: type, queue: source, removed, index };
    }

    if (type === 'start_next') {
      const teamCount = Number.isInteger(Number(config.teamCount)) && Number(config.teamCount) > 1
        ? Number(config.teamCount)
        : 2;
      if (source.length < teamCount) {
        return {
          status: 'not_ready',
          action: type,
          queue: source,
          required: teamCount,
          matchup: null
        };
      }
      const teams = source.slice(0, teamCount);
      const remaining = config.consume === false ? source : source.slice(teamCount);
      return {
        status: 'started',
        action: type,
        queue: remaining,
        matchup: { teams, teamA: teams[0], teamB: teams[1] }
      };
    }

    return { status: 'invalid_action', action: type, queue: source };
  }

  const DEFAULT_ROUTE_SCREENS = Object.freeze([
    'analytics',
    'comm-create',
    'communities',
    'game',
    'help-center',
    'history',
    'hub',
    'onboarding',
    'privacy',
    'profile',
    'pulse',
    'reset-pin',
    'settings',
    'setup',
    'teams',
    'terms',
    'tournament',
    'world'
  ]);
  const DEFAULT_PUBLIC_ROUTE_SCREENS = Object.freeze([
    'profile',
    'onboarding',
    'privacy',
    'terms',
    'communities',
    'world'
  ]);

  function routeNameSet(value, fallback) {
    const names = value instanceof Set
      ? Array.from(value)
      : Array.isArray(value) ? value : fallback;
    return new Set(names.map(function (name) { return String(name).trim().toLowerCase(); }).filter(Boolean));
  }

  function safeDecodeRoutePart(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  function communityIdSet(value) {
    if (!(value instanceof Set) && !Array.isArray(value)) return null;
    const ids = value instanceof Set ? Array.from(value) : value;
    return new Set(ids.map(function (item) {
      return String(item && typeof item === 'object' ? item.id : item);
    }));
  }

  function routeDecision(action, screen, route, reason, extra) {
    return Object.assign({
      handled: action !== 'none',
      action,
      screen: screen || null,
      route: route || null,
      reason,
      communityId: null
    }, extra || {});
  }

  /**
   * Resolve a CourtCall hash without browser or storage dependencies. A local
   * guest profile counts as an identity; callers can pass hasProfile:false to
   * gate private screens to the profile route.
   */
  function resolveHashRoute(hash, options) {
    const config = asObject(options);
    const rawHash = String(hash === undefined || hash === null ? '' : hash).trim();
    const rawRoute = rawHash.replace(/^#\/?/, '').replace(/^\/+|\/+$/g, '');
    if (!rawRoute) return routeDecision('none', null, null, 'empty_hash');

    const encodedParts = rawRoute.split('/');
    const routePart = safeDecodeRoutePart(encodedParts[0]);
    if (routePart === null) {
      const fallback = asBoolean(firstDefined(config.hasProfile, config.hasIdentity, config.isGuest, config.authenticated, false))
        ? 'hub'
        : 'profile';
      return routeDecision('navigate', fallback, null, 'invalid_route');
    }
    const route = routePart.trim().toLowerCase();
    const validScreens = routeNameSet(config.validScreens, DEFAULT_ROUTE_SCREENS);
    const publicScreens = routeNameSet(config.publicScreens, DEFAULT_PUBLIC_ROUTE_SCREENS);
    const hasProfile = asBoolean(firstDefined(
      config.hasProfile,
      config.hasIdentity,
      config.isGuest === true ? true : undefined,
      config.authenticated,
      false
    ));
    const fallbackScreen = hasProfile ? 'hub' : 'profile';

    // A community link is public, but opening a known community is distinct
    // from rendering the community index so the UI can hydrate it first.
    if (route === 'community') {
      const decodedId = encodedParts.length > 1 ? safeDecodeRoutePart(encodedParts[1]) : '';
      const communityId = decodedId === null ? '' : decodedId.trim();
      if (!communityId) {
        return routeDecision('navigate', 'communities', route, decodedId === null
          ? 'invalid_community_id'
          : 'missing_community_id');
      }
      const knownIds = communityIdSet(config.communityIds);
      if (knownIds && !knownIds.has(communityId)) {
        return routeDecision('navigate', 'communities', route, 'unknown_community', { communityId });
      }
      return routeDecision('open_community', 'comm-detail', route, 'community_deep_link', { communityId });
    }

    if (!hasProfile && !publicScreens.has(route)) {
      return routeDecision('navigate', 'profile', route, 'auth_required');
    }

    if (route === 'changelog') {
      return routeDecision('open_changelog', null, route, 'changelog_deep_link');
    }

    if (!validScreens.has(route)) {
      return routeDecision('navigate', fallbackScreen, route, 'invalid_route');
    }

    if (route === 'game') {
      const hasActiveGame = config.hasActiveGame !== undefined
        ? asBoolean(config.hasActiveGame)
        : Boolean(config.savedGame && !asBoolean(asObject(config.savedGame).gameOver));
      return hasActiveGame
        ? routeDecision('resume_game', 'game', route, 'active_game')
        : routeDecision('navigate', fallbackScreen, route, 'inactive_game');
    }

    return routeDecision('navigate', route, route, 'direct_route');
  }

  /** Build a single-elimination bracket without ever pairing BYE vs BYE. */
  function generateKnockoutFixtures(teamNames, options) {
    const teams = Array.isArray(teamNames)
      ? teamNames.map(readName).filter(Boolean)
      : [];
    if (teams.length < 2) return [];
    const config = asObject(options);
    const base = firstDefined(config.base, Date.now());
    let size = 1;
    while (size < teams.length) size *= 2;
    const remaining = teams.slice();
    const byeCount = size - remaining.length;
    const seeded = [];
    for (let index = 0; index < byeCount; index += 1) seeded.push(remaining.shift(), 'BYE');
    seeded.push.apply(seeded, remaining);

    let fixtureIndex = 0;
    const fixtures = [];
    let previousRound = [];
    for (let index = 0; index < seeded.length; index += 2) {
      const fixture = {
        id: `fx_${base}_${fixtureIndex++}`,
        teamA: seeded[index],
        teamB: seeded[index + 1],
        round: 1,
        scoreA: null,
        scoreB: null,
        winner: null,
        played: false,
        nextMatchId: null,
        nextSlot: null
      };
      if (fixture.teamB === 'BYE') {
        fixture.winner = fixture.teamA;
        fixture.played = true;
      }
      previousRound.push(fixture);
      fixtures.push(fixture);
    }

    let round = 1;
    while (previousRound.length > 1) {
      round += 1;
      const nextRound = [];
      for (let index = 0; index < previousRound.length; index += 2) {
        const fixture = {
          id: `fx_${base}_${fixtureIndex++}`,
          teamA: previousRound[index].winner || 'TBD',
          teamB: previousRound[index + 1].winner || 'TBD',
          round,
          scoreA: null,
          scoreB: null,
          winner: null,
          played: false,
          nextMatchId: null,
          nextSlot: null
        };
        previousRound[index].nextMatchId = fixture.id;
        previousRound[index].nextSlot = 'home';
        previousRound[index + 1].nextMatchId = fixture.id;
        previousRound[index + 1].nextSlot = 'away';
        nextRound.push(fixture);
        fixtures.push(fixture);
      }
      previousRound = nextRound;
    }
    return fixtures;
  }

  return Object.freeze({
    OUTCOMES,
    NO_SCORE_PROMPT,
    NO_SCORE_OPTIONS,
    evaluateAutomaticOutcome,
    decideManualEnd,
    recomputeTimeline,
    undoLatestAction,
    normalizeMatch,
    resultNarrative,
    getHistoryResult,
    getStatsContribution,
    isFinalOutcome,
    adjustFoulCount,
    applyFoulChange,
    createRematch,
    createSwapRematch,
    generateRoundRobinFixtures,
    recordFixtureResult,
    calculateStandings,
    applyQueueAction,
    resolveHashRoute,
    generateKnockoutFixtures
  });
}));
