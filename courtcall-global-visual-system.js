/* CourtCall Midnight Arena OS — presentation-only route atmosphere layer. */
(function courtCallGlobalVisualSystem() {
  'use strict';

  const ROUTES = Object.freeze({
    onboarding: { atmosphere: 'arena', native: '.ob-wrap' },
    profile: { atmosphere: 'arena', native: '.profile-hero' },
    hub: { atmosphere: 'arena', native: '.app-dashboard' },
    setup: { atmosphere: 'locker', native: '.setup-hero' },
    game: { atmosphere: 'clutch', native: '#s-game' },
    teams: {
      atmosphere: 'locker', kicker: 'ROSTER ROOM', title: 'BUILD THE LINEUP',
      copy: 'Rate the crew, balance the floor and set who has next.'
    },
    history: { atmosphere: 'sideline', native: '.history-hero' },
    tournament: {
      atmosphere: 'championship', kicker: 'CHAMPIONSHIP CONTROL', title: 'ONE BRACKET. ONE WINNER.',
      copy: 'Run the fixtures, call every result and light the final court.'
    },
    'tourn-detail': { atmosphere: 'championship', native: '.tc-header' },
    world: { atmosphere: 'sideline', native: '.world-hero' },
    communities: { atmosphere: 'community', native: '.comm-hero' },
    'comm-create': {
      atmosphere: 'community', kicker: 'OPEN A NEW GYM', title: 'BUILD YOUR HOME COURT',
      copy: 'Give the crew a name, a court and a place to keep the run alive.'
    },
    'comm-detail': { atmosphere: 'community', native: '.cd-header' },
    pulse: { atmosphere: 'sideline', native: '.pulse-hero' },
    settings: {
      atmosphere: 'arena', kicker: 'COURT CONTROL', title: 'TUNE YOUR GAME',
      copy: 'Calmer controls, the same Midnight Arena identity.'
    },
    analytics: {
      atmosphere: 'sideline', kicker: 'PERFORMANCE DESK', title: 'READ THE RUN',
      copy: 'Broadcast-style numbers for games, habits and momentum.'
    },
    'help-center': {
      atmosphere: 'arena', kicker: 'COURTCALL PLAYBOOK', title: 'FIND THE NEXT PLAY',
      copy: 'Clear court-tested guidance without leaving the game.'
    },
    privacy: { atmosphere: 'arena', native: '.legal-body' },
    terms: { atmosphere: 'arena', native: '.legal-body' },
    'reset-pin': { atmosphere: 'arena', native: '.profile-hero' }
  });

  const COMMUNITY_TABS = Object.freeze({
    feed: ['GYM FLOOR', 'THE COURT CONVERSATION', 'Calls, recaps and reactions from this basketball community.'],
    members: ['THE CREW', 'WHO IS IN THE GYM?', 'Roles and membership, arranged like a team sheet.'],
    players: ['SCOUTING DESK', 'PLAYER CARDS', 'Positions, ratings, records and earned basketball badges.'],
    gallery: ['MATCH-DAY MEDIA', 'THE COURT IN FRAMES', 'Highlights, winners and practice sessions from the community.'],
    events: ['GAME-DAY BOARD', 'NEXT RUNS', 'Dates, courts, availability and RSVP status at a glance.'],
    leaderboard: ['ARENA RANKINGS', 'WHO OWNS THE COURT?', 'The community leaders, ranked by the numbers that matter.'],
    settings: ['GYM CONTROL', 'COMMUNITY SETTINGS', 'Keep the court organised without losing its identity.']
  });

  function makeHero(config) {
    const hero = document.createElement('section');
    hero.className = 'cc-route-hero';
    hero.setAttribute('aria-labelledby', `cc-route-hero-${config.route}`);

    const copy = document.createElement('div');
    copy.className = 'cc-route-hero__copy';
    const kicker = document.createElement('p');
    kicker.className = 'cc-route-hero__kicker';
    kicker.textContent = config.kicker;
    const title = document.createElement('h1');
    title.id = `cc-route-hero-${config.route}`;
    title.textContent = config.title;
    const description = document.createElement('p');
    description.className = 'cc-route-hero__description';
    description.textContent = config.copy;
    copy.append(kicker, title, description);

    const mark = document.createElement('span');
    mark.className = 'cc-route-hero__mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = '<i></i><b></b>';
    hero.append(copy, mark);
    return hero;
  }

  function ensureRouteHero(screen, route, config) {
    let hero = screen.querySelector(':scope > .cc-route-hero');
    if (!config.title) {
      if (hero) hero.remove();
      return;
    }
    if (!hero) {
      hero = makeHero({ ...config, route });
      const pageNav = screen.querySelector(':scope > .page-nav');
      if (pageNav) pageNav.insertAdjacentElement('afterend', hero);
      else screen.prepend(hero);
    }
  }

  function markNativeHero(screen, selector) {
    screen.querySelector(selector)?.classList.add('cc-native-hero');
  }

  function setSaveDataState() {
    const saveData = Boolean(navigator.connection?.saveData);
    document.documentElement.toggleAttribute('data-cc-save-data', saveData);
  }

  function onCommunityTabChange(tab) {
    const content = document.getElementById('cd-tab-content');
    const config = COMMUNITY_TABS[tab];
    if (!content || !config) return;
    document.getElementById('s-comm-detail')?.setAttribute('data-cc-community-tab', tab);
    content.querySelector(':scope > .cc-subview-hero')?.remove();

    const hero = document.createElement('header');
    hero.className = 'cc-subview-hero';
    const kicker = document.createElement('span');
    kicker.className = 'cc-subview-hero__kicker';
    kicker.textContent = config[0];
    const title = document.createElement('strong');
    title.textContent = config[1];
    const copy = document.createElement('span');
    copy.className = 'cc-subview-hero__copy';
    copy.textContent = config[2];
    hero.append(kicker, title, copy);
    content.prepend(hero);
  }

  function onRouteChange(route) {
    const screen = document.getElementById(`s-${route}`);
    if (!screen) return;

    setSaveDataState();
    if (route === 'landing') {
      document.querySelectorAll('.screen.cc-visual-route').forEach(item => item.classList.remove('cc-visual-route'));
      document.documentElement.dataset.ccAtmosphere = 'cinematic';
      document.body.dataset.ccAtmosphere = 'cinematic';
      return;
    }
    const config = ROUTES[route] || { atmosphere: 'arena' };
    document.documentElement.dataset.ccAtmosphere = config.atmosphere;
    document.body.dataset.ccAtmosphere = config.atmosphere;
    document.querySelectorAll('.screen.cc-visual-route').forEach(item => {
      if (item !== screen) item.classList.remove('cc-visual-route');
    });
    screen.classList.add('cc-visual-route');
    screen.dataset.ccAtmosphere = config.atmosphere;
    screen.dataset.ccVisualGrade = 'A';
    ensureRouteHero(screen, route, config);
    if (config.native) markNativeHero(screen, config.native);
    if (route === 'comm-detail') onCommunityTabChange(screen.querySelector('.cd-tab.on')?.dataset.tab || 'feed');
  }

  window.CourtCallGlobalVisuals = Object.freeze({
    onRouteChange,
    onCommunityTabChange,
    routeConfig: ROUTES
  });

  setSaveDataState();
  navigator.connection?.addEventListener?.('change', setSaveDataState);
  document.addEventListener('DOMContentLoaded', () => {
    const active = document.querySelector('.screen.active');
    if (active?.id?.startsWith('s-')) onRouteChange(active.id.slice(2));
  }, { once: true });
})();
