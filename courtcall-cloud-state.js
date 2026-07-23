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
    OFFLINE_SAVED: 'offline_saved', FAILED: 'failed'
  });

  function classifyError(error) {
    if (!error) return VIEW.ERROR;
    const code = String(error.code || error.status || '').toLowerCase();
    const message = String(error.message || error).toLowerCase();
    if (code === '401' || message.includes('not authenticated') || message.includes('jwt')) return VIEW.AUTH_REQUIRED;
    if (code === '403' || code === '42501' || message.includes('permission') || message.includes('row-level security')) return VIEW.PERMISSION_DENIED;
    return VIEW.ERROR;
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
      [SYNC.FAILED]: 'Sync failed · Retry'
    };
    return copy[state] || copy[SYNC.FAILED];
  }

  return Object.freeze({ VIEW, SYNC, classifyError, communityCopy, syncCopy });
}));
