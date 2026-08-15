# CourtCall Phase 1 Audit V2

**Audit date:** 4 August 2026  
**Scope:** read-only Phase 1 review of the complete CourtCall workspace, the three controlling documents, the supplied visual reference, the archived pre-rollback application, the active application, supporting scripts/assets, tests, deployment files, and all Supabase SQL/migrations.  
**Code changes:** none. This document is the only file added.  
**Evidence levels:** **Confirmed** = directly present in source/tests; **Tested** = exercised by the existing automated suite during this audit; **Inferred** = high-confidence static analysis that still needs browser/database verification; **Unverified** = requires a live browser, device, or Supabase project.

## 1. Executive conclusion

CourtCall is not the `basketball.html` single-file application described by the older specification. The current deployable product is a static PWA whose entry point is `index.html`, with four external JavaScript files (`basketball-supa.js`, `courtcall-core.js`, `courtcall-notifications.js`, `courtcall-cloud-state.js`), a service worker, a manifest, images, and an optional Supabase backend. `basketball.html` does not exist in this workspace.

The application is a broad, functioning beta rather than an empty redesign target. It has 19 static screen containers, 395 unique static IDs, 533 named function declarations across the active application/core modules, 11 Supabase tables plus one public directory view, three browser-callable RPCs, a local-first persistence layer, PWA behavior, and extensive game/team/tournament/community workflows. All 56 existing automated unit/static-contract tests passed during this audit.

The most important Phase 1 conclusions are:

1. The master prompt's explicit removal of the standalone Canvas basketball is a valid and isolatable override, but `icons/basketball-3d.webp` is not widget-only and must remain unless all of its other brand/UI uses are replaced.
2. The specification, current code, current deployment, and July world-class audit conflict on architecture, entry filename, auth direction, and schema naming. Those conflicts must be resolved before implementation.
3. Static duplicate IDs and named function declarations are currently clean. Runtime ID generation, global namespace scale, dynamically rendered controls, and repeated event wiring remain regression risks.
4. The current client matches the hardened July migrations more closely than it matches Section 10 of `COURTCALL_SPEC.md`; notably posts use `user_id`/`content`, events use `creator_id`/`event_date`, and the current community model adds `join_policy` and moderation fields.
5. LocalStorage key strings required by the spec are preserved, but the app adds compatibility/status keys. Identity-scoped data is still stored in global device keys; consent and full logout reduce risk, but true per-account namespaces are not implemented.
6. The six-digit PIN is still the remote Supabase password. Local-only PINs are PBKDF2-protected, but the online credential space remains weak.
7. The repository includes obsolete bootstrap SQL and permission scripts that are unsafe to treat as the current schema. Only the ordered migrations should be considered authoritative for an already-hardened project.
8. No redesign or Higgsfield generation should begin until Phase 2 records browser/device/Supabase baselines and the blocking architecture questions at the end of this document are answered.

## 2. Source precedence used for this audit

| Priority | Source | Audit interpretation |
|---:|---|---|
| 1 | `COURTCALL_SPEC.md` | Binding feature/data contract, except where explicitly overridden or demonstrably superseded by approved current compatibility behavior. |
| 2 | Existing working behavior | Preserved where it adds compatibility, security, accessibility, or corrected game semantics. |
| 3 | `CourtCall_Master_Higgsfield_Codex_3D_Scroll_Prompt_v2_No_Canvas_Basketball.md` | Binding visual/implementation direction and the explicit removal of the standalone Canvas basketball. |
| 4 | `COURTCALL_WORLD_CLASS_AUDIT.md` | Evidence and recommendations, not automatically a replacement technical contract. |
| 5 | PNG reference | Mood, lighting, density, and sectional-layout reference only; its words, scores, capabilities, and data are not requirements. |

The supplied PNG was inspected at full resolution. Its useful cues are the midnight-arena palette, orange/blue split lighting, large condensed display type, high-contrast score HUD, wide cinematic hero, sequential numbered story panels, and lower product-demo framing. It must not be used as proof for live standings, win probability, voice accuracy, tournament state, community volume, player data, or any other capability.

## 3. Existing file and architecture inventory

### 3.1 Active/deployable application

| File | Role | Current status / observations |
|---|---|---|
| `index.html` (722,185 B; 10,875 lines) | Active entry point; markup, approximately 169 KB inline CSS, approximately 439 KB inline application JS, content, routing and screens | Primary product. Contains 19 screens, 395 IDs, the standalone Canvas widget, auth, game, teams, tournaments, communities, settings, help, PWA registration and Supabase adapter calls. |
| `basketball-supa.js` (199,564 B, minified) | Vendored Supabase browser client | Loaded before app code. It is a current-style v2 bundle containing Auth/PostgREST/Storage/Realtime/Functions APIs and passkey code. Version is not pinned in a package manifest or documented in a source banner. |
| `courtcall-core.js` (40,049 B) | UMD framework-neutral domain module | Game outcomes/normalization, fouls, rematches, queue, team/tournament helpers, standings, hash resolution. Used by browser and Node tests. |
| `courtcall-cloud-state.js` (2,647 B) | UMD cloud/error-state classifier | Separates loading, results, empty, offline, auth, permission and error views; supplies honest sync copy. |
| `courtcall-notifications.js` (3,868 B) | UMD notification manager | Typed live-region/toast state and route clearing. |
| `basketball-sw.js` (4,074 B) | Service worker | Cache `courtcall-v15`; navigation network-first with 4 s timeout and cached root fallback; bounded 48-entry same-origin runtime cache; safe shell validation. |
| `basketball.manifest.json` (1,025 B) | PWA manifest | Root start/scope/id, standalone portrait-oriented sports app, 192/512/maskable icons, `/#/setup` shortcut. |
| `.github/workflows/deploy.yml` (1,786 B) | GitHub Pages deployment | Copies a curated artifact. Does **not** run the 56 tests or validation before deploy. Excludes SQL/tests/archive/source PNG. |
| `_redirects` (721 B) | Cloudflare path shielding/legacy redirects | Redirects repository internals, SQL, tests, legacy Snake/Ladder files, source PNG and backup archives to `/`. Redirect behavior is not a true 404/deny response. |
| `robots.txt` / `sitemap.xml` | Crawl configuration | Sitemap still advertises removed/redirected `snake-ladder.html` and stale `lastmod`; only root is a useful canonical URL. |

### 3.2 Assets

| File | Role / dependency |
|---|---|
| `icons/basketball-3d.webp` (44,586 B) | Shared live asset: onboarding/profile branding, header/avatar, footer mark, standalone widget texture, service-worker shell. Must not be deleted with widget code. |
| `icons/basketball-3d.png` (1,562,758 B) | Large source-only image; used by `tools/generate-icons.py` to regenerate the WebP; blocked from deployment. Not directly used by the active page. |
| `icons/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Installed-app icons. |
| `icons/icon.svg` | Source vector; referenced by old spec but excluded/redirected in current deploy. |
| `icons/social-card.png` | Open Graph/Twitter asset. |
| `a_wide_promotional_website_app_landing_page_mockup.png` (2,066,423 B) | Visual mood/layout reference only; not referenced by runtime. |

### 3.3 Database files

| File/group | Role | Risk classification |
|---|---|---|
| `supabase/migrations/20260713162416_community_access_hardening.sql` | Current hardening migration: private helpers, visibility guards, column grants, security-invoker directory view, invite RPCs, role/member protections | Authoritative ordered migration. |
| `supabase/migrations/20260713170000_client_schema_alignment.sql` | Adds current client columns, event identity trigger, restrictive event policies and atomic RSVP RPC | Authoritative ordered migration. |
| `supabase/migrations/20260723143500_legacy_definer_execution_lockdown.sql` | Revokes public/browser execution from trigger-only/compatibility definers | Authoritative ordered migration. |
| `supabase-full-setup.sql`, `supabase-schema.sql`, `supabase-communities.sql`, `supabase-missing-tables.sql`, `supabase-enhancements.sql`, `supabase-fix-permissions.sql`, `supabase-rls-audit.sql` | Historical/bootstrap/manual SQL layers | Not a single reproducible current schema. Several use legacy policies, broad grants, public `SECURITY DEFINER` helpers, or older columns. Never apply wholesale to the current production project. |

### 3.4 Tests, tooling, legacy and archive

| File/group | Role / finding |
|---|---|
| `tests/*.test.js` (6 files) | 56 tests covering core outcomes, tournament/queue/routing, cloud copy, notifications, security contracts, settings, unique static IDs, labels, and selected UX contracts. All passed. |
| `TESTING-INSTRUCTIONS.md` | Manual QA guide. Stale: old GitHub URL/project, obsolete flows, and Test 16 explicitly requires the widget that the controlling prompt removes. |
| `tools/generate-icons.py` | Generates PWA icons/social card and converts the source basketball PNG into shared WebP. Requires Pillow. Some generated copy (“NO SIGNUP”, “WORKS OFFLINE”) needs truth review. |
| `snake-ladder.html`, `style.css`, `game.js` | Unrelated legacy Snake and Ladder application. Excluded from the deploy artifact and redirected. |
| `backup-before-rollback-current-version-20260530-153108.zip` (untracked) | Archive containing an older `CourtCall/` static app (`index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, `assets/court-hero.png`, `assets/icon.svg`) and its nested Git history. It is reference/rollback material, not active runtime. |
| `.git/**` | Repository metadata, objects, refs, logs and standard sample hooks | Not application/runtime source. Existing working tree was clean except the untracked backup ZIP before this audit file was created. |

### 3.5 Current architecture diagram

```text
Browser / installed PWA
  index.html (19 pre-rendered screens + inline CSS/JS)
    -> basketball-supa.js (vendored Supabase client)
    -> courtcall-core.js (domain compatibility and calculations)
    -> courtcall-notifications.js (live UI messages)
    -> courtcall-cloud-state.js (sync/directory state model)
    -> localStorage (primary/offline device state)
    -> Supabase Auth + Data API + 3 RPCs (optional signed-in mirror)
    -> Web Speech / Audio / Vibration / Share / Clipboard APIs
  basketball-sw.js
    -> precached root, four JS files, manifest, basketball WebP
    -> bounded runtime asset cache
```

## 4. Screen, route, ID and function inventory

### 4.1 Screen and hash route inventory

| Static screen ID | Hash route | Access / behavior | Main renderer/action |
|---|---|---|---|
| `s-profile` | `#/profile` | Public; current cold default | `switchAuthMode`, `signIn`, `createAccount`, guest/local profile flows |
| `s-onboarding` | `#/onboarding` | Public | `showOnboarding`, `obAction`, `skipOnboarding` |
| `s-hub` | `#/hub` | Identity-gated; contains marketing mode and authenticated dashboard mode | `renderHub`, `renderAppDashboard` |
| `s-setup` | `#/setup` | Identity-gated | `goSetup`, `updateSetupSummary`, `handleStartGame` |
| `s-game` | `#/game` | Requires active saved/live game; resolver can resume | `renderGame`, scoring/clock/voice functions |
| `s-teams` | `#/teams` | Identity-gated | `renderTeamBuilder`, player/team/queue/captain-draft functions |
| `s-history` | `#/history` | Identity-gated | `renderHistory`, `openMatchDetail`, delete/share functions |
| `s-tournament` | `#/tournament` | Identity-gated; tournament detail is a state/tab in same screen, not a separate `s-tourn-detail` | `renderTournament`, `renderTournTab`, fixture functions |
| `s-communities` | `#/communities` | Public directory plus signed/local membership state | `renderCommunities`, cloud-state views |
| `s-comm-create` | `#/comm-create` | Gated by route resolver; contains invite-code join and creation | `createCommunity`, `joinCommunityByCode` |
| `s-comm-detail` | `#/community/{id}` | Dynamic known-ID route | `openCommunity`, `renderCommDetail`, seven tab renderers |
| `s-pulse` | `#/pulse` | Identity-gated | `renderPulse`; manual location/search shortcuts; demo feed |
| `s-world` | `#/world` | Public | Static curated external links/placeholders |
| `s-settings` | `#/settings` | Identity-gated | `renderSettings`, settings/data/account actions |
| `s-analytics` | `#/analytics` | Identity-gated | `renderAnalytics` |
| `s-help-center` | `#/help-center` | Identity-gated in current route resolver | `renderHelpCenter`, deterministic assistant functions |
| `s-privacy` | `#/privacy` | Public | Static legal screen |
| `s-terms` | `#/terms` | Public | Static legal screen |
| `s-reset-pin` | `#/reset-pin` | Recovery-session dependent | `submitNewPin` |

Special route: `#/changelog` opens the changelog modal for a known identity. No standalone `landing`, `tourn-detail`, or separate match-detail screen exists; marketing is a state inside `s-hub`, tournament detail is inside `s-tournament`, and match detail is a modal.

`_PUBLIC_SCREENS` currently contains `profile`, `onboarding`, `privacy`, `terms`, `communities`, and `world`. A fresh root with no local profile goes to Profile, not the marketing landing. This confirms the conversion issue in the July audit.

### 4.2 Navigation inventory

- Bottom navigation: Home, Game, Teams, History, More.
- More sheet: Tournaments, Communities, Pulse, Basketball World, Profile, Settings, Feedback, Invite Friends.
- Desktop header: Features, How It Works, authenticated Home/Teams/History/Tournaments, Communities, Discover, Login/Profile, Start Game.
- Mobile drawer currently retains marketing links even in app mode.
- Modal/sheet states include More, nav drawer, match detail, post-game, player picker, feedback, changelog, confirmation, help assistant and PWA update/install UI.

### 4.3 ID and function results

- **395** literal/static `id` values found in `index.html`.
- **0 static duplicate IDs** found. The existing UI contract test independently confirms unique IDs.
- **533 named function declarations** across `index.html`, `courtcall-core.js`, `courtcall-cloud-state.js`, and `courtcall-notifications.js`.
- **0 duplicate named function declarations** found across those active sources.
- The public globals are still very large. Major function families are:
  - auth/identity: `supaSignUp`, `supaSignIn`, `supaSignOut`, `signIn`, `createAccount`, `guestLogin`, `switchProfile`, `logOut`, local PIN helpers;
  - routing/shell: `showScreen`, `_routeFromHash`, `resolveHashRoute`, drawers/sheets/dialog focus helpers;
  - game: `freshState`, `save`, `load`, `addScore`, `addFoul`, `addTimeout`, `undoScore`, clocks, voice, win/post-game/rematch/save;
  - teams/queue: player CRUD, `generateTeams`, captain draft, fairness, queue actions;
  - history/tournament: normalization/stats/detail/share/delete, fixture generation/result/standing/bracket actions;
  - communities: create/join/membership, seven tabs, posts/comments/reactions, players/ratings, gallery, events/RSVP, leaderboard/settings;
  - sync: 20+ table/RPC adapter and hydration functions;
  - settings/support/PWA: import/export, theme/motion/audio, analytics, Pulse, help, feedback, install/update/offline.

The complete machine-readable function surface can be regenerated with the audit command pattern `function <name>(...)`; no source hook should be renamed in a redesign without tracing inline handlers and tests.

## 5. Specification-compliance matrix

Status values: **Working**, **Partial**, **Missing**, **Conflict**, **Uncertain**, **Intentional removal**.

| Requirement | Spec / prompt source | Existing implementation | Status | Planned Phase after approval | Regression risk / test |
|---|---|---|---|---|---|
| Pickup scoring/community product scope | Spec 1, 4; prompt 2 | Broad active app in `index.html` | Working | Preserve | Full browser journey |
| Main `basketball.html` single file | Spec 1; prompt 4 | No `basketball.html`; active `index.html` plus 4 external JS files | Conflict | Requires blocking decision | Deployment/offline/cache tests |
| Vanilla JS/no framework/no build | Spec 1; prompt 4 | Static HTML/CSS/ES JavaScript; no package/build step | Working | Preserve unless explicitly changed | Deploy smoke test |
| Only Supabase CDN external JS | Spec 1 | Vendored local Supabase plus three local app modules | Conflict | Decide whether current modular files are approved compatibility | CSP/cache/load-order tests |
| Hash routing | Spec 3; prompt 6 | `CourtCallCore.resolveHashRoute`, `showScreen`, hashchange | Working | Preserve | Existing route tests + deep-link browser tests |
| All required product areas | Spec 3–4; prompt 6 | 19 screens plus modal/state variants | Partial | Preserve IDs; document state-based equivalents | Route/screen matrix |
| Separate `tourn-detail` screen | Spec 3/4.7 | Detail lives in `s-tournament` | Conflict | Preserve current behavior or add alias only if required | Tournament deep-link/back test |
| Public landing as screen | Spec 4.15 | Marketing lives inside `s-hub`; fresh root shows Profile | Partial | Make deliberate route decision in later phase | Fresh-profile route and CTA test |
| Bottom nav and More sheet | Spec 3 | Exact five tabs/eight More actions | Working | Restyle without hook changes | Keyboard/mobile nav test |
| Email + PIN Supabase auth | Spec 1/4.1/10; prompt 11 | Implemented; PIN is Supabase password | Working but unsafe | Auth direction needs explicit approval | Live auth/recovery/rate-limit tests |
| Guest mode without Supabase | Spec 4.1 | Local guest/profile flows; no required cloud call | Working | Preserve | Offline guest E2E |
| PIN boxes/paste/backspace/reveal | Spec 4.1 | Implemented, with local PBKDF2 verifier | Working | Fix narrow-screen layout later | 320 px, paste, SR tests |
| Reset PIN | Spec 4.18 | Supabase recovery event and `updateUser` flow | Partial/Unverified | Browser/email validation in Phase 2 | Recovery-link E2E |
| Hub resume/actions/stats | Spec 4.2 | Dashboard mode, resume, actions, stats, streak-like content | Working | Preserve | Populated/empty browser fixture |
| Complete game setup | Spec 4.3; prompt 13 | Rules, teams/colors, clocks, timeouts, players, defaults | Working | Preserve state contract | Setup matrix |
| `freshState()` compatibility | Spec 4.3 | Core fields preserved; additional `periodsEnabled` and runtime context | Working/extended | Do not remove compatible additions | Unit/state migration tests |
| Score, foul, timeout, undo | Spec 4.4/5 | Implemented; core normalization and foul helpers tested | Working/Tested | Highest regression priority | Existing tests + double-tap/manual E2E |
| Win score/win by two/manual end | Spec 5 | Corrected explicit win/tie/cancel/no-contest semantics | Working/Tested | Preserve corrected behavior | Existing outcome tests |
| Shot/game clocks | Spec 4.4/5 | Interval-based controllers; persistence context | Working/Unverified on background | Preserve, then device test | Sleep/background/route interval tests |
| Voice grammar | Spec 4.4/5 | Web Speech, parser and visible state | Partial/Unverified | Preserve exact accepted commands | Supported/denied/unsupported browser matrix |
| Player attribution and foul limits | Existing behavior/audit | Implemented picker/player actions | Working/Unverified | Preserve | Roster/foul E2E |
| Save/resume/history cap | Spec 4.4/4.6/8 | Active state, match normalization, 200 cap, legacy list | Working/Tested in core | Preserve keys/shapes | Storage fixtures/import tests |
| Team Builder player CRUD/ratings | Spec 4.5/6 | Implemented | Working | Preserve | Browser CRUD and corrupt storage tests |
| Balanced/random/snake draft | Spec 4.5/6 | Balanced/random and captain/alternate draft; terminology differs | Partial | Choose canonical name without changing logic | Deterministic/fairness tests |
| Queue Winners Stay/Rotation | Spec 4.5 | Winners Stay, All Rotate/manual-related current behavior | Working/extended | Reconcile labels/help | Existing queue tests + UI |
| History filters/career/detail/delete | Spec 4.6/8 | Current filters are broader product variants; normalized outcome/detail/share/delete | Working/extended | Reconcile exact filter contract | Populated identity-scoped E2E |
| Round robin | Spec 4.7/7 | Implemented and tested, including odd-team byes | Working/Tested | Preserve | Existing fixture/standings tests |
| Knockout/byes/advancement/champion | Spec 4.7/7 | Implemented and tested for power/non-power-of-two | Working/Tested | Preserve | Existing tests + 3/5/6/7/9 team UI |
| Tournament cloud persistence | Spec 10 | Upsert/delete/pull implemented | Partial/Unverified live | Validate deployed columns/RLS | Live CRUD cross-user test |
| Communities directory/create/join | Spec 4.8–4.10/9 | Implemented with hardened directory view/invite RPC and join policy | Working/extended | Preserve security model | Existing security contract + live roles |
| Seven community tabs | Spec 4.10 | Feed, Members, Players, Gallery, Events, Leaderboard, admin Settings | Working | Preserve | Role matrix browser tests |
| Posts/types/pin/edit/delete/reactions/comments | Spec 4.10/9 | Implemented, but cloud schema uses `user_id`/`content`; `pinned` appears local-only unless later schema supports it | Partial | Validate server parity before redesign | Live persistence/reload/cross-user |
| Member roles/requests/moderation | Spec 4.10/9 | Implemented; hardened migrations add restrictive guards | Working/Unverified live | Preserve | Admin/contributor/member/anon SQL/E2E |
| Community players/badges/ratings | Spec 4.10/9 | Implemented and mapped to tables | Working/Unverified live | Preserve IDs/rules | Rating uniqueness and permissions |
| Gallery upload/URL | Spec 4.10/9 | URL syncs; base64 upload remains local-only | Partial by design | Storage remains a later product decision; prompt currently requires compatibility | Quota/offline/reload test |
| Events/five RSVP states/capacity | Spec 4.10/9 | Implemented; atomic `set_community_event_rsvp` RPC | Working/Tested statically, live unverified | Preserve RPC | Concurrency/capacity/RLS tests |
| Leaderboard categories/rules | Spec 4.10 | Implemented | Working/Unverified | Preserve | Seeded calculations/UI |
| Settings/defaults/audio/haptics/theme/motion | Spec 4.11/13; current app | Expanded current settings | Working/Tested selectively | Preserve; fix visual theme defects | Existing contract + screenshots |
| Export/import/clear/demo | Spec 13/16 | Versioned portable export fields, validation, clear/demo functions | Working/Partial | Add ownership/migration fixtures before visual changes | Round-trip/corrupt/old backup tests |
| Analytics | Spec 4.12/17 | Device-local stats | Working | Keep scope label honest | Counter tests/browser |
| Pulse | Spec 4.13 | Manual location, generated searches, explicitly demo cards | Working | Do not claim live news | Link/content test |
| Basketball World | Spec 4.14 | Static links/placeholders | Working/Partial content | Verify links or remove unsupported placeholders | External link audit |
| Help Center/Assistant | Spec 4.16/14 | 23-article deterministic KB; persistent feedback/history | Working | Correct stale content | Search/keyboard/content contract |
| Privacy/Terms | Spec 4.17 | Static dated May 2026 | Working but stale | Legal review before launch | Route/link/content review |
| Feedback/changelog/invite | Spec 18/20/21 | Mailto/copy, modal changelog, share fallbacks | Working/Unverified browser | Preserve accurately | Clipboard/share/mailto tests |
| PWA manifest/install/update/offline banner | Spec 11 | Implemented, current v15 SW differs beneficially from old v8 recipe | Working/extended | Preserve current hardened behavior | Install/update/offline upgrade tests |
| Exact old SW shell/cache | Spec 11/prompt 24 | Current root/module/WebP shell and safer strategies differ | Conflict | Current behavior should likely win; needs approval | Old-to-new SW test |
| Static ID uniqueness | Prompt quality gate | 395 IDs, zero duplicates | Working/Tested | Maintain CI check | Existing UI contract |
| Named function uniqueness | Prompt quality gate | 533 declarations, zero duplicates | Working | Add stronger global/dynamic checks | Static parser/lint |
| WCAG AA | Spec 12; prompt 22 | Good foundations; known semantic, contrast, reflow and focus gaps | Partial | Phase 3 foundation after baseline | W3C/axe/manual AT |
| No unsupported marketing | Prompt 10/30 | Several claims/placeholders remain too broad | Partial | Content reconciliation | Content contract |
| Standalone Canvas basketball | Spec 15 vs explicit master-prompt override | Fully present | **Intentional removal** | Remove only after Phase 2 baseline/approval | No remaining refs/RAF/listeners/assets request |
| Cinematic scroll site/Higgsfield media | Master prompt 8–10 | Not implemented; PNG is reference only | Missing, intentionally deferred | Phase 10 only; do not generate now | Performance/fallback/route cleanup |

## 6. localStorage key compatibility review

### 6.1 Required keys preserved exactly

| Constant/domain | Exact key | Current use | Compatibility |
|---|---|---|---|
| `K.profile` | `cc_profile` | Active local/account profile | Preserved |
| `K.profiles` | `cc_profiles` | Local multi-profile list | Preserved |
| `K.players` | `cc_players` | Legacy/player compatibility | Preserved |
| `K.builder` | `cc_builder` | Players, generated teams, queue | Preserved |
| `K.matches` | `cc_matches` | Primary match history | Preserved |
| `K.tournaments` | `cc_tournaments` | Tournament records | Preserved |
| `K.settings` | `cc_settings` | Expanded settings object; defaults merged | Preserved/extended |
| `K.game` | `courtcall_v1` | Active game state | Preserved/extended |
| `K.games` | `courtcall_games` | Legacy winner/loser summaries | Preserved |
| `STATS_KEY` | `courtcall_app_stats` | Device analytics | Preserved |
| `OB_KEY` | `courtcall_onboarding_seen` | Onboarding state | Preserved |
| `KC.communities` | `courtcall_communities` | Community mirror/local records | Preserved |
| `KC.members` | `courtcall_community_members` | Membership mirror | Preserved |
| `KC.joins` | `courtcall_community_joins` | Join requests | Preserved |
| `KC.posts` | `courtcall_community_posts` | Posts/comments/reactions | Preserved |
| `KC.players` | `courtcall_community_players` | Community players | Preserved |
| `KC.gallery` | `courtcall_community_gallery` | Gallery, including base64 uploads | Preserved |
| `KC.events` | `courtcall_community_events` | Events/RSVPs | Preserved |
| `KC.ratings` | `courtcall_community_ratings` | Ratings | Preserved |
| Pulse | `pickup_app_pulse_location` | Manual saved location | Preserved |
| Assistant | `courtcall_help_chat_history` | Last 20 messages | Preserved |
| Assistant feedback | `courtcall_help_feedback` | Last 50 feedback rows | Preserved |

### 6.2 Current additive/device keys

`cc_pending_account_sync`, `cc_sync_preferences`, `cc_last_successful_sync`, `cc_last_backup`, `cc_community_draft`, `cc_seen_version`, `cc_dev`, `pwa_dismissed`, local auth lock/PIN-verifier related keys, and Supabase `sb-*` session keys are additional current compatibility/status data. They should be retained or explicitly migrated; they are not spec violations merely because they are additive.

### 6.3 Compatibility findings

- Defensive JSON reads return safe defaults, but many writes swallow quota/serialization errors. A gallery base64 write can therefore fail silently and leave UI/cloud state misleading.
- Import validates top-level array/object shapes, but does not fully validate every nested entity, ownership reference, URL, size or schema version before writing.
- Current match normalization is a strong compatibility layer: it accepts old winner/loser, oriented team, cloud snake_case and current outcome shapes.
- `courtcall_games` intentionally retains only the legacy winner-oriented subset (20 rows); ties/no-contests are not fabricated as wins.
- Global keys are not true per-identity namespaces. The app uses ownership fields, consent, cloud merge rules, community mirror clearing, and destructive full logout, but switching/local guest scenarios still require exhaustive proof that every domain is filtered.
- `_wipeLocalStorage()` removes broad `cc_`, `courtcall_`, and `sb-` prefixes. That is appropriate only for the explicitly destructive full logout/clear path and must not be reused for ordinary profile switching.
- Do not rename any required key in the redesign. If namespacing is approved later, use a migration/adapter that continues to read the exact legacy keys.

## 7. Supabase table and column mapping review

The Supabase skill review also identified a current platform change relevant to future migrations: newly created public tables may not be automatically exposed to the Data API. Grants and RLS must both be explicit. No schema changes were made in this phase.

### 7.1 Client-to-database mapping

| Client function(s) | Table/view/RPC | Operation and exact current fields | Review |
|---|---|---|---|
| `_syncProfileFromDB`, account/profile push | `profiles` | Reads current/legacy profile columns; current migration adds `avatar`, `jersey_number`, `position`, `preferred_game_type`, `skill_info`; core includes `id`, `name`, `nickname`, `games_played`, `created_at` | Current migration-aligned; spec lists only legacy core columns. |
| `supaSaveGame`, `supaDeleteGame`, `_syncGamesFromDB`, `supaFetchGames` | `games` | `id,user_id,team_a_name,team_b_name,score_a,score_b,winner,game_type,win_score,scoring_rule,duration,fouls_a,fouls_b,max_lead_a,max_lead_b,lead_changes,biggest_run,quarters_played,tournament_id,fixture_id,players_a,players_b,created_at` | Matches spec columns. Outcome is encoded through winner text for compatibility; no delete tombstone/outbox. |
| `supaUpsertTournament`, delete/sync | `tournaments` | `id,user_id,name,format,win_score,teams,fixtures,standings,completed,winner,settings,created_at,updated_at` | Matches current schema/spec. JSON concurrency remains last-write-wins. |
| directory sync | `community_directory` view | Public safe projection; no `invite_code` | Hardened migration uses `security_invoker`; correct public surface. |
| community member/admin sync | `communities` | Current fields include `id,creator_id,name,description,type,visibility,logo,location,invite_code,read_only,comments_locked,ratings_disabled,created_at,member_count,join_policy` | Extends spec. Direct table SELECT is column-granted; invite codes obtained separately for authorized managers. |
| `supaCreateCommunity`, `supaJoinCommunity`, leave/approval, sync | `community_members` | `community_id,user_id,role,profile_name,joined_at`; composite key `(community_id,user_id)` | Current hardening prevents self-promotion and protects role/identity. Direct join must agree with `join_policy`. |
| `supaSubmitPost`, update/delete/sync | `community_posts` | Current client writes `id,community_id,user_id,author_name,title,content,image_url,type,reactions,comments`; reads `created_at` | **Schema-name conflict with spec**, which says `author_id`, `body`, and `pinned`. Current SQL/client consistently use `user_id`/`content`; pin persistence needs live verification. |
| `supaUpsertCPlayer`, delete/sync | `community_players` | `id,community_id,creator_id,name,nickname,jersey_num,photo_url,position,badges,games_played,wins,losses,points,mvp_count,created_at` | Current migration aligned. |
| `supaUpsertCRating`, delete/sync | `community_ratings` | `id,player_id,community_id,rater_id,shooting,defense,passing,speed,teamwork,clutch,sportsmanship,created_at,updated_at`; conflict `(player_id,rater_id)` | Matches spec/current schema; old scripts had weaker policy patterns. |
| `supaSubmitGalleryItem`, update/delete/sync | `community_gallery` | `id,community_id,uploader_id,uploader_name,image_url,caption,album,tagged_players,likes,comments,created_at` | URL items sync; base64 upload intentionally does not. |
| `supaCreateEvent`, update/sync | `community_events` | `id,community_id,creator_id,title,description,event_date,event_time,location,event_type,max_attendees,creator_name,rsvps,created_at,updated_at` | **Schema-name conflict with spec**, which says `date,time,type,max_players,created_by`. Current client/migration are internally aligned. Legacy fallback drops enhanced columns on undefined-column errors, risking partial cloud records. |
| `supaSetEventRsvp` | RPC `set_community_event_rsvp` | Parameters `p_event_id,p_status,p_profile_name`; atomically replaces caller's JSON RSVP under row lock and capacity check | Correct hardened write surface; authenticated execute only. |
| join request functions | `community_join_requests` | `id,community_id,user_id,profile_name,status,requested_at,reviewed_at`; conflict `(community_id,user_id)` | Matches current/spec model. Approval then upserts membership client-side; transactionality across the two operations is not guaranteed. |
| invite join | RPC `join_community_by_invite` | Bounded invite/profile inputs; server-controlled membership insert | Hardened path; authenticated execute only. |
| invite code fetch | RPC `get_my_community_invite_codes` | Returns invite codes only for communities the caller manages | Hardened path; authenticated execute only. |

### 7.2 Schema/RLS findings

- Eleven public tables are expected: `profiles`, `games`, `tournaments`, `communities`, `community_members`, `community_posts`, `community_players`, `community_ratings`, `community_gallery`, `community_events`, `community_join_requests`.
- All are intended to have RLS. The migration set moves sensitive helper functions into `courtcall_private`, fixes search paths, uses explicit authenticated grants, adds restrictive policies/triggers, and locks down public definers.
- The current client still uses a legacy anonymous JWT key in source. That is a public client credential, not a service-role key, but moving to a current publishable key is advisable when compatible.
- The seven root SQL scripts are cumulative historical tools, not a trustworthy declarative snapshot. `supabase-fix-permissions.sql` in particular grants broad CRUD to `anon` and should not be rerun as a generic fix; RLS may limit rows but the grant surface is unnecessarily broad and conflicts with later hardening.
- Several legacy policies use `auth.uid()` directly rather than `(select auth.uid())`, lack `TO authenticated`, or omit `WITH CHECK` on updates. Later migrations harden many community paths, but the live project must be verified from catalog state rather than inferred from files.
- Public `SECURITY DEFINER` functions are safe only where execution is explicitly revoked/granted and the function performs its own `auth.uid()`/authorization checks. The three exposed RPCs require regression tests; trigger-only/compatibility functions must remain non-browser-callable.
- Current Supabase breaking-change review: future new tables may need explicit Data API grants; self-hosted gateway/PG changes are irrelevant unless deployment becomes self-hosted; the client does not hard-code OAuth token status 201.

## 8. Existing working-feature baseline

### 8.1 Automated evidence

`node --test tests/*.test.js` completed with **56 passed, 0 failed**. Confirmed/tested contracts include:

- automatic win and win-by-two;
- manual end for blank, tie and scored games;
- undo reopening a winning game;
- match normalization and single-winner trophy behavior;
- max lead/lead changes from newest-first timelines;
- foul increment/undo without negative counts;
- rematch and swapped rematch;
- odd/even round robin, knockout byes and advancement;
- fixture tie validation, standings and immutable result progression;
- queue move/remove/start-next;
- public/private/invalid/community/changelog/game hash routing;
- offline/empty/auth/permission/error cloud-state copy;
- typed notifications and route clearing;
- public directory exclusion of invite codes;
- authenticated invite RPC contract and prevention of membership self-promotion;
- definer execution lockdown;
- atomic RSVP RPC/rollback contract;
- hostile-looking inline-handler IDs encoded inertly;
- complete quick-game defaults, sound volume, theme/reduced motion, sync/backup timestamps;
- unique static IDs, named form controls, image alt text and button accessible names.

### 8.2 Implemented but not exercised end-to-end in this audit

Auth/recovery, microphone/voice, service-worker installation/update, real offline refresh, background clocks, Web Share/clipboard/mailto, all community role combinations, real Supabase writes/merges, file quota behavior, light-theme screenshots, screen-reader output and mobile layouts require Phase 2 browser/device/database baselines. “Working” in the matrix means implemented and internally consistent, not live-production certified.

## 9. Missing and incomplete features

### Critical contract gaps

- No `basketball.html`; active entry point and deploy contract disagree with the specification/prompt.
- No true separate landing route/screen; fresh visitors are sent to Profile.
- No separate `s-tourn-detail`; current tournament detail is in-screen state.
- Spec/current Supabase post and event column names disagree.
- Remote authentication still uses a six-digit PIN as password.
- No per-identity storage namespace or durable offline mutation outbox/tombstones/conflict UI.
- No Supabase Storage workflow; base64 media is local-only and quota-prone.
- No browser E2E, accessibility runner, HTML validator, visual regression, service-worker upgrade or live RLS test suite in CI.

### Product/content gaps

- Cinematic scroll sequence and generated media are absent by design and must remain deferred.
- Landing claims such as “no login”, “works offline”, “no setup”, and some future placeholders need qualification.
- Help/manual QA content is stale and conflicts with current names/behavior and the widget-removal mandate.
- Light theme remains visually incomplete according to current fixed dark surfaces.
- Public help/contact/accessibility/true 404 structure is incomplete.
- Account/cloud data deletion, moderation/report/block, media durability, push notifications, live news, booking and payments are absent; they must not be marketed as shipped.

### Reliability gaps

- Many async Supabase mutations are fired without a persisted outbox; local UI can succeed while cloud retry is lost after reload.
- Delete sync lacks tombstones, so stale devices/merges can resurrect data.
- Some update/delete calls rely on RLS alone and filter only by row ID; safe if policies are correct, fragile if schema drift occurs.
- Join approval plus member insert is a two-step client operation rather than one atomic RPC.
- Silent `catch {}` around storage writes and some platform calls hides quota and persistence failures.

## 10. Duplicate ID and duplicate function risks

### Confirmed clean state

- Zero duplicate static IDs among 395 literal IDs.
- Zero duplicate named function declarations among 533 declarations in active sources.
- Existing tests guard static IDs, but not every runtime-generated subtree or global variable/function collision.

### Remaining risks

| Risk | Evidence | Severity / mitigation |
|---|---|---|
| Timestamp-only IDs collide | Tournament, community, member, post, comment, player, rating, join, event and gallery IDs frequently use `Date.now()` | Medium. Rapid same-millisecond creation/import can collide locally or at DB primary keys. Use collision-resistant compatible IDs for new records while accepting old IDs. |
| Mixed timestamp/random strategy | Setup/builder player IDs add random suffix; most other entities do not | Medium. Standardize only behind a compatibility helper; do not rewrite stored IDs. |
| Large global namespace | Hundreds of inline globals plus UMD globals and inline event handlers | High regression risk during redesign. New function names can shadow existing bindings or handlers. Add an extracted symbol inventory/lint gate. |
| Dynamic HTML IDs | Many renderers interpolate entity IDs into handlers/markup | Medium. `jsArg` mitigates hostile IDs, but duplicates can arise from duplicate imported entity IDs. Validate uniqueness during import and render. |
| Repeated event initialization | DOMContentLoaded, route renderers, widget init, delegated and direct listeners coexist | Medium. Verify each initializer is one-shot or cleans up. Timer/listener leak tests are needed. |
| Function names vs inline handler contract | Renaming a function can leave dormant `onclick` strings | High. Preserve names until inline handlers are eliminated in a separately approved architecture change. |

## 11. Security risks

| Priority | Risk | Evidence / consequence | Required response |
|---:|---|---|---|
| P0 | Weak remote credential | Six numeric digits are passed as Supabase password: at most one million values; client lockout does not secure the server | Decide whether strict spec behavior or passwordless/strong auth wins before redesign. Add server abuse controls regardless. |
| P0/P1 | Identity-scoped data in global keys | Matches, active game, builder, tournaments and settings are global device records, with partial owner fields/filtering | Phase 2 cross-account/guest/offline test; approve namespace migration or prove complete filtering. |
| P1 | Historical SQL is dangerous to reapply | Broad anon CRUD grants and legacy definer/policy patterns coexist with hardened migrations | Mark root scripts historical; create a canonical migration/readme workflow later. Never use “fix permissions” blindly. |
| P1 | Live RLS state unverified | Files show intended hardening, not guaranteed deployed catalog state | Read-only live catalog/advisor/RLS role verification in Phase 2. |
| P1 | No durable sync/outbox | Optimistic local changes may never reach cloud; reload loses retry intent | Add idempotent persisted operations only after data-contract design. |
| P1 | Imported backup trust | Top-level shape checks do not deeply validate nested values/ownership/URLs/size | Versioned deep schema validation, preview, limits and rollback. |
| P1 | User media/URLs | Remote images and base64 content can expose tracking, unsafe schemes if validation misses a path, quota failure and EXIF/privacy issues | Central URL policy, Storage pipeline if approved, MIME/magic-byte/EXIF handling. |
| P1 | Inline execution | Large inline JS/CSS and inline handlers prevent a strong CSP | A strict CSP needs an approved architecture change; deploy report-only first after extraction. |
| P1 | Missing/weak production headers | Prior audit observed no CSP/HSTS/Permissions-Policy/frame protection; repository does not define them | Verify current host, then configure at hosting layer. Limit microphone and deny unused permissions. |
| P2 | Public client key age/class | Browser contains a legacy anon JWT | Expected to be public, but rotate/migrate to publishable-key convention when supported; never add secret/service role. |
| P2 | Non-atomic community approval | Request status and membership insert are separate calls | Prefer a bounded server RPC if future change is approved. |
| P2 | Soft redirects for private paths | `_redirects` sends probes to app root with 308 instead of denying/404 | Use explicit 404/410/deny behavior on the actual host. |
| P2 | Third-party external links/media | Google/league/image URLs can leak referrer or load untrusted resources | Centralize `noopener/noreferrer`, URL validation and privacy copy. |

Positive controls already present include `escHtml`, `escAttr`, `jsArg`, no service-role key, PBKDF2 local PIN verifier, credential-free portable backup projection, hardened directory view, explicit RPC authorization patterns, restricted definer grants, role protections, and client-side file type/size checks.

## 12. Accessibility risks

| Priority | Risk | Current evidence |
|---:|---|---|
| P1 | Invalid interactive structure | Many settings/action buttons contain nested `div` elements; prior W3C run found 59 errors including 48 such cases | Static accessible-name tests do not prove valid semantics. |
| P1 | Contrast | White on bright orange and small muted text fail AA in known token combinations | Needs route/state/theme contrast matrix. |
| P1 | 320 px reflow | Six fixed PIN boxes, header actions and two-team color controls can clip | `overflow-x:hidden` can conceal rather than solve failure. |
| P1 | Route focus/announcement | `showScreen` changes visible screen/hash but does not consistently move focus to the active H1/main | Keyboard/SR users can remain in stale context. |
| P1 | Heading/landmark semantics | Many visual page titles remain `div`; one stable skip target does not always correspond to active content | Rebuild semantic structure without changing IDs. |
| P1 | Dialog consistency | Several custom overlays have focus helpers, but post-game and all dynamic variants need one proven focus/inert/restore contract | Manual keyboard/SR matrix required. |
| P1 | Auth/live errors | Some improved notification states exist; every auth/form/quota error is not guaranteed associated/live-announced | Form-by-form audit required. |
| P2 | Target size | Small PIN-eye/comment-delete/icon controls may fall below WCAG 2.2 minimum/preferred court target | Measure rendered boxes. |
| P2 | Emoji/glyph noise | Functional emoji and unlabeled decorative glyph repetition vary by OS/screen reader | Original SVG functional icon system later; retain text names. |
| P2 | Dynamic live-region volume | Rapid scores, timers, toasts and status changes can over-announce | Timer thresholds and score verbosity need manual AT testing. |
| P2 | Canvas widget | It has an accessible label but no meaningful keyboard interaction equivalent; removal improves this specific risk | Verify removal does not damage focus order/hero structure. |

## 13. Mobile usability risks

- Critical auth PIN row does not reliably fit 320–360 px.
- Public header includes too many visible actions on narrow phones.
- Setup team/color controls can overflow at the smallest supported widths.
- Community seven-tab strip, bracket, standings and dense forms need visible horizontal-scroll affordances and non-drag alternatives.
- Fixed bottom navigation, install/update banners, dialogs and mobile keyboard can overlap controls; malformed/untested safe-area calculations remain a concern.
- The live game must be tested at short landscape heights, with browser chrome, rotation, sweat/one-handed use, double taps and interrupted voice permissions.
- Inputs below 16 px can trigger iOS zoom.
- Long names, localized dates, large text/200–400% zoom, and offline/error copy may break layouts that pass with demo data.
- Touch/pointer cancellation and repeated fast scoring need device proof, not only click tests.

## 14. Performance risks

| Risk | Evidence | Impact |
|---|---|---|
| Monolithic initial document | 722 KB HTML, approximately 1,438 initial elements, 268 buttons, 19 pre-rendered screens | Parse/compile/style cost and maintenance fragility. |
| Large eager JS | Approximately 439 KB inline JS + 199.6 KB Supabase bundle + core modules | Startup/low-end Android cost even for local guest scoring. |
| Unfingerprinted app shell | Root and named JS assets cached by versioned SW, but URLs are stable | Update can briefly mix releases; requires upgrade testing. |
| Widget frame/render cost | 260 px DPR-capped Canvas draws per-column texture every frame plus DOM glow/sparks | Battery/CPU cost; currently pauses offscreen/hidden/reduced-motion. Removal is beneficial. |
| Shared WebP precached | 44.6 KB loaded for all users because it is in shell | Modest, but should remain only if shared branding still needs it. |
| Base64 local media | Up to 2 MB input expands in base64 and localStorage JSON | Main-thread serialization, quota exhaustion and total-save failure. |
| Repeated full `innerHTML` renders | Community/history/tournament/help areas build large HTML strings | Long tasks, focus loss, injection review burden. |
| Timers/listeners | Shot/game clocks, recognition restart, sync timers, help delays, widget RAF and observers | Duplicate/leak risk across navigation; needs lifecycle tests. |
| Deployment lacks performance gate | Workflow only copies/checks file presence | Regressions deploy silently. |
| Fonts/external assets | Google Fonts and external user images/search destinations are network dependent | Offline visual degradation/privacy/latency. |

## 15. Standalone Canvas basketball dependency inventory

### 15.1 Widget-only HTML

The removable block is the `bd-wrap` experience in the marketing portion of `s-hub`, approximately lines 1909–1957 of the audited `index.html`:

- `.bd-wrap`
- `.bd-labels-row`, `.bd-lbl` (“SLOW” / “FAST”)
- `.bd-stage` / `#bd-stage`
- `.bd-arc-svg`
- `#bd-arc-fill`
- `#bd-arc-ptr`
- `#bd-sweep`
- `#bd-ring`
- `#ball-canvas`
- `#bd-sparks`
- `.bd-court`
- `#bd-btn` / DRAG & SPIN label/icon

### 15.2 Widget-only CSS

The primary removable CSS boundary is approximately lines 1132–1162:

- both duplicate `#ball-canvas` rule pairs;
- `.bd-wrap`, `.bd-labels-row`, `.bd-lbl`, `.bd-stage`, `.bd-arc-svg`, `.bd-ring`, `.bd-sweep` and pseudo-element;
- `.bd-sparks`, `.bd-court` and pseudo-element;
- `.bd-btn` and its hover/active/spin/focus states;
- widget-specific reduced-motion rule;
- `@keyframes bdSweep` and `@keyframes sparkFly` if no other use remains after a full search.

### 15.3 Widget-only JavaScript/IIFE

The standalone IIFE begins at the `3D Basketball Renderer` comment near line 10,280 and continues to its closing invocation near the end of the main script. Its removable state/functions are:

- constants `BALL_PX`, `SEG`, `TILT`, `cosTilt`, `sinTilt`, `SEAMS`, `TEX_SIZE`, `BALL_MARG`;
- `applyTilt`, `_prepareBallTex`, `_updateBDEffects`, widget-local `init`, `drawBall`, `_shouldAnimate`, `renderOnce`, `requestLoop`, `syncAnimationState`, `loop`;
- `angle`, `speed`, drag/momentum/coast state, canvas/context/frame state, viewport/reduced-motion state, texture canvases/image;
- `_ballTex.src = 'icons/basketball-3d.webp'` and its load handler;
- canvas pointerdown/move/up listeners and pointer capture;
- `#bd-btn` click listener;
- widget IntersectionObserver;
- widget `visibilitychange`, media-query `change`, and `courtcall-motion-change` listeners;
- widget RAF/cancelRAF lifecycle and spark removal timeouts.

### 15.4 Shared dependencies that must not be removed with the widget

| Dependency | Other uses |
|---|---|
| `icons/basketball-3d.webp` | Onboarding/profile marks, header/avatar, footer mark, runtime avatar reset, service-worker shell, generated asset pipeline. |
| Global `requestAnimationFrame` | Focus scheduling for player picker, match detail, feedback and changelog; future cinematic sequence may also use it. Remove only widget calls. |
| `visibilitychange` | Service-worker update polling also uses it. Remove only widget listener. |
| reduced-motion setting/event | Used by the rest of the application and tested. Remove only the widget subscription/local helper. |
| generic Canvas capability | The future cinematic prompt explicitly permits Canvas for frame sequences/particles; do not globally prohibit `<canvas>` or Canvas APIs. |
| source PNG | Not runtime widget-only: it feeds `tools/generate-icons.py` to create the shared WebP. Keep until asset-generation strategy changes. |
| TESTING-INSTRUCTIONS Test 16 | Must be removed/replaced in a later documentation phase, not executed as a post-removal requirement. |

## 16. Safe removal plan for the widget

No removal is performed in Phase 1. The safe later sequence is:

1. Create the Phase 2 browser/performance/accessibility baseline and capture the current hero at required viewports.
2. Freeze a search manifest for every `bd-`, `ball-canvas`, widget function, texture assignment, DRAG & SPIN string, widget RAF/listener/observer and keyframe reference.
3. Remove the entire `bd-wrap` markup block as one unit. Replace it only with an approved static/structural landing composition; do not insert the future cinematic system yet unless its phase is separately approved.
4. Remove only the widget CSS selectors and widget-only keyframes. Retain shared layout tokens and any animation used elsewhere.
5. Remove the entire widget IIFE as one unit rather than deleting individual statements. This guarantees closure-local RAF, observer, image and listener state disappears together.
6. Keep `icons/basketball-3d.webp` because of non-widget uses. Remove it from the service-worker shell only if all remaining UI uses are replaced and offline fallback is validated.
7. Keep `icons/basketball-3d.png` and the generator conversion step until the shared WebP is no longer generated/used; then remove both in one asset-pipeline change.
8. Update stale manual Test 16 and changelog/help copy in the documentation phase so the widget is no longer promised.
9. Bump service-worker cache version only with a tested update path; verify old v15 clients activate the new shell without mixed assets.
10. Run static searches asserting zero widget markers and zero widget texture request inside the removed IIFE.
11. Run all 56 tests, HTML validation, console smoke test, reduced-motion check, focus-order check, route transitions and offline first/repeat load.
12. Measure CPU/network/battery proxies before/after and confirm no blank hero gap or cumulative layout shift.

Suggested removal acceptance checks:

```text
No #ball-canvas / #bd-* DOM nodes
No .bd-* widget styles or widget keyframes
No _prepareBallTex / _updateBDEffects / drawBall widget functions
No widget pointer listeners, IntersectionObserver or RAF
No texture request caused by widget initialization
Shared WebP still renders in approved non-widget locations
All existing non-widget tests and routes remain green
```

## 17. Recommended implementation sequence

This sequence respects the master prompt while protecting current working behavior.

1. **Approve the contract decisions below.** Resolve entry point, single-file versus current modules, schema authority, auth direction, and live-project access.
2. **Phase 2 regression baseline.** Run the active app locally in a real browser; capture 320/360/390 mobile, landscape, tablet and desktop; record console/network/accessibility tree; exercise guest/auth if credentials are available; export representative legacy/current localStorage; verify live Supabase tables, grants, RLS, policies, RPCs and migrations read-only.
3. **Protect data and deployment.** Add CI execution of current tests, then browser smoke/HTML/axe/security-contract checks. Document the canonical migration chain and quarantine historical SQL from accidental execution.
4. **Remove the standalone widget only.** Use the safe boundary above; update its tests/docs; preserve shared assets and all non-widget RAF/motion behavior.
5. **Fix P0/P1 trust defects before visual redesign.** Identity isolation, auth decision, import validation, sync failure/outbox strategy, storage quota/error visibility, live RLS verification.
6. **Accessibility/mobile foundation.** Valid semantics, active-route main/focus, unified dialog/sheet behavior, contrast tokens, 320 px PIN/setup/header reflow, touch targets and safe areas.
7. **Design-system layer.** Add tokens/components within the approved architecture while retaining IDs, function hooks, storage keys and data shapes.
8. **Core game redesign first.** Setup, score/foul/timeout/undo, clocks, voice, resume, post-game and history. Run the full game matrix before proceeding.
9. **Teams/history/tournaments.** Preserve corrected domain behavior and terminology compatibility.
10. **Communities and Supabase parity.** Validate every role and data mapping, then redesign tabs/forms. Do not normalize schema names without an explicit migration decision.
11. **Settings/support/PWA.** Reconcile help/legal/claims, import/export, theme, analytics scope, service-worker upgrade and install behavior.
12. **Cinematic landing and Higgsfield assets last.** Only after core app stability and explicit approval. Use truthful product captures and static/reduced-motion fallbacks; do not reintroduce an interactive standalone ball.
13. **Final cross-device/RLS/performance/accessibility launch gate.** No “complete” claim until live tests are actually run.

## 18. Truly blocking questions

These questions do not block this audit; they block safe implementation after Phase 1.

1. **What is the authoritative entry point for subsequent phases: keep the deployed `index.html`, or create/rename to the specified `basketball.html`?** There is no `basketball.html` to preserve or modify today, while the deploy workflow, manifest, service worker and custom domain all target root/`index.html`.
2. **Does the current four-file modular static architecture override the older “all CSS/JS inline, only Supabase CDN external” rule?** Folding `courtcall-core.js`, notifications and cloud-state back into one HTML file would reduce testability and change the active deployment architecture; leaving them external contradicts the literal spec.
3. **Which Supabase schema is authoritative where Section 10 conflicts with current code/migrations?** Specifically, should future work preserve deployed `community_posts.user_id/content` and `community_events.creator_id/event_date/event_time/event_type/max_attendees`, or migrate to the spec's `author_id/body` and `created_by/date/time/type/max_players`? A silent rename is unsafe.
4. **Should remote email+six-digit-PIN authentication be preserved exactly, or may the P0 recommendation from the July audit replace it with passwordless/strong authentication while retaining an optional local PIN?** The master prompt says preserve auth; the world-class audit calls the current remote PIN unsafe.
5. **Will Phase 2 have read-only access to the actual Supabase project and an approved test account/role set?** File inspection cannot prove deployed grants, RLS, RPC behavior, schema drift, recovery email, or cross-user isolation.

Everything else can proceed with reasonable implementation judgment after those decisions and a recorded Phase 2 baseline.

## 19. Verification record

- Read `COURTCALL_SPEC.md` completely.
- Read `COURTCALL_WORLD_CLASS_AUDIT.md` completely.
- Read `CourtCall_Master_Higgsfield_Codex_3D_Scroll_Prompt_v2_No_Canvas_Basketball.md` completely.
- Inspected the supplied PNG at original resolution.
- Inventoried all workspace files and the archived ZIP contents.
- Inspected all active app/deployment/PWA/asset-tool/test/SQL sources; treated `.git` internals as repository metadata, not application code.
- Ran the complete existing automated test suite: **56/56 passed**.
- Confirmed no application file was modified and no redesign or asset generation was started.

