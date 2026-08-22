# CourtCall Phase 8 — Supporting Product

Date: August 22, 2026  
Canonical production entry point: `index.html`  
Browser-tested origin: `http://127.0.0.1:8765/`  
Phase boundary: Analytics, Pulse, Basketball World, Help, legal/informational screens, supporting navigation, and directly related Settings states only

## 1. Audit findings

The pre-edit audit covered `COURTCALL_SPEC.md`, the Phase 6 and Phase 7 reports, the global visual-system report, the canonical `index.html`, `courtcall-core.js`, `courtcall-global-visual-system.js`, the relevant supporting-product implementation, all relevant automated tests, and `basketball-sw.js`.

The baseline was healthy: JavaScript syntax was clean and the inherited suite passed 149/149. The canonical application, hash router, localStorage contracts, existing Supabase mappings, Midnight Arena presentation layer, and PWA navigation strategy were intact.

The bounded audit found:

| Area | Existing baseline | Phase 8 finding |
|---|---|---|
| Analytics | Device usage counters only | Useful saved match, team, player, tournament, and community records were available but not analysed |
| Pulse | Safe external search shortcuts and developer-only sample cards | Production had no read-only local CourtCall activity; distinctions were accurate but incomplete |
| Basketball World | Six external basketball destinations | Two unsupported “coming soon” feed promises made the screen feel incomplete |
| Help | 23 rule-based articles and a keyword assistant | Several instructions were stale or inaccurate; Analytics was not documented |
| Legal | Existing Privacy and Terms copy | Copy was retained, but heading hierarchy, landmarks, line length, and link readability needed improvement |
| Navigation | Hash routing and route focus were established | Help was not treated as public information and route changes could preserve stale window scroll |
| States | Existing sync, toast, community, and PWA states were strong | Pulse and Settings lacked direct, plain-language network state; Analytics lacked product-data empty states |
| Responsive | Strong global mobile foundation | World and Pulse retained two-column layouts too far down; dense Analytics needed locally scrollable tables |
| Accessibility | Existing unique-ID, named-control, dialog, and focus contracts were green | Supporting headings, search result status, table semantics, filter states, and new-tab context needed strengthening |
| PWA | Network-first navigation and bounded stale-while-revalidate asset caching | New supporting CSS/JS needed explicit app-shell coverage and a cache-version update |

No Phase 8 requirement needed a Supabase schema, RLS, tournament, Community permission, game-logic, or storage-model change.

## 2. Gaps found

The concrete gaps were:

- Analytics did not derive any product performance from Match History or related saved records.
- Analytics export contained usage counters only, and “Reset Stats” did not make its safe scope clear.
- Pulse did not show local CourtCall matches, tournaments, posts, or events even though those records existed.
- Pulse’s filter controls did not declare their initial pressed state in static markup.
- Pulse did not explicitly expose online/offline search availability.
- Basketball World promised future news and pickup feeds that do not exist.
- The EuroLeague link pointed to the organisation root instead of the direct EuroLeague destination.
- Help incorrectly instructed users to grant device location, claimed all data was local-only in one article, described a nonexistent generic Submit feedback action, and omitted Analytics.
- Help search did not announce result counts.
- Direct Help access was gated even though it is an informational screen, and its Back action was hard-wired to Settings.
- Legal pages lacked `main`, `h1`/`h2` hierarchy, a controlled reading width, and underlined links.
- Supporting route changes reset a screen container but not the actual window scroll position.
- World’s grid and Pulse’s location fields could remain unnecessarily dense at phone widths.
- New Phase 8 assets were absent from the offline shell.

## 3. Files changed

Production files:

- `index.html` — supporting markup, rendering, routes, state copy, accessibility, and navigation-scroll correction.
- `courtcall-core.js` — added Help Center to the default public informational route set.
- `courtcall-supporting-product.js` — new pure read-only analytics, Pulse activity/search, and Help matching helpers.
- `courtcall-supporting-product.css` — new responsive supporting-product layout and readability layer.
- `basketball-sw.js` — app-shell entries for the Phase 8 CSS/JS and cache version `v51`; navigation strategy is unchanged.

Focused test file:

- `tests/courtcall-phase8-supporting-product.test.js` — 10 Phase 8 tests.

Existing tests updated only for the intentional service-worker cache version:

- `tests/courtcall-design-foundation.test.js`
- `tests/courtcall-global-visual-system.test.js`
- `tests/courtcall-landing-hub-separation.test.js`
- `tests/courtcall-phase4-core-game.test.js`
- `tests/courtcall-phase5-team-history.test.js`
- `tests/courtcall-phase6-tournaments.test.js`
- `tests/courtcall-phase7-communities.test.js`
- `tests/courtcall-visual-motion-foundation.test.js`

No Supabase file, migration, tournament implementation, Community permission handler, game implementation, manifest, cinematic file, or localStorage key was changed.

## 4. Analytics

Analytics now derives deterministic insights from records CourtCall already owns:

- saved and competitive game totals;
- decided games, ties, cancelled games, and no-contests;
- combined points, average combined points, average final margin, and games decided by two points or fewer;
- game-format counts;
- case-insensitive team records with games played, wins, losses, draws, points for, points against, differential, and win rate;
- player career rows using the existing `CourtCallCore.calculatePlayerCareerStats` contract;
- tournament totals, active/completed counts, and fixtures recorded;
- Community, roster-player, post, and event totals;
- device usage counters as a clearly separated secondary section.

Cancelled and no-contest games never become wins or losses. Team statistics are explicitly separate from History’s established Home/Team-A career perspective. Player rows appear only when saved games contain player lineups. Empty records render honest team and player empty states.

Analytics export now contains the derived snapshot plus metadata. Reset clears device-only usage counters and explicitly preserves matches, tournaments, players, and communities.

## 5. Pulse

Pulse preserves its non-news-API contract and now separates three content classes:

1. **Local CourtCall activity** — read-only cards derived from saved competitive matches, tournaments, Community posts, and Community events.
2. **External live-search shortcuts** — HTTPS Google or Google News searches built from manually entered location fields.
3. **Developer samples** — visible only in the existing developer mode and labeled as sample/demo content.

Production never renders demo cards. Local cards route back into History, Tournament Detail, or Community Detail without changing the underlying records. Filters update both local activity and external shortcuts, expose `aria-pressed`, and produce an accurate empty state when no local record matches a category.

Location text is bounded and normalized before URL construction. CourtCall does not request device location, fetch a news feed, rank current stories, or imply that search results are verified. Online/offline status is stated directly.

## 6. Basketball World

Basketball World remains a static curated directory, now presented as an intentional supporting product rather than an unfinished feed.

- Retained six established destinations: NBA, WNBA, FIBA, EuroLeague, NCAA men’s Division I basketball, and BIG3.
- Updated the EuroLeague destination to its direct official section.
- Labeled the screen “Official resources, not a live feed.”
- Removed unsupported future news-feed and local-pickup-feed promises.
- Clarified that the directory remains readable offline while external destinations require a connection.
- Preserved safe new-tab behavior with `noopener noreferrer`.

No scores, standings, current news, rankings, or live sports API were added.

## 7. Help

The Help system remains entirely rule based. It makes no external AI call and continues to display “Beta Help · Keyword matching · Not AI.”

Changes:

- Extracted the existing keyword-scoring behavior into the pure Phase 8 support module so known-topic and fallback behavior are directly testable.
- Added an Analytics article covering record sources, exclusions, team grouping, player prerequisites, and usage-reset scope.
- Corrected Getting Started, Communities, Pulse, Basketball World, backup/import, and feedback instructions to match the actual application.
- Removed the false device-location instruction.
- Preserved the existing email fallback for unknown questions.
- Added a live search-result count.
- Preserved accordion state naming, keyboard activation, dialog focus trapping, Escape close, feedback controls, and saved Help history keys.

Live browser checks returned the Analytics article for “How does analytics work?” and the honest fallback for an unknown “quantum upholstery” query.

## 8. Legal/informational screens

Existing legal commitments and dates were not rewritten. Privacy and Terms now have:

- a page-level `h1`;
- logical `h2` section headings;
- a semantic `main` landmark;
- a maximum 760 px reading width;
- increased line height and phone-safe padding;
- visibly underlined links with existing focus treatment.

Settings About/version/build, Changelog, feedback, and Reset PIN behavior remain intact. The existing route contract still gates Reset PIN on a valid recovery session and keeps Changelog identity-gated.

## 9. Navigation

Verified routes:

- `#/analytics`
- `#/pulse`
- `#/world`
- `#/help-center`
- `#/privacy`
- `#/terms`
- local Pulse deep links to `#/community/:id`, `#/tournament/:id`, and `#/history`

Help Center is now a public informational route in both the browser route set and the core resolver. Its Back action remembers the originating screen and safely falls back to Landing for a visitor rather than exposing private Settings. Settings → Help → Back and Settings → Privacy → Back were browser verified.

Browser back from a Pulse local deep link returned to `#/pulse`; reload retained the Pulse route and regenerated the same read-only local activity. A real defect found during browser QA was fixed: route changes now reset `window.scrollY` and the active screen scroll position, so supporting pages no longer open midway down after another long page.

Landing/Hub separation was not changed.

## 10. Empty/error/offline states

- Analytics renders explicit no-team and no-player states instead of zero-filled fictional rankings.
- Pulse renders a category-specific no-local-activity state and keeps external shortcuts separately available.
- Pulse states whether external links are available online or require a connection.
- Settings now states current network availability separately from sync state.
- Existing sync copy remains authoritative; Phase 8 does not claim cloud success.
- World states that its directory is locally readable and external destinations require internet.
- Help content and keyword matching remain local/offline-capable.
- No asynchronous loading state was added to local calculations because the supporting module is synchronous and read-only.

Existing Community request/loading/permission behavior and Supabase error behavior were not altered.

## 11. Accessibility

Verified or added:

- unique static IDs and programmatically named form controls;
- named buttons and external-link new-tab context for assistive technology;
- page `h1` and section `h2` hierarchy on supporting and legal routes;
- legal `main` landmarks;
- Help result-count `role=status` with polite live updates;
- Help accordion `aria-expanded` and labeled regions;
- Pulse filter group and explicit `aria-pressed` state;
- semantic Analytics tables with column headers;
- keyboard-focusable local horizontal table scrollers;
- visible global focus styles;
- Help dialog naming, focus trapping, and Escape behavior;
- responsive and reduced-motion rules for new supporting styles.

The global forced-colors, focus-visible, route-announcement, and single-active-landmark foundations remain green in the complete suite.

## 12. Responsive verification

Responsive contracts were added for every requested size:

| Viewport | Supporting-product contract |
|---|---|
| 320×568 | Analytics cards collapse to one column; action buttons stack; World and Pulse fields use one column; dense tables scroll locally |
| 390×844 | Analytics uses two cards per row; World and Pulse use one-column content; phone margins remain 12–16 px |
| 844×390 | Four-column metrics fit within the 920 px dashboard cap; tables remain contained; horizontal Pulse filters scroll locally |
| 768×1024 | Dashboard and Help/legal max widths preserve readable line lengths; tables stay within local scrollers |
| 1440×900 | Analytics caps at 920 px; Help/legal cap at 760 px; World cards remain within the application layout |

Automated responsive-containment tests verify the phone breakpoints, locally scrollable tables, reduced-motion behavior, and app-shell CSS. The live in-app browser had a fixed 1280×720 content viewport: all seven supporting routes showed zero page-level horizontal overflow there, and Analytics and Pulse were visually inspected. Exact live resizing to the five requested dimensions was not exposed by the browser environment; this is recorded under Remaining limitations rather than overstated as live verification.

## 13. PWA/offline changes

- Added `courtcall-supporting-product.css?v=20260822` to the offline shell.
- Added `courtcall-supporting-product.js?v=20260822` to the offline shell.
- Advanced the service-worker cache to `courtcall-v51`.
- Preserved network-first navigation.
- Preserved bounded stale-while-revalidate caching for same-origin static assets.
- Did not cache third-party search results or external league destinations.
- Did not change or clear localStorage.

The final service-worker update prompt was activated and accepted in the live app; the update banner then remained hidden while the new Phase 8 UI and assets rendered. Direct HTTP checks returned 200 with `text/html`, `text/javascript`, and `text/css` for the canonical page and new support assets.

## 14. Test results

Syntax:

- `courtcall-supporting-product.js`: pass
- `courtcall-core.js`: pass
- `courtcall-global-visual-system.js`: pass
- `basketball-sw.js`: pass
- canonical inline application script: pass

Automated:

- Focused Phase 8: **10 passed, 0 failed**
- Complete regression suite: **159 passed, 0 failed**
- Baseline retained: previous **149 passed, 0 failed**, plus 10 Phase 8 tests

Focused coverage includes deterministic Analytics, honest Analytics empty states, local Pulse activity, Pulse URL sanitation and content labeling, Help known-topic and fallback matching, public/supporting route behavior, legal hierarchy, World no-live-data contracts, dependency boundaries, responsive containment, and the offline shell.

Live production browser checks at `http://127.0.0.1:8765/` verified:

- Analytics sections, real record-backed tables, no invented empty rows, and zero page overflow;
- Pulse local activity, no production demo cards, filters, six safe HTTPS search shortcuts, local deep links, back navigation, and reload persistence;
- six World destinations and removal of unsupported live-feed promises;
- Help search, result count, accordion, known response, fallback, non-AI labeling, keyboard Enter, and Escape close;
- Privacy and Terms headings, landmarks, reading width, and routing;
- Settings network/sync copy and supporting navigation;
- scroll reset across hash routes;
- no `pageerror` event across the seven supporting routes;
- final service-worker update activation and the absence of a stale update prompt.

## 15. Remaining limitations

- The in-app browser exposed a fixed 1280×720 viewport and rejected viewport emulation. The five requested exact sizes are covered by automated responsive contracts, but not by five separately resized live-browser sessions.
- A true network-disconnected browser session was not available. Offline behavior is verified through the service-worker shell contract, asset precache tests, active v51 update, and accurate online/offline UI logic; an air-gapped runtime check remains environment-dependent.
- The browser already contained a local profile. Anonymous Help/World/Privacy/Terms gating is verified by the pure route resolver and automated tests without destructively clearing that profile, not by a second clean browser profile.
- External league/search destinations naturally require the third-party sites and a network connection. CourtCall neither controls nor caches their content.
- Supabase connectivity was not required for Phase 8. No schema, table, column, RPC, RLS, or Community permission change was made; Phase 8 reads the established local/cloud-hydrated records already available to the app.

Phase 9 was not started. No commit or push was performed, and no Git command was used during this phase.
