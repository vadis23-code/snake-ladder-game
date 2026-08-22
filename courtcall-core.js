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

  function boundedInteger(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < minimum || number > maximum) return fallback;
    return number;
  }

  /** Validate the values that create a live CourtCall game. */
  function validateGameSetup(input) {
    const source = asObject(input);
    const errors = [];
    const winScore = Number(source.winScore);
    const ptsSmall = Number(source.ptsSmall);
    const ptsLarge = Number(source.ptsLarge);
    const shotClockDuration = Number(firstDefined(source.shotClockDuration, 0));
    const timeoutsPerTeam = Number(firstDefined(source.timeoutsPerTeam, 0));

    if (!Number.isInteger(winScore) || winScore < 2 || winScore > 999) {
      errors.push('Win score must be a whole number from 2 to 999.');
    }
    if (!Number.isInteger(ptsSmall) || ptsSmall < 1 || ptsSmall > 9 ||
        !Number.isInteger(ptsLarge) || ptsLarge < 1 || ptsLarge > 9) {
      errors.push('Basket values must be whole numbers from 1 to 9.');
    } else if (ptsSmall === ptsLarge) {
      errors.push('Small and large basket values must be different.');
    }
    if (shotClockDuration !== 0 &&
        (!Number.isInteger(shotClockDuration) || shotClockDuration < 5 || shotClockDuration > 60)) {
      errors.push('Shot clock must be off or a whole number from 5 to 60 seconds.');
    }
    if (!Number.isInteger(timeoutsPerTeam) || timeoutsPerTeam < 0 || timeoutsPerTeam > 3) {
      errors.push('Timeouts per team must be between 0 and 3.');
    }

    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors.slice()) });
  }

  function normalizeGamePlayer(player) {
    const source = asObject(player);
    return {
      id: firstDefined(source.id, null),
      name: readName(source) || 'Player',
      score: asNonNegativeNumber(source.score, 0),
      fouls: asNonNegativeNumber(source.fouls, 0)
    };
  }

  /** Create the compatible local game-state shape from bounded setup values. */
  function createGameState(input) {
    const source = asObject(input);
    const teamA = asObject(source.teamA);
    const teamB = asObject(source.teamB);
    const ptsSmall = boundedInteger(source.ptsSmall, 1, 9, 1);
    let ptsLarge = boundedInteger(source.ptsLarge, 1, 9, 2);
    if (ptsLarge === ptsSmall) ptsLarge = ptsSmall === 9 ? 8 : ptsSmall + 1;
    const shotClockDuration = Number(source.shotClockDuration) === 0
      ? 0
      : boundedInteger(source.shotClockDuration, 5, 60, 0);
    const quarter = firstDefined(source.quarter, 1);

    return {
      gameType: String(firstDefined(source.gameType, '3v3')),
      winScore: boundedInteger(source.winScore, 2, 999, 21),
      ptsSmall,
      ptsLarge,
      allowFreeThrow: source.allowFreeThrow === undefined ? true : asBoolean(source.allowFreeThrow),
      shotClockDuration,
      shotClockAutoReset: source.shotClockAutoReset === undefined ? true : asBoolean(source.shotClockAutoReset),
      gameClockMode: source.gameClockMode === 'up' ? 'up' : 'off',
      periodsEnabled: asBoolean(source.periodsEnabled),
      winBy2: asBoolean(source.winBy2),
      withPlayers: asBoolean(source.withPlayers),
      timeoutsPerTeam: boundedInteger(source.timeoutsPerTeam, 0, 3, 0),
      timeoutsUsedA: asNonNegativeNumber(source.timeoutsUsedA, 0),
      timeoutsUsedB: asNonNegativeNumber(source.timeoutsUsedB, 0),
      teamA: {
        name: readName(teamA) || 'Team A',
        score: asNonNegativeNumber(teamA.score, 0),
        fouls: asNonNegativeNumber(teamA.fouls, 0),
        colorKey: String(firstDefined(teamA.colorKey, 'orange')),
        players: Array.isArray(teamA.players) ? teamA.players.map(normalizeGamePlayer) : []
      },
      teamB: {
        name: readName(teamB) || 'Team B',
        score: asNonNegativeNumber(teamB.score, 0),
        fouls: asNonNegativeNumber(teamB.fouls, 0),
        colorKey: String(firstDefined(teamB.colorKey, 'blue')),
        players: Array.isArray(teamB.players) ? teamB.players.map(normalizeGamePlayer) : []
      },
      quarter,
      possession: normalizeTeamKey(source.possession) || 'a',
      history: Array.isArray(source.history) ? source.history.slice() : [],
      maxLead: {
        a: asNonNegativeNumber(asObject(source.maxLead).a, 0),
        b: asNonNegativeNumber(asObject(source.maxLead).b, 0)
      },
      voiceActive: false,
      gameOver: asBoolean(source.gameOver),
      startTime: Number.isFinite(Number(source.startTime)) ? Number(source.startTime) : null
    };
  }

  function allowedScoreValues(game) {
    const source = asObject(game);
    const values = [
      boundedInteger(source.ptsSmall, 1, 9, 1),
      boundedInteger(source.ptsLarge, 1, 9, 2)
    ];
    if (asBoolean(source.allowFreeThrow)) values.push(1);
    return Array.from(new Set(values)).sort(function (left, right) { return left - right; });
  }

  function nextGamePeriod(current, enabled) {
    if (!asBoolean(enabled)) return current;
    if (Number.isInteger(current) && current >= 1 && current < 4) return current + 1;
    if (current === 4) return 'OT';
    const label = String(current || '').trim().toUpperCase();
    if (label === 'OT') return 'OT2';
    const overtime = label.match(/^OT(\d+)$/);
    return overtime ? `OT${Number(overtime[1]) + 1}` : 1;
  }

  function describeGameAction(action, teams) {
    const event = asObject(action);
    const names = asObject(teams);
    const team = normalizeTeamKey(event.team);
    const teamName = team === 'a' ? (readName(names.a) || 'Team A') :
      team === 'b' ? (readName(names.b) || 'Team B') : '';
    if (event.type === 'foul') return `Foul · ${event.playerName || teamName}`;
    if (event.type === 'timeout') return `Timeout · ${teamName}`;
    const points = boundedInteger(firstDefined(event.pts, event.points), 1, 99, 0);
    return points && teamName ? `+${points} · ${event.playerName || teamName}` : 'Last action';
  }

  function scoreHapticPattern(points) {
    const value = boundedInteger(points, 1, 9, 1);
    if (value >= 3) return Object.freeze([22, 24, 22, 24, 42]);
    if (value === 2) return Object.freeze([28, 28, 34]);
    return Object.freeze([36]);
  }

  /** Reconcile a persisted count-up clock with time spent in the background. */
  function resumeClockSnapshot(snapshot, now) {
    const source = asObject(snapshot);
    const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const savedAt = Number(source.savedAt);
    let elapsed = Math.floor(asNonNegativeNumber(source.elapsed, 0));
    const running = asBoolean(source.running);
    if (running && Number.isFinite(savedAt) && currentTime > savedAt) {
      elapsed += Math.floor((currentTime - savedAt) / 1000);
    }
    return Object.freeze({ elapsed, running });
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
    if (fixture.played) {
      return { status: 'already_played', fixtures: source, fixture, outcome: fixture.outcome || null };
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

  function normalizeTournamentFormat(value) {
    const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    return compact === 'knockout' || compact === 'singleelimination' || compact === 'singleelim'
      ? 'knockout'
      : 'roundrobin';
  }

  function validateTournamentTeams(teamNames, options) {
    const config = asObject(options);
    const minTeams = boundedInteger(firstDefined(config.minTeams, 2), 2, 64, 2);
    const maxTeams = boundedInteger(firstDefined(config.maxTeams, 16), minTeams, 64, 16);
    const names = Array.isArray(teamNames) ? teamNames.map(readName).filter(Boolean) : [];
    const seen = new Set();
    const duplicateNames = [];
    names.forEach(function (name) {
      const key = name.toLocaleLowerCase();
      if (seen.has(key) && !duplicateNames.some(function (duplicate) { return duplicate.toLocaleLowerCase() === key; })) {
        duplicateNames.push(name);
      }
      seen.add(key);
    });
    const errors = [];
    if (names.length < minTeams) errors.push(`Add at least ${minTeams} named teams.`);
    if (names.length > maxTeams) errors.push(`A tournament can have up to ${maxTeams} teams.`);
    if (duplicateNames.length) errors.push('Team names must be unique.');
    return { valid: errors.length === 0, names, duplicateNames, errors, minTeams, maxTeams };
  }

  function validateTournamentName(value, tournaments) {
    const name = readName(value);
    const key = name.toLocaleLowerCase();
    const duplicate = Boolean(name) && (Array.isArray(tournaments) ? tournaments : []).some(function (tournament) {
      const source = asObject(tournament);
      return readName(firstDefined(source.name, source.title)).toLocaleLowerCase() === key;
    });
    const errors = [];
    if (!name) errors.push('Enter a tournament name.');
    if (duplicate) errors.push('A tournament with this name already exists.');
    return { valid: errors.length === 0, name, duplicate, errors };
  }

  function normalizeTournamentTeam(team, index) {
    const source = asObject(team);
    const name = readName(typeof team === 'string'
      ? team
      : firstDefined(source.name, source.teamName, source.team_name, source.label));
    if (!name) return null;
    return Object.assign({}, source, { name });
  }

  function normalizeTournamentFixture(fixture, index, tournamentId) {
    const source = asObject(fixture);
    const teamA = readName(firstDefined(source.teamA, source.team_a, source.homeTeam, source.home_team, source.home)) || 'TBD';
    const teamB = readName(firstDefined(source.teamB, source.team_b, source.awayTeam, source.away_team, source.away)) || 'TBD';
    const scoreA = parseFixtureScore(firstDefined(source.scoreA, source.score_a, source.homeScore, source.home_score));
    const scoreB = parseFixtureScore(firstDefined(source.scoreB, source.score_b, source.awayScore, source.away_score));
    const status = String(source.status || '').trim().toLowerCase();
    const isBye = source.isBye === true || teamA === 'BYE' || teamB === 'BYE';
    const played = isBye
      ? source.played !== false
      : source.played === true || source.completed === true || ['played', 'complete', 'completed', 'final'].includes(status)
        || (scoreA !== null && scoreB !== null);
    let outcome = source.outcome || null;
    if (!outcome && played && scoreA !== null && scoreB !== null) {
      outcome = scoreA === scoreB
        ? OUTCOMES.TIE
        : scoreA > scoreB ? OUTCOMES.TEAM_A_WIN : OUTCOMES.TEAM_B_WIN;
    }
    let winner = readName(source.winner && typeof source.winner === 'object' ? source.winner.name : source.winner) || null;
    if (!winner && isBye) winner = teamA === 'BYE' ? teamB : teamA;
    if (!winner && outcome === OUTCOMES.TEAM_A_WIN) winner = teamA;
    if (!winner && outcome === OUTCOMES.TEAM_B_WIN) winner = teamB;
    const rawRound = Number(firstDefined(source.round, source.roundNumber, source.round_number, 1));
    const round = Number.isInteger(rawRound) && rawRound > 0 ? rawRound : 1;
    const rawSlot = String(firstDefined(source.nextSlot, source.next_slot, '') || '').trim().toLowerCase();
    const nextSlot = ['home', 'a', 'teama'].includes(rawSlot)
      ? 'home'
      : ['away', 'b', 'teamb'].includes(rawSlot) ? 'away' : null;
    return Object.assign({}, source, {
      id: String(firstDefined(source.id, source.fixtureId, source.fixture_id, `legacy_fx_${tournamentId || 'tournament'}_${index}`)),
      teamA,
      teamB,
      scoreA,
      scoreB,
      winner,
      outcome,
      played,
      isBye,
      round,
      nextMatchId: firstDefined(source.nextMatchId, source.next_match_id, null),
      nextSlot,
      resultMatchId: firstDefined(source.resultMatchId, source.result_match_id, source.matchId, source.match_id, null)
    });
  }

  /** Read current and legacy tournament JSON without rewriting local storage. */
  function normalizeTournament(tournament, options) {
    const source = asObject(tournament);
    const config = asObject(options);
    const id = String(firstDefined(source.id, source.tournamentId, source.tournament_id, `legacy_tournament_${firstDefined(config.index, 0)}`));
    const fixtures = (Array.isArray(source.fixtures) ? source.fixtures : [])
      .map(function (fixture, index) { return normalizeTournamentFixture(fixture, index, id); });
    let teams = (Array.isArray(source.teams) ? source.teams : [])
      .map(normalizeTournamentTeam)
      .filter(Boolean);
    if (!teams.length) {
      const seen = new Set();
      teams = fixtures.flatMap(function (fixture) { return [fixture.teamA, fixture.teamB]; })
        .filter(function (name) {
          const key = readName(name).toLocaleLowerCase();
          if (!key || key === 'bye' || key === 'tbd' || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(function (name, index) { return normalizeTournamentTeam(name, index); });
    }
    const rawWinScore = Number(firstDefined(source.winScore, source.win_score, asObject(source.settings).winScore, 21));
    const winScore = Number.isInteger(rawWinScore) && rawWinScore >= 2 && rawWinScore <= 999 ? rawWinScore : 21;
    const sourceWinner = source.winner && typeof source.winner === 'object' ? source.winner.name : source.winner;
    const standings = Array.isArray(source.standings) ? source.standings.map(function (row) { return Object.assign({}, row); }) : [];
    return Object.assign({}, source, {
      id,
      name: readName(firstDefined(source.name, source.title)) || 'Untitled Tournament',
      format: normalizeTournamentFormat(firstDefined(source.format, source.type)),
      winScore,
      teams,
      fixtures,
      standings,
      completed: source.completed === true || String(source.status || '').toLowerCase() === 'completed',
      winner: readName(sourceWinner) || null,
      createdAt: firstDefined(source.createdAt, source.created_at, null),
      updatedAt: firstDefined(source.updatedAt, source.updated_at, null)
    });
  }

  function resolveStandingsChampion(standings) {
    const rows = Array.isArray(standings) ? standings : [];
    if (!rows.length) return { winner: null, tied: false };
    if (rows.length === 1) return { winner: rows[0].name, tied: false };
    const first = rows[0];
    const second = rows[1];
    const tied = first.pts === second.pts
      && first.difference === second.difference
      && first.pf === second.pf;
    return { winner: tied ? null : first.name, tied };
  }

  /** Derive status, standings, next match and champion without mutating the input. */
  function deriveTournamentState(tournament) {
    const normalized = normalizeTournament(tournament);
    const playable = normalized.fixtures.filter(function (fixture) { return !fixture.isBye; });
    const completedFixtures = playable.filter(function (fixture) { return fixture.played; });
    const ready = playable
      .filter(function (fixture) {
        return !fixture.played && fixture.teamA !== 'TBD' && fixture.teamB !== 'TBD';
      })
      .sort(function (left, right) { return left.round - right.round || String(left.id).localeCompare(String(right.id)); });
    let standings = normalized.standings;
    let completed = normalized.completed;
    let winner = normalized.winner;
    let tieBreakPending = false;

    if (normalized.format === 'roundrobin') {
      standings = calculateStandings(normalized.fixtures, normalized.teams.map(function (team) { return team.name; }), {
        winPoints: 2,
        tiePoints: 1,
        lossPoints: 0
      });
      completed = playable.length > 0 && completedFixtures.length === playable.length;
      if (completed) {
        const champion = resolveStandingsChampion(standings);
        winner = champion.winner;
        tieBreakPending = champion.tied;
      } else {
        winner = null;
      }
    } else {
      const highestRound = normalized.fixtures.reduce(function (max, fixture) { return Math.max(max, fixture.round || 1); }, 1);
      const finals = normalized.fixtures.filter(function (fixture) { return fixture.round === highestRound; });
      const final = finals.length === 1 ? finals[0] : null;
      completed = Boolean(final && final.played && final.winner);
      winner = completed ? final.winner : null;
    }

    const status = completed
      ? tieBreakPending ? 'tiebreak_required' : 'completed'
      : completedFixtures.length ? 'in_progress' : 'scheduled';
    return Object.assign({}, normalized, {
      standings,
      completed,
      winner,
      tieBreakPending,
      status,
      completedFixtures: completedFixtures.length,
      pendingFixtures: Math.max(0, playable.length - completedFixtures.length),
      totalFixtures: playable.length,
      nextFixture: ready[0] || null
    });
  }

  /** Apply one real-game result once, then derive standings or bracket state. */
  function applyTournamentResult(tournament, result, options) {
    const normalized = normalizeTournament(tournament);
    const source = asObject(result);
    const config = asObject(options);
    const fixtureId = firstDefined(source.fixtureId, source.fixture_id, source.id);
    const fixture = normalized.fixtures.find(function (candidate) { return String(candidate.id) === String(fixtureId); });
    if (!fixture) return { status: 'not_found', tournament: deriveTournamentState(normalized), fixture: null };
    const matchId = firstDefined(source.matchId, source.match_id, null);
    if (matchId && normalized.fixtures.some(function (candidate) {
      return String(candidate.id) !== String(fixture.id) && String(candidate.resultMatchId || '') === String(matchId);
    })) {
      return { status: 'duplicate_match', tournament: deriveTournamentState(normalized), fixture };
    }
    if (fixture.played) return { status: 'duplicate', tournament: deriveTournamentState(normalized), fixture };
    if (fixture.teamA === 'TBD' || fixture.teamB === 'TBD' || fixture.isBye) {
      return { status: 'not_ready', tournament: deriveTournamentState(normalized), fixture };
    }
    const teamAName = readName(firstDefined(source.teamAName, asObject(source.teamA).name));
    const teamBName = readName(firstDefined(source.teamBName, asObject(source.teamB).name));
    if ((teamAName && teamAName !== fixture.teamA) || (teamBName && teamBName !== fixture.teamB)) {
      return { status: 'team_mismatch', tournament: deriveTournamentState(normalized), fixture };
    }
    const recorded = recordFixtureResult(
      normalized.fixtures,
      fixture.id,
      firstDefined(source.scoreA, asObject(source.teamA).score),
      firstDefined(source.scoreB, asObject(source.teamB).score),
      { allowTies: normalized.format === 'roundrobin' && config.allowTies === true }
    );
    if (recorded.status !== 'applied') {
      return Object.assign({}, recorded, { tournament: deriveTournamentState(normalized) });
    }
    if (matchId) {
      const appliedFixture = recorded.fixtures.find(function (candidate) { return String(candidate.id) === String(fixture.id); });
      if (appliedFixture) appliedFixture.resultMatchId = matchId;
    }
    const updated = deriveTournamentState(Object.assign({}, normalized, {
      fixtures: recorded.fixtures,
      updatedAt: firstDefined(source.recordedAt, source.date, new Date().toISOString())
    }));
    return {
      status: 'applied',
      tournament: updated,
      fixture: updated.fixtures.find(function (candidate) { return String(candidate.id) === String(fixture.id); }),
      advancedTo: recorded.advancedTo
        ? updated.fixtures.find(function (candidate) { return String(candidate.id) === String(recorded.advancedTo.id); })
        : null
    };
  }

  function undoTournamentResult(tournament, fixtureId, options) {
    const normalized = normalizeTournament(tournament);
    const config = asObject(options);
    const index = normalized.fixtures.findIndex(function (fixture) { return String(fixture.id) === String(fixtureId); });
    if (index < 0) return { status: 'not_found', tournament: deriveTournamentState(normalized), fixture: null };
    const fixture = normalized.fixtures[index];
    if (!fixture.played || fixture.isBye) return { status: 'noop', tournament: deriveTournamentState(normalized), fixture };
    if (config.matchId && fixture.resultMatchId && String(config.matchId) !== String(fixture.resultMatchId)) {
      return { status: 'match_mismatch', tournament: deriveTournamentState(normalized), fixture };
    }
    const fixtures = normalized.fixtures.map(function (candidate) { return Object.assign({}, candidate); });
    if (fixture.nextMatchId) {
      const next = fixtures.find(function (candidate) { return String(candidate.id) === String(fixture.nextMatchId); });
      if (next && next.played) return { status: 'downstream_played', tournament: deriveTournamentState(normalized), fixture };
      if (next) {
        if (fixture.nextSlot === 'home' && next.teamA === fixture.winner) next.teamA = 'TBD';
        if (fixture.nextSlot === 'away' && next.teamB === fixture.winner) next.teamB = 'TBD';
      }
    }
    fixtures[index] = Object.assign({}, fixtures[index], {
      scoreA: null,
      scoreB: null,
      winner: null,
      outcome: null,
      played: false,
      resultMatchId: null
    });
    const updated = deriveTournamentState(Object.assign({}, normalized, {
      fixtures,
      completed: false,
      winner: null,
      updatedAt: new Date().toISOString()
    }));
    return { status: 'applied', tournament: updated, fixture: updated.fixtures[index] };
  }

  function tournamentRoundLabel(round, totalRounds) {
    const current = Math.max(1, Number.parseInt(round, 10) || 1);
    const total = Math.max(current, Number.parseInt(totalRounds, 10) || current);
    const remaining = total - current;
    if (remaining === 0) return 'Final';
    if (remaining === 1) return 'Semifinal';
    if (remaining === 2) return 'Quarterfinal';
    return `Round of ${2 ** (remaining + 1)}`;
  }

  function normalizeBuilderAttributes(value, ratingFallback) {
    const source = asObject(value);
    const legacyRating = boundedInteger(ratingFallback, 1, 10, 6);
    const fallback = Math.max(1, Math.min(5, Math.round(legacyRating / 2)));
    return {
      shoot: boundedInteger(firstDefined(source.shoot, source.shooting), 1, 5, fallback),
      def: boundedInteger(firstDefined(source.def, source.defense, source.defence), 1, 5, fallback),
      speed: boundedInteger(source.speed, 1, 5, fallback),
      stamina: boundedInteger(source.stamina, 1, 5, fallback)
    };
  }

  /** Map the four builder attributes to the established 1–10 overall scale. */
  function calculatePlayerRating(attributes) {
    const attrs = normalizeBuilderAttributes(attributes, 6);
    return Math.round((attrs.shoot + attrs.def + attrs.speed + attrs.stamina) / 4 * 2);
  }

  /** Read old and current player shapes without rewriting their compatible IDs. */
  function normalizeBuilderPlayer(player, index) {
    const source = asObject(player);
    const attrs = normalizeBuilderAttributes(source.attrs, source.rating);
    const nickname = String(firstDefined(source.nickname, source.nick, '')).trim().slice(0, 20);
    return Object.assign({}, source, {
      id: String(firstDefined(source.id, `legacy_player_${Number(index) || 0}`)),
      name: (readName(source) || `Player ${(Number(index) || 0) + 1}`).slice(0, 20),
      nickname,
      attrs,
      rating: calculatePlayerRating(attrs)
    });
  }

  /** Return the team index for a true snake order: A, B, B, A, A, B… */
  function snakeDraftTeamIndex(pickIndex, teamCount) {
    const pick = Number(pickIndex);
    const count = Number(teamCount);
    if (!Number.isInteger(pick) || pick < 0 || !Number.isInteger(count) || count < 2) return null;
    const round = Math.floor(pick / count);
    const position = pick % count;
    return round % 2 === 0 ? position : count - 1 - position;
  }

  function assignSnakeTeams(players, teamCount) {
    const teams = Array.from({ length: teamCount }, function () { return []; });
    players.forEach(function (player, index) {
      teams[snakeDraftTeamIndex(index, teamCount)].push(player);
    });
    return teams;
  }

  function teamRatingTotals(teams) {
    return (Array.isArray(teams) ? teams : []).map(function (team) {
      const players = Array.isArray(team) ? team : Array.isArray(asObject(team).players) ? team.players : [];
      return players.reduce(function (sum, player, index) {
        return sum + normalizeBuilderPlayer(player, index).rating;
      }, 0);
    });
  }

  /** RMSD of team rating totals; zero is an exactly even rated split. */
  function calculateTeamRmsd(teams) {
    const totals = teamRatingTotals(teams);
    if (totals.length < 2) return 0;
    const mean = totals.reduce(function (sum, total) { return sum + total; }, 0) / totals.length;
    return Math.sqrt(totals.reduce(function (sum, total) {
      return sum + ((total - mean) ** 2);
    }, 0) / totals.length);
  }

  function shuffledCopy(players, random) {
    const source = players.slice();
    const rng = typeof random === 'function' ? random : Math.random;
    for (let index = source.length - 1; index > 0; index -= 1) {
      const sample = Math.max(0, Math.min(0.999999999, Number(rng()) || 0));
      const target = Math.floor(sample * (index + 1));
      const current = source[index];
      source[index] = source[target];
      source[target] = current;
    }
    return source;
  }

  function improveTeamRmsd(teams) {
    const result = teams.map(function (team) { return team.slice(); });
    let baseline = calculateTeamRmsd(result);
    let improved = true;
    let passes = 0;
    while (improved && passes < 100) {
      improved = false;
      passes += 1;
      for (let left = 0; left < result.length && !improved; left += 1) {
        for (let right = left + 1; right < result.length && !improved; right += 1) {
          for (let a = 0; a < result[left].length && !improved; a += 1) {
            for (let b = 0; b < result[right].length && !improved; b += 1) {
              const candidate = result.map(function (team) { return team.slice(); });
              const swap = candidate[left][a];
              candidate[left][a] = candidate[right][b];
              candidate[right][b] = swap;
              const rmsd = calculateTeamRmsd(candidate);
              if (rmsd < baseline - 0.000001) {
                result[left] = candidate[left];
                result[right] = candidate[right];
                baseline = rmsd;
                improved = true;
              }
            }
          }
        }
      }
    }
    return { teams: result, rmsd: baseline };
  }

  /** Fisher–Yates assignment for a rating-independent team split. */
  function generateRandomTeams(players, teamCount, options) {
    const count = boundedInteger(teamCount, 2, 12, 2);
    const source = (Array.isArray(players) ? players : []).map(normalizeBuilderPlayer);
    const random = asObject(options).random;
    const shuffled = shuffledCopy(source, random);
    const teams = Array.from({ length: count }, function () { return []; });
    shuffled.forEach(function (player, index) { teams[index % count].push(player); });
    return { teams, totals: teamRatingTotals(teams), rmsd: calculateTeamRmsd(teams) };
  }

  /**
   * Try a sorted snake seed plus multiple shuffled snake arrangements and keep
   * the lowest RMSD result. The supplied players are never mutated.
   */
  function generateBalancedTeams(players, teamCount, options) {
    const config = asObject(options);
    const count = boundedInteger(teamCount, 2, 12, 2);
    const iterations = boundedInteger(config.iterations, 1, 500, 50);
    const source = (Array.isArray(players) ? players : []).map(normalizeBuilderPlayer);
    const sorted = source.slice().sort(function (left, right) {
      return right.rating - left.rating || left.name.localeCompare(right.name);
    });
    let best = improveTeamRmsd(assignSnakeTeams(sorted, count));
    for (let iteration = 1; iteration < iterations; iteration += 1) {
      const candidate = improveTeamRmsd(assignSnakeTeams(shuffledCopy(source, config.random), count));
      if (candidate.rmsd < best.rmsd - 0.000001) best = candidate;
    }
    return {
      teams: best.teams,
      totals: teamRatingTotals(best.teams),
      rmsd: best.rmsd,
      iterations
    };
  }

  function normalizeQueueEntry(entry, index) {
    const source = asObject(entry);
    const legacyName = typeof entry === 'string' || typeof entry === 'number' ? String(entry).trim() : '';
    const name = readName(source) || legacyName || `Team ${(Number(index) || 0) + 1}`;
    return Object.assign({}, source, {
      id: String(firstDefined(source.id, `legacy_queue_${Number(index) || 0}_${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '_')}`)),
      name: name.slice(0, 30),
      players: Array.isArray(source.players) ? source.players.map(normalizeBuilderPlayer) : []
    });
  }

  function calculateHistorySummary(matches, options) {
    const perspective = normalizeTeamKey(asObject(options).perspectiveTeam) || 'a';
    const normalized = (Array.isArray(matches) ? matches : []).map(normalizeMatch);
    const competitive = normalized.filter(function (match) { return match.isCompetitiveResult; });
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let differential = 0;
    let scoreTotal = 0;
    competitive.forEach(function (match) {
      if (match.outcome === OUTCOMES.TIE) draws += 1;
      else if ((perspective === 'a' && match.outcome === OUTCOMES.TEAM_A_WIN) ||
        (perspective === 'b' && match.outcome === OUTCOMES.TEAM_B_WIN)) wins += 1;
      else losses += 1;
      const rawDifference = match.teamA.score - match.teamB.score;
      differential += perspective === 'a' ? rawDifference : -rawDifference;
      scoreTotal += (match.teamA.score + match.teamB.score) / 2;
    });
    const totalGames = competitive.length;
    return {
      totalGames,
      wins,
      losses,
      draws,
      winRate: totalGames ? Math.round((wins / totalGames) * 100) : 0,
      averageDifferential: totalGames ? differential / totalGames : 0,
      averageScore: totalGames ? scoreTotal / totalGames : 0
    };
  }

  function filterMatchHistory(matches, mode, options) {
    const perspective = normalizeTeamKey(asObject(options).perspectiveTeam) || 'a';
    const filter = String(mode || 'all').trim().toLowerCase();
    const normalized = (Array.isArray(matches) ? matches : []).map(normalizeMatch);
    if (filter === 'wins') return normalized.filter(function (match) {
      return perspective === 'a' ? match.outcome === OUTCOMES.TEAM_A_WIN : match.outcome === OUTCOMES.TEAM_B_WIN;
    });
    if (filter === 'losses') return normalized.filter(function (match) {
      return perspective === 'a' ? match.outcome === OUTCOMES.TEAM_B_WIN : match.outcome === OUTCOMES.TEAM_A_WIN;
    });
    if (filter === 'draws') return normalized.filter(function (match) { return match.outcome === OUTCOMES.TIE; });
    return normalized;
  }

  function calculatePlayerCareerStats(matches) {
    const players = new Map();
    (Array.isArray(matches) ? matches : []).map(normalizeMatch).forEach(function (match) {
      if (!match.isCompetitiveResult) return;
      const process = function (entries, teamKey) {
        (Array.isArray(entries) ? entries : []).forEach(function (entry) {
          const player = asObject(entry);
          const name = readName(player);
          if (!name) return;
          const key = player.id !== undefined && player.id !== null
            ? `id:${player.id}`
            : `name:${name.trim().toLocaleLowerCase()}`;
          if (!players.has(key)) players.set(key, { id: firstDefined(player.id, null), name, games: 0, points: 0, fouls: 0, wins: 0, losses: 0, draws: 0 });
          const career = players.get(key);
          career.games += 1;
          career.points += asNonNegativeNumber(firstDefined(player.score, player.points), 0);
          career.fouls += asNonNegativeNumber(player.fouls, 0);
          if (match.outcome === OUTCOMES.TIE) career.draws += 1;
          else if (match.winnerTeam === teamKey) career.wins += 1;
          else career.losses += 1;
        });
      };
      process(firstDefined(match.playersA, match.teamA.players), 'a');
      process(firstDefined(match.playersB, match.teamB.players), 'b');
    });
    return Array.from(players.values()).map(function (career) {
      return Object.assign({}, career, {
        averagePoints: career.games ? career.points / career.games : 0,
        winRate: career.games ? Math.round((career.wins / career.games) * 100) : 0
      });
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

    if (type === 'rotation' || type === 'rotate_all') {
      if (source.length < 2) return { status: 'not_ready', action: type, queue: source, required: 2 };
      return { status: 'applied', action: type, queue: source.slice(2).concat(source.slice(0, 2)) };
    }

    if (type === 'winners_stay') {
      if (source.length < 2) return { status: 'not_ready', action: type, queue: source, required: 2 };
      const winnerIndex = Number(config.winnerIndex) === 1 ? 1 : 0;
      const loserIndex = winnerIndex === 0 ? 1 : 0;
      return {
        status: 'applied',
        action: type,
        queue: [source[winnerIndex]].concat(source.slice(2), [source[loserIndex]]),
        winner: source[winnerIndex],
        loser: source[loserIndex]
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
    'landing',
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
    'tourn-detail',
    'world'
  ]);
  const DEFAULT_PUBLIC_ROUTE_SCREENS = Object.freeze([
    'landing',
    'profile',
    'onboarding',
    'privacy',
    'terms',
    'communities',
    'world',
    'help-center'
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

    // Phase 9 retires password/PIN recovery. Old bookmarks and recovery links
    // resolve to the email-code sign-in screen instead of a dead PIN form.
    if (route === 'reset-pin') {
      return routeDecision('navigate', 'profile', route, 'legacy_pin_retired');
    }

    if (!hasProfile && !publicScreens.has(route)) {
      return routeDecision('navigate', 'profile', route, 'auth_required');
    }

    if (route === 'tournament' || route === 'tourn-detail') {
      const encodedTournamentId = encodedParts.length > 1 ? encodedParts[1] : '';
      const decodedTournamentId = encodedTournamentId ? safeDecodeRoutePart(encodedTournamentId) : '';
      const tournamentId = decodedTournamentId === null ? '' : decodedTournamentId.trim();
      if (route === 'tourn-detail' && !tournamentId) {
        return routeDecision('navigate', 'tournament', route, decodedTournamentId === null
          ? 'invalid_tournament_id'
          : 'missing_tournament_id');
      }
      if (tournamentId) {
        const knownIds = communityIdSet(config.tournamentIds);
        if (knownIds && !knownIds.has(tournamentId)) {
          return routeDecision('navigate', 'tournament', route, 'unknown_tournament', { tournamentId });
        }
        return routeDecision('open_tournament', 'tourn-detail', route, 'tournament_deep_link', { tournamentId });
      }
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
    validateTournamentTeams,
    validateTournamentName,
    normalizeTournament,
    deriveTournamentState,
    applyTournamentResult,
    undoTournamentResult,
    tournamentRoundLabel,
    calculatePlayerRating,
    normalizeBuilderPlayer,
    snakeDraftTeamIndex,
    calculateTeamRmsd,
    generateRandomTeams,
    generateBalancedTeams,
    normalizeQueueEntry,
    calculateHistorySummary,
    filterMatchHistory,
    calculatePlayerCareerStats,
    applyQueueAction,
    resolveHashRoute,
    generateKnockoutFixtures,
    validateGameSetup,
    createGameState,
    allowedScoreValues,
    nextGamePeriod,
    describeGameAction,
    scoreHapticPattern,
    resumeClockSnapshot
  });
}));
