(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CourtCallCloudState = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VIEW = Object.freeze({
    LOADING: 'loading', RESULTS: 'results', EMPTY: 'empty', OFFLINE: 'offline',
    ERROR: 'error', AUTH_REQUIRED: 'auth_required', PERMISSION_DENIED: 'permission_denied',
    SYNC_PENDING: 'sync_pending'
  });
  const SYNC = Object.freeze({
    ONLINE_SYNCED: 'online_synced', ONLINE_LOCAL: 'online_local', SAVING_LOCAL: 'saving_local', SYNCING: 'syncing',
    OFFLINE_SAVED: 'offline_saved', FAILED: 'failed',
    AUTH_REQUIRED: 'auth_required', PERMISSION_DENIED: 'permission_denied'
  });
  // Phase 11 failure taxonomy: every cloud error resolves to exactly one class
  // so the UI can never present a network failure as "empty" or "synced".
  const FAILURE = Object.freeze({
    OFFLINE: 'offline', TIMEOUT: 'timeout', AUTH_REQUIRED: 'auth_required',
    PERMISSION_DENIED: 'permission_denied', SERVER_UNAVAILABLE: 'server_unavailable', UNKNOWN: 'unknown'
  });

  function classifyError(error) {
    if (!error) return VIEW.ERROR;
    const code = String(error.code || error.status || '').toLowerCase();
    const message = String(error.message || error).toLowerCase();
    if (code === '401' || message.includes('not authenticated') || message.includes('jwt')) return VIEW.AUTH_REQUIRED;
    if (code === '403' || code === '42501' || message.includes('permission') || message.includes('row-level security')) return VIEW.PERMISSION_DENIED;
    return VIEW.ERROR;
  }

  function classifyFailure(error, options) {
    const online = !options || options.online !== false;
    if (!online) return FAILURE.OFFLINE;
    const code = String(error?.code || error?.status || '').toLowerCase();
    const name = String(error?.name || '').toLowerCase();
    const message = String(error?.message || error || '').toLowerCase();
    if (code === 'timeout' || name === 'timeouterror' || name === 'aborterror' || message.includes('timed out') || message.includes('timeout')) return FAILURE.TIMEOUT;
    if (code === '401' || message.includes('not authenticated') || message.includes('jwt')) return FAILURE.AUTH_REQUIRED;
    if (code === '403' || code === '42501' || message.includes('permission') || message.includes('row-level security')) return FAILURE.PERMISSION_DENIED;
    if (/^5\d\d$/.test(code) || message.includes('failed to fetch') || message.includes('networkerror') || message.includes('network request failed') || message.includes('unavailable') || message.includes('load failed')) return FAILURE.SERVER_UNAVAILABLE;
    return FAILURE.UNKNOWN;
  }

  function failureMessage(kind) {
    const copy = {
      [FAILURE.OFFLINE]: 'You’re offline. Changes stay saved on this device and sync resumes when you reconnect.',
      [FAILURE.TIMEOUT]: 'The cloud is responding slowly. Your data stays saved on this device — retry in a moment.',
      [FAILURE.AUTH_REQUIRED]: 'Sign in to use cloud sync. Everything stays saved on this device.',
      [FAILURE.PERMISSION_DENIED]: 'Your account doesn’t have permission for that cloud change.',
      [FAILURE.SERVER_UNAVAILABLE]: 'The cloud service is unreachable right now. Your data stays saved on this device.',
      [FAILURE.UNKNOWN]: 'Cloud sync hit an unexpected problem. Your data stays saved on this device.'
    };
    return copy[kind] || copy[FAILURE.UNKNOWN];
  }

  // Maps a failure class onto the sync indicator without ever claiming success.
  function syncStateForFailure(kind) {
    if (kind === FAILURE.OFFLINE) return SYNC.OFFLINE_SAVED;
    if (kind === FAILURE.AUTH_REQUIRED) return SYNC.AUTH_REQUIRED;
    if (kind === FAILURE.PERMISSION_DENIED) return SYNC.PERMISSION_DENIED;
    return SYNC.FAILED;
  }

  // Auth and permission failures must never be retried blindly; offline waits
  // for the reconnect event instead of burning attempts.
  function isRetryableFailure(kind) {
    return kind === FAILURE.TIMEOUT || kind === FAILURE.SERVER_UNAVAILABLE || kind === FAILURE.UNKNOWN;
  }

  function retryDelayMs(attempt, baseMs, capMs) {
    const base = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : 800;
    const cap = Number.isFinite(capMs) && capMs > 0 ? capMs : 8000;
    const step = Math.max(1, Math.floor(attempt) || 1);
    return Math.min(cap, base * Math.pow(2, step - 1));
  }

  function timeoutError(label) {
    const error = new Error(`${label || 'Cloud request'} timed out`);
    error.name = 'TimeoutError';
    error.code = 'timeout';
    return error;
  }

  // Wraps any thenable (Supabase builders included) so a stalled request can
  // never leave the UI stuck in a loading/syncing state forever.
  function withTimeout(promiseLike, ms, label) {
    const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 12000;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; reject(timeoutError(label)); } }, timeoutMs);
      Promise.resolve(promiseLike).then(
        value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } },
        error => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } }
      );
    });
  }

  // Bounded retry with exponential backoff for idempotent operations only.
  // Attempts are hard-capped, auth/permission failures stop immediately, and
  // going offline mid-retry stops the loop instead of spinning.
  async function runWithRetry(operation, options) {
    const config = options || {};
    const attempts = Math.min(5, Math.max(1, Math.floor(config.attempts) || 3));
    const isOnline = typeof config.isOnline === 'function' ? config.isOnline : () => true;
    const sleep = typeof config.sleep === 'function' ? config.sleep : ms => new Promise(resolve => setTimeout(resolve, ms));
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error;
        const kind = classifyFailure(error, { online: isOnline() });
        if (error && typeof error === 'object') try { error.failureKind = kind; } catch (_) {}
        if (!isRetryableFailure(kind) || attempt >= attempts || !isOnline()) throw error;
        if (typeof config.onRetry === 'function') config.onRetry({ attempt, kind, error });
        await sleep(retryDelayMs(attempt, config.baseDelayMs, config.capDelayMs));
      }
    }
    throw lastError;
  }

  // ── Local-first storage safety helpers ─────────────────
  function safeJsonParse(raw, fallback) {
    if (typeof raw !== 'string' || raw === '') return fallback;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  // Recovers an id-keyed collection: drops non-object entries and duplicate
  // ids (first occurrence wins) while keeping every other record intact.
  function dedupeById(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    for (const item of list) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const id = item.id;
      if (id != null && id !== '') {
        const key = String(id);
        if (seen.has(key)) continue;
        seen.add(key);
      }
      result.push(item);
    }
    return result;
  }

  function communityCopy(state) {
    const copy = {
      [VIEW.LOADING]: { title: 'Loading public communities…', action: null },
      [VIEW.EMPTY]: { title: 'No public communities match your current filters.', action: null },
      [VIEW.OFFLINE]: { title: 'You’re offline. Your communities saved on this device are still available. Public community discovery will resume when you reconnect.', action: null },
      [VIEW.ERROR]: { title: 'We couldn’t load public communities.', action: 'Retry' },
      [VIEW.AUTH_REQUIRED]: { title: 'Sign in to load your cloud communities. Public groups saved on this device are still available.', action: 'Sign In' },
      [VIEW.PERMISSION_DENIED]: { title: 'You don’t have permission to view these communities.', action: null },
      [VIEW.SYNC_PENDING]: { title: 'Your community changes are saved on this device and waiting to sync.', action: 'Retry' }
    };
    return copy[state] || copy[VIEW.ERROR];
  }

  function syncCopy(state) {
    const copy = {
      [SYNC.ONLINE_SYNCED]: 'Online · Synced',
      [SYNC.ONLINE_LOCAL]: 'Online · Saved on this device',
      [SYNC.SAVING_LOCAL]: 'Saving locally…',
      [SYNC.SYNCING]: 'Syncing…',
      [SYNC.OFFLINE_SAVED]: 'Offline · Saved on this device',
      [SYNC.FAILED]: 'Sync failed · Retry',
      [SYNC.AUTH_REQUIRED]: 'Saved on this device · Sign in to sync',
      [SYNC.PERMISSION_DENIED]: 'Saved on this device · Cloud sync not permitted'
    };
    return copy[state] || copy[SYNC.FAILED];
  }

  return Object.freeze({
    VIEW, SYNC, FAILURE, classifyError, communityCopy, syncCopy,
    classifyFailure, failureMessage, syncStateForFailure, isRetryableFailure,
    retryDelayMs, withTimeout, runWithRetry, safeJsonParse, dedupeById
  });
}));
