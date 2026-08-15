# CourtCall Global Visual System

**Pass:** Midnight Arena OS visual-continuity pass  
**Canonical production entry point:** `index.html`  
**Production page tested:** `http://127.0.0.1:8765/`  
**Branch:** `codex/phase5-team-history`  
**Common working-tree baseline:** `2f91cb0e8b1df9921053e194fe7e605dbf4d0a9f`  
**Status:** Complete and ready for visual review. No subsequent functional phase has been started.

## 1. Outcome

The canonical CourtCall application now carries one continuous **MIDNIGHT ARENA OS** language from the cinematic landing experience into its internal routes. Internal pages use route-aware gradients, court geometry, arena lighting, optimized Higgsfield-derived stills, basketball-specific cards, compact page heroes, broadcast data treatments, and restrained native motion. Large landing videos are not reused inside the application.

This was a presentation-only pass. It did not change scoring rules, storage schemas, Supabase mappings, tournament progression, or community permissions. The two application hooks added to `index.html` only notify the presentation layer when the active route or community tab changes.

## 2. Before/after route audit

The before grades reflect the pre-pass production source and visual inspection. The after grades reflect the final implementation, production-browser inspection, responsive matrix, and automated visual-contract tests.

| Surface | Before | After | Final basketball expression |
|---|:---:|:---:|---|
| Landing | A | A | Existing five-stage cinematic journey remains the premium entry moment. |
| Home / Hub | C | A | Empty-court arena crop, orange/blue opposing light, centre-court geometry, floor reflection, basketball hero, broadcast action and status cards. |
| Game Setup | B | A | Locker-room control-panel atmosphere, opposing team light fields, court HUD, sports chips, strong tip-off action. Existing team-colour preview behaviour remains intact. |
| Live Game | A | A | Split-team arena field, giant scores, lead aura, clocks, possession, event feed, foul state, score motion, and victory treatment remain dominant; no decorative image competes with scoring. |
| Teams | B | A | Player-tunnel hero, court grid, trading-card surfaces, rating hierarchy, team zones, balance/draft treatments. |
| Queue / Who Got Next | B | A | Sideline lighting, baseline queue treatment, status hierarchy, next-team spotlight, winners-stay court status styling. |
| History | B | A | Final-score wall, winner emphasis, broadcast results, settled arena atmosphere, performance-stat treatment. |
| Tournaments | C | A | Championship crop, restrained gold, bracket geometry, match-card hierarchy, champion lighting, tournament-specific empty state. |
| Communities directory | C | A | Warmer local-court atmosphere, compact togetherness hero, basketball cards, court-line dividers, distinct offline/request/true-empty states preserved. |
| Community detail | C | A | Community identity sits over the global court system with a route hero and basketball-specific subview treatments. |
| Community players | C | A | Scouting/trading-card hierarchy for jersey, position, ratings, games, wins, points, MVPs, and badges. |
| Gallery | C | B | Match-day media-wall framing, poster cards, sports tabs, and score-overlay-ready surfaces. |
| Events | C | A | Fixture-card styling emphasizes date, time, court, type, RSVP, and availability. |
| Leaderboards | B | A | Arena ranking hierarchy with broadcast numbers and gold/silver/bronze podium treatment. |
| Pulse | C | A | Sideline/action crop, editorial sports cards, court dividers, and restrained route entrance. |
| Basketball World | C | A | Arena editorial atmosphere and basketball-specific information-card system. |
| Settings | D | B | Calmer arena-dark surfaces, premium dividers, basketball micro-details, and unchanged high-readability controls. |
| Help Center | C | A | Playbook hero, tactic-board lines, playbook dividers, legible help categories and guides. |
| Analytics | C | A | Performance-stat hero, broadcast metric cards, sports numbers, and court-grid chart context. |
| Profile / Auth | B | A | Static cinematic arena crop, darkened lighting, premium glass card, strong CourtCall entry identity. |
| Privacy / Terms / Reset PIN | C | B | Arena-dark legal/auth shell with controlled contrast, court dividers, and intentionally low visual intensity. |
| Victory state | A | A | Existing winning colour plus gold, final-score hierarchy, restrained confetti, and immediate actions remain unchanged. |
| Empty states | C | A | Court-mark illustration language and route-specific basketball copy/treatment replace generic blank panels. |
| Modals / Sheets / Toasts | C | B | Midnight glass, court-line detail, strong typography, orange/team accent states, and visible focus. |
| Forms | B | A | Arena-dark fields, sports labels/chips, premium focus treatment, and preserved validation semantics. |
| Navigation | B | A | Persistent Midnight Arena chrome, smooth active indicator, compact mobile state, basketball route context, and unchanged hash routing. |

No audited production surface remains at grade C or D.

## 3. Shared visual primitives added

The additive stylesheet exposes reusable, framework-free primitives rather than route-specific one-offs:

- `.cc-arena-gradient` — layered midnight arena light field.
- `.cc-team-aura` — orange/blue team-light surface.
- `.cc-court-lines` — scalable court geometry.
- `.cc-floor-reflection` — low-contrast maple/arena reflection.
- `.cc-broadcast-stat` — sports-broadcast metric hierarchy.
- `.cc-score-card` — final/live score framing.
- `.cc-player-card` — scouting/trading-card material.
- `.cc-tournament-card` — bracket and fixture surface.
- `.cc-championship-glow` — restrained gold championship emphasis.
- `.cc-court-hud` — pregame/live control panel treatment.
- `.cc-basketball-badge` — sports identity and status badge.
- `.cc-premium-divider` — court-line section divider.
- `.cc-route-hero` — compact, route-aware internal hero.

The route helper maps every production screen to an atmosphere, visual grade, eyebrow, title, and optional compact hero. Community subviews receive their own Players, Gallery, Events, Leaderboard, Feed, Members, and Settings treatments without duplicating the application.

## 4. Higgsfield assets reused

Ten lightweight WebP crops were derived from the five existing approved Higgsfield clips:

| Source clip | Reused atmosphere | Desktop | Mobile |
|---|---|---:|---:|
| Empty Court | Home, auth, settings, general arena | `arena.webp` — 45,360 B | `arena-mobile.webp` — 22,148 B |
| Tip-Off | Setup, teams, locker-room controls | `locker.webp` — 34,520 B | `locker-mobile.webp` — 18,512 B |
| The Run | History, analytics, Pulse, sideline | `sideline.webp` — 29,930 B | `sideline-mobile.webp` — 15,854 B |
| Clutch Moment | Live/match intensity context | `clutch.webp` — 29,022 B | `clutch-mobile.webp` — 16,842 B |
| Victory | Tournament, champion, community achievement | `championship.webp` — 26,228 B | `championship-mobile.webp` — 16,188 B |

The complete atmosphere set is 254,604 bytes. No new AI/Higgsfield imagery was generated in this pass; only optimized still derivatives of existing media were created.

## 5. Route-aware atmosphere and motion

- Route changes update a single presentation data attribute and use a 280 ms opacity/transform transition. Navigation and hash changes are not delayed.
- Home uses `arena`; setup/teams use `locker`; history/Pulse/analytics use `sideline`; live game uses `clutch`; tournaments/community achievements use `championship`.
- The landing controller continues to tear down after application entry, so its video/scroll machinery does not follow the user through internal routes.
- The new helper creates no `requestAnimationFrame`, interval, timeout, fetch, storage, Supabase, or continuous-particle work.
- `prefers-reduced-motion`, the existing in-app reduced-motion preference, forced-colours, and save-data presentation states are covered.

## 6. Performance impact

| Addition | Size / behaviour |
|---|---|
| Global visual CSS | 31,750 bytes, additive and loaded after the cinematic layer. |
| Global visual helper | 6,762 bytes, presentation-only and loop-free. |
| Atmosphere stills | 254,604 bytes total; each route references at most one applicable still. |
| Largest still | 45,360 bytes. |
| Mobile selection | Dedicated 640×800 crops are selected at mobile breakpoints. |
| Data Saver | The helper adds a save-data state and CSS removes photographic atmosphere, retaining gradients/court geometry. |
| Offline shell | CSS and helper are precached under service-worker cache `v36`; route stills are intentionally runtime-lazy rather than shell-prefetched. |
| Internal videos | Zero visible video elements on every internal route in the responsive route matrix. |
| Animation cost | Transform and opacity only for route entrances; no lingering RAF loop and no continuous particle system. |

## 7. Responsive production verification

Testing was performed against the canonical production page, not a copied harness: `http://127.0.0.1:8765/`.

### Route matrix

Fifteen directly reachable internal routes were exercised at all five required viewports (75 route-size cases): Home, Setup, Teams, History, Tournaments, Basketball World, Communities, Create Community, Pulse, Settings, Analytics, Help Center, Profile, Privacy, and Terms.

| Viewport | Route cases | Document overflow | Active-screen overflow | Visible internal video |
|---:|---:|---:|---:|---:|
| 320×568 | 15 | 0 px | 0 px | 0 routes |
| 390×844 | 15 | 0 px | 0 px | 0 routes |
| 844×390 | 15 | 0 px | 0 px | 0 routes |
| 768×1024 | 15 | 0 px | 0 px | 0 routes |
| 1440×900 | 15 | 0 px | 0 px | 0 routes |

Each case resolved to the expected active route, loaded the global visual stylesheet, and reported visual grade A at the route layer.

### Live-game matrix

The actual production setup flow was used to start a game, and the active live scoreboard was checked at all five viewports. Every size had 0 px document and active-screen overflow, four visible scoring actions, and five visible game controls.

Two consecutive Team A `+1` actions were issued without waiting for an animation to end: the score changed from 0 to 2. Two Undo actions restored it to 0. No score tap was dropped, no visual layer blocked input, and the 844×390 landscape layout retained the full scoring surface.

The 320×568 More sheet was also inspected after transition completion. Its full 3×3 navigation grid remains reachable; Help Center is available there while the floating help control is suppressed at narrow widths to prevent content overlap.

### Accessibility and constrained modes

- Reduced motion is covered by both OS media-query and existing in-app preference contracts; entrance animation collapses without removing state or focus information.
- Save-data removes internal poster imagery and keeps the gradient/court system, so controls and identity remain intact.
- Focus-visible styling and existing keyboard semantics are preserved.
- Atmospheric colour is decorative; headings, labels, scores, winners, possession, and status remain explicit in text.
- Mobile image crops prevent desktop focal points from forcing oversized background downloads or unreadable framing.

## 8. Regression result

Command:

```text
node --test tests/*.test.js
```

Result: **111 passed, 0 failed, 0 skipped** in 1.923 seconds.

The suite covers the cinematic landing, game outcomes, scoring and undo, routing, design foundation, global visual layer, notifications, Phase 4 core game, Phase 5 team/history, community security, settings/accessibility, and visual-motion foundation. New global-system tests verify:

- visual load order and offline shell availability;
- route configuration for all 19 production screens;
- shared primitive coverage;
- existence and weight of all desktop/mobile atmosphere crops;
- basketball-specific community-subview heroes;
- presentation-only, loop-free, save-data-aware implementation;
- balanced CSS and JavaScript blocks.

Production console inspection found no error originating in the global visual CSS or helper. The only repeated console errors were existing environment-dependent Supabase community-sync `Failed to fetch` messages from the local environment.

## 9. Files changed by this pass

- `courtcall-global-visual-system.css` — global atmosphere, primitives, routes, responsive and accessibility states.
- `courtcall-global-visual-system.js` — presentation-only route/community visual mapping.
- `assets/atmospheres/*.webp` — ten optimized desktop/mobile crops.
- `index.html` — load the visual layer, notify it of route/community-tab changes, and retain mobile Help access in the More sheet.
- `basketball-sw.js` — cache version `v36`, global CSS/helper offline shell entries.
- `tests/courtcall-global-visual-system.test.js` — dedicated visual-system contract tests.
- Existing Phase 3/4/5/motion contract tests — expected service-worker version updated from `v34` to `v36`.
- `COURTCALL_GLOBAL_VISUAL_SYSTEM.md` — this report.

All other dirty working-tree changes predate this pass and were preserved. Nothing was reset, discarded, committed, or pushed.

## 10. Remaining limitations and environment-dependent checks

1. **Populated community-detail capture:** The local environment did not have an available community membership/detail record and Supabase community sync failed with `Failed to fetch`. The detail and all subview presentation contracts are implemented and automated, but a populated server-backed community should receive a final visual capture when that environment is available.
2. **Physical-device performance:** Desktop browser emulation verifies layout, input, responsive crops, save-data/reduced-motion contracts, and loop absence. A low-end physical Android device remains the best final confirmation of GPU compositing and real network decode time.
3. **Service-worker activation:** The new `v36` shell was discovered during testing and the application showed its existing update-ready prompt. The next accepted reload activates the new shell; offline entries are covered by automated tests.
4. **Pre-existing blank-game cancellation bug:** Production QA exposed that cancelling a zero-score game calls `clearSave()` and then route exit invokes `pauseGameRuntime()`, which immediately stores a fresh blank game again. Fixing that ordering would change game/storage logic and was therefore deliberately excluded from this visual-only pass. It should be addressed in a later authorized functional phase.

The visual foundation is complete. The next functional phase remains paused pending review of this document and the production visuals.
