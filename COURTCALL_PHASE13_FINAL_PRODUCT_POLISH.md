# CourtCall Phase 13 — Final Product Polish

**Branch:** `codex/phase13-final-product-polish` (uncommitted per stop conditions)
**Scope:** polish only. No new features, no engine/tournament/schema changes, Phase 11 offline safeguards and Phase 12 scoring UX preserved and re-verified.

---

## 1. Audit summary

Rather than eyeballing screens, the audit was **instrumented**: a Playwright probe walked 19 routes × 5 viewports (95 route renders) measuring document and element overflow, clipped/off-screen controls, text truncation, touch-target sizes, accessible names, heading structure, console errors, and 404s. A second probe took an h1 census per route; a third measured DOM growth and animation-frame activity.

Baseline: **70 raw findings, 0 document-level overflow, 0 console errors, 0 404s.** Triage reduced these to **9 genuine defects**; the rest were probe artifacts or WCAG-exempt patterns (documented in §4).

## 2. Issues found

| # | Severity | Area | Issue |
|---|---|---|---|
| 1 | **High** | Tournaments / mobile | The four primary sections (My Tournaments, Discover India, Following, Host) were a horizontal scroller. At 320px and 390px, **Following and Host rendered entirely off-screen** (x=326→509) — two of four primary sections undiscoverable on a phone. |
| 2 | Medium | Headings | `#/analytics`, `#/help-center`, `#/comm-create` each had **two `<h1>`s** — the nav-bar `page-title` plus the injected route-hero title. |
| 3 | Medium | Headings | `#/game` and `#/communities` had **zero `<h1>`** — no primary heading at all. |
| 4 | Medium | Design consistency | `page-title` was marked up inconsistently: 8 as `<div>`, 7 as `<h1>`, with no rule distinguishing them. |
| 5 | Medium | Copy | Cloud-failure toasts used **three different phrasings** across 21 sites: `saved locally; cloud sync failed.`, `is saved locally; cloud sync failed.`, and `is saved locally; secure cloud sync failed.` |
| 6 | Low | Copy | "secure cloud sync failed" — "secure" is technical noise with no user meaning. |
| 7 | Low | Copy | `saved locally on this device` — redundant; and Phase 10's "saved locally as pending" diverged from Phase 11's "on this device" vocabulary. |
| 8 | Low | Touch targets | Landing cinematic chapter dots were **18×18px** (below the 24px WCAG 2.5.8 minimum). |
| 9 | Low | Touch targets | Settings volume slider was a **16px-tall** drag target; the consent checkbox was **18×18px**. |

## 3. Issues fixed

1. **Tournament sections reachable on phones.** Below the 700px breakpoint the tab strip becomes a **2×2 grid** (`display:grid;grid-template-columns:1fr 1fr;overflow-x:visible`) instead of a scroller, and pills gained `min-height:44px`. The ≥700px centred row is untouched. Verified: all four tabs now render fully inside the viewport at 320 and 390.
2. **One primary heading per route.** Established and applied a clear rule: *the route-hero `<h1>` is the page heading where one exists; otherwise the nav `page-title` is.* Concretely — demoted `h1.page-title` → `div.page-title` on Analytics, Help Center, New Community; promoted Communities' label to `<h1>`; added a visually-hidden `<h1>Live game scoreboard</h1>` to the game screen so the scoreboard design is untouched. **All 19 routes now report exactly one visible h1** (census re-run post-fix).
3. **Unified cloud-failure copy.** All 17 "saved but not synced" toasts now read `<Thing> saved on this device · cloud sync failed`, matching the Phase 11 sync vocabulary, with "secure" removed and one separator. The four *"the action did not happen"* toasts (`Request was not approved because cloud sync failed.`) were deliberately left alone — they describe different semantics.
4. **Local-storage copy aligned** — `saved locally on this device` → `saved on this device`; `Submission saved locally as pending` → `Submission saved on this device as pending`.
5. **Touch targets raised.** Chapter dots 18px → **24px** hit area with the `::before` inset grown in step so the *visible* 6px dot is pixel-identical; volume slider `min-height:44px`; consent checkbox → **24px**.
6. **PWA versioning kept coherent** (§9).

## 4. Issues deliberately NOT changed

- **Pulse filter chips scroll horizontally** (4 of 7 off-screen at 390px). Unlike the Tournament tabs, these are seven peer *filter refinements*, the default "All" is visible first, and a horizontal chip scroller is the conventional mobile pattern; wrapping seven chips would cost ~150px of vertical space on a 568px screen. Horizontal scrolling here is *necessary*, not gratuitous. **Deferred as a judgment call, not an oversight.**
- **Inline text links on Privacy/Terms/Profile measured 14–19px tall.** WCAG 2.5.8 explicitly exempts links inline in a sentence; enlarging them would break paragraph typography.
- **25 "unnamed input" findings were false positives** — verified with a proper accessible-name probe (wrapping `<label>` and `label[for]`): **0 inputs genuinely lack a name** across Teams, Discover, Host, Settings, and Profile. No change made.
- **"TRUNC" findings on `.cc-sr-only` / `.sr-only` headings** are an artifact of screen-reader clipping (`scrollWidth > clientWidth` by design).
- **Performance:** no changes. Measured **zero DOM node growth** across 5 full navigation cycles (2238 → 2238 nodes) and **zero animation frames** while parked off-landing — no leaks, no runaway loops, nothing to fix. Per the "no speculative rewrites" instruction, nothing was touched.
- **Core game engine, tournament algorithms, router, Supabase schema/RLS** — untouched, as required.

## 5. Files changed

| File | Change |
|---|---|
| `index.html` | Heading semantics on 5 screens; 20 copy strings unified; volume-slider and consent-checkbox touch targets; two stylesheet version pins. |
| `courtcall-discover-india.css` | Phase 13 block: 2×2 tournament tab grid below 700px + 44px pill height. |
| `courtcall-cinematic.css` | Chapter-dot hit area 18px → 24px with compensating `::before` inset. |
| `basketball-sw.js` | `CACHE_VERSION` **v57 → v58**; cinematic and discover stylesheet precache URLs re-pinned to `?v=20260825`. |
| `tests/courtcall-phase13-final-polish.test.js` | **New** — 12 focused Phase 13 tests. |
| 13 existing test files | v57 → v58 pins; cinematic CSS pin; Phase 7 toast expectation updated to the unified phrase. |

## 6. Improvements by category

**Design consistency:** one documented heading rule across all 19 routes; primary navigation no longer hides items on mobile; tab pills share the product-wide 44px target.
**Mobile:** two previously unreachable primary sections restored at 320/390px; no horizontal page overflow at any of the five viewports; every scoring control still inside the viewport.
**Accessibility:** exactly one primary heading per route (screen-reader landmark integrity); three sub-minimum touch targets raised to spec; the live-game h1 is screen-reader-only so no visual regression; no accessible names were missing to begin with.
**Copy:** 20 strings unified onto the Phase 11 vocabulary; technical jargon removed; capitalization and separators consistent; no unsupported promises introduced.
**Performance:** verified clean, unchanged.

## 7. PWA / version changes

Two precached stylesheets changed content, so both were re-pinned **in lockstep** across `index.html` and the service-worker precache list, and the cache version advanced:

- `courtcall-cinematic.css?v=20260814b` → `?v=20260825`
- `courtcall-discover-india.css?v=20260822` → `?v=20260825`
- `courtcall-core-game.css?v=20260824` (unchanged this phase)
- **`CACHE_VERSION = 'v58'`**

Link/precache parity is asserted by a test that reads the `<link>` URL from the HTML and requires the identical string in the shell list. The Phase 11 architecture (atomic precache, 5xx shell fallback, shell-precache fallback for runtime assets, user-driven `SKIP_WAITING`) is unchanged and re-asserted.

## 8. Test results

- **Focused Phase 13: 12/12 pass** — heading rule (both directions), tournament tab reachability, touch-target specs, copy unification, "failure copy never claims success", link/precache parity + v58, Phase 11 architecture intact, Phase 12 scoring intact.
- **Full regression: 249/249 pass** (237 prior + 12 new). 15 tests initially failed; all 15 were expected-value updates from deliberate Phase 13 changes (13 cache pins, 1 cinematic CSS pin, 1 copy assertion) — each reviewed individually before updating, with the underlying contract preserved.
- **`node --check`** clean on every root JS file, test file, build tool, and the extracted inline `index.html` script. All three touched stylesheets have balanced braces.
- **Production artifact: 69 files**, no repository internals leaked.

## 9. Browser QA

Against the built artifact, headless Chromium:

- **Route matrix — 19 routes × 5 viewports (320×568, 390×844, 844×390, 768×1024, 1440×900):** no document overflow, no console errors, no 404s at any size. The 8 tournament-tab clipping findings are **gone**; remaining flags are the documented exemptions in §4.
- **Phase 12 scoring regression — 29/29 pass** on the polished build, including exact rapid-tap totals (C=4 A=3 D=5 B=1 → 7–6), the 10-tap burst (exactly 10 events), win/undo, save/reload, and all five viewports.
- **Service-worker update flow — 4/4:** update prompt appears for the waiting worker, reload activates the new version, obsolete `courtcall-v58` caches cleaned, and an **active game survived the update reload**.

## 10. Realistic walkthrough — 24/24

All 19 prescribed steps passed end to end: landing → guest → hub → setup with rosters → player scoring (Cy +2 → 2/2) → undo (→ 0/0) → end game with victory overlay → history shows the finished game → tournaments (all four tabs on-screen) → Discover India → follow persists → communities → analytics → settings → help → offline (shell renders, "Offline · Saved on this device") → offline reload served by the service worker → reconnect ("Online · Saved on this device"). Navigation checks: browser Back returned to Hub correctly; offline Communities showed the **offline** state ("📴 You're offline… saved on this device"), never a false "empty".

One walkthrough failure during development was traced to a **wrong selector in my test script** (`comm-discover-list` vs `discover-comm-list`), not a product defect — the offline state was verified correct by direct DOM inspection before the probe was corrected.

## 11. Limitations

- All QA ran in **headless Chromium only** — no Safari/iOS, Firefox, or real-device pass. Touch-target *sizes* are verified by measurement, but real finger ergonomics, haptics, and sub-pixel rendering are not.
- **Contrast was not measured programmatically.** No contrast defects were fixed because none were measured; this is a gap, not a clearance.
- Screen-reader behaviour was verified **structurally** (heading census, accessible-name probe, `aria-live` inspection), **not** with VoiceOver/TalkBack.
- The h1 census counts *visible* h1s at 390px; a screen whose heading only appears at another breakpoint would not be caught.
- Copy was polished for consistency and clarity; **no native-speaker editorial pass or localisation review** was performed.
- Cloud *success* paths remain unexercised — the Supabase host is unreachable from this sandbox, so failure/offline paths are what got tested (thoroughly).

## 12. Remaining manual checks

1. Real-device pass (iOS Safari + Android Chrome): tournament 2×2 tabs, chapter dots, volume slider, consent checkbox under an actual thumb.
2. VoiceOver/TalkBack sweep confirming one heading per route and that the live-game sr-only h1 announces sensibly.
3. Automated or manual **contrast audit** across the Midnight Arena palette.
4. Editorial read-through of the unified failure copy in context.
5. Post-deploy: confirm SW **v58** activates and the update prompt appears on stale tabs.

## 13. Intentionally deferred to Phase 14

- **Pulse filter-chip overflow** (§4) — revisit if user feedback shows people miss the later categories.
- **Programmatic contrast + automated a11y (axe) sweep** in CI, which would replace several hand-rolled probes used here.
- **Cross-browser/device QA matrix** beyond headless Chromium.
- **Per-player voice attribution** (voice still scores to the team, unchanged since Phase 12).
- **Fouls still use the player-picker modal** — the only remaining two-step action on the live screen, deliberately preserved in Phase 12 and untouched here.
