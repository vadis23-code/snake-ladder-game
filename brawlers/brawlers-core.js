/*
 * Brawlers Basketball Experience — pure logic shared by the page and tests.
 * Loaded as a classic script in the browser (window.BrawlersCore) and via
 * require() in Node tests. No DOM or Firebase access in this file.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BrawlersCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_NAME_LENGTH = 30;
  const MIN_TEAMS = 2;
  const MAX_TEAMS = 4;
  const MIN_SKILL = 1;
  const MAX_SKILL = 5;
  const DEFAULT_SKILL = 3;
  const SESSION_TYPES = ['Half Court', 'Full Court'];
  const TIME_ZONE = 'Asia/Kolkata';

  const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const labelFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  /** Session day as YYYY-MM-DD in India time (not UTC). */
  function sessionDay(date = new Date()) {
    return dayFormatter.format(date);
  }

  function sessionDayLabel(date = new Date()) {
    return labelFormatter.format(date);
  }

  /** Trim and collapse internal whitespace. */
  function cleanName(raw) {
    return String(raw ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Returns an error message, or '' when the name is acceptable. */
  function validateName(raw) {
    const name = cleanName(raw);
    if (!name) return 'Enter a player name.';
    if (name.length > MAX_NAME_LENGTH) return `Names can be at most ${MAX_NAME_LENGTH} characters.`;
    if (!/[\p{L}\p{N}]/u.test(name)) return 'Names need at least one letter or number.';
    return '';
  }

  /**
   * Stable identity for a player across days, used as the Firestore document
   * id. Case- and spacing-insensitive, so "Big  VJ" and "big vj" collide and
   * the database rejects the duplicate.
   */
  function nameKey(raw) {
    return encodeURIComponent(cleanName(raw).toLowerCase());
  }

  function normalizeSkill(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < MIN_SKILL || n > MAX_SKILL) return null;
    return n;
  }

  function clampTeamCount(value) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return MIN_TEAMS;
    return Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, n));
  }

  /** Unbiased Fisher–Yates shuffle; returns a new array. */
  function shuffle(items, random = Math.random) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function sum(team) {
    return team.reduce((t, p) => t + p.skill, 0);
  }

  function spreadOf(totals) {
    return Math.max(...totals) - Math.min(...totals);
  }

  function squaredDeviation(totals) {
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    return totals.reduce((t, x) => t + (x - mean) ** 2, 0);
  }

  /** Team sizes differ by at most one; which teams get the extra player is random. */
  function teamCapacities(playerCount, teamCount, random) {
    const base = Math.floor(playerCount / teamCount);
    const extra = playerCount % teamCount;
    const caps = Array.from({ length: teamCount }, (_, i) => base + (i < extra ? 1 : 0));
    return shuffle(caps, random);
  }

  function greedyAssign(ordered, caps, random) {
    const teams = caps.map(() => []);
    const totals = caps.map(() => 0);
    for (const p of ordered) {
      let best = -1;
      for (const i of shuffle([...teams.keys()], random)) {
        if (teams[i].length >= caps[i]) continue;
        if (best === -1 || totals[i] < totals[best]) best = i;
      }
      teams[best].push(p);
      totals[best] += p.skill;
    }
    return teams;
  }

  /** Swap players between teams while it lowers the squared deviation of team totals. */
  function improveBySwaps(teams) {
    let totals = teams.map(sum);
    let current = squaredDeviation(totals);
    for (let pass = 0; pass < 50; pass++) {
      let improved = false;
      for (let a = 0; a < teams.length; a++) {
        for (let b = a + 1; b < teams.length; b++) {
          for (let i = 0; i < teams[a].length; i++) {
            for (let j = 0; j < teams[b].length; j++) {
              const delta = teams[b][j].skill - teams[a][i].skill;
              if (delta === 0) continue;
              const next = totals.slice();
              next[a] += delta;
              next[b] -= delta;
              const score = squaredDeviation(next);
              if (score < current - 1e-9) {
                [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
                totals = next;
                current = score;
                improved = true;
              }
            }
          }
        }
      }
      if (!improved) break;
    }
    return teams;
  }

  /**
   * Split players into skill-balanced teams.
   * players: [{ name, skill? }] — unrated players count as DEFAULT_SKILL.
   * Sizes differ by at most one; total skill spread is minimised. Many
   * randomised trials are run so regenerating gives different, equally fair
   * line-ups instead of the same split every time.
   */
  function balanceTeams(players, teamCount, options = {}) {
    const random = options.random || Math.random;
    const trials = options.trials ?? 200;
    const count = clampTeamCount(teamCount);
    const pool = players.map((p) => ({
      name: cleanName(p.name),
      skill: normalizeSkill(p.skill) ?? DEFAULT_SKILL,
      rated: normalizeSkill(p.skill) !== null
    }));

    if (!pool.length) {
      return { teams: Array.from({ length: count }, () => []), totals: Array(count).fill(0), spread: 0 };
    }

    let best = null;
    for (let t = 0; t < Math.max(1, trials); t++) {
      // Strongest first with random tie-breaks (Array#sort is stable).
      const ordered = shuffle(pool, random).sort((x, y) => y.skill - x.skill);
      const caps = teamCapacities(pool.length, count, random);
      const teams = improveBySwaps(greedyAssign(ordered, caps, random));
      const totals = teams.map(sum);
      const spread = spreadOf(totals);
      const dev = squaredDeviation(totals);
      if (!best || spread < best.spread || (spread === best.spread && dev < best.dev - 1e-9)) {
        best = { teams, totals, spread, dev };
      }
      if (best.spread === 0) break;
    }
    return { teams: best.teams, totals: best.totals, spread: best.spread };
  }

  /** Names on today's list that are not in the generated teams. */
  function playersMissingFromTeams(playerNames, teams) {
    const inTeams = new Set(teams.flat().map((n) => cleanName(n).toLowerCase()));
    return playerNames.filter((n) => !inTeams.has(cleanName(n).toLowerCase()));
  }

  function buildShareMessage({ title, dateLabel, sessionType, players, teams, link }) {
    const lines = [`🏀 ${title}`, `📅 ${dateLabel}`];
    if (sessionType) lines.push(`🏟 ${sessionType}`);
    lines.push(`👥 Total players: ${players.length}`, '');
    if (teams && teams.length) {
      teams.forEach((team, i) => {
        lines.push(`*Team ${i + 1}* (${team.length})`);
        team.forEach((name) => lines.push(`• ${name}`));
        lines.push('');
      });
    } else {
      players.forEach((name, i) => lines.push(`${i + 1}. ${name}`));
      lines.push('');
    }
    if (link) lines.push(`Join the list: ${link}`);
    return lines.join('\n').trim();
  }

  return {
    MAX_NAME_LENGTH, MIN_TEAMS, MAX_TEAMS, MIN_SKILL, MAX_SKILL, DEFAULT_SKILL, SESSION_TYPES,
    sessionDay, sessionDayLabel, cleanName, validateName, nameKey, normalizeSkill,
    clampTeamCount, shuffle, balanceTeams, playersMissingFromTeams, buildShareMessage
  };
});
