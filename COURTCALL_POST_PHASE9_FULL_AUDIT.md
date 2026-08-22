# CourtCall Post-Phase-9 Full Audit

**Audit date:** 2026-08-22  
**Audit type:** Read-only repository, runtime, deployment, Supabase, security, accessibility, responsive, performance, PWA, and regression audit  
**Canonical working-tree entry point:** `index.html`  
**Canonical local URL:** `http://127.0.0.1:8765/`  
**Current branch recorded by `.git/HEAD`:** `codex/phase9-otp-auth`  
**Application files modified by this audit:** none  
**Audit artifact added:** `COURTCALL_POST_PHASE9_FULL_AUDIT.md`

## 1. Executive conclusion

The Phase 9 working tree is internally healthy but **not production-ready**.

The local application passes all executable gates: 12 root JavaScript files parse, the single inline application script parses, 173/173 regression tests pass, all 34 service-worker shell assets return HTTP 200 locally, all static IDs are unique, and the 19 fixed routes exercised in the canonical browser render with zero page-level horizontal overflow at the available viewport.

Three release blockers override that healthy local result:

1. **The two public deployments are stale.** Both `https://courtcall13.win/` and the repository's GitHub Pages URL serve the older password/PIN build, not the post-Phase-9 working tree.
2. **The GitHub Pages workflow cannot deploy the current application correctly.** Its minimal artifact omits 31 files directly required by `index.html`; the generated deployment would lose the current styles, auth module, Communities contract, motion/cinematic modules, and cinematic media. Its service-worker installation would fail because required precache responses would be missing.
3. **The linked Supabase project is inactive.** Live OTP delivery, account creation, returning-user authentication, profile hydration, RLS, Communities cloud behavior, and deployed migration state cannot be verified.

The correct next action is a deployment/release-hardening phase, not another functional phase.

## 2. Severity summary

| Severity | Count | Meaning |
|---|---:|---|
| P0 — release blocker | 3 | Public users do not receive the audited application or required backend behavior |
| P1 — high | 4 | Security, deployment, or data-integrity verification must be completed before production |
| P2 — medium | 7 | Maintainability, accessibility, storage, performance, or documentation risk |
| P3 — low | 4 | Polish, metadata, and long-term hardening |

### P0 findings

| ID | Finding | Evidence | Required resolution |
|---|---|---|---|
| P0-1 | Public deployments are stale | Working-tree `index.html`: 787,134 bytes, SHA-256 `53D2F2…D653A`; `courtcall13.win`: 715,306 bytes, `130B0E…DA04`; GitHub Pages: 714,573 bytes, `F42658…6EA`. Both live pages contain `signInWithPassword`, do not contain `Send Code`, and do not reference `courtcall-auth.js`. | Select one canonical deployment pipeline and deploy the reviewed working tree only after the current phase is intentionally committed. |
| P0-2 | GitHub Pages artifact omits current runtime | Static dependency comparison found 39 direct local references from the canonical HTML but only 8 included by `.github/workflows/deploy.yml`; 31 are missing. | Rebuild the artifact definition from a single auditable allowlist that contains every production runtime asset, then add a reference-completeness test. |
| P0-3 | Supabase project inactive | Project `jfeegcocynozbjpzbjae` reports `INACTIVE`; table and migration queries time out. | Restore or replace the project, apply the canonical migrations, configure OTP email delivery, then run live Auth/RLS tests. |

### P1 findings

| ID | Finding | Impact | Recommendation |
|---|---|---|---|
| P1-1 | Deployed schema and migration history are unknown | Repository RLS may not match production; cloud authorization cannot be trusted from static SQL alone. | After project restoration, compare live migrations/tables/functions/grants to the four versioned migrations and run security/performance advisors plus role-based probes. |
| P1-2 | No Content-Security-Policy is deployed | The application uses 472 inline event handlers, a 503,870-byte inline script, and 81 `innerHTML` assignment sites. Escaping is generally present, but an injection regression would have broad execution capability. | Introduce CSP in stages: eliminate inline handlers, add nonces/hashes during migration, restrict scripts, frames, connections, images, styles, and object sources. |
| P1-3 | Missing assets resolve to HTML with HTTP 200 on the custom domain | Requests for `courtcall-auth.js` and `courtcall-cinematic.js` returned the old HTML shell as `text/html`, masking missing files. Browsers will reject these as scripts, and the service worker rejects HTML masquerading as shell assets. | Configure true 404 behavior for missing static assets and reserve SPA fallback for navigation requests only. |
| P1-4 | OTP production controls remain unverified | Email template, SMTP, expiry, CAPTCHA, redirect/site URLs, rate limits, and real delivery have not been tested. | Configure `{{ .Token }}`, custom SMTP, approved URLs, server rate limits, and CAPTCHA/abuse controls; test new, returning, expired, replayed, and throttled OTPs. |

## 3. Repository and architecture inventory

The workspace contains 127 repository-visible files.

| Type | Count | Total size |
|---|---:|---:|
| JavaScript | 29 | 513,401 bytes |
| Markdown | 17 | 556,645 bytes |
| SQL | 11 | 132,375 bytes |
| CSS | 10 | 168,974 bytes |
| HTML | 3 | 793,452 bytes |
| WebP | 26 | 1,321,768 bytes |
| PNG | 7 | 3,805,070 bytes |
| JPEG | 6 | 1,193,265 bytes |
| MP4 | 5 | 19,463,305 bytes |
| WebM | 5 | 15,320,069 bytes |
| Other production/config/test artifacts | 15 | approximately 4.5 MB plus metadata |

### Runtime architecture

- `index.html` is the only production application.
- `basketball.html` is a 499-byte redirect-only compatibility shim that preserves query/hash state.
- `basketball.manifest.json` uses `/` as `id`, `start_url`, and scope.
- `basketball-sw.js` is the v52 PWA service worker.
- `basketball-supa.js` is a pinned browser bundle of Supabase JS 2.106.2.
- The application has no framework, bundler, package manifest, or build step.
- The canonical HTML contains legacy inline CSS/JavaScript plus additive local CSS/JavaScript modules.
- `game.js`, `style.css`, `snake-ladder.html`, and the large backup ZIP are repository legacy/development artifacts and are not loaded by the canonical app.
- The standalone Canvas basketball widget is absent from the production HTML. There are zero `<canvas>` elements and no active Canvas render loop.

### Loaded CSS order

1. Inline legacy stylesheet in `index.html`
2. `courtcall-design-system.css`
3. `courtcall-core-game.css`
4. `courtcall-team-history.css`
5. `courtcall-motion-foundation.css`
6. `courtcall-cinematic.css`
7. `courtcall-global-visual-system.css`
8. `courtcall-tournaments.css`
9. `courtcall-supporting-product.css`
10. `courtcall-auth.css`

### Loaded JavaScript order

1. `basketball-supa.js`
2. `courtcall-core.js`
3. `courtcall-communities.js`
4. `courtcall-notifications.js`
5. `courtcall-cloud-state.js`
6. `courtcall-supporting-product.js`
7. `courtcall-auth.js`
8. The 503,870-byte inline application controller
9. `courtcall-motion-foundation.js`
10. `courtcall-cinematic.js`
11. `courtcall-global-visual-system.js`

## 4. Canonical entry point and deployment audit

### Working tree

The repository architecture correctly establishes `index.html` as canonical. The manifest starts at `/`, the service worker precaches `./`, and `basketball.html` redirects to the root.

### Local production-equivalent server

`http://127.0.0.1:8765/` serves the current `index.html`. All 34 app-shell URLs return HTTP 200 and non-zero content, totaling 2,248,224 bytes. The auth JS/CSS and v52 worker served locally are byte-identical to the working-tree files.

### Cloudflare custom domain

`https://courtcall13.win/` is not serving the audited working tree:

- it serves 715,306 bytes instead of 787,134;
- it contains the old password API;
- it does not contain the Phase 9 OTP UI;
- current JS asset requests fall through to the HTML shell;
- sensitive repository paths checked (`COURTCALL_SPEC.md` and the Phase 9 test) return 308 as intended;
- `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` are present;
- no `Content-Security-Policy` header is present.

### GitHub Pages

The origin is `vadis23-code/snake-ladder-game`, and the deployed Pages root is also stale. `courtcall-auth.js` returns 404 there.

The current workflow only runs on pushes to `master` and constructs a small `dist` directory. It omits these 31 direct working-tree dependencies:

- all nine current local application stylesheets;
- `courtcall-auth.js`;
- `courtcall-communities.js`;
- `courtcall-supporting-product.js`;
- `courtcall-motion-foundation.js`;
- `courtcall-cinematic.js`;
- `courtcall-global-visual-system.js`;
- the five cinematic MP4s;
- the five cinematic WebMs;
- the five cinematic poster WebPs;
- `assets/cinematic/courtcall-master.webp`.

It also omits the compatibility shim and dynamically selected mobile cinematic fallbacks. Because v52 precaches absent CSS/JS/images with `Promise.all`, installation deletes the partial cache and fails atomically.

### Deployment decision

Use `https://courtcall13.win/` as the canonical public origin and treat GitHub Pages as either:

- the same complete artifact deployed as a secondary origin, or
- an intentionally disabled/non-production target.

Maintaining two independently drifting static deployments is unsafe.

## 5. Screen and route inventory

There are 20 static `.screen` elements and 461 unique static IDs.

| Screen ID | Route | Access | Status |
|---|---|---|---|
| `s-landing` | `#/landing` and empty-root startup | Public | Working locally; cinematic lifecycle isolated |
| `s-profile` | `#/profile` | Public | Phase 9 OTP + guest + legacy local PIN |
| `s-onboarding` | `#/onboarding` | Public | Working |
| `s-hub` | `#/hub` | Identity/guest | Working |
| `s-setup` | `#/setup` | Identity/guest | Working |
| `s-game` | `#/game` | Identity/guest + active game | Working; refresh behavior tested |
| `s-teams` | `#/teams` | Identity/guest | Working |
| `s-history` | `#/history` | Identity/guest | Working |
| `s-tournament` | `#/tournament` | Identity/guest | Working |
| `s-tourn-detail` | `#/tournament/{id}` | Identity/guest | Dynamic deep link; missing ID redirects |
| `s-communities` | `#/communities` | Public directory/local memberships | Working |
| `s-comm-create` | `#/comm-create` | Identity/guest; cloud write requires auth | Working locally |
| `s-comm-detail` | `#/community/{id}` | Visibility/role dependent | Dynamic deep link; cloud hydration environment-dependent |
| `s-pulse` | `#/pulse` | Identity/guest | Working; local/demo/search content is labelled |
| `s-world` | `#/world` | Public | Working; curated links only |
| `s-settings` | `#/settings` | Identity/guest | Working |
| `s-analytics` | `#/analytics` | Identity/guest | Working; local record-derived analytics |
| `s-help-center` | `#/help-center` | Public | Working; explicitly keyword-based, not AI |
| `s-privacy` | `#/privacy` | Public | Working |
| `s-terms` | `#/terms` | Public | Working |

Compatibility/action routes:

- `#/reset-pin` redirects to Profile with `legacy_pin_retired`.
- `#/changelog` opens a modal for an existing identity.
- malformed routes safely fall back to Profile or Hub.
- direct community/tournament IDs are decoded and validated.
- a requested private hash is remembered in memory through authentication.

## 6. Specification-compliance matrix

| Area | Working-tree status | Production status | Notes |
|---|---|---|---|
| Canonical Landing/Hub separation | Pass | Fail/stale | Root is Landing locally; public sites serve older shell |
| Cinematic five-stage Landing | Pass | Fail/stale/missing assets | Native scroll controller, lazy later clips, reduced/data fallbacks |
| Global Midnight Arena visual system | Pass | Fail/stale | Route-aware and does not cover Landing locally |
| Motion foundation | Pass | Fail/stale | Score, lead, foul, possession, feed, victory, navigation, card, bracket, reaction contracts pass |
| Core game | Pass | Older deployed version | Scoring, undo, fouls, periods, clocks, voice contract, result normalization tested |
| Team Builder/history | Pass | Older deployed version | Balanced/random/snake draft, queue, career/history normalization tested |
| Tournaments | Pass | Older deployed version | Knockout/round-robin, byes, standings, fixtures, undo/deep links tested |
| Communities | Pass locally/static RLS | Cloud unverified | Creation, detail tabs, permissions, optimistic writes, RPC contracts tested |
| Supporting product | Pass | Older deployed version | Analytics, Pulse, Help, legal, World honesty contracts pass |
| OTP authentication | Pass locally/mocked | Not deployed; backend inactive | Official Supabase contracts used; real email path unverified |
| Guest behavior | Pass | Older deployed version | Explicit guest, consent-gated merge, non-destructive logout |
| PWA shell | Pass locally | Would fail from current GitHub artifact | v52 shell complete locally; deployment asset list broken |
| Accessibility baseline | Pass with two heading gaps | Older deployed version | Unique IDs/names/focus/reduced motion pass; Game/Communities headings need improvement |
| Responsive baseline | Pass contracts and available viewport | Not audited on current public build | Exact device emulation remains a tooling gap |
| Supabase/RLS | Strong repository design | Unknown | Project inactive; migration history unavailable |

## 7. Existing working-feature baseline

The following functionality is present and covered by executable contracts in the working tree:

- cinematic public Landing with reversible scroll journey and capability fallbacks;
- Landing-to-product CTA continuity without storage pollution;
- guest and cloud identity routing;
- email OTP request/verification contracts;
- active-session restoration;
- non-destructive logout;
- custom game setup and quick game;
- 1s/2s and 2s/3s scoring modes;
- target score, win by two, periods/overtime, shot clock, game clock;
- undo, manual end, cancel/no-contest, tie and winner normalization;
- player attribution, player fouls, foul-limit warnings, possession;
- rematch and swap-team rematch;
- Team Builder: balanced, random, interactive snake draft, queue rotation;
- history filters, home-side perspective, career/player summaries;
- tournament create/history/detail, knockout and round-robin, deterministic byes, standings, fixture results and undo;
- Community creation, public/private discovery, deep links, feed, members, players, gallery, events, leaderboard, settings, roles, joins, approvals, reactions/comments and RSVP contracts;
- local analytics, record-backed Pulse, curated Basketball World, Help Center and legal screens;
- backup export/import with schema checking and credential exclusion;
- settings for quick-game defaults, sound/volume, vibration, theme and reduced motion;
- install/update PWA UX and bounded runtime cache;
- premium native motion with reduced-motion fallbacks.

Browser/hardware-dependent features remain conditional: speech recognition, vibration, sharing, install prompts, camera/gallery pickers, and email delivery.

## 8. ID and function inventory

### Static IDs

- 461 static `id` attributes
- 461 unique
- 0 duplicates

### Functions

The broad regex inventory found 883 function declarations and 874 unique names across the inline app, external modules, legacy `game.js`, and the minified Supabase bundle.

No active global collision was identified. Apparent duplicates are scoped or legacy:

- `checkWin`, `newGame`, and `launchConfetti` exist in active inline code and unloaded legacy `game.js`;
- `undoTournamentResult` exists as an inline UI function and a scoped core helper;
- `render`, `onRouteChange`, `createId`, and `normalizeMatch` occur in separate module/IIFE scopes;
- the minified bundle repeats an internal single-letter name.

There are 211 distinct function names referenced through inline handlers. The automated handler scan found only DOM/built-in method false positives and no missing application handler.

### Risk

The absence of current collisions does not remove the architectural risk of 472 inline handler attributes and a very large shared global namespace. Future phases should progressively move route/surface behavior behind delegated listeners and module boundaries.

## 9. localStorage compatibility review

The active application preserves 31 named application keys plus the Supabase-managed session key.

### Core/profile/game keys

- `cc_profile`
- `cc_profiles`
- `cc_players`
- `cc_builder`
- `cc_matches`
- `cc_tournaments`
- `cc_settings`
- `courtcall_v1`
- `courtcall_games`
- `cc_pending_account_sync`
- `cc_sync_preferences`
- `cc_last_successful_sync`
- `cc_last_backup`

### Community keys

- `courtcall_communities`
- `courtcall_community_members`
- `courtcall_community_joins`
- `courtcall_community_posts`
- `courtcall_community_players`
- `courtcall_community_gallery`
- `courtcall_community_events`
- `courtcall_community_ratings`
- `cc_community_draft`

### Supporting/settings/compatibility keys

- `courtcall_app_stats`
- `cc_auth_lock`
- `courtcall_onboarding_seen`
- `pickup_app_pulse_location`
- `cc_seen_version`
- `pwa_dismissed`
- `courtcall_help_chat_history`
- `courtcall_help_feedback`
- `cc_dev`

The Supabase client separately manages `sb-jfeegcocynozbjpzbjae-auth-token` (and SDK-related variants). OTP values are not stored. Legacy `snl_users` appears only in unloaded `game.js` and is not part of the canonical data model.

Compatibility is strong: established keys were not renamed in Phases 4–9, normalizers accept legacy records, backups exclude credentials, and import performs rollback on failure. Ordinary logout removes identity/session state without deleting product data.

Risks:

- localStorage is synchronous, origin-wide, unencrypted device storage;
- a shared-device user can inspect local profiles, games, Communities, help history, location preference, and analytics;
- 2 MB image uploads are converted to data URLs and stored locally, so a few images can exhaust typical browser quota;
- there is no durable offline cloud-mutation outbox or conflict journal;
- account-merge consent is local state and should be exercised with real cross-device accounts after backend restoration.

## 10. Supabase table, column, RPC, and RLS review

### Client-referenced relations

- `profiles`
- `games`
- `tournaments`
- `communities`
- `community_directory`
- `community_members`
- `community_posts`
- `community_events`
- `community_players`
- `community_ratings`
- `community_gallery`
- `community_join_requests`

### Client-referenced RPCs

- `get_my_community_invite_codes`
- `join_community_by_invite`
- `set_community_event_rsvp`
- `set_community_post_reaction`
- `add_community_post_comment`
- `delete_community_post_comment`
- `set_community_gallery_like`
- `add_community_gallery_comment`
- `delete_community_gallery_comment`

### Identity mapping

- `auth.users.id` is the stable cloud identity.
- `profiles.id` uses the same UUID and references `auth.users`.
- `games.user_id` and `tournaments.user_id` reference the profile identity.
- Community creator/member/author/uploader/rater fields use the same UUID contract.
- OTP hydration accepts cached profile data only when its ID matches the authenticated UUID.

### Static security strengths

- RLS is enabled in repository SQL for all exposed application tables.
- later migrations add both `USING` and `WITH CHECK` ownership guards for updates;
- private helper functions use a non-exposed `courtcall_private` schema;
- genuine `SECURITY DEFINER` functions set `search_path = ''`, check `auth.uid()`, and have bounded grants;
- trigger-only/compatibility definers are locked back to `service_role`;
- Community directory reads exclude invite codes;
- invite joins and embedded JSON reactions/comments use authenticated RPCs;
- role self-promotion and last-admin/member-boundary changes are guarded;
- no browser service-role or secret key is present. The embedded JWT is the legacy public `anon` key.

### Static SQL risks

There are several historical setup scripts plus four versioned migrations. The older one-shot scripts contain broader grants and earlier policy forms. Running a legacy setup file without the later hardening migrations would not produce the audited security model.

The project needs one canonical provisioning instruction that says, unambiguously, which baseline and migrations constitute the current schema. The 2026 Supabase Data API change also means table exposure/grants must be confirmed explicitly rather than assumed for newly created relations.

### Live status

- project: `jfeegcocynozbjpzbjae`
- region: `ap-southeast-2`
- PostgreSQL: 17.6.1.127
- status: `INACTIVE`
- migration listing: timeout
- table listing: timeout
- publishable-key listing: unavailable
- security/performance advisor calls returned no lints, but this is not accepted as proof because the database was not queryable.

Relevant current Supabase changes:

- newly created public tables are moving to explicit Data API exposure;
- new Free-tier projects using default SMTP cannot customize auth templates, making custom SMTP important for `{{ .Token }}` OTP email;
- default OTP resend is 60 seconds, with server configuration remaining authoritative.

## 11. Security audit

### Passed controls

- no `eval`, `new Function`, `document.write`, `javascript:` URLs, iframes, or Canvas runtime;
- no exposed service-role key;
- no OTP persistence or logging;
- generic auth error mapping and one new/returning flow;
- PBKDF2 retained only for legacy local profiles;
- explicit guest-to-account synchronization consent;
- output escaping helpers used throughout dynamic application/community HTML;
- hostile-looking inline-handler IDs are covered by tests;
- external links use HTTPS and `_blank` links include `noopener`/`noreferrer`;
- Cloudflare redirects protect inspected SQL, test, tool, backup, and specification paths;
- RLS/RPC hardening is present in versioned migrations;
- backup exports exclude credentials.

### Remaining risks

1. **CSP absent.** This is the largest browser-side hardening gap.
2. **Large injection surface.** There are 81 `innerHTML` assignments and 472 inline handlers. Current escaping tests are good, but every future template change is security-sensitive.
3. **OTP abuse controls unverified.** No live CAPTCHA/rate-limit configuration was available for audit.
4. **External image URLs.** Community post/gallery/player URLs can contact third-party hosts, exposing user IP/referrer behavior and allowing tracking pixels. Consider a controlled image proxy or Supabase Storage.
5. **Origin-wide local data.** Any successful same-origin script injection could read application data and the persisted Supabase session.
6. **No deployed security-header source file.** `_redirects` protects paths, but there is no repository `_headers` policy for CSP, Permissions-Policy, frame restrictions, or cross-origin isolation decisions.
7. **Stale production.** Users currently receive the weaker password/PIN build.

## 12. Accessibility audit

### Strengths

- 461 unique IDs and no duplicates;
- all 11 static images have `alt` attributes;
- buttons and static form controls pass programmatic-name tests;
- no positive `tabindex` values;
- skip link follows the active screen;
- route changes maintain one active main landmark and announce page changes;
- dialogs, tabs, tables, brackets, filters, score controls, fouls, possession, sync state, auth status, and validation expose accessible labels/states;
- score/lead/foul state is not color-only;
- `prefers-reduced-motion`, in-app reduced motion, forced colors, and focus-visible rules exist;
- OTP uses one paste-friendly code input with `autocomplete="one-time-code"`;
- horizontal data regions are keyboard-focusable and labelled.

### Risks

- `s-game` has no semantic heading; its active `main` is announced without an accessible name.
- `s-communities` visually displays “Communities” but exposes it as generic text rather than a heading.
- the product contains many decorative ticker/status strings that may create noise depending on assistive technology and visibility rules; manual screen-reader review is still required.
- 414 static buttons plus dynamically generated controls create dense tab sequences on feature-heavy screens.
- no automated contrast measurement or real screen-reader/voice-control session was run in this audit.

Recommended correction: give every screen one stable `h1` (or an `aria-labelledby` relationship on its active main landmark), starting with Game and Communities.

## 13. Mobile and responsive audit

The responsive code covers phone, tablet, desktop, short landscape, reduced-motion, forced-color, and locally scrollable dense regions. Score actions are large, immediate, and one-hand oriented. Brackets and tables contain their own horizontal scrolling rather than widening the page. Cinematic media has mobile posters and capability fallbacks.

The canonical browser provided a fixed 1265×720 document viewport. Nineteen routes were exercised there:

- 19/19 resolved safely;
- 19/19 had zero page-level horizontal overflow;
- 19/19 had zero active-screen horizontal overflow;
- no visible route-level alert appeared;
- `#/tourn-detail` without an ID correctly redirected to `#/tournament`.

Exact live emulation at 320×568, 390×844, 844×390, 768×1024, and 1440×900 was not available through the browser controller. Those sizes are covered by static responsive/test contracts, not claimed as live device tests.

Remaining mobile risks:

- large local image data URLs can cause memory/quota pressure on phones;
- five-stage video can be costly on constrained networks despite lazy/capability handling;
- very dense Community and Settings screens need manual device/keyboard/safe-area testing;
- speech, vibration, share, install, and media-picker support varies by mobile browser.

## 14. Performance audit

### Size profile

- `index.html`: 787,134 bytes / 11,384 lines
- inline JavaScript: 503,870 bytes
- inline CSS: 166,498 bytes
- external application CSS: 168,974 bytes
- external `courtcall-*` JavaScript: 157,485 bytes
- pinned Supabase bundle: 199,564 bytes
- cinematic MP4/WebM set: 34,783,374 bytes
- largest single clip: `03-the-run.mp4`, 4,638,096 bytes
- local PWA precache shell: approximately 2.25 MB
- `!important` declarations: 59

### Strengths

- no continuous Canvas or heavy scoreboard background;
- motion primarily uses transform/opacity and reduced-motion fallbacks;
- later cinematic videos are lazy;
- video range requests bypass the service worker;
- videos are not placed in the 2.25 MB precache;
- runtime cache is bounded to 48 entries;
- inactive route visual controllers tear down;
- data-saver/low-capability fallbacks exist;
- CSS/JS dependencies are local except Google Fonts and intentional external content links.

### Risks

- the monolithic HTML must be downloaded, parsed, and compiled before most application behavior is available;
- large inline CSS/JS cannot be cached or versioned independently from HTML;
- 10 style layers and 59 `!important` declarations increase style recalculation/cascade-debugging cost;
- external Google Fonts are render/network dependencies and are not part of the same-origin PWA shell;
- the large Supabase bundle loads even for visitors who only watch the public Landing;
- the five-video experience still represents approximately 35 MB if a user traverses all stages and both formats are considered available;
- localStorage serialization of large Communities/gallery arrays is synchronous;
- no production Lighthouse/Web Vitals trace was possible against the current build because it is not deployed.

Recommended sequence: split auth/product code from the public Landing, move inline code to versioned modules, lazy-load Supabase and feature modules after route intent, self-host/subset fonts, and establish performance budgets for HTML, first-load JS, PWA shell, LCP media, and total cinematic transfer.

## 15. PWA and offline audit

The v52 worker is structurally sound in the local working tree:

- atomic shell install;
- rejects HTML returned for non-navigation assets;
- cleans prior CourtCall caches;
- network-first navigation with cached root fallback;
- bounded same-origin stale-while-revalidate runtime cache;
- range requests bypass interception;
- update prompt requires user action and reloads after `controllerchange`;
- current auth, motion, cinematic, global visual, supporting-product and Community assets are present in the local shell.

Release risks:

- the GitHub artifact omits most shell dependencies, so v52 cannot install there;
- the public custom domain returns HTML for missing JS, which v52 correctly rejects but cannot repair;
- the public sites are serving an older worker/app pair;
- there is no durable offline mutation outbox;
- real offline install/update/upgrade was tested locally, not on the stale public deployments.

## 16. Data compatibility and synchronization

Read-time normalizers preserve older game, player, tournament, and Community records. Phase 9 does not rename storage keys or cloud columns. Match outcomes normalize winner/tie/cancelled/no-contest explicitly. Tournament and Community IDs remain text where established; authenticated identities remain UUIDs.

The current synchronization model is local-first with targeted cloud upserts/reads and explicit state messaging. It correctly avoids claiming cloud success on failure. However:

- there is no general durable outbox;
- local uploads stored as data URLs are intentionally not pushed as cloud URLs;
- live conflict behavior across multiple devices has not been exercised;
- guest-to-account merge has automated coverage but not a live Supabase session;
- schema alignment is only statically proven while the project is inactive.

## 17. Documentation and product-metadata drift

Documentation does not yet describe the actual post-Phase-9 product consistently:

- `COURTCALL_SPEC.md` still instructs preservation of a Canvas 3D basketball widget and contains an entire obsolete Canvas renderer section, while production and tests require no standalone Canvas widget.
- `TESTING-INSTRUCTIONS.md` still tells testers to use a PIN account and includes a Tip-Off Canvas widget test. It is not a valid Phase 9 manual QA plan.
- the app identifies itself as `v0.12 Beta`, dated July 2026, even though Phase 9 was completed on 2026-08-22.
- `APP_BUILD` says `GitHub Pages Beta` while the intended custom production origin is Cloudflare.
- `ROUTE_LABELS` still calls the compatibility alias “Reset PIN,” though it redirects to email sign-in.
- `sitemap.xml` has June 2026 dates and lists `snake-ladder.html`, while Cloudflare deliberately redirects that path and the GitHub minimal artifact omits it.
- changelog “upcoming” items and safety notes predate several later phases.

These are not runtime blockers, but they materially increase release and QA error risk.

## 18. Test and verification results

| Verification | Result |
|---|---:|
| Root JS syntax | 12/12 passed |
| Inline application script parse | 1/1 passed |
| Full Node regression suite | 173 passed, 0 failed |
| Static IDs | 461 unique, 0 duplicate |
| Canonical browser routes | 19/19 safe at available viewport |
| Page-level horizontal overflow | 0 px on all 19 routes |
| Active-screen horizontal overflow | 0 px on all 19 routes |
| Local PWA shell URLs | 34/34 HTTP 200, non-zero |
| Local shell bytes | 2,248,224 |
| Live Supabase tables/migrations | Blocked by inactive project |
| Live OTP | Not testable |
| Live deployed Phase 9 | Fail — not deployed |
| Video duration/decode rerun | `ffprobe` unavailable in this environment; existence/contracts passed |

The 173 tests cover cinematic architecture, cloud state, core game, routing, design foundation, global visual system, Landing/Hub separation, notifications, Team Builder/history, tournaments, Communities, supporting product, OTP auth, security, settings, static UI, and motion.

## 19. Prioritized remediation sequence

### Release gate 1 — choose and repair deployment

1. Declare `courtcall13.win` the canonical production origin.
2. Decide whether GitHub Pages remains an exact secondary deployment or is retired.
3. Replace the hand-maintained incomplete artifact list with a complete production allowlist.
4. Add an automated build check that resolves every HTML, JS, CSS, manifest, and service-worker dependency inside the artifact.
5. Ensure missing asset requests return 404, never the SPA HTML shell.
6. Add production security headers.

### Release gate 2 — restore and verify Supabase

1. Restore or replace project `jfeegcocynozbjpzbjae`.
2. Establish the canonical migration history from the versioned migration directory.
3. Verify tables, columns, views, functions, grants, indexes, and RLS live.
4. Run Supabase security and performance advisors.
5. Configure custom SMTP and the `{{ .Token }}` email template.
6. Confirm Site URL/redirect URLs, OTP expiry/rate limits, and CAPTCHA.
7. Run real new-user, returning-user, logout, session restore, guest merge, and Community role/RLS tests.

### Release gate 3 — production smoke and performance

1. Deploy to a preview/staging origin.
2. Compare served hashes against the reviewed artifact.
3. Test cold load, service-worker install, update from the old worker, offline reload, and stale-cache recovery.
4. Run the required responsive matrix on real browser viewports.
5. Run keyboard, screen-reader, contrast, and touch testing.
6. Record Lighthouse/Web Vitals and cinematic transfer budgets.
7. Promote the exact verified artifact to `courtcall13.win`.

### Post-release hardening

1. Modularize the inline app and remove inline handlers.
2. Introduce CSP.
3. Lazy-load Supabase and feature modules.
4. Move images to controlled storage/proxy delivery.
5. Add a durable offline mutation outbox.
6. Update the specification, QA plan, version/build metadata, changelog, and sitemap.

## 20. Truly blocking questions

These decisions must be answered before a safe production deployment:

1. Is `https://courtcall13.win/` the sole canonical production host, with GitHub Pages retained only as a backup, or must both hosts remain supported as equal deployments?
2. Should the inactive Supabase project be restored, or should CourtCall migrate to a new project? A new project changes URL/key, Auth users, hosted configuration, and migration/identity planning.
3. Which canonical SQL baseline is authoritative for a restored/new project: the versioned migration chain alone, or a regenerated consolidated baseline followed by migrations?
4. Which custom SMTP provider/sender domain will deliver OTP emails, and can the Supabase plan support the required custom `{{ .Token }}` template?
5. Is production allowed to launch with local image data only, or is Supabase Storage/proxied media required before Communities is public?

## 21. Final audit status

**Working tree:** PASS with documented P2/P3 debt.  
**Local canonical runtime:** PASS at the available viewport.  
**Automated regression:** PASS, 173/173.  
**Cloud backend:** BLOCKED/UNVERIFIED.  
**Cloudflare production:** FAIL — stale pre-Phase-9 application.  
**GitHub Pages production:** FAIL — stale build and incomplete future artifact.  
**Release recommendation:** DO NOT DEPLOY OR START ANOTHER FUNCTIONAL PHASE until the P0 deployment and Supabase blockers are resolved and a production-equivalent staging smoke test passes.

No application file, storage model, game logic, Supabase migration, commit, or remote deployment was changed during this audit.
