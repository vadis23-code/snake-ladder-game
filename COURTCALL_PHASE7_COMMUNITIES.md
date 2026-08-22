# CourtCall Phase 7 — Communities

**Status:** Complete, locally verified, and stopped before Phase 8  
**Canonical production entry point:** `index.html`  
**Production URL tested:** `http://127.0.0.1:8765/`  
**Verification date:** 2026-08-21  
**Starting checkpoint:** Phase 6, 132 tests passed  
**Final checkpoint:** 149 tests passed, 0 failed  
**Commit/push:** Not performed

## 1. Audit findings

The existing application already contained a broad Communities implementation inside `index.html`: directory and creation screens, Community Detail, Feed, Members, Players, Gallery, Events, Leaderboard, Settings, local persistence, and Supabase adapters. Its visual treatment already matched the local-court MIDNIGHT ARENA system and did not require a redesign.

The main audit issue was not missing surface area; it was inconsistent enforcement and normalization. Role checks were distributed across rendering and event handlers, legacy records were read in several shapes, some writes could claim local success after an unsafe or failed cloud operation, and embedded reaction/comment JSON could require overly broad row updates. Deep-link hydration, duplicate prevention, collision-safe IDs, storage failure reporting, tie handling, and narrow-mobile containment also needed hardening.

The canonical application remains `index.html`. `basketball.html` was not modified. Community work did not change game rules, tournament calculations, global authentication, or unrelated storage models.

## 2. Gaps fixed

- Added one reusable Communities contract for normalization, IDs, roles, permissions, event types/times, duplicate detection, and leaderboard ranking.
- Rechecked permissions inside mutation handlers instead of relying only on hidden buttons.
- Distinguished creator/owner protection from the stored `admin`, `contributor`, and `member` roles.
- Protected the owner from removal, downgrade, and self-leave; protected administrators from accidental self-removal/leave.
- Made join, leave, approval, deletion, and cloud-only operations fail closed when the remote write is required and fails.
- Added safe unknown-community deep-link hydration before falling back.
- Made community creation case-insensitive for duplicates, collision-safe, rollback-aware, and route directly to Community Detail.
- Added duplicate submission locks for posts, comments, gallery comments, events, and other repeated writes.
- Replaced cross-member direct JSON updates for reactions/comments/likes with authenticated, row-locked RPCs.
- Enforced read-only posts, comment locks, rating disablement, contributor ownership boundaries, and post/member protections in both client rules and the Phase 7 migration.
- Completed player validation, duplicate prevention, complete manual statistics, rating normalization, and cleanup of deleted player references in gallery tags/ratings.
- Normalized all six current event types and legacy time values; preserved upcoming/past and capacity behavior.
- Corrected leaderboard category persistence, shared ranks for ties, and the minimum three-game rule for win-rate rankings.
- Added visible localStorage quota/error handling and retained established keys.
- Added narrow-screen wrapping and a one-column phone gallery without page-level overflow.
- Final verification found a real PWA defect: a new `index.html` could be paired with the older stale-while-revalidate community module for one load, temporarily hiding owner post controls. The module URL is now versioned as `courtcall-communities.js?v=20260821`, and the service-worker generation is `v48`. First-reload verification showed Pin/Edit/Delete immediately.

## 3. Files changed

Phase 7 implementation and documentation:

- `index.html` — Community routes, UI, handlers, local/cloud behavior, permission checks, responsive fixes, and versioned contract load.
- `courtcall-communities.js` — shared Communities normalization and permission contract.
- `basketball-sw.js` — caches the versioned contract and uses cache generation `v48`.
- `supabase/migrations/20260817000000_phase7_community_permissions.sql` — owner/member guards, RLS restrictions, and atomic RPCs.
- `tests/courtcall-phase7-communities.test.js` — 17 focused Phase 7 tests.
- `COURTCALL_PHASE7_COMMUNITIES.md` — this report.

Cache-generation assertions were updated in:

- `tests/courtcall-design-foundation.test.js`
- `tests/courtcall-global-visual-system.test.js`
- `tests/courtcall-landing-hub-separation.test.js`
- `tests/courtcall-phase4-core-game.test.js`
- `tests/courtcall-phase5-team-history.test.js`
- `tests/courtcall-phase6-tournaments.test.js`
- `tests/courtcall-visual-motion-foundation.test.js`

No change was made to `basketball.html`.

## 4. Community creation

Creation supports the existing fields only: name, type, country/state/city/area, optional home court, optional regular-run details, description, emoji identity, visibility, and approval policy. Required names are trimmed and validated; duplicates are case-insensitive. IDs include a random suffix and are checked against existing IDs.

The creator is persisted as the creator/owner and an `admin` member. Local save failure is visible. Cloud creation occurs only when authenticated sync is approved; failure does not claim remote success, and a failed creator-member insert attempts to roll back the community row.

Browser result: `Phase 7 Verification Court 2026-08-21` routed immediately to:

`http://127.0.0.1:8765/#/community/community_mt34r4lx_1k5hb`

## 5. Community detail

Community Detail exposes identity, location/type, description, visibility, role, member count, invite control for authorized users, and all seven tabs: Feed, Members, Players, Gallery, Events, Leaderboard, and Settings. Hash routing is preserved.

The direct detail URL above was reloaded repeatedly. The same community, post, player, gallery item, event, RSVP, and updated description remained available, confirming local reload persistence. Unknown cloud IDs first attempt a narrow remote hydration and otherwise fail safely.

## 6. Feed

The established post types remain available: General Post, Announcement, Match Result, Upcoming Game, Tournament Update, Photo Post, Player Spotlight, Poll, MVP Vote, Training Tip, and Court Update.

Feed behavior now covers create, edit-own, delete-own/admin, pin-admin, remove-photo-admin, timestamps, author identity, reactions, comments, empty state, read-only mode, comment lock, duplicate submission prevention, and persistence. Removed/non-members cannot keep mutating old content through client permissions. Base64 post images stay local; HTTP(S) image URLs may sync.

Browser verification created a post, added a like and comment, reloaded the deep link, and retained all three. Owner controls displayed Pin, Edit, and Delete after the cache fix.

## 7. Members

The member list shows identity, join date, and role. The owner is represented by `communities.createdBy`/`creator_id` plus an admin membership row; there is no incompatible new stored `owner` role. UI copy displays `Owner · Admin`.

Open join, approval requests, invite codes, leave, approve/reject, role changes, and removals preserve existing behavior. Cloud-backed membership changes fail closed before local membership is changed. The owner cannot be removed or downgraded. An administrator cannot remove self through the role controls, and owners/admins cannot leave until ownership/role is safely resolved.

Browser verification confirmed the one-member owner state and absence of inappropriate self-management controls.

## 8. Players

Community players support name, nickname, jersey number, photo URL, position, badges, games, wins, losses, points, MVP count, edit, removal, and the existing seven rating attributes: shooting, defense, passing, speed, teamwork, clutch, and sportsmanship.

Names are duplicate-checked within a community. Numeric validation prevents impossible or negative records. Deleting a player removes that player's ratings and removes stale gallery tags while leaving historical post text intact. Stable IDs and field normalization preserve compatibility with existing records; no automatic Team/History mutation was invented.

Browser verification added `Verification Guard` (`Clamps`, PG, #7) with 4 games, 3 wins, 1 loss, 42 points, and 1 MVP. The premium player card and owner Edit/Delete controls rendered correctly.

## 9. Gallery

Gallery retains the existing albums, captions, player tags, likes, comments, URL mode, and local file mode. Admins and contributors can add; admins can manage any item; contributors can manage only their own item. Likes/comments require membership, and comment locks are respected.

HTTP(S) URL items can sync to the existing table. Base64 file uploads remain local by design; no unsupported storage service was added. Invalid protocols are rejected, images have accessible alternatives, and broken images show the existing placeholder.

Browser verification covered empty state and a URL item tagged to the test player. The grid rendered as one column at 320/390 and two columns at the three larger sizes.

## 10. Events

The exact supported labels are Pickup Game, Tournament, Practice Session, Social Event, Training Camp, and Watch Party. Current and legacy database aliases normalize safely. Events retain title, description, date, time, court/location, capacity, creator, RSVP collection, upcoming/past filters, edit, and delete.

RSVP statuses remain Going, Maybe, Can't Go, Need Team, and Running Late. Capacity cannot be reduced below the existing Going count. Edit/delete permissions follow admin-any and contributor-own boundaries.

Browser verification created a future Practice Session at Verification Gym with capacity 10, selected Going, and displayed authorized Edit/Delete controls.

## 11. Leaderboard

Leaderboards use only current community players and ratings. Categories are Overall Rating, Top Scorers, Most Games, Win Rate, MVP Count, and Sportsmanship. Rankings recalculate from current reads, so new local results do not leave a cached ranking.

Equal values receive shared competition ranks (for example 1, 1, 3). Win Rate excludes players with fewer than three games. Gold/silver/bronze treatment follows the rank. No undocumented performance tie-break was added; equal-stat rows use a stable alphabetical presentation only.

Browser verification switched from Overall Rating to Top Scorers and displayed Verification Guard at rank 1 with 42 points. The category no longer resets during the tab rerender.

## 12. Settings

Authorized administrators can edit name, description, visibility, and approval policy. Existing moderation controls cover read-only posting, comment lock, and rating disablement. Settings do not modify global CourtCall settings.

Only the creator/owner can delete the community. Deletion requires confirmation including the exact community name and removes only that community's local dependent records after any required cloud deletion succeeds.

Browser verification changed the description, saved, reloaded the direct deep link, and found the updated value. Owner-only Delete Community and all three moderation controls were present.

## 13. Permission matrix

`Owner` below means the community creator, resolved as an admin with additional protection.

| Action | Owner | Admin | Contributor | Member | Guest/non-member |
|---|---:|---:|---:|---:|---:|
| View public community | Yes | Yes | Yes | Yes | Yes |
| View private/hidden community | Yes | Yes | Yes | Yes | No, unless admitted/invited |
| Create post | Yes | Yes | Yes | Yes | No |
| Create post in read-only mode | Yes | Yes | No | No | No |
| Edit own post | Yes | Yes | Yes | Yes | No |
| Delete own post/comment | Yes | Yes | Yes | Yes | No |
| Delete any post/comment; pin; remove post photo | Yes | Yes | No | No | No |
| React/comment/RSVP | Yes | Yes | Yes | Yes | No |
| Add player/gallery/event | Yes | Yes | Yes | No | No |
| Edit/delete any player/gallery/event | Yes | Yes | No | No | No |
| Edit/delete contributor-owned player/gallery/event | Yes | Yes | Yes | No | No |
| Rate player when ratings enabled | Yes | Yes | Yes | Yes | No |
| Approve/reject joins | Yes | Yes | No | No | No |
| Change another member's role | Yes | Yes | No | No | No |
| Remove another non-owner member | Yes | Yes | No | No | No |
| Leave community | No | No | Yes | Yes | Not applicable |
| Edit settings/moderation | Yes | Yes | No | No | No |
| Delete community | Yes | No | No | No | No |

Role controls are a usability layer, not a substitute for RLS. Mutation handlers recheck the same client contract, and remote authorization remains server-side.

## 14. Supabase/RLS findings

Existing table and column names are preserved:

- `communities`: `id`, `creator_id`, `name`, `description`, `type`, `visibility`, `logo`, `location`, `invite_code`, and compatible `join_policy`.
- `community_members`: `community_id`, `user_id`, `role`, `profile_name`.
- `community_posts`: `id`, `community_id`, `user_id`, `author_name`, `title`, `content`, `image_url`, `type`, `reactions`, `comments`, `pinned`, timestamps.
- `community_players`: identity, creator, nickname/jersey/photo/position/badges, and existing stat columns.
- `community_ratings`: player/community/rater plus the seven rating attributes and timestamps.
- `community_gallery`: uploader, URL, caption, album, tags, likes, comments, timestamp.
- `community_events`: creator, title/description, date/time, location, type, capacity, RSVP JSON, timestamp.
- `community_join_requests`: community, user/profile, status, and request timestamp.

The Phase 7 migration adds restrictive policies/guards for contributor ownership, read-only posts, post edit/delete membership, ratings disablement, owner member protection, settings updates, and deletion. Six authenticated, row-locked RPCs perform post reactions/comments and gallery likes/comments. The functions use qualified names, an empty `search_path`, explicit `auth.uid()`/membership checks, revoke default execution, and grant only their authenticated signatures.

Live Supabase was not reachable during browser verification. The production app reported `Failed to fetch` from `_doSyncCommunitiesFromDB`; it did not claim a successful remote write. Therefore the migration file and adapter mappings are statically/test verified, but deployment, advisors, and multi-account RLS behavior remain environment-dependent.

## 15. Data compatibility

No established localStorage key was renamed:

- `courtcall_communities`
- `courtcall_community_members`
- `courtcall_community_joins`
- `courtcall_community_posts`
- `courtcall_community_players`
- `courtcall_community_gallery`
- `courtcall_community_events`
- `courtcall_community_ratings`

Records normalize on read across camelCase/database snake_case fields, moderator-to-contributor legacy roles, creator aliases, event type aliases, 12-hour/24-hour times, comment body/text aliases, and legacy visibility/join-policy values. Normalization does not delete or silently rewrite the original store. Writes keep the established application shape.

Local-only records are retained when cloud reads fail or omit unsynced IDs. Cloud-backed destructive membership/deletion flows do not modify local state when the required remote operation fails. localStorage quota failures produce a visible error instead of silent loss.

## 16. Responsive verification

Every tab was opened at every requested size. `document.scrollWidth` and the active Community Detail screen's `scrollWidth` equaled their client width in all 35 tab/viewport combinations.

| Requested viewport | Page overflow | Community tabs | Gallery |
|---|---|---|---|
| 320×568 | None | Local horizontal strip: 279px client / 543px scroll | 1 column, 281px |
| 390×844 | None | Local horizontal strip: 349–364px client / 543px scroll | 1 column, 351px |
| 844×390 | None | Fully contained | 2 columns, 395.5px each |
| 768×1024 | None | Fully contained | 2 columns, 357.5px each |
| 1440×900 | None | Fully contained in max-width content | 2 columns, 541px each |

The local tab/filter rows intentionally scroll on narrow phones; they do not create page-level overflow. Member roles, player actions, event cards, leaderboard rows, and settings controls remained usable at each size.

## 17. Test results

Automated verification:

- Root JavaScript syntax checks: passed.
- `index.html` inline script parse: passed.
- Focused Phase 7 suite: 17 passed, 0 failed.
- Final full regression suite: **149 passed, 0 failed**.
- Static ID/accessibility/cache assertions: passed as part of the full suite.

Production browser verification at `http://127.0.0.1:8765/` covered:

- creation and correct deep-link routing;
- all seven detail tabs;
- feed create/reaction/comment and reload persistence;
- owner/member role presentation and permission controls;
- player create and statistics;
- gallery empty/add/render/tag state;
- event create/RSVP/edit-delete visibility;
- leaderboard category switching and source value;
- settings save and reload persistence;
- direct-link reload;
- all five responsive sizes;
- service-worker/module freshness on first reload after the `v48` fix.

No new Phase 7 JavaScript errors occurred. The only console errors were repeated Supabase directory `Failed to fetch` messages caused by unavailable connectivity, clearly separated from locally verified behavior.

## 18. Remaining limitations

1. The Phase 7 migration has not been applied to or queried against a reachable live Supabase project in this environment. Production migration execution, database advisors, and authenticated cross-account RLS tests remain required before a cloud release.
2. Browser testing used the existing local `Guest` profile as the community owner. Anonymous/non-member, promotion/demotion, join approval, removal, and contributor-own-versus-other UI cases are covered by the permission contract and automated tests but require separate signed-in accounts for live browser validation.
3. Base64 gallery/post uploads intentionally remain local; only URL media uses the current database mapping. No unsupported Supabase Storage infrastructure was added.
4. The specification defines no further leaderboard tie-break after equal values. Shared ranks and stable alphabetical presentation are documented rather than inventing a formula.
5. The browser-created local fixture `Phase 7 Verification Court 2026-08-21` remains on this device with its verification post, player, gallery item, and event; no destructive cleanup was performed.
6. The optional `community_players`, `community_ratings`, and `community_gallery` tables must already exist in the target project; the Phase 7 migration conditionally protects them and does not redesign or create their schemas.

Phase 8 was not started.
