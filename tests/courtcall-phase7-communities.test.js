'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const communities = require(path.join(root, 'courtcall-communities.js'));
const html = read('index.html');
const sw = read('basketball-sw.js');
const migration = read('supabase/migrations/20260817000000_phase7_community_permissions.sql');

const publicCommunity = {
  id: 'court-1', name: 'Night Runs', visibility: 'public', createdBy: 'owner'
};
const context = (role, userId = role, extra = {}) => ({
  community: publicCommunity, role, userId, ...extra
});

test('legacy community records normalize without renaming the established model', () => {
  const community = communities.normalizeCommunity({
    id: 'legacy', name: ' Legacy Court ', emoji: '🌙', creator_id: 'owner',
    visibility: 'hidden', join_policy: 'invite', member_count: '4',
    read_only: 1, comments_locked: true, ratings_disabled: true
  });
  assert.equal(community.name, 'Legacy Court');
  assert.equal(community.logo, '🌙');
  assert.equal(community.createdBy, 'owner');
  assert.equal(community.joinPolicy, 'invite_only');
  assert.equal(community.memberCount, 4);
  assert.equal(community.readOnly, true);

  const post = communities.normalizePost({
    id: 'p1', community_id: 'legacy', user_id: 'u1', author_name: 'Player',
    content: 'Legacy body', image_url: 'https://example.test/a.webp',
    comments: [{ id: 'c1', author_id: 'u2', author_name: 'Coach', text: 'Good run' }]
  });
  assert.equal(post.communityId, 'legacy');
  assert.equal(post.body, 'Legacy body');
  assert.equal(post.comments[0].body, 'Good run');
  const join = communities.normalizeJoinRequest({ id: 'j1', community_id: 'legacy', user_id: 'u3', profile_name: 'Rook', requested_at: '2026-08-17' });
  assert.equal(join.communityId, 'legacy');
  assert.equal(join.profileId, 'u3');
  assert.equal(join.status, 'pending');
});

test('the documented role matrix gates community actions', () => {
  const { ACTIONS: A, can } = communities;
  assert.equal(can(A.VIEW, context('guest')), true);
  assert.equal(can(A.POST, context('member')), true);
  assert.equal(can(A.COMMENT, context('member')), true);
  assert.equal(can(A.REACT, context('member')), true);
  assert.equal(can(A.RATE, context('member')), true);
  assert.equal(can(A.RSVP, context('member')), true);
  assert.equal(can(A.ADD_PLAYER, context('member')), false);
  assert.equal(can(A.ADD_PLAYER, context('contributor')), true);
  assert.equal(can(A.ADD_GALLERY, context('contributor')), true);
  assert.equal(can(A.CREATE_EVENT, context('contributor')), true);
  assert.equal(can(A.EDIT_POST, context('member', 'member', { entity: { authorId: 'member' } })), true);
  assert.equal(can(A.DELETE_POST, context('member', 'member', { entity: { authorId: 'member' } })), true);
  assert.equal(can(A.PIN_POST, context('member')), false);
  assert.equal(can(A.PIN_POST, context('admin')), true);
  assert.equal(can(A.DELETE_COMMENT, context('member', 'member', { entity: { authorId: 'member' } })), true);
  assert.equal(can(A.DELETE_COMMENT, context('guest', 'member', { entity: { authorId: 'member' } })), false);
  assert.equal(can(A.MANAGE_JOIN, context('admin')), true);
  assert.equal(can(A.MANAGE_JOIN, context('contributor')), false);
  assert.equal(can(A.EDIT_SETTINGS, context('contributor')), false);
  assert.equal(can(A.EDIT_SETTINGS, context('admin')), true);
  assert.equal(can(A.DELETE_COMMUNITY, context('admin')), false);
  assert.equal(can(A.DELETE_COMMUNITY, context('member', 'owner')), true);
  assert.equal(can(A.LEAVE, context('member')), true);
  assert.equal(can(A.LEAVE, context('admin')), false);
});

test('locks and private visibility are enforced by the shared permission contract', () => {
  const { ACTIONS: A, can } = communities;
  assert.equal(can(A.VIEW, { community: { ...publicCommunity, visibility: 'private' }, role: 'guest', userId: 'visitor' }), false);
  assert.equal(can(A.VIEW, { community: { ...publicCommunity, visibility: 'private' }, role: 'member', userId: 'member' }), true);
  assert.equal(can(A.POST, { community: { ...publicCommunity, readOnly: true }, role: 'member', userId: 'member' }), false);
  assert.equal(can(A.POST, { community: { ...publicCommunity, readOnly: true }, role: 'admin', userId: 'admin' }), true);
  assert.equal(can(A.EDIT_POST, { community: { ...publicCommunity, readOnly: true }, role: 'member', userId: 'member', entity: { authorId: 'member' } }), false);
  assert.equal(can(A.COMMENT, { community: { ...publicCommunity, commentsLocked: true }, role: 'member', userId: 'member' }), false);
  assert.equal(can(A.RATE, { community: { ...publicCommunity, ratingsDisabled: true }, role: 'member', userId: 'member' }), false);
});

test('owner, self-management and entity ownership protections are explicit', () => {
  const { ACTIONS: A, can } = communities;
  const ownerTarget = { communityId: 'court-1', profileId: 'owner', role: 'admin' };
  const otherTarget = { communityId: 'court-1', profileId: 'member-2', role: 'member' };
  assert.equal(can(A.CHANGE_ROLE, context('admin', 'admin-1', { targetMember: ownerTarget })), false);
  assert.equal(can(A.REMOVE_MEMBER, context('admin', 'member-2', { targetMember: otherTarget })), false);
  assert.equal(can(A.CHANGE_ROLE, context('admin', 'admin-1', { targetMember: otherTarget })), true);
  assert.equal(can(A.EDIT_PLAYER, context('contributor', 'contrib', { entity: { createdBy: 'contrib' } })), true);
  assert.equal(can(A.EDIT_PLAYER, context('contributor', 'contrib', { entity: { createdBy: 'other' } })), false);
  assert.equal(can(A.DELETE_EVENT, context('member', 'member', { entity: { createdBy: 'member' } })), false);
  assert.equal(can(A.DELETE_EVENT, context('contributor', 'contrib', { entity: { createdBy: 'contrib' } })), true);
});

test('duplicate names are case-insensitive and scoped without corrupting edits', () => {
  const records = [
    { id: 'p1', communityId: 'a', name: 'Jordan' },
    { id: 'p2', communityId: 'b', name: 'Jordan' }
  ];
  assert.equal(communities.duplicateName(records, ' jordan ', 'a'), true);
  assert.equal(communities.duplicateName(records, 'Jordan', 'a', 'p1'), false);
  assert.equal(communities.duplicateName(records, 'Jordan', 'c'), false);
});

test('generated IDs resist same-millisecond collisions', () => {
  assert.match(communities.createId('post'), /^post_[a-z0-9]+_[a-z0-9]+$/);
  const first = communities.createId('post', [], 1000, () => 0);
  const second = communities.createId('post', [first], 1000, () => 0);
  assert.notEqual(second, first);
  assert.match(first, /^post_[a-z0-9]+_[a-z0-9]+$/);
});

test('leaderboards use shared ranks for ties and require three games for win rate', () => {
  const players = [
    { id: 'b', communityId: 'c', name: 'Beta', points: 20, gamesPlayed: 2, wins: 2 },
    { id: 'a', communityId: 'c', name: 'Alpha', points: 20, gamesPlayed: 4, wins: 3 },
    { id: 'c', communityId: 'c', name: 'Charlie', points: 10, gamesPlayed: 5, wins: 2 }
  ];
  const scoring = communities.rankPlayers(players, [], 'scoring');
  assert.deepEqual(scoring.map(row => [row.player.name, row.rank]), [['Alpha', 1], ['Beta', 1], ['Charlie', 3]]);
  const winRate = communities.rankPlayers(players, [], 'winrate');
  assert.deepEqual(winRate.map(row => row.player.name), ['Alpha', 'Charlie']);
  assert.match(html, /if\(tab==='leaderboard'&&activeCommTab!=='leaderboard'\)lbCategory='rating'/);
});

test('all specified event labels and legacy times round-trip safely', () => {
  const mappings = [
    ['Pickup Game', 'pickup'], ['Tournament', 'tournament'],
    ['Practice Session', 'practice'], ['Social Event', 'social'],
    ['Training Camp', 'training'], ['Watch Party', 'watch']
  ];
  for (const [label, databaseValue] of mappings) {
    assert.equal(communities.eventTypeToDb(label), databaseValue);
    assert.equal(communities.normalizeEventType(databaseValue), label);
  }
  assert.equal(communities.eventTimeInput('9:05 PM'), '21:05');
  assert.equal(communities.eventTimeInput('09:05'), '09:05');
  assert.equal(communities.eventTimeInput('25:00'), '');
  assert.equal(communities.parseEventDateTime({ date: '2026-08-17', time: '9:05 PM' }).getHours(), 21);
});

test('production keeps every established localStorage key and caches the community contract', () => {
  for (const key of [
    'courtcall_communities', 'courtcall_community_members', 'courtcall_community_joins',
    'courtcall_community_posts', 'courtcall_community_players', 'courtcall_community_gallery',
    'courtcall_community_events', 'courtcall_community_ratings'
  ]) assert.match(html, new RegExp(key));
  assert.match(html, /<script src="\.\/courtcall-communities\.js\?v=20260821"><\/script>/);
  assert.match(sw, /CACHE_VERSION = 'v53'/);
  assert.match(sw, /'\.\/courtcall-communities\.js\?v=20260821'/);
});

test('creation validates, persists the creator as admin and routes to detail', () => {
  assert.match(html, /async function createCommunity\(\)/);
  assert.match(html, /CommunityContract\.duplicateName\(getComms\(\),name\)/);
  assert.match(html, /role:'admin'/);
  assert.match(html, /if\(!setComms\(communities\)\)/);
  assert.match(html, /openCommunity\(community\.id\)/);
  assert.match(html, /supaCreateCommunity\(community,member\)/);
  assert.match(html, /supaCreateCommunity rollback failed/);
});

test('feed writes are guarded, duplicate-safe and use atomic member RPCs', () => {
  assert.match(html, /async function reactPost[\s\S]*?requireCommunityAction\(COMM_ACTION\.REACT/);
  assert.match(html, /async function submitComment[\s\S]*?post-comment:\$\{postId\}/);
  assert.match(html, /supaSetPostReaction\(postId,emoji,active\)/);
  assert.match(html, /supaAddPostComment\(postId,comment\)/);
  assert.match(html, /supaDeletePostComment\(postId,commentId\)/);
  for (const action of ['EDIT_POST', 'DELETE_POST', 'PIN_POST', 'REMOVE_POST_PHOTO']) {
    assert.match(html, new RegExp(`(?:requireCommunityAction|CommunityContract\\.can)\\(COMM_ACTION\\.${action}`), `${action} needs a shared permission check`);
  }
  assert.match(html, /requireCommunityAction\(COMM_ACTION\.DELETE_COMMENT,post\.communityId/);
  assert.doesNotMatch(html.match(/async function reactPost[\s\S]*?function toggleComments/)?.[0] || '', /supaUpdatePost/);
  assert.match(migration, /from public\.community_posts as post where post\.id = p_post_id for update;/i);
  assert.match(migration, /current_user_is_community_member\(target_community_id\)/i);
});

test('member, player and settings mutations recheck permissions in their handlers', () => {
  for (const action of ['CHANGE_ROLE', 'REMOVE_MEMBER', 'ADD_PLAYER', 'EDIT_PLAYER', 'DELETE_PLAYER', 'EDIT_SETTINGS', 'DELETE_COMMUNITY']) {
    assert.match(html, new RegExp(`(?:requireCommunityAction|canCommunity)\\(COMM_ACTION\\.${action}`), `${action} needs a handler guard`);
  }
  assert.match(html, /CommunityContract\.duplicateName\(all,name,p\.communityId,p\.id\)/);
  assert.match(html, /gallery\.forEach\(item=>\{const next=\(item\.taggedPlayers\|\|\[\]\)\.filter\(id=>id!==playerId\)/);
  assert.match(html, /uiConfirm\(`Delete "\$\{c\.name\}"[\s\S]*?\{phrase:c\.name\}\)/);
  assert.match(html, /requireCommunityAction\(COMM_ACTION\.CHANGE_ROLE,communityId,\{targetMember:m\}\)/);
});

test('gallery and event writes keep optimistic UX while surfacing cloud failures', () => {
  assert.match(html, /supaSetGalleryLike\(itemId,pos===-1\)/);
  assert.match(html, /supaAddGalleryComment\(itemId,comment\)/);
  assert.match(html, /supaDeleteGalleryComment\(itemId,cmtId\)/);
  assert.match(html, /async function submitEvent/);
  assert.match(html, /supaUpdateEvent\(evt\.id/);
  assert.match(html, /CommunityContract\.parseEventDateTime\((?:e|evt)\)/);
  assert.match(html, /secure cloud sync failed/);
});

test('community deep links hydrate an unknown cloud record before falling back', () => {
  assert.match(html, /async function _hydrateCommunityDeepLink\(communityId\)/);
  assert.match(html, /decision\.route==='community'&&decision\.reason==='unknown_community'[\s\S]*?_hydrateCommunityDeepLink\(decision\.communityId\)/);
  assert.match(html, /_screenToHash[\s\S]*?encodeURIComponent\(activeCommunityId\)/);
});

test('join, leave and approval flows fail closed before local membership changes', () => {
  assert.match(html, /function getAllJoinReqs\(\)\{return _readCommunityCollection\(KC\.joins,CommunityContract\.normalizeJoinRequest\)\}/);
  assert.match(html, /cloudCommunity&&await supaCreateJoinRequest\(newReq\)===false[\s\S]*?Nothing changed on this device/);
  assert.match(html, /cloudCommunity&&await supaJoinCommunity\(communityId\)===false[\s\S]*?Nothing changed on this device/);
  assert.match(html, /supaLeaveComm\(communityId\)===false[\s\S]*?cloud sync failed/);
  assert.match(html, /supaUpdateJoinRequest\(reqId,'approved'\)===false[\s\S]*?cloud sync failed/);
  assert.match(html, /members\.push\(\{id:_communityId\('mem',members\)/);
  assert.match(html, /requireCommunityAction\(COMM_ACTION\.MANAGE_JOIN,communityId/);
  assert.doesNotMatch(html, /localCommunity\?\.localOnly\|\|\(!isSupaAuthenticated\(\)&&localCommunity\)/);
});

test('Phase 7 migration protects owners, contributor boundaries and embedded JSON writes', () => {
  assert.match(migration, /old\.user_id = community_owner[\s\S]*?owner role is protected/i);
  assert.match(migration, /new\.role not in \('admin', 'contributor', 'member'\)/i);
  assert.match(migration, /before delete on public\.community_members/i);
  assert.match(migration, /cp: contributor insert guard/i);
  assert.match(migration, /gal: contributor insert guard/i);
  assert.match(migration, /events: contributor insert guard/i);
  assert.match(migration, /cp: contributor (?:update|delete) guard/i);
  assert.match(migration, /gal: contributor (?:update|delete) guard/i);
  assert.match(migration, /events: contributor (?:update|delete) guard/i);
  assert.match(migration, /ratings: enabled insert guard/i);
  assert.match(migration, /posts: read-only insert guard/i);
  assert.match(migration, /posts: edit guard/i);
  assert.match(migration, /posts: delete guard/i);
  for (const rpc of [
    'set_community_post_reaction', 'add_community_post_comment', 'delete_community_post_comment',
    'set_community_gallery_like', 'add_community_gallery_comment', 'delete_community_gallery_comment'
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`, 'i'));
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}`, 'i'));
    assert.match(html, new RegExp(`'${rpc}'`));
  }
});

test('small-screen community layouts contain their dense controls', () => {
  assert.match(html, /@media\(max-width:420px\)[\s\S]*?\.gal-grid\{grid-template-columns:1fr/);
  assert.match(html, /\.member-card\{align-items:flex-start;flex-wrap:wrap/);
  assert.match(html, /\.join-req-card\{align-items:flex-start;flex-wrap:wrap/);
  assert.match(html, /\.member-role-select\{flex:1;max-width:none/);
  const inlineCss = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
  const clean = inlineCss.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((clean.match(/\{/g) || []).length, (clean.match(/\}/g) || []).length);
});
