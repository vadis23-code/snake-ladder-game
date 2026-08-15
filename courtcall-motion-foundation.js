/* CourtCall Visual Motion Foundation — presentation only. */
(function courtCallMotionFoundation() {
  'use strict';

  const VERSION = '1.0.0';
  const reduceQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const timers = new Map();
  const observers = [];
  const elementKeys = new WeakMap();
  let elementKeySequence = 0;

  function reducedMotion() {
    return document.documentElement.dataset.reducedMotion === 'true' || Boolean(reduceQuery?.matches);
  }

  function schedule(key, callback, delay) {
    if (timers.has(key)) clearTimeout(timers.get(key));
    const timer = setTimeout(() => {
      timers.delete(key);
      callback();
    }, delay);
    timers.set(key, timer);
  }

  function replayClass(element, className, duration) {
    if (!element) return;
    if (!elementKeys.has(element)) elementKeys.set(element, ++elementKeySequence);
    const key = `element:${elementKeys.get(element)}:${className}`;
    element.classList.remove(className);
    if (reducedMotion()) return;
    requestAnimationFrame(() => {
      if (!element.isConnected) return;
      element.classList.add(className);
      schedule(key, () => element.classList.remove(className), duration);
    });
  }

  function gameState() {
    try {
      return typeof state === 'object' && state ? state : null;
    } catch {
      return null;
    }
  }

  function scoringEvents(currentState) {
    return Array.isArray(currentState?.history)
      ? currentState.history.filter(event => !event.type || event.type === 'score')
      : [];
  }

  function scoreEventKey(currentState) {
    const latest = scoringEvents(currentState)[0];
    if (!latest) return 'empty';
    return [latest.ts || 'legacy', latest.team, latest.pts, scoringEvents(currentState).length].join(':');
  }

  function detectComeback(currentState) {
    const chronological = scoringEvents(currentState).slice().reverse();
    if (chronological.length < 4) return null;

    let scoreA = 0;
    let scoreB = 0;
    const maxDeficit = { a: 0, b: 0 };
    chronological.forEach(event => {
      const points = Math.max(0, Number(event.pts) || 0);
      if (event.team === 'a') scoreA += points;
      if (event.team === 'b') scoreB += points;
      maxDeficit.a = Math.max(maxDeficit.a, scoreB - scoreA);
      maxDeficit.b = Math.max(maxDeficit.b, scoreA - scoreB);
    });

    const latest = chronological[chronological.length - 1];
    if (!latest || !['a', 'b'].includes(latest.team)) return null;
    const finalDifference = latest.team === 'a' ? scoreA - scoreB : scoreB - scoreA;
    const priorDifference = finalDifference - (Number(latest.pts) || 0);
    const erased = maxDeficit[latest.team];
    if (erased < 6 || priorDifference >= 0 || finalDifference < 0) return null;

    const team = latest.team === 'a' ? currentState.teamA : currentState.teamB;
    return {
      team: latest.team,
      teamName: team?.name || `Team ${latest.team.toUpperCase()}`,
      erased
    };
  }

  function createStatusNodes() {
    const game = document.getElementById('s-game');
    const runBanner = document.getElementById('run-banner');
    if (!game || !runBanner) return {};

    let comeback = document.getElementById('cc-comeback-alert');
    if (!comeback) {
      comeback = document.createElement('div');
      comeback.id = 'cc-comeback-alert';
      comeback.className = 'cc-comeback-alert hidden';
      comeback.setAttribute('role', 'status');
      comeback.setAttribute('aria-live', 'polite');
      comeback.setAttribute('aria-atomic', 'true');
      runBanner.insertAdjacentElement('afterend', comeback);
    }

    let foulStatus = document.getElementById('cc-foul-status');
    if (!foulStatus) {
      foulStatus = document.createElement('div');
      foulStatus.id = 'cc-foul-status';
      foulStatus.className = 'cc-sr-only';
      foulStatus.setAttribute('role', 'status');
      foulStatus.setAttribute('aria-live', 'assertive');
      foulStatus.setAttribute('aria-atomic', 'true');
      game.appendChild(foulStatus);
    }
    return { comeback, foulStatus };
  }

  function wirePeriodAndPossession() {
    const periodLabel = document.getElementById('q-label');
    const periodButton = document.getElementById('q-chip');
    const possessionButton = document.getElementById('poss-btn');
    const possessionLabel = document.getElementById('poss-label');
    if (!periodLabel || !periodButton || !possessionButton || !possessionLabel) return;

    let lastPeriod = periodLabel.textContent;
    let lastPossession = possessionButton.textContent;
    const observer = new MutationObserver(() => {
      if (periodLabel.textContent !== lastPeriod) {
        lastPeriod = periodLabel.textContent;
        replayClass(periodButton, 'cc-motion-period-change', 500);
      }
      if (possessionButton.textContent !== lastPossession) {
        lastPossession = possessionButton.textContent;
        possessionButton.dataset.side = lastPossession.includes('◀') ? 'a' : 'b';
        replayClass(possessionButton, 'cc-motion-possession-swap', 450);
        replayClass(possessionLabel, 'cc-motion-possession-label', 450);
      }
    });
    observer.observe(periodLabel, { childList: true, characterData: true, subtree: true });
    observer.observe(possessionButton, { childList: true, characterData: true, subtree: true });
    observers.push(observer);
  }

  function wireFeedMotion() {
    const list = document.getElementById('feed-list');
    const counter = document.getElementById('feed-count');
    if (!list || !counter) return;
    const readCount = () => Math.max(0, Number.parseInt(counter.textContent, 10) || 0);
    let knownCount = readCount();

    const observer = new MutationObserver(() => {
      const nextCount = readCount();
      const addedCount = nextCount - knownCount;
      knownCount = nextCount;
      if (addedCount <= 0 || reducedMotion()) return;

      const entries = Array.from(list.querySelectorAll('.feed-entry')).slice(0, Math.min(addedCount, 6));
      entries.forEach((entry, index) => {
        const colour = entry.querySelector('.fe-team')?.getAttribute('style') || '';
        entry.classList.toggle('cc-motion-team-a', colour.includes('--ca'));
        entry.classList.toggle('cc-motion-team-b', colour.includes('--cb'));
        entry.style.setProperty('--cc-feed-delay', `${index * 40}ms`);
        entry.classList.add('cc-motion-feed-in');
        schedule(`feed:${nextCount}:${index}`, () => entry.classList.remove('cc-motion-feed-in'), 420 + (index * 40));
      });
    });
    observer.observe(list, { childList: true });
    observers.push(observer);
  }

  function wireFoulStatus(foulStatus) {
    const badges = ['a', 'b'].map(team => document.getElementById(`foul-${team}`)).filter(Boolean);
    if (!badges.length || !foulStatus) return;
    const counts = new Map(badges.map(badge => [badge.id, Number.parseInt(badge.textContent.replace(/\D/g, ''), 10) || 0]));

    const sync = () => {
      const warnings = [];
      badges.forEach(badge => {
        const team = badge.id.endsWith('-a') ? 'a' : 'b';
        const count = Number.parseInt(badge.textContent.replace(/\D/g, ''), 10) || 0;
        const previous = counts.get(badge.id) || 0;
        counts.set(badge.id, count);
        const currentState = gameState();
        const name = team === 'a' ? currentState?.teamA?.name : currentState?.teamB?.name;
        if (count >= 5) {
          warnings.push(`${name || `Team ${team.toUpperCase()}`} has ${count} team fouls.`);
          badge.setAttribute('aria-describedby', foulStatus.id);
        } else {
          badge.removeAttribute('aria-describedby');
        }
        if (count > previous && count >= 5) foulStatus.textContent = `Foul warning. ${warnings[warnings.length - 1]}`;
      });
      if (!warnings.length) foulStatus.textContent = '';
      else if (!foulStatus.textContent) foulStatus.textContent = `Foul warning. ${warnings.join(' ')}`;
    };

    const observer = new MutationObserver(sync);
    badges.forEach(badge => observer.observe(badge, { childList: true, characterData: true, subtree: true }));
    sync();
    observers.push(observer);
  }

  function wireHotHand() {
    const banner = document.getElementById('run-banner');
    if (!banner) return;
    const sync = () => {
      const supported = banner.classList.contains('active') && Boolean(banner.textContent.trim());
      if (supported) {
        banner.dataset.motionLabel = 'HOT HAND';
        banner.setAttribute('aria-label', `Hot hand. ${banner.textContent.replace(/🔥/g, '').trim()}`);
      } else {
        delete banner.dataset.motionLabel;
        banner.removeAttribute('aria-label');
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(banner, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
    sync();
    observers.push(observer);
  }

  function wireComeback(comeback) {
    const scoreA = document.getElementById('t-score-a');
    const scoreB = document.getElementById('t-score-b');
    if (!scoreA || !scoreB || !comeback) return;
    let latestKey = scoreEventKey(gameState());

    const sync = () => {
      const currentState = gameState();
      const nextKey = scoreEventKey(currentState);
      if (nextKey === latestKey) return;
      latestKey = nextKey;
      if (!currentState || currentState.gameOver || reducedMotion()) return;
      const signal = detectComeback(currentState);
      if (!signal) return;

      comeback.textContent = `Comeback alert · ${signal.teamName} erased a ${signal.erased}-point deficit`;
      comeback.style.setProperty('--cc-comeback-color', signal.team === 'a' ? 'var(--ca)' : 'var(--cb)');
      comeback.classList.remove('hidden');
      replayClass(comeback, 'cc-motion-comeback-in', 1250);
      schedule('comeback:hide', () => comeback.classList.add('hidden'), 1300);
    };

    const observer = new MutationObserver(sync);
    observer.observe(scoreA, { childList: true, characterData: true, subtree: true });
    observer.observe(scoreB, { childList: true, characterData: true, subtree: true });
    observers.push(observer);
  }

  function wireRoutesAndVictory() {
    let activeScreen = document.querySelector('.screen.active');
    const overlay = document.getElementById('pg-overlay');
    const targets = Array.from(document.querySelectorAll('.screen'));
    if (overlay) targets.push(overlay);

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        const target = mutation.target;
        if (target.classList?.contains('screen') && target.classList.contains('active') && target !== activeScreen) {
          activeScreen = target;
          replayClass(target, 'cc-motion-route-in', 500);
        }
      });
    });
    targets.forEach(target => observer.observe(target, { attributes: true, attributeFilter: ['class'] }));
    observers.push(observer);
  }

  function annotateBracket() {
    const body = document.getElementById('tourn-tab-body');
    if (!body) return;
    const winners = Array.from(body.querySelectorAll('.fixture-card')).filter(card => card.querySelector('.fx-badge.played'));
    winners.forEach((card, index) => {
      card.classList.add('cc-bracket-winner');
      card.style.setProperty('--cc-bracket-delay', `${Math.min(index, 5) * 40}ms`);
      replayClass(card, 'cc-motion-bracket-advance', 440 + (Math.min(index, 5) * 40));
    });
  }

  function wireBracket() {
    const body = document.getElementById('tourn-tab-body');
    if (!body) return;
    const observer = new MutationObserver(annotateBracket);
    observer.observe(body, { childList: true });
    observers.push(observer);
  }

  function reactionEmoji(button) {
    const text = button.textContent.trim();
    if (text.startsWith('👍')) return '👍';
    if (text.startsWith('🔥')) return '🔥';
    if (text.startsWith('👏')) return '👏';
    return '';
  }

  function wireReactions() {
    document.addEventListener('click', event => {
      const button = event.target.closest('.react-btn');
      if (!button || button.disabled || reducedMotion()) return;
      const emoji = reactionEmoji(button);
      if (!emoji) return;
      const rect = button.getBoundingClientRect();
      const float = document.createElement('span');
      float.className = 'cc-reaction-float';
      float.setAttribute('aria-hidden', 'true');
      float.textContent = emoji;
      float.style.setProperty('--cc-reaction-x', `${rect.left + (rect.width / 2)}px`);
      float.style.setProperty('--cc-reaction-y', `${rect.top}px`);
      document.body.appendChild(float);
      schedule(`reaction:${Date.now()}:${Math.random()}`, () => float.remove(), 760);
    }, true);
  }

  function init() {
    const { comeback, foulStatus } = createStatusNodes();
    wirePeriodAndPossession();
    wireFeedMotion();
    wireFoulStatus(foulStatus);
    wireHotHand();
    wireComeback(comeback);
    wireRoutesAndVictory();
    wireBracket();
    wireReactions();
    document.documentElement.dataset.motionFoundation = VERSION;
  }

  window.CourtCallMotionFoundation = Object.freeze({
    VERSION,
    reducedMotion,
    detectComeback
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

}());
