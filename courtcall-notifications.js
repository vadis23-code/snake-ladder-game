(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CourtCallNotifications = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TYPES = Object.freeze({
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFORMATION: 'information'
  });
  const VALID_TYPES = new Set(Object.values(TYPES));
  let sequence = 0;

  function normalizeType(type) {
    const value = String(type || TYPES.INFORMATION).trim().toLowerCase();
    if (value === 'info') return TYPES.INFORMATION;
    return VALID_TYPES.has(value) ? value : TYPES.INFORMATION;
  }

  function createId() {
    sequence += 1;
    return `cc_notice_${Date.now()}_${sequence}`;
  }

  function normalizeNotification(message, options) {
    const config = options && typeof options === 'object' ? options : {};
    const duration = Number(config.duration);
    return Object.freeze({
      id: String(config.id || createId()),
      message: String(message || '').trim(),
      type: normalizeType(config.type),
      source: String(config.source || 'global'),
      duration: Number.isFinite(duration) && duration >= 0 ? duration : 4000,
      persistent: Boolean(config.persistent)
    });
  }

  function createManager(options) {
    const config = options || {};
    const element = config.element || null;
    const getRoute = typeof config.getRoute === 'function' ? config.getRoute : function () { return 'global'; };
    const setTimer = config.setTimer || setTimeout;
    const clearTimer = config.clearTimer || clearTimeout;
    let active = null;
    let timer = null;

    function render(notification) {
      if (!element) return;
      element.textContent = notification.message;
      element.dataset.notificationId = notification.id;
      element.dataset.source = notification.source;
      element.dataset.type = notification.type;
      element.classList.remove('success', 'error', 'warning', 'information');
      element.classList.add(notification.type, 'show');
      element.setAttribute('role', notification.type === TYPES.ERROR || notification.type === TYPES.WARNING ? 'alert' : 'status');
      element.setAttribute('aria-live', notification.type === TYPES.ERROR || notification.type === TYPES.WARNING ? 'assertive' : 'polite');
      element.setAttribute('aria-atomic', 'true');
    }

    function dismiss(id) {
      if (!active || (id && active.id !== id)) return false;
      if (timer) clearTimer(timer);
      timer = null;
      active = null;
      if (element) {
        element.classList.remove('show', 'success', 'error', 'warning', 'information');
        element.textContent = '';
        delete element.dataset.notificationId;
        delete element.dataset.source;
        delete element.dataset.type;
      }
      return true;
    }

    function notify(message, options) {
      dismiss();
      const supplied = options && typeof options === 'object' ? options : {};
      const notification = normalizeNotification(message, Object.assign({ source: getRoute() }, supplied));
      if (!notification.message) return null;
      active = notification;
      render(notification);
      if (!notification.persistent && notification.duration > 0) {
        timer = setTimer(function () { dismiss(notification.id); }, notification.duration);
      }
      return notification;
    }

    function clearForRoute(nextRoute) {
      if (!active || active.persistent) return false;
      if (active.source === 'global' || active.source === String(nextRoute || '')) return false;
      return dismiss(active.id);
    }

    return Object.freeze({
      notify,
      dismiss,
      clearForRoute,
      getActive: function () { return active; }
    });
  }

  return Object.freeze({ TYPES, normalizeNotification, createManager });
}));
