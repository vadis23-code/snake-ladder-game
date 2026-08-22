(function courtCallCommunitiesModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CourtCallCommunities = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCourtCallCommunities() {
  'use strict';

  const ROLES = Object.freeze({
    ADMIN: 'admin',
    CONTRIBUTOR: 'contributor',
    MEMBER: 'member',
    GUEST: 'guest'
  });

  const ACTIONS = Object.freeze({
    VIEW: 'view', POST: 'post', COMMENT: 'comment', DELETE_COMMENT: 'delete_comment',
    REACT: 'react', RATE: 'rate', RSVP: 'rsvp',
    EDIT_POST: 'edit_post', DELETE_POST: 'delete_post', PIN_POST: 'pin_post',
    REMOVE_POST_PHOTO: 'remove_post_photo',
    ADD_PLAYER: 'add_player', EDIT_PLAYER: 'edit_player', DELETE_PLAYER: 'delete_player',
    ADD_GALLERY: 'add_gallery', DELETE_GALLERY: 'delete_gallery',
    CREATE_EVENT: 'create_event', EDIT_EVENT: 'edit_event', DELETE_EVENT: 'delete_event',
    CHANGE_ROLE: 'change_role', REMOVE_MEMBER: 'remove_member', MANAGE_JOIN: 'manage_join',
    EDIT_SETTINGS: 'edit_settings', DELETE_COMMUNITY: 'delete_community', LEAVE: 'leave'
  });

  const RATING_ATTRS = Object.freeze(['shooting', 'defense', 'passing', 'speed', 'teamwork', 'clutch', 'sportsmanship']);
  const RSVP_STATUSES = Object.freeze(['going', 'maybe', 'not_going', 'need_team', 'running_late']);
  const EVENT_TYPE_TO_DB = Object.freeze({
    'Pickup Game': 'pickup', Tournament: 'tournament', 'Practice Session': 'practice',
    'Training Camp': 'training', 'Social Event': 'social', 'Watch Party': 'watch', Other: 'other'
  });
  const EVENT_TYPE_FROM_DB = Object.freeze({
    pickup: 'Pickup Game', pickup_game: 'Pickup Game', tournament: 'Tournament',
    practice: 'Practice Session', practice_session: 'Practice Session',
    training: 'Training Camp', training_camp: 'Training Camp',
    social: 'Social Event', social_event: 'Social Event',
    watch: 'Watch Party', watch_party: 'Watch Party', other: 'Other'
  });

  function text(value, fallback = '') {
    return value === undefined || value === null ? fallback : String(value);
  }

  function boundedText(value, max, fallback = '') {
    return text(value, fallback).trim().slice(0, max);
  }

  function finiteNonNegative(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function normalizeRole(value) {
    const role = text(value).trim().toLowerCase();
    if (role === 'admin') return ROLES.ADMIN;
    if (role === 'contributor' || role === 'moderator') return ROLES.CONTRIBUTOR;
    if (role === 'member') return ROLES.MEMBER;
    return ROLES.GUEST;
  }

  function normalizeVisibility(value) {
    const visibility = text(value).trim().toLowerCase();
    return ['public', 'private', 'hidden'].includes(visibility) ? visibility : 'public';
  }

  function normalizeJoinPolicy(value, visibility, approval) {
    const policy = text(value).trim().toLowerCase();
    if (['open', 'approval', 'invite_only'].includes(policy)) return policy;
    if (policy === 'invite') return 'invite_only';
    if (visibility === 'hidden') return 'invite_only';
    if (visibility === 'private' || approval === true) return 'approval';
    return 'open';
  }

  function normalizeCommunity(record) {
    const source = safeObject(record);
    const visibility = normalizeVisibility(source.visibility);
    const joinApproval = source.joinApproval ?? source.join_approval ?? (source.join_policy === 'approval');
    const joinPolicy = normalizeJoinPolicy(source.joinPolicy ?? source.join_policy, visibility, Boolean(joinApproval));
    return {
      ...source,
      id: boundedText(source.id, 160),
      name: boundedText(source.name, 50, 'Untitled Community') || 'Untitled Community',
      description: boundedText(source.description, 600),
      type: boundedText(source.type, 80, 'Pickup Group') || 'Pickup Group',
      logo: boundedText(source.logo ?? source.emoji, 16, '🏀') || '🏀',
      visibility,
      joinPolicy,
      joinApproval: joinPolicy === 'approval',
      inviteCode: source.inviteCode ?? source.invite_code ?? null,
      createdBy: source.createdBy ?? source.creator_id ?? source.ownerId ?? null,
      createdAt: source.createdAt ?? source.created_at ?? '',
      memberCount: finiteNonNegative(source.memberCount ?? source.member_count, 0),
      readOnly: Boolean(source.readOnly ?? source.read_only),
      commentsLocked: Boolean(source.commentsLocked ?? source.comments_locked),
      ratingsDisabled: Boolean(source.ratingsDisabled ?? source.ratings_disabled),
      location: boundedText(source.location, 160),
      country: boundedText(source.country, 80),
      state: boundedText(source.state, 80),
      city: boundedText(source.city, 80),
      area: boundedText(source.area, 80),
      court: boundedText(source.court, 120)
    };
  }

  function normalizeMember(record) {
    const source = safeObject(record);
    const communityId = source.communityId ?? source.community_id;
    const profileId = source.profileId ?? source.user_id;
    return {
      ...source,
      id: boundedText(source.id || `${communityId || ''}_${profileId || ''}`, 340),
      communityId: boundedText(communityId, 160),
      profileId: boundedText(profileId, 160),
      profileName: boundedText(source.profileName ?? source.profile_name, 120, 'Unknown') || 'Unknown',
      role: normalizeRole(source.role) === ROLES.GUEST ? ROLES.MEMBER : normalizeRole(source.role),
      joinedAt: source.joinedAt ?? source.joined_at ?? ''
    };
  }

  function normalizeJoinRequest(record) {
    const source = safeObject(record);
    const status = boundedText(source.status, 24).toLowerCase();
    return {
      ...source,
      id: boundedText(source.id, 180),
      communityId: boundedText(source.communityId ?? source.community_id, 160),
      profileId: source.profileId ?? source.user_id ?? null,
      profileName: boundedText(source.profileName ?? source.profile_name, 120, 'Unknown') || 'Unknown',
      requestedAt: source.requestedAt ?? source.requested_at ?? '',
      reviewedAt: source.reviewedAt ?? source.reviewed_at ?? '',
      status: ['pending', 'approved', 'rejected'].includes(status) ? status : 'pending'
    };
  }

  function normalizeComment(record, kind = 'post') {
    const source = safeObject(record);
    const content = source.body ?? source.text ?? source.content ?? '';
    const normalized = {
      ...source,
      id: boundedText(source.id, 180),
      authorId: source.authorId ?? source.author_id ?? null,
      authorName: boundedText(source.authorName ?? source.author_name, 120, 'Unknown') || 'Unknown',
      createdAt: source.createdAt ?? source.created_at ?? ''
    };
    if (kind === 'gallery') normalized.text = boundedText(content, 200);
    else normalized.body = boundedText(content, 200);
    return normalized;
  }

  function normalizePost(record) {
    const source = safeObject(record);
    const reactions = safeObject(source.reactions);
    return {
      ...source,
      id: boundedText(source.id, 180),
      communityId: boundedText(source.communityId ?? source.community_id, 160),
      authorId: source.authorId ?? source.user_id ?? null,
      authorName: boundedText(source.authorName ?? source.author_name, 120, 'Unknown') || 'Unknown',
      title: boundedText(source.title, 80),
      body: boundedText(source.body ?? source.content ?? source.text, 600),
      imageUrl: text(source.imageUrl ?? source.image_url),
      type: boundedText(source.type, 80, 'General Post') || 'General Post',
      reactions: {
        like: safeArray(reactions.like).map(String),
        fire: safeArray(reactions.fire).map(String),
        clap: safeArray(reactions.clap).map(String)
      },
      comments: safeArray(source.comments).map(comment => normalizeComment(comment)),
      pinned: Boolean(source.pinned),
      createdAt: source.createdAt ?? source.created_at ?? ''
    };
  }

  function normalizePlayer(record) {
    const source = safeObject(record);
    return {
      ...source,
      id: boundedText(source.id, 180),
      communityId: boundedText(source.communityId ?? source.community_id, 160),
      name: boundedText(source.name, 40, 'Unknown') || 'Unknown',
      nickname: boundedText(source.nickname, 20),
      jerseyNumber: boundedText(source.jerseyNumber ?? source.jersey_num ?? source.jersey_number, 4),
      photoUrl: text(source.photoUrl ?? source.photo_url),
      position: boundedText(source.position, 12, 'PG') || 'PG',
      badges: safeArray(source.badges).map(String),
      gamesPlayed: finiteNonNegative(source.gamesPlayed ?? source.games_played),
      wins: finiteNonNegative(source.wins),
      losses: finiteNonNegative(source.losses),
      points: finiteNonNegative(source.points ?? source.total_score),
      mvpCount: finiteNonNegative(source.mvpCount ?? source.mvp_count),
      createdBy: source.createdBy ?? source.creator_id ?? source.created_by ?? null,
      createdAt: source.createdAt ?? source.created_at ?? ''
    };
  }

  function normalizeRating(record) {
    const source = safeObject(record);
    const rating = {
      ...source,
      id: boundedText(source.id, 180),
      playerId: boundedText(source.playerId ?? source.player_id, 180),
      communityId: boundedText(source.communityId ?? source.community_id, 160),
      raterProfileId: source.raterProfileId ?? source.rater_id ?? null,
      createdAt: source.createdAt ?? source.created_at ?? '',
      updatedAt: source.updatedAt ?? source.updated_at ?? ''
    };
    RATING_ATTRS.forEach(attribute => {
      const value = Number(source[attribute]);
      rating[attribute] = Number.isFinite(value) && value >= 1 && value <= 5 ? value : 0;
    });
    return rating;
  }

  function normalizeGalleryItem(record) {
    const source = safeObject(record);
    return {
      ...source,
      id: boundedText(source.id, 180),
      communityId: boundedText(source.communityId ?? source.community_id, 160),
      imageSourceType: source.imageSourceType === 'upload' ? 'upload' : 'url',
      imageData: text(source.imageData),
      imageUrl: text(source.imageUrl ?? source.image_url),
      fileName: boundedText(source.fileName, 180),
      caption: boundedText(source.caption, 300),
      album: boundedText(source.album, 80, 'General') || 'General',
      taggedPlayers: safeArray(source.taggedPlayers ?? source.tagged_players).map(String),
      uploadedBy: source.uploadedBy ?? source.uploader_id ?? null,
      uploaderName: boundedText(source.uploaderName ?? source.uploader_name, 120, 'Unknown') || 'Unknown',
      likes: safeArray(source.likes).map(String),
      comments: safeArray(source.comments).map(comment => normalizeComment(comment, 'gallery')),
      createdAt: source.createdAt ?? source.created_at ?? ''
    };
  }

  function normalizeEventType(value) {
    const source = boundedText(value, 60, 'Pickup Game');
    return EVENT_TYPE_FROM_DB[source.toLowerCase()] || source || 'Pickup Game';
  }

  function eventTypeToDb(value) {
    return EVENT_TYPE_TO_DB[normalizeEventType(value)] || 'other';
  }

  function normalizeEvent(record) {
    const source = safeObject(record);
    return {
      ...source,
      id: boundedText(source.id, 180),
      communityId: boundedText(source.communityId ?? source.community_id, 160),
      title: boundedText(source.title, 80, 'Untitled Event') || 'Untitled Event',
      description: boundedText(source.description, 500),
      type: normalizeEventType(source.type ?? source.event_type),
      date: boundedText(source.date ?? source.event_date, 24),
      time: boundedText(source.time ?? source.event_time, 24),
      location: boundedText(source.location, 160),
      maxPlayers: finiteNonNegative(source.maxPlayers ?? source.max_attendees ?? source.max_players),
      createdBy: source.createdBy ?? source.creator_id ?? null,
      creatorName: boundedText(source.creatorName ?? source.creator_name, 120),
      createdAt: source.createdAt ?? source.created_at ?? '',
      rsvps: safeArray(source.rsvps).map(item => ({
        ...item,
        profileId: item.profileId ?? item.profile_id ?? null,
        profileName: boundedText(item.profileName ?? item.name ?? item.profile_name, 120, 'Unknown') || 'Unknown',
        status: RSVP_STATUSES.includes(item.status) ? item.status : 'maybe'
      }))
    };
  }

  function normalizeList(value, normalizer) {
    return safeArray(value).map(normalizer).filter(item => item.id);
  }

  function isOwner(community, userId) {
    return Boolean(community && userId && text(community.createdBy ?? community.creator_id) === text(userId));
  }

  function isMemberRole(role) {
    return [ROLES.ADMIN, ROLES.CONTRIBUTOR, ROLES.MEMBER].includes(normalizeRole(role));
  }

  function can(action, context = {}) {
    const community = normalizeCommunity(context.community || {});
    const userId = context.userId == null ? '' : text(context.userId);
    const owner = isOwner(community, userId);
    const role = owner ? ROLES.ADMIN : normalizeRole(context.role);
    const target = context.targetMember ? normalizeMember(context.targetMember) : null;
    const entity = safeObject(context.entity);
    const member = isMemberRole(role);
    const admin = role === ROLES.ADMIN;
    const contributor = role === ROLES.CONTRIBUTOR;
    const entityOwner = userId && text(entity.authorId ?? entity.uploadedBy ?? entity.createdBy ?? entity.creatorId) === userId;

    switch (action) {
      case ACTIONS.VIEW: return community.visibility === 'public' || member || owner;
      case ACTIONS.POST: return member && (!community.readOnly || admin);
      case ACTIONS.EDIT_POST: return member && entityOwner && (!community.readOnly || admin);
      case ACTIONS.DELETE_POST: return admin || (member && entityOwner);
      case ACTIONS.PIN_POST:
      case ACTIONS.REMOVE_POST_PHOTO: return admin;
      case ACTIONS.COMMENT: return member && (!community.commentsLocked || admin);
      case ACTIONS.DELETE_COMMENT: return admin || (member && entityOwner);
      case ACTIONS.REACT:
      case ACTIONS.RSVP: return member;
      case ACTIONS.RATE: return member && !community.ratingsDisabled;
      case ACTIONS.ADD_PLAYER:
      case ACTIONS.ADD_GALLERY:
      case ACTIONS.CREATE_EVENT: return admin || contributor;
      case ACTIONS.EDIT_PLAYER:
      case ACTIONS.DELETE_PLAYER: return admin || (contributor && entityOwner);
      case ACTIONS.DELETE_GALLERY:
      case ACTIONS.EDIT_EVENT:
      case ACTIONS.DELETE_EVENT: return admin || (contributor && entityOwner);
      case ACTIONS.CHANGE_ROLE:
      case ACTIONS.REMOVE_MEMBER:
        return admin && Boolean(target) && target.profileId !== userId && !isOwner(community, target.profileId);
      case ACTIONS.MANAGE_JOIN: return admin;
      case ACTIONS.EDIT_SETTINGS: return admin;
      case ACTIONS.DELETE_COMMUNITY: return owner;
      case ACTIONS.LEAVE: return member && !admin && !owner;
      default: return false;
    }
  }

  function duplicateName(records, name, communityId, excludeId) {
    const wanted = boundedText(name, 120).toLocaleLowerCase();
    if (!wanted) return false;
    return safeArray(records).some(record => {
      if (excludeId && text(record.id) === text(excludeId)) return false;
      if (communityId !== undefined && text(record.communityId ?? record.community_id) !== text(communityId)) return false;
      return boundedText(record.name, 120).toLocaleLowerCase() === wanted;
    });
  }

  function createId(prefix, existingIds = [], now = Date.now(), random = Math.random) {
    const used = new Set(safeArray(existingIds).map(String));
    const cleanPrefix = boundedText(prefix, 24, 'item').replace(/[^a-z0-9_-]/gi, '') || 'item';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = Math.floor(Number(random()) * 0xFFFFFF).toString(36).padStart(5, '0');
      const id = `${cleanPrefix}_${Number(now).toString(36)}_${suffix}${attempt || ''}`;
      if (!used.has(id)) return id;
    }
    return `${cleanPrefix}_${Number(now).toString(36)}_${used.size.toString(36)}`;
  }

  function ratingAverage(ratings, attribute) {
    const values = safeArray(ratings).map(rating => Number(rating[attribute])).filter(value => value >= 1 && value <= 5);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  }

  function rankPlayers(players, ratings, category) {
    const allRatings = normalizeList(ratings, normalizeRating);
    let ranked = normalizeList(players, normalizePlayer).map(player => {
      const playerRatings = allRatings.filter(rating => rating.playerId === player.id);
      let value = null;
      let unit = '';
      if (category === 'rating') {
        const values = RATING_ATTRS.map(attribute => ratingAverage(playerRatings, attribute)).filter(item => item !== null);
        value = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;
        unit = 'avg';
      } else if (category === 'scoring') { value = player.points; unit = 'pts'; }
      else if (category === 'games') { value = player.gamesPlayed; unit = 'games'; }
      else if (category === 'winrate') { value = player.gamesPlayed >= 3 ? Math.round((player.wins / player.gamesPlayed) * 100) : null; unit = '%'; }
      else if (category === 'mvp') { value = player.mvpCount; unit = 'MVPs'; }
      else if (category === 'sport') { value = ratingAverage(playerRatings, 'sportsmanship'); unit = 'avg'; }
      return { player, numericValue: value, unit };
    }).filter(item => item.numericValue !== null && (['rating', 'sport'].includes(category) || item.numericValue > 0));

    ranked.sort((left, right) => right.numericValue - left.numericValue
      || left.player.name.localeCompare(right.player.name, undefined, { sensitivity: 'base' })
      || left.player.id.localeCompare(right.player.id));
    ranked = ranked.slice(0, 10);
    let previousValue = null;
    let sharedRank = 0;
    return ranked.map((item, index) => {
      if (previousValue === null || item.numericValue !== previousValue) sharedRank = index + 1;
      previousValue = item.numericValue;
      const value = ['rating', 'sport'].includes(category) ? item.numericValue.toFixed(1) : item.numericValue;
      return { ...item, rank: sharedRank, value };
    });
  }

  function eventTimeInput(value) {
    let time = boundedText(value, 20);
    const twelveHour = time.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (twelveHour) {
      let hour = Number(twelveHour[1]) % 12;
      if (twelveHour[3].toUpperCase() === 'PM') hour += 12;
      time = `${String(hour).padStart(2, '0')}:${twelveHour[2]}`;
    }
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '';
  }

  function parseEventDateTime(event) {
    const normalized = normalizeEvent(event);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.date)) return null;
    const time = eventTimeInput(normalized.time) || '23:59';
    const date = new Date(`${normalized.date}T${time}:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return Object.freeze({
    ROLES, ACTIONS, RATING_ATTRS, RSVP_STATUSES,
    normalizeRole, normalizeCommunity, normalizeMember, normalizeJoinRequest, normalizeComment, normalizePost,
    normalizePlayer, normalizeRating, normalizeGalleryItem, normalizeEvent, normalizeList,
    normalizeEventType, eventTypeToDb, isOwner, isMemberRole, can, duplicateName, createId,
    ratingAverage, rankPlayers, eventTimeInput, parseEventDateTime
  });
});
