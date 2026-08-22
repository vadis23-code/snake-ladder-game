(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CourtCallAuth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_COOLDOWN_MS = 60000;

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
  }

  function normalizeOtp(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 6);
  }

  function maskEmail(value) {
    const email = normalizeEmail(value);
    const at = email.lastIndexOf('@');
    if (at < 1) return email;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    const visible = local.length <= 2 ? 1 : 2;
    return `${local.slice(0, visible)}${'•'.repeat(Math.max(2, local.length - visible))}@${domain}`;
  }

  function errorText(error) {
    return `${error?.code || ''} ${error?.message || ''} ${error?.name || ''}`.toLowerCase();
  }

  function mapAuthError(error, phase, online) {
    const text = errorText(error);
    const status = Number(error?.status || 0);
    if (online === false || /failed to fetch|network|offline|fetcherror|aborterror/.test(text)) {
      return phase === 'send'
        ? 'You’re offline. Connect to the internet to request a code.'
        : 'You’re offline. Connect to the internet to verify your code.';
    }
    if (status === 429 || /rate.?limit|too many|over_email_send_rate_limit|over_request_rate_limit/.test(text)) {
      return 'Too many attempts. Please wait and try again.';
    }
    if (phase === 'verify') return 'Incorrect or expired code.';
    return 'We couldn’t send a code right now. Try again shortly.';
  }

  function createRequestGate(options) {
    const config = options || {};
    const now = typeof config.now === 'function' ? config.now : Date.now;
    const cooldownMs = Number.isFinite(config.cooldownMs) && config.cooldownMs >= 0
      ? config.cooldownMs
      : DEFAULT_COOLDOWN_MS;
    let sendInFlight = false;
    let verifyInFlight = false;
    let resendAt = 0;

    return Object.freeze({
      beginSend: function () {
        if (sendInFlight || now() < resendAt) return false;
        sendInFlight = true;
        return true;
      },
      finishSend: function (successful) {
        sendInFlight = false;
        if (successful) resendAt = now() + cooldownMs;
      },
      beginVerify: function () {
        if (verifyInFlight) return false;
        verifyInFlight = true;
        return true;
      },
      finishVerify: function () {
        verifyInFlight = false;
      },
      reset: function () {
        sendInFlight = false;
        verifyInFlight = false;
        resendAt = 0;
      },
      remainingMs: function () {
        return Math.max(0, resendAt - now());
      },
      snapshot: function () {
        return Object.freeze({ sendInFlight, verifyInFlight, resendAt });
      }
    });
  }

  async function requestEmailOtp(client, value, options) {
    if (!client?.auth?.signInWithOtp) throw new TypeError('Supabase OTP is unavailable');
    const email = normalizeEmail(value);
    const config = options || {};
    return client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        ...(config.emailRedirectTo ? { emailRedirectTo: config.emailRedirectTo } : {}),
        ...(config.data && typeof config.data === 'object' ? { data: config.data } : {})
      }
    });
  }

  async function verifyEmailOtp(client, value, code) {
    if (!client?.auth?.verifyOtp) throw new TypeError('Supabase OTP verification is unavailable');
    return client.auth.verifyOtp({
      email: normalizeEmail(value),
      token: normalizeOtp(code),
      type: 'email'
    });
  }

  async function restoreSession(client) {
    if (!client?.auth?.getSession) return null;
    const result = await client.auth.getSession();
    if (result?.error) throw result.error;
    const session = result?.data?.session || null;
    return session?.access_token && session?.user?.id ? session : null;
  }

  async function signOut(client) {
    if (!client?.auth?.signOut) return { error: null };
    return client.auth.signOut();
  }

  function profileName(user, remote, cached) {
    const metadataName = String(user?.user_metadata?.name || '').trim();
    const emailPrefix = normalizeEmail(user?.email).split('@')[0] || 'Player';
    return String(remote?.name || cached?.name || metadataName || emailPrefix || 'Player').trim() || 'Player';
  }

  function resolveProfile(input) {
    const source = input || {};
    const user = source.user || {};
    if (!user.id) throw new TypeError('Authenticated user ID is required');
    const remote = source.remoteProfile?.id === user.id ? source.remoteProfile : null;
    const cached = source.cachedProfile?.id === user.id ? source.cachedProfile : null;
    const name = profileName(user, remote, cached);
    const remoteCreated = remote?.created_at || remote?.createdAt;
    const cachedCreated = cached?.createdAt || cached?.created_at;
    const gamesPlayed = Math.max(
      Number(cached?.gamesPlayed || cached?.games_played || 0) || 0,
      Number(remote?.games_played || remote?.gamesPlayed || 0) || 0
    );
    const profile = {
      ...(cached || {}),
      id: user.id,
      email: normalizeEmail(user.email || cached?.email),
      name,
      nickname: String(remote?.nickname || cached?.nickname || name).trim() || name,
      avatar: remote?.avatar || cached?.avatar || '',
      jerseyNumber: remote?.jersey_number || remote?.jerseyNumber || cached?.jerseyNumber || '',
      position: remote?.position || cached?.position || '',
      preferredGameType: remote?.preferred_game_type || remote?.preferredGameType || cached?.preferredGameType || '',
      skillInfo: remote?.skill_info || remote?.skillInfo || cached?.skillInfo || '',
      gamesPlayed,
      createdAt: cachedCreated || remoteCreated || source.createdAt || new Date().toISOString(),
      localOnly: false
    };
    delete profile.pinHash;
    delete profile.pinVerifier;
    return Object.freeze({
      profile: Object.freeze(profile),
      reusedExisting: Boolean(remote || cached),
      needsRemoteCreate: !remote
    });
  }

  return Object.freeze({
    DEFAULT_COOLDOWN_MS,
    normalizeEmail,
    isValidEmail,
    normalizeOtp,
    maskEmail,
    mapAuthError,
    createRequestGate,
    requestEmailOtp,
    verifyEmailOtp,
    restoreSession,
    signOut,
    resolveProfile
  });
});
