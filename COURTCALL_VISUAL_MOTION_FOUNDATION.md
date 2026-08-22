# CourtCall Visual Motion Foundation

**Status:** Implemented and ready for review  
**Date:** 2026-08-10  
**Branch:** `codex/phase5-team-history`  
**Common Git baseline:** `2f91cb0e8b1df9921053e194fe7e605dbf4d0a9f`  
**Canonical production entry point:** `index.html` at the repository root  
**Browser-tested URL:** `http://127.0.0.1:8765/`  
**Commit/push status:** Not committed and not pushed

## 1. Scope guard

This pass is presentation-only. It does not change:

- score calculation, outcome evaluation, undo rules or game state shape;
- localStorage keys, stored record shapes or migration behavior;
- Supabase tables, columns, RPCs, authentication or row-level security;
- tournament generation, advancement rules or persistence;
- community membership, moderation or reaction permissions;
- Higgsfield assets or the next functional phase.

The only live-game rendering adjustment preserves existing score-button DOM nodes while their labels and scoring configuration are unchanged. This prevents a second rapid tap from targeting a button that was just replaced. It does not change the score handler or score data.

## 2. Files in this pass

| File | Change |
|---|---|
| `courtcall-motion-foundation.css` | New native-CSS motion tokens, keyframes, responsive behavior and reduced-motion fallbacks. |
| `courtcall-motion-foundation.js` | New presentation controller for one-shot DOM motion, actual-history signals and accessibility status. |
| `index.html` | Loads the motion layer; keeps score buttons stable between score renders; exposes immediate post-game actions; shortens and restrains confetti. |
| `basketball-sw.js` | Bumps the app-shell cache to `v33` and precaches both motion files. |
| `tests/courtcall-visual-motion-foundation.test.js` | Adds motion, performance, accessibility, dependency and duplicate-ID contracts. |
| Existing Phase 3–5 tests | Updates the expected service-worker cache version from `v32` to `v33`. |

`basketball.html` remains a redirect-only compatibility shim. The application was not duplicated.

## 3. Motion-system contract

The implementation uses the required easing families:

- spring: `cubic-bezier(.34,1.56,.64,1)`;
- standard: `cubic-bezier(.4,0,.2,1)`;
- large entrance: `cubic-bezier(.16,1,.3,1)`.

Timing tokens are 100 ms press feedback, 180 ms micro interaction, 240 ms navigation, 320 ms card motion and 900 ms celebration. The quarter animation is 220 ms. All effects are one-shot; there is no continuous particle system or live-scoreboard canvas.

## 4. Requirement reconciliation

| Requirement | Result | Implementation and verification |
|---|---|---|
| Score animation | Pass | Score changes before feedback. A 220 ms spring overshoot, team-colour ripple, six transient particles and glow decay use existing score feedback hooks. Decorative layers use `pointer-events:none`. Stable score-button nodes prevent rapid-tap loss. |
| Team lead aura | Pass | The existing numeric `--lead-strength` drives a smoothly transitioning team-colour aura. Visible `Leading by N`, `Trailing` and `Level` text plus a leading marker prevent colour-only communication. |
| Foul interaction | Pass | Red panel pulse, count shake and urgent feed treatment are retained and refined. At five team fouls, the badge receives `aria-describedby` and an assertive foul-warning status. Existing player five-foul limit text/announcement remains intact. |
| Possession | Pass | The indicator slides toward the new side and its label crossfades in 180 ms. State and persistence remain in the existing handler. |
| Quarter/period | Pass | Q1 → Q2 browser test produced `ccMotionPeriod` with a computed duration of 0.22 seconds. |
| Event feed | Pass | Only newly added rows animate from 10 px above. Team-colour/urgent flash settles in 180 ms; multi-row insertion uses a 40 ms stagger. |
| Button press feel | Pass | High-value game/navigation/action buttons compress in 100 ms with shadow crush and spring return. Actions are not deferred. |
| Hot hand | Pass | The existing actual-history run detector is the source of truth. A supported 4–0/6–0 run receives a restrained gold `HOT HAND` label and accessible name; it is absent without a qualifying run. |
| Comeback alert | Pass | A presentation-only detector reads actual score events. Browser test: Team B erased a six-point deficit and tied 6–6; a short, non-modal status banner appeared. No alert is produced with fewer than four score events or a deficit below six. |
| Victory moment | Pass | Overlay dim, winner entrance, oversized-to-settled final score, winning colour plus gold and 24 short-lived confetti pieces. `SAVE & EXIT` and `NEW GAME` are the first visible actions and are enabled immediately. |
| Navigation | Pass | Active bottom-tab indicator transitions independently of routing. Screen slide/fade is 240 ms. UI navigation preserved `#/game`, `#/hub`, `#/teams` and other existing hashes. |
| Player cards | Pass | Fine-pointer hover/focus lift uses a 320 ms transform/elevation transition. Touch/coarse-pointer devices do not receive a flip. No 3D flip was added because it would duplicate card content and degrade touch usability. |
| Tournament brackets | Implemented; live-data check pending | Played fixture cards receive winner slide/glow and progressive line reveal without changing advancement. Static contracts and core tournament tests pass. The localhost guest profile had no active tournament, so a completed live bracket was not fabricated solely for visual testing. |
| Community reactions | Implemented; live-data check pending | A capture-phase presentation listener creates a 720 ms emoji float. The existing `reactPost` function remains responsible for immediate local count update and background Supabase sync. The localhost guest profile had no community/post data and Supabase fetch was unavailable. |

## 5. Performance controls

- Native CSS and vanilla JavaScript only; no GSAP, Lenis, Three.js or new dependency.
- No canvas, continuous animation loop, `setInterval` or request-idle task in the motion controller.
- `requestAnimationFrame` is used only to restart a one-shot CSS class without a forced layout read.
- Motion animates transforms and opacity; score particles are DOM elements removed after the effect.
- Inactive effects have no running loop. Existing game clocks remain unchanged.
- The hot-hand banner's earlier infinite pulse is overridden with one entrance animation.
- The score pad is no longer rebuilt after every point when its configuration is unchanged.
- The new unminified assets are approximately 16 KB CSS and 13 KB JavaScript.
- Both assets are in the versioned service-worker shell.

## 6. Accessibility controls

- Both `prefers-reduced-motion: reduce` and CourtCall's `data-reduced-motion="true"` setting disable motion.
- Reduced motion hides score particles, reaction floats, comeback motion and confetti.
- Reduced-motion victory keeps both primary actions visible, enabled and immediately focusable.
- Keyboard test produced a visible 3 px focus outline on the possession control.
- Lead, foul, hot-hand and comeback state have text/status equivalents.
- Motion elements never receive pointer input.
- Forced-colour fallbacks preserve lead, hot-hand, comeback and bracket cues.

## 7. Browser validation matrix

| Viewport | Result | Evidence |
|---|---|---|
| 320×568 | Pass | No root/body horizontal overflow. All four score buttons were visible at approximately 73×76 px. Live-game focus remained visible. |
| 390×844 | Pass | No horizontal overflow. Normal and reduced-motion victory actions were visible and enabled immediately. Score, foul, possession, period, hot-hand and comeback checks ran here. |
| 844×390 | Pass | No horizontal overflow. Broadcast feed rail measured 224 px. Score pad and control bar remained above the fold; redundant last-action detail is hidden only in short landscape while Undo remains in the control bar. |
| 1440×900 | Pass | No horizontal overflow. Desktop layout rendered a 1088 px game surface and 352 px event rail. Player-card hover lift and live-game layout were verified. |

Additional interaction evidence:

- non-reduced rapid double tap advanced Team A from 0 to 2 and produced two feed events;
- after the stable-button fix, a reduced-motion double tap advanced 9 to 11, produced the two required events and opened victory;
- score effect layer computed `pointer-events:none`;
- leader text and numeric lead strength updated immediately;
- foul five produced `aria-describedby="cc-foul-status"` and `Foul warning. Team A has 5 team fouls.`;
- normal victory produced 24 pieces using the winner orange, gold, pale gold and white, with the final-score motion at 0.82 seconds;
- reduced-motion victory produced zero confetti and no winner/final-score animation;
- the test browser preference was restored to reduced motion off and the default target was restored to 21 after validation.

## 8. Automated verification

Commands:

```text
node --check courtcall-motion-foundation.js
node --test <all tests/*.test.js>
git diff --check
```

Results:

- JavaScript syntax: pass.
- Complete regression suite: **95/95 pass**.
- Motion-specific tests: **8/8 pass**.
- Duplicate static IDs: none.
- Git whitespace check: pass; only existing Windows LF/CRLF conversion warnings were reported.

## 9. Console and environment-dependent checks

The motion layer produced no console errors or warnings. The complete page console was not fully clean on localhost: six existing community-sync attempts logged:

```text
[Supa] _doSyncCommunitiesFromDB EXCEPTION: TypeError: Failed to fetch
```

This is an environment/network-dependent Supabase fetch failure, not a motion failure. No Supabase mapping, retry, logging or permission code was changed in this pass.

Checks still requiring a connected/data-populated environment:

1. visually observe winner advancement in an actual completed knockout bracket;
2. click a real community reaction and observe both the float and successful background Supabase sync;
3. rerun with an OS-level reduced-motion preference on a physical touch device;
4. confirm a fully clean console with the Supabase endpoint reachable;
5. perform an installed-PWA offline reload after deployment of cache `v33`.

## 10. Review gate

The Visual Motion Foundation is complete for review. Higgsfield asset generation and the next functional phase have not started. Do not proceed to either until this document and the remaining environment-dependent notes are accepted.
