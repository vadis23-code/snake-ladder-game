(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CourtCallSupportingProduct = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const asArray = value => Array.isArray(value) ? value : [];
  const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const text = value => String(value === undefined || value === null ? '' : value).trim();
  const nameKey = value => text(value).toLocaleLowerCase();

  function timestamp(value) {
    if (value === undefined || value === null || value === '') return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function matchDate(match) {
    return match.completedAt || match.completed_at || match.createdAt || match.created_at || match.date || null;
  }

  function normalizeMatch(match, core) {
    if (core && typeof core.normalizeMatch === 'function') return core.normalizeMatch(match);
    const source = asObject(match);
    const teamA = asObject(source.teamA);
    const teamB = asObject(source.teamB);
    const scoreA = number(teamA.score ?? source.scoreA ?? source.score_a);
    const scoreB = number(teamB.score ?? source.scoreB ?? source.score_b);
    const outcome = source.outcome || (scoreA === scoreB ? 'tie' : scoreA > scoreB ? 'team_a_win' : 'team_b_win');
    return {
      ...source,
      outcome,
      teamA: { ...teamA, name: text(teamA.name) || 'Team A', score: scoreA },
      teamB: { ...teamB, name: text(teamB.name) || 'Team B', score: scoreB },
      winnerTeam: outcome === 'team_a_win' ? 'a' : outcome === 'team_b_win' ? 'b' : null,
      isCompetitiveResult: ['team_a_win', 'team_b_win', 'tie'].includes(outcome)
    };
  }

  function summarizeTeams(matches) {
    const teams = new Map();
    const ensure = name => {
      const key = nameKey(name);
      if (!teams.has(key)) teams.set(key, { name, played: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0 });
      return teams.get(key);
    };
    matches.filter(match => match.isCompetitiveResult).forEach(match => {
      const a = ensure(match.teamA.name);
      const b = ensure(match.teamB.name);
      a.played += 1; b.played += 1;
      a.pointsFor += match.teamA.score; a.pointsAgainst += match.teamB.score;
      b.pointsFor += match.teamB.score; b.pointsAgainst += match.teamA.score;
      if (match.outcome === 'tie') { a.draws += 1; b.draws += 1; }
      else if (match.winnerTeam === 'a') { a.wins += 1; b.losses += 1; }
      else if (match.winnerTeam === 'b') { b.wins += 1; a.losses += 1; }
    });
    return [...teams.values()].map(team => ({
      ...team,
      differential: team.pointsFor - team.pointsAgainst,
      winRate: team.played ? Math.round(team.wins / team.played * 100) : 0
    })).sort((a, b) => b.played - a.played || b.wins - a.wins || b.differential - a.differential || a.name.localeCompare(b.name));
  }

  function summarizeFormats(matches) {
    const counts = new Map();
    matches.forEach(match => {
      const label = text(match.gameType || match.game_type) || 'Pickup';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  function summarizeTournaments(records, core) {
    const tournaments = asArray(records).map(record => core && typeof core.deriveTournamentState === 'function'
      ? core.deriveTournamentState(record)
      : asObject(record));
    const completed = tournaments.filter(tournament => tournament.completed === true || tournament.status === 'completed');
    const playedFixtures = tournaments.reduce((total, tournament) => total + asArray(tournament.fixtures).filter(fixture => fixture.played && !fixture.isBye).length, 0);
    const totalFixtures = tournaments.reduce((total, tournament) => total + asArray(tournament.fixtures).filter(fixture => !fixture.isBye).length, 0);
    return {
      total: tournaments.length,
      active: tournaments.length - completed.length,
      completed: completed.length,
      playedFixtures,
      totalFixtures,
      champions: completed.filter(tournament => text(tournament.winner)).map(tournament => ({ name: text(tournament.name), winner: text(tournament.winner) }))
    };
  }

  function buildAnalytics(data, options) {
    const source = asObject(data);
    const config = asObject(options);
    const core = config.core;
    const matches = asArray(source.matches).map(match => normalizeMatch(match, core));
    const competitive = matches.filter(match => match.isCompetitiveResult);
    const wins = competitive.filter(match => match.winnerTeam).length;
    const ties = competitive.filter(match => match.outcome === 'tie').length;
    const cancelled = matches.filter(match => match.outcome === 'cancelled').length;
    const noContests = matches.filter(match => match.outcome === 'no_contest').length;
    const totalPoints = competitive.reduce((sum, match) => sum + match.teamA.score + match.teamB.score, 0);
    const totalMargin = competitive.reduce((sum, match) => sum + Math.abs(match.teamA.score - match.teamB.score), 0);
    const playerRows = core && typeof core.calculatePlayerCareerStats === 'function'
      ? core.calculatePlayerCareerStats(source.matches)
      : [];
    const players = playerRows.slice().sort((a, b) => b.points - a.points || b.games - a.games || a.name.localeCompare(b.name));
    const events = asArray(source.communityEvents);
    const now = Number.isFinite(Number(config.now)) ? Number(config.now) : Date.now();
    return {
      generatedAt: new Date(now).toISOString(),
      games: {
        saved: matches.length,
        competitive: competitive.length,
        decided: wins,
        ties,
        cancelled,
        noContests,
        totalPoints,
        averageCombinedPoints: competitive.length ? totalPoints / competitive.length : 0,
        averageMargin: competitive.length ? totalMargin / competitive.length : 0,
        closeGames: competitive.filter(match => Math.abs(match.teamA.score - match.teamB.score) <= 2).length,
        formats: summarizeFormats(matches)
      },
      teams: summarizeTeams(matches),
      players,
      tournaments: summarizeTournaments(source.tournaments, core),
      communities: {
        total: asArray(source.communities).length,
        players: asArray(source.communityPlayers).length,
        posts: asArray(source.communityPosts).length,
        events: events.length,
        upcomingEvents: events.filter(event => timestamp(event.date || event.startsAt || event.starts_at) >= now).length
      },
      usage: { ...asObject(source.usage) }
    };
  }

  function shorten(value, maximum) {
    const clean = text(value).replace(/\s+/g, ' ');
    return clean.length > maximum ? `${clean.slice(0, maximum - 1).trimEnd()}…` : clean;
  }

  function buildLocalActivity(data, options) {
    const source = asObject(data);
    const core = asObject(options).core;
    const activity = [];
    asArray(source.matches).forEach(raw => {
      const match = normalizeMatch(raw, core);
      if (!match.isCompetitiveResult) return;
      const narrative = core && typeof core.resultNarrative === 'function'
        ? core.resultNarrative(match)
        : `${match.teamA.name} ${match.teamA.score}–${match.teamB.score} ${match.teamB.name}`;
      activity.push({
        id: `match:${text(match.id) || activity.length}`,
        category: 'basketball', label: 'Saved match', title: `${match.teamA.name} ${match.teamA.score}–${match.teamB.score} ${match.teamB.name}`,
        summary: narrative, route: 'history', occurredAt: matchDate(match), timestamp: timestamp(matchDate(match))
      });
    });
    asArray(source.tournaments).forEach((raw, index) => {
      const tournament = core && typeof core.deriveTournamentState === 'function' ? core.deriveTournamentState(raw) : asObject(raw);
      const played = number(tournament.completedFixtures) || asArray(tournament.fixtures).filter(fixture => fixture.played && !fixture.isBye).length;
      const total = number(tournament.totalFixtures) || asArray(tournament.fixtures).filter(fixture => !fixture.isBye).length;
      const state = tournament.completed ? (text(tournament.winner) ? `Champion: ${text(tournament.winner)}` : 'Tournament complete') : `${played} of ${total} matches recorded`;
      const occurredAt = tournament.updatedAt || tournament.updated_at || tournament.createdAt || tournament.created_at;
      activity.push({
        id: `tournament:${text(tournament.id) || index}`,
        category: 'tournament', label: tournament.completed ? 'Completed tournament' : 'Tournament', title: text(tournament.name) || 'Tournament',
        summary: state, route: text(tournament.id) ? `tournament/${text(tournament.id)}` : 'tournament', occurredAt, timestamp: timestamp(occurredAt)
      });
    });
    asArray(source.communityPosts).forEach((post, index) => {
      const occurredAt = post.createdAt || post.created_at;
      activity.push({
        id: `post:${text(post.id) || index}`,
        category: 'community', label: 'Community post', title: text(post.title) || `Post by ${text(post.authorName || post.author_name) || 'a community member'}`,
        summary: shorten(post.body || post.text || post.content, 150) || 'Saved in a CourtCall community.',
        route: text(post.communityId || post.community_id) ? `community/${text(post.communityId || post.community_id)}` : 'communities', occurredAt, timestamp: timestamp(occurredAt)
      });
    });
    asArray(source.communityEvents).forEach((event, index) => {
      const occurredAt = event.date || event.startsAt || event.starts_at || event.createdAt || event.created_at;
      const details = [text(event.date || event.startsAt || event.starts_at), text(event.time), text(event.location)].filter(Boolean).join(' · ');
      activity.push({
        id: `event:${text(event.id) || index}`,
        category: 'community', label: 'Community event', title: text(event.title) || 'Community event', summary: details || 'Saved community event',
        route: text(event.communityId || event.community_id) ? `community/${text(event.communityId || event.community_id)}` : 'communities', occurredAt, timestamp: timestamp(occurredAt)
      });
    });
    return activity.sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id)).slice(0, 16);
  }

  function cleanLocation(value, fallback) {
    return text(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, 80) || fallback || '';
  }

  function searchUrl(host, query) {
    const url = new URL(host);
    url.searchParams.set('q', query);
    url.searchParams.set('hl', 'en');
    return url.toString();
  }

  function buildSearchQueries(location) {
    const loc = asObject(location);
    const country = cleanLocation(loc.country, 'India');
    const state = cleanLocation(loc.state);
    const city = cleanLocation(loc.city, state || country);
    const court = cleanLocation(loc.court);
    const queries = [
      { label: `🏀 ${city} basketball`, query: `${city} basketball news`, cat: 'basketball', host: 'https://news.google.com/search' },
      { label: `📍 ${city} local sports`, query: `${city} local sports news`, cat: 'local', host: 'https://news.google.com/search' },
      { label: `🏆 ${city} basketball tournaments`, query: `${city} basketball tournament`, cat: 'tournament', host: 'https://news.google.com/search' },
      { label: `🤝 ${city} community sports`, query: `${city} community sports events`, cat: 'community', host: 'https://news.google.com/search' },
      { label: `⛅ ${city} weekend weather`, query: `weather ${city} weekend`, cat: 'weather', host: 'https://www.google.com/search' },
      { label: `🌐 ${country} basketball`, query: `${country} basketball news`, cat: 'national', host: 'https://news.google.com/search' }
    ];
    if (state && nameKey(state) !== nameKey(city)) queries.splice(1, 0, { label: `🏀 ${state} basketball`, query: `${state} basketball news`, cat: 'basketball', host: 'https://news.google.com/search' });
    if (court) queries.push({ label: `📍 ${court} court updates`, query: `${court} basketball court ${city}`, cat: 'local', host: 'https://www.google.com/search' });
    return queries.map(item => ({ label: item.label, cat: item.cat, url: searchUrl(item.host, item.query) }));
  }

  function matchHelpArticle(articles, query) {
    const normalized = text(query).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalized.split(' ').filter(word => word.length > 2);
    let article = null;
    let score = 0;
    asArray(articles).forEach(candidate => {
      let candidateScore = 0;
      asArray(asObject(candidate).keywords).forEach(keyword => {
        const normalizedKeyword = text(keyword).toLowerCase();
        if (!normalizedKeyword) return;
        if (normalized.includes(normalizedKeyword)) candidateScore += normalizedKeyword.split(' ').length * 3;
        else words.forEach(word => {
          if (normalizedKeyword === word || normalizedKeyword.startsWith(word) || word.startsWith(normalizedKeyword)) candidateScore += 1;
        });
      });
      if (candidateScore > score) { score = candidateScore; article = candidate; }
    });
    const confidence = score >= 6 ? 'high' : score >= 2 ? 'medium' : 'low';
    return { article: confidence === 'low' ? null : article, score, confidence };
  }

  return Object.freeze({ buildAnalytics, buildLocalActivity, buildSearchQueries, matchHelpArticle });
}));
