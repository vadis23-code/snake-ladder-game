# CourtCall Phase 9.6 — Production QA Hotfix

Date: 22 August 2026  
Branch: `codex/phase9-6-production-qa-hotfix`  
Baseline: `75e3ea4` (`Merge CourtCall through Phase 9.5 production recovery`)

## Help deep-link root cause

CourtCall has two Help surfaces:

- `help-center` is a real public screen and already resolves at `#/help-center`.
- The floating Help button calls `openHelpChat()` and opens the CourtCall Assistant as a dialog over the current screen.

`help` was neither a valid screen nor a recognized router action. `resolveHashRoute('#/help')` therefore classified the hash as invalid. With a local identity it selected the normal `hub` fallback; without an identity it selected the profile/auth gate. This explains why the Help button worked while the deep link did not.

## Help hotfix

The router now treats `help` as a public action route:

- Resolution returns action `open_help`, backing screen `help-center`, and reason `help_deep_link`.
- `#/help` is normalized with `history.replaceState()` to `#/help-center`, preventing a duplicate alias entry or Back loop.
- The existing Help Center is rendered, then the existing CourtCall Assistant dialog is opened.
- The current screen is retained as the Help Center Back target when available. Cold anonymous and identified deep links fall back to Landing and Hub respectively.
- Navigating Back or to another hash closes the action dialog before rendering the destination.
- Existing Help-button behavior remains unchanged: it opens/closes the assistant over the current screen without changing that route.

During browser verification, a related Help-only focus race was found. `closeHelpChat()` scheduled `_helpReturnFocus.focus()` and then immediately nulled `_helpReturnFocus`, causing a console error when the callback executed. It now captures the return element before clearing state.

Auth gating remains unchanged: Help and Help Center are public; Hub and Tournaments remain private; Communities remains public.

## Cinematic investigation

The reported paused video state is expected and was not reproduced as a product defect.

`courtcall-cinematic.js` explicitly documents that video playback is never autonomous. It does not call `video.play()`. Every video remains paused while `currentTime` is scrubbed from native scroll progress. Therefore `paused === true` and `currentTime === 0` at the top of the first stage are correct.

Investigation confirmed:

- Active mode: `full-video`.
- Reduced motion: not selected in the production verification session.
- No save-data, low-memory, or static fallback was active.
- Active media was visible, fully decoded (`readyState 4`), muted, and error-free.
- Route lifecycle started the cinematic on Landing and tears it down outside Landing.
- No `play()` promise exists to reject because playback is scroll-scrubbed rather than autoplayed.
- Clicking the visible Tip-Off chapter performed the normal `goToStage()` interaction, moved scroll from 0 to 845 pixels, changed stage 0 to stage 1, and advanced media time from 0 to more than 7 seconds.

The earlier automation attempted a wheel-style scroll that did not alter `scrollY`; it therefore supplied no progress for the controller to render. Chapter interaction proved the timeline works normally. No cinematic JavaScript, CSS, or media was changed.

## Files changed

Functional hotfix:

- `courtcall-core.js`
- `index.html`
- `basketball-sw.js` — cache version advanced from `v52` to `v53` so cached `courtcall-core.js` cannot keep the broken route for an extra load.

Focused/contract tests:

- `tests/courtcall-core.test.js`
- `tests/courtcall-phase8-supporting-product.test.js`

Mechanical cache-version expectation updates:

- `tests/courtcall-design-foundation.test.js`
- `tests/courtcall-global-visual-system.test.js`
- `tests/courtcall-landing-hub-separation.test.js`
- `tests/courtcall-phase4-core-game.test.js`
- `tests/courtcall-phase5-team-history.test.js`
- `tests/courtcall-phase6-tournaments.test.js`
- `tests/courtcall-phase7-communities.test.js`
- `tests/courtcall-phase9-otp-auth.test.js`
- `tests/courtcall-visual-motion-foundation.test.js`

No deployment workflow, Supabase schema, RLS policy, product feature, cinematic file, or legacy local PIN compatibility was changed.

## Automated validation

- JavaScript syntax: 30 files passed `node --check`.
- Focused route/supporting-product tests: **48 passed, 0 failed**.
- Full regression suite: **178 passed, 0 failed**.
- Production artifact: 67 files, all 67 returned HTTP 200.
- Service-worker release: `v53`; atomic shell validation and obsolete-cache cleanup remain intact.
- `git diff --check`: passed.

Focused coverage now verifies authenticated and anonymous `#/help` resolution, public route status, action dispatch, alias normalization, dialog opening, dialog teardown on navigation, focus restoration, and cache-version propagation.

## Browser QA

The corrected 67-file production artifact was tested from a clean origin at `http://127.0.0.1:8968/`.

- `/` opened `#/landing` with full-video cinematic mode.
- `#/landing` opened Landing.
- Anonymous `#/hub` correctly gated to Profile/OTP.
- `#/help` normalized to `#/help-center`, activated the Help Center, and opened the CourtCall Assistant dialog.
- Browser Back returned to Landing and closed the assistant.
- Anonymous `#/tournament` correctly gated to Profile/OTP.
- `#/communities` opened Communities publicly.
- Existing Help button opened and closed the assistant without changing the Communities route.
- Tip-Off interaction advanced cinematic stage and media time.
- No tested route had page-level horizontal overflow.
- Final clean-origin console result: no warnings or errors.

## Remaining external/manual checks

No commit, push, or deployment was performed.

After an approved merge/push, verify on `https://courtcall13.win/`:

1. `#/help` normalizes to `#/help-center` and opens the assistant.
2. Browser Back closes the dialog and returns to the preceding route.
3. The Help button still opens over Hub/Communities without changing the hash.
4. Service worker `v53` activates and removes obsolete CourtCall caches.
5. Wheel, touch, trackpad, and chapter-button input all scrub the cinematic timeline on representative desktop and mobile browsers.

Phase 10 was not started.
