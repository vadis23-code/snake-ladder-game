# CourtCall Cinematic Landing / Higgsfield Phase

Date: 2026-08-10  
Canonical production entry point: `index.html`  
Canonical production URL: `http://127.0.0.1:8765/`  
Branch: `codex/phase5-team-history`  
Baseline commit at phase start: `2f91cb0e8b1df9921053e194fe7e605dbf4d0a9f`  
Commit/push status: **Not committed and not pushed, as required.**

## 1. Outcome

The cinematic public landing experience is implemented in the canonical CourtCall SPA. It uses five connected Higgsfield/Seedance clips, one selected master arena reference, native scroll progress, `requestAnimationFrame`, sticky positioning, CSS transforms and video `currentTime` seeking.

The landing is not a separate application. Its real CTAs enter the existing setup and communities routes. On entry to the operational app, the controller cancels its pending frame, removes listeners, disconnects its observer, pauses media, removes video sources and releases its active state.

No game, team, tournament, storage, Supabase, community-permission, voice-grammar or manifest contract was changed. The service-worker cache version was advanced only to distribute the new presentation files and still-image fallbacks; its registration, scope, fetch policy and navigation contract are unchanged.

## 2. Phase boundaries honored

- Implemented only the cinematic public landing phase.
- Used `index.html`, the confirmed canonical production entry point.
- Did not duplicate the application in `basketball.html`.
- Did not change core score rules, game state, clocks, team balancing, queue rotation, tournament calculations or match-history calculations.
- Did not add or rename localStorage keys.
- Did not change Supabase tables, columns, RPCs or RLS assumptions.
- Did not change community roles or permissions.
- Did not change voice commands or grammar.
- Did not add GSAP, Lenis, Three.js, React or another animation framework.
- Removed the superseded standalone Canvas basketball widget and its orphaned runtime/style dependencies.
- Did not begin the next functional phase.

## 3. Higgsfield verification

Higgsfield was connected and authenticated before media generation.

Available capabilities verified:

- Credit/balance lookup and cost estimation.
- Model listing, search, recommendation and model-detail lookup.
- Image generation.
- Video generation.
- Audio generation (available but deliberately unused).
- Media upload and upload confirmation.
- Job display, job status and job-history lookup.
- Seedance 2.0 video generation.
- Image reference controls.
- Start-image controls.
- End-image controls.
- 16:9, 1080p video output.
- Silent generation with generated audio disabled.
- 4–15 second Seedance duration support.

Credit verification:

- Opening balance: 449.5 credits.
- Three master still candidates: 12 credits total.
- Six 8-second 1080p high-quality Seedance runs: 432 credits total.
- One video run was a rejected Clip 2 take and was regenerated cleanly.
- Final balance: 5.5 credits.

Because Higgsfield was available, `HIGGSFIELD_PRODUCTION_PLAN.md` was not needed.

## 4. Master reference generation

Image model: `cinematic_studio_2_5`  
Format: 4K, 16:9  
Subject: realistic premium orange basketball on the centre-circle line of a dark midnight indoor arena; warm orange light at left, electric-blue light at right, polished maple reflections, black seating, haze, extremely low symmetrical courtside camera; no text, logos, watermark or identifiable athletes.

Candidate jobs:

| Candidate | Higgsfield job | Result |
|---|---|---|
| 01 | `6b679ddb-b1f6-40d7-8748-eb05b73306aa` | **Selected** |
| 02 | `36152702-3019-48fe-8c51-b2a2c561e82c` | Not selected |
| 03 | `df7821d6-7dd6-4846-b97d-498cb5622ab7` | Not selected |

Candidate 01 was selected for its realistic ball, usable court geometry, orange/blue split, arena depth, centred composition and clean HTML-copy space.

Compact candidate references are preserved in `assets/cinematic/candidates/`. Raw 4K candidate originals were kept outside the repository working tree to prevent unnecessary source bloat.

## 5. Connected video generation

Video model: Seedance 2.0  
Format: 1920×1080, 16:9  
Generated duration: 8 seconds each  
Generated audio: disabled  
Identity policy: anonymous/non-identifiable silhouettes only; no text, logos or watermarks.

Every approved clip was generated in order. The exact extracted final frame of each accepted clip was uploaded as the next clip's start reference.

| Stage | Approved job | Continuity frame used for next stage | Notes |
|---|---|---|---|
| 01 Empty Court | `5bd10c00-5072-4075-aec0-4fb5d49101b1` | `a724e64b-2216-431e-ade9-b38455625448` | Ball settles at centre; far hoop and light split preserved. |
| 02 Tip-Off | `a7d41235-ee0d-449e-be85-761a87ee5f60` | `522e3275-9e81-4e65-9748-515a1a04c686` | Clean replacement take. |
| 03 The Run | `a5990c52-90d6-495d-8762-74e50f3c0978` | `e45b227e-f825-4fc4-8461-2cf6c7833707` | Low tracking/dribble continuity retained. |
| 04 Clutch Moment | `39631f5f-ebd7-4382-bd39-9462a1f7dcf1` | `c76c6171-f09e-4265-b004-0e906865e797` | Approved above-rim continuity frame taken at 6.5 s. |
| 05 Victory and Community | `58da26f4-cc14-4bcf-8db5-a8cba30eb7b6` | Final sequence | Net, celebration, restrained gold and CTA space retained. |

Rejected video:

- Clip 2 job `a4604f22-b5b8-416d-8be7-c658971051f7` was rejected because a transient jersey “7” violated the no-text/no-markings requirement.
- It is not referenced by the production page.

Controlled production adjustments:

- Clip 3 finishes closer to the lane than the ideal three-point gather, but preserves the approved anonymous athletes, direction, court, ball and lighting language.
- Clip 4's raw generation continued beyond the required above-rim moment. Production output uses the clean 6.5-second above-rim endpoint, retimed to exactly 8 seconds. Clip 5 was generated from that exact endpoint.

## 6. Web asset package

Production folder: `assets/cinematic/`

Master assets:

- `courtcall-master.webp` — 128,830 bytes.
- `courtcall-master.jpg` — 256,624 bytes.
- `courtcall-master-mobile.webp` — 77,050 bytes.

Per-stage outputs:

- `01-empty-court.{webm,mp4}` plus WebP/JPG poster and mobile WebP.
- `02-tip-off.{webm,mp4}` plus WebP/JPG poster and mobile WebP.
- `03-the-run.{webm,mp4}` plus WebP/JPG poster and mobile WebP.
- `04-clutch-moment.{webm,mp4}` plus WebP/JPG poster and mobile WebP.
- `05-victory.{webm,mp4}` plus WebP/JPG poster and mobile WebP.

Encoding validation:

| File family | Codec | Duration | Resolution | Audio |
|---|---|---:|---:|---|
| Five MP4 files | H.264 High, yuv420p, fast-start | 8.00 s each | 1920×1080 | None |
| Five WebM files | VP9 Profile 0 | 8.00 s each | 1920×1080 | None |

Encoding details:

- MP4: H.264 CRF 24, slow preset, yuv420p, fast-start.
- WebM: VP9 CRF 32.
- Keyframes every 12 frames to keep reverse/forward scroll seeking responsive.
- No audio track in any production video.
- Total cinematic package, including candidates and all fallbacks: 31 files, 35.29 MiB.
- Initial load requests only the master poster and current clip. Later clips are lazy-loaded as their stage approaches.

## 7. Landing implementation

New presentation files:

- `courtcall-cinematic.css`
- `courtcall-cinematic.js`

Canonical markup lives once in `index.html` under `#cc-cinema`.

Controller behavior:

- Native page scrolling remains fully user-controlled.
- No wheel/touch interception and no scroll hijacking.
- A passive scroll listener updates a target progress value.
- `requestAnimationFrame` runs only while progress is unsettled.
- Scrolling upward drives the same stage calculation in reverse.
- Video does not call `.play()` and does not autoplay independently.
- Active video time is derived from stage-local scroll progress.
- Current and near-next clips are loaded; all other clips remain unloaded.
- Five keyboard-accessible chapter controls use the same native scroll path and expose the current step with `aria-current="step"`.

Pinned story stages:

1. Empty Court — operating-system message and Start/Explore CTAs.
2. Tip-Off — supported game formats, scoring, clocks, colours and assignments.
3. The Run — live scoring, fouls, timeouts, possession, undo, clocks, voice and offline-first.
4. Clutch Moment — deterministic score/history-derived insight language only.
5. Victory and Community — tournaments, community surfaces and final real-app CTAs.

HUD states:

| Stage | Period | Clock | Score | Pace/message |
|---|---|---:|---:|---|
| Empty Court | PREGAME | 00:00 | 0–0 | READY |
| Tip-Off | Q1 | 00:00 | 0–0 | SET |
| The Run | Q1 | 06:24 | 12–9 | FAST |
| Clutch | GAME POINT | 00:38 | 19–19 | ONE POSSESSION / 50–50 |
| Victory | FINAL | 00:00 | 21–19 | COURTCALL |

The HUD also includes the shot-clock ring, possession marker, momentum strip and event ticker. State is communicated with labels and numbers, not colour alone.

## 8. Routing and teardown

- Anonymous users now land on the public cinematic hub instead of being forced directly to the profile screen.
- Returning local/signed-in profiles still receive the existing operational dashboard; the cinematic layer remains `display:none`, loads zero videos and runs no RAF.
- `START A GAME`, `START PLAYING`, the top-nav Start Game button and `Skip to App` enter the existing setup flow.
- `CREATE YOUR COMMUNITY` and `EXPLORE COMMUNITIES` use the existing communities route.
- Hash routing is preserved.

Observed teardown after `START A GAME`:

- Active screen: `s-setup`.
- URL hash: `#/setup`.
- Cinematic active: `false`.
- Pending RAF: `false`.
- Registered cinematic listeners: `0`.
- Loaded cinematic video sources: `0`.

Observed teardown after `CREATE YOUR COMMUNITY`:

- Active screen: `s-communities`.
- URL hash: `#/communities`.
- Cinematic active: `false`.
- Pending RAF: `false`.
- Registered cinematic listeners: `0`.
- Loaded cinematic video sources: `0`.

## 9. Fallback and accessibility behavior

Poster/loading:

- The selected master WebP is present before any video metadata is ready.
- Each video carries an individual poster reference.

Static-sequence mode is selected for:

- `prefers-reduced-motion: reduce`.
- CourtCall's in-app reduced-motion preference.
- Width at or below 760 px.
- Height at or below 520 px.
- Save-Data connections.
- Reported device memory of 4 GiB or lower.
- Browsers without usable video support.
- Video load failure.

Accessibility:

- All CTAs and stage controls are native buttons.
- Focus-visible styling remains enabled.
- Story panels update `aria-hidden`.
- Current chapter updates `aria-current`.
- HUD scores use an atomic live region.
- Status/fallback messages use a polite live region.
- Reduced motion removes cinematic transitions and animated grain/scroll cues.
- Forced-colour styles keep controls and HUD borders legible.

If all video and image files fail, the CSS background, HTML copy, HUD and real-app CTAs remain usable.

## 10. Standalone Canvas basketball removal

Removed from `index.html`:

- Legacy public S1–S6 marketing markup superseded by the cinematic story.
- `#ball-canvas` and `bd-*` widget markup.
- Canvas basketball CSS.
- Texture sampling, seam rendering, drag/spin, momentum, particle sparks and continuous widget RAF code.
- Widget-specific observers/listeners.

Preserved:

- `icons/basketball-3d.webp`, because it is still used by the real CourtCall nav, onboarding and footer branding.

Post-removal scan found no `ball-canvas`, `bd-wrap`, `bd-btn`, `BALL_PX`, `_ballTex` or `3D Basketball Renderer` references.

## 11. PWA distribution

`basketball-sw.js` cache version is `v34`.

The shell now includes:

- Versioned cinematic CSS and controller JS.
- Selected master desktop/mobile stills.
- All five desktop WebP posters.
- All five mobile WebP stills.

Large MP4/WebM files are intentionally not precached. They are requested on demand, while offline and low-cost modes have cached stills. Manifest name, start URL, display mode, service-worker scope, route fallback and storage contracts are unchanged.

## 12. Verification results

### Automated regression

- Node test runner: **104 passed, 0 failed**.
- New cinematic contract tests cover assets, native scroll/video architecture, lazy loading, teardown, fallbacks, data-contract isolation, Canvas removal, real routing and offline still availability.
- Inline `index.html` script parsed successfully.
- `courtcall-cinematic.js` passed syntax validation.
- Static ID inventory: 440 IDs, 0 duplicates.

### Browser-tested viewports

The anonymous cinematic page was tested from the same canonical workspace/server bytes at:

| Viewport | Experience | Video sources at initial stage | Horizontal overflow | Result |
|---:|---|---:|---:|---|
| 320×568 | Mobile still sequence | 0 | 0 px | Pass |
| 390×844 | Mobile still sequence | 0 | 0 px | Pass |
| 844×390 | Compact landscape still sequence | 0 | 0 px | Pass |
| 768×1024 | Tablet video scrub | 1 | 0 px | Pass |
| 1440×900 | Desktop video scrub | 1 | 0 px | Pass |

Verified interactions:

- All five story stages advance and reverse.
- Active copy, quarter, clock, score, pace, possession, momentum and ticker stay synchronized.
- Sticky stage stays below the sticky nav during progression.
- Mobile/landscape crops preserve the ball, copy, HUD and CTAs.
- Only the current clip is loaded at first; later clips load as approached.
- `START A GAME`, `Skip to App` and community CTAs use real routes.
- Media-failure injection switched to static mode with copy and CTA still usable.
- No cinematic-source console errors.
- Eight rapid live-score taps produced an 8–0 score with no dropped tap after cinematic teardown.

### URLs used

- Exact canonical production URL and returning-profile/app teardown check: `http://127.0.0.1:8765/` (normalized by the SPA to `#/hub`).
- Clean anonymous-origin visual viewport checks: `http://localhost:8765/`.
- Isolated media-failure and score-regression checks from the same workspace bytes: `http://127.0.0.1:8766/`.

The secondary clean origins were used only to avoid inspecting, clearing or overwriting the existing profile stored for `127.0.0.1:8765`.

## 13. Contract preservation

Confirmed by source scan and regression tests:

- No cinematic JavaScript reference to localStorage or sessionStorage.
- No new or renamed storage key.
- No Supabase access from the cinematic controller.
- No Supabase schema, table, column, RPC or permission change.
- No tournament calculation change.
- No team/queue calculation change.
- No game-state or score-rule change.
- No community permission change.
- No voice grammar change.
- No generated claim of AI prediction.
- No external animation dependency.

## 14. Files changed in this phase

New:

- `COURTCALL_CINEMATIC_HIGGSFIELD_PHASE.md`
- `courtcall-cinematic.css`
- `courtcall-cinematic.js`
- `tests/courtcall-cinematic-higgsfield.test.js`
- `assets/cinematic/` production media and compact master candidates.

Updated:

- `index.html` — cinematic markup, public anonymous entry, routing hook, teardown hook, Canvas-widget removal and navigation targets.
- `basketball-sw.js` — `v34` release cache plus cinematic controller/still assets.
- `tests/courtcall-settings-contract.test.js` — reduced-motion assertion now targets the current motion systems after Canvas removal.
- Phase 3/4/5/motion contract tests — expected service-worker release advanced from `v33` to `v34`.

No application data file, Supabase migration or manifest file was changed in this phase.

## 15. Remaining environment-dependent checks

These are not implementation blockers:

1. Run one anonymous-session smoke test at the literal `http://127.0.0.1:8765/` origin after the owner has intentionally signed out or supplied a disposable browser profile. The existing local profile was deliberately not inspected or erased; the exact origin was therefore validated in returning-profile mode, while anonymous rendering used clean same-server origins.
2. Recheck the `prefers-reduced-motion` media query on a physical device with OS Reduce Motion enabled. The code path, in-app preference propagation, static mode, zero-video mobile mode and automated contract are verified; the in-app browser does not expose media-feature emulation.
3. Recheck throttled 3G/slow-device decode on a representative mid-range Android handset. The implemented save-data/low-memory/mobile paths avoid video, and no continuous animation loop exists.
4. Confirm deployed GitHub Pages/CDN MIME types for `.webm` and cache headers after deployment. Local server MIME and both codecs are valid.
5. Local Supabase calls report backend-unavailable sync messages when the local environment has no configured/reachable backend. No such message originates from cinematic code.

## 16. Phase status

**Cinematic Landing / Higgsfield phase: complete and ready for review.**

The next functional phase has not started. No commit or push was performed.
