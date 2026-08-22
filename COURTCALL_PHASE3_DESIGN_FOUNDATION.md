# CourtCall Phase 3 Design Foundation

Audit date: 2026-08-05  
Workspace: `C:\Users\Vadiv\OneDrive\Documents\CourtCall`  
Branch: `codex/phase3-design-foundation`  
Starting commit: `2f91cb0`  
Phase: 3 only — design foundation  
Standalone Canvas basketball widget: unchanged  
Higgsfield assets: not generated  
Phase 4 screen redesign: not started

## 1. Executive result

Phase 3 is complete. CourtCall now has an additive, reusable design-system layer with semantic color, typography, spacing, radius, elevation, layout and motion tokens. It provides component primitives for actions, chips, cards, forms, tabs, dialogs and common layout patterns while preserving the current application's IDs, inline handlers, route names, storage contracts and Supabase mappings.

The same layer establishes the responsive shell and accessibility baseline required before Phase 4. All 19 routed screens now maintain one active page landmark, inactive screens are hidden from assistive technology and made inert, skip navigation follows the active route, route changes receive concise announcements, stale changelog state is closed on navigation, and reduced-motion, forced-color and increased-contrast preferences have explicit support.

Automated verification passes 64 of 64 tests. Browser verification covers 320×568, 390×844, 768×1024, 1440×900 and the critical 844×390 live-game landscape layout. No tested viewport has horizontal document overflow. A live score and Undo round trip still works. The only browser errors are the previously documented failed requests to the unreachable configured Supabase host.

## 2. Phase 3 compliance matrix

| Phase 3 requirement | Implementation | Result |
|---|---|---|
| Add design tokens | Semantic dark/light/system color tokens; typography, spacing, radius, elevation, layout and motion tokens in `courtcall-design-system.css` | Complete |
| Add typography | Display/body/numeric families, fluid type scale, line-height and letter-spacing contracts, tabular score numerals | Complete |
| Reusable buttons | `.cc-button`, primary, secondary, danger and icon variants; legacy button adapters | Complete |
| Reusable chips | `.cc-chip` with neutral, positive, warning and danger states | Complete |
| Reusable cards | `.cc-card`, interactive and elevated variants; legacy panel/card adapters | Complete |
| Reusable forms | `.cc-field`, labels, hints, errors, inputs and validation/focus treatment; legacy form adapters | Complete |
| Reusable modals | `.cc-scrim`, `.cc-dialog`, header/body/footer primitives; current modal adapter | Complete |
| Reusable tabs | `.cc-tablist` and `.cc-tab`, including selected/focus states; current auth tab adapter | Complete |
| Reusable navigation | Safe-area-aware header/bottom navigation and responsive navigation treatment | Complete |
| Responsive shell | Mobile-first reflow at 320px, tablet/desktop containment, compact mobile header/help control, six-digit PIN grid, landscape game shell | Complete |
| Accessibility foundation | Active landmark/inert routing, dynamic skip link, route announcements, programmatic route focus, visible keyboard focus, target sizing, forced colors, contrast and reduced motion | Complete |
| Preserve functional hooks | Existing IDs, routes, inline handler entry points, localStorage keys, Supabase client contract and application functions retained | Complete |

## 3. Files changed

| File | Phase 3 change |
|---|---|
| `courtcall-design-system.css` | New additive design-system, component, accessibility and responsive layer loaded after legacy CSS. |
| `index.html` | Loads the design layer; adds active-screen accessibility synchronization, concise route labels, recovery-session state and safe changelog teardown. |
| `courtcall-core.js` | Requires an authenticated recovery event before resolving `#/reset-pin`. |
| `basketball-sw.js` | Pre-caches the new stylesheet and advances the application shell cache to `v17`. |
| `tests/courtcall-core.test.js` | Adds recovery-route authorization coverage. |
| `tests/courtcall-design-foundation.test.js` | Adds token, component, contrast, responsive, accessibility, PWA and structural CSS contracts. |
| `COURTCALL_PHASE3_DESIGN_FOUNDATION.md` | This Phase 3 implementation and verification handoff. |

Pre-existing untracked audit, baseline, sample export and backup artifacts were preserved. Phase 3 did not edit them.

## 4. Design token contract

### 4.1 Color

The new layer separates semantic meaning from component implementation:

- Surfaces: canvas, raised, overlay and inverse.
- Text: primary, secondary, muted and inverse.
- Borders: default, strong and focus.
- Actions: primary, primary hover, secondary and danger.
- Basketball states: Team A, Team B, success, warning, danger and informational.
- Themes: dark defaults, explicit light tokens and system-theme resolution.

The primary action fill is `#c2410c` with white foreground. The automated contrast calculation verifies a WCAG AA ratio of at least 4.5:1. Focus indication uses a separate high-visibility token and is not dependent on color alone.

### 4.2 Typography

- A display stack for product headings.
- A UI/body stack optimized for native rendering and broad device coverage.
- A numeric stack with tabular numerals for scores, clocks and metrics.
- Fluid type tokens from compact metadata through display scores.
- Explicit line-height and tracking tokens for dense game UI and readable long-form screens.

No remote font dependency was introduced, so the application retains its offline-first behavior and avoids font-related render blocking.

### 4.3 Spacing, shape and depth

- Spacing is based on a 4px rhythm and exposes semantic steps from 4px through 64px.
- Radius tokens cover control, card, panel and pill shapes.
- Elevation tokens provide low, card, floating and dialog depth without requiring component-specific values.
- Layout tokens define readable content width, application width, gutters, header height and bottom-navigation height.

### 4.4 Motion

The stylesheet centralizes short, medium and long durations plus standard, emphasized and exit easing. `prefers-reduced-motion: reduce` removes nonessential animation and scrolling behavior globally while retaining instant state feedback.

## 5. Reusable component foundation

The `.cc-*` classes are the stable contract for later phases:

| Family | Foundation classes |
|---|---|
| Layout | `.cc-container`, `.cc-stack`, `.cc-cluster`, `.cc-grid`, `.cc-sr-only` |
| Actions | `.cc-button`, `.cc-button--primary`, `.cc-button--secondary`, `.cc-button--danger`, `.cc-icon-button` |
| Status | `.cc-chip` plus positive, warning and danger variants; `.cc-status` |
| Content | `.cc-card`, `.cc-card--interactive`, `.cc-card--elevated` |
| Forms | `.cc-field`, `.cc-label`, `.cc-hint`, `.cc-error`, `.cc-input` |
| Tabs | `.cc-tablist`, `.cc-tab` |
| Dialogs | `.cc-scrim`, `.cc-dialog`, `.cc-dialog__header`, `.cc-dialog__body`, `.cc-dialog__footer` |

Compatibility adapters improve current legacy elements immediately, but Phase 4 can adopt `.cc-*` classes screen by screen without renaming IDs or changing JavaScript hooks.

## 6. Accessibility foundation

### 6.1 Route and landmark behavior

`showScreen()` now synchronizes accessibility state after every route change:

- Exactly one `.screen` is active.
- The active screen has `aria-hidden="false"`.
- Each inactive screen has `aria-hidden="true"` and `inert`.
- An active screen without its own nested `main` receives `role="main"`.
- The skip link target changes to the active screen ID.
- A concise live-region label announces the destination, such as “Home page” or “Live Game page”.
- The route heading or page title receives programmatic focus without displaying an interactive focus ring.

The noninteractive route-focus exception only suppresses the ring on the programmatically focused heading. Interactive controls retain the visible focus token.

### 6.2 Interaction and preference support

- Buttons receive a 44px minimum height where space permits.
- The 320px PIN grid retains six columns without document overflow; each digit field is 33×52px and exceeds the WCAG 2.2 24px minimum target dimension.
- Focus-visible styles apply to links, controls, tabs and dialog actions.
- Forced-colors mode restores native outlines and removes decorative effects that would obscure state.
- Increased-contrast preference strengthens borders, text and focus indication.
- Reduced-motion preference disables nonessential transitions, transforms and smooth scrolling.
- State tokens are paired with text/shape/status semantics rather than being the only carrier of meaning.

### 6.3 Route defects resolved from Phase 2

- A local guest can no longer open the reset-PIN screen from a direct hash without an active Supabase password-recovery event.
- Successful password reset and sign-out clear recovery-session state.
- Navigating away from `#/changelog` closes its modal and overlay without restoring focus to a stale route trigger.
- Unknown-route fallback cannot leave the changelog modal over the Hub.

## 7. Responsive foundation

| Viewport | Verified result |
|---|---|
| 320×568 | Profile/auth and expanded local profile reflow to 305px usable width; six PIN cells remain in one row; buttons are 44px or taller; no horizontal overflow. |
| 390×844 | Hub uses the full 375px content viewport; header login action is hidden, Help becomes a compact 44px control, duplicate global sync badge is suppressed on Hub, no horizontal overflow. |
| 768×1024 | Active screen and header occupy the full 768px shell; 18 inactive screens remain inert and hidden; no horizontal overflow. |
| 1440×900 | Active screen and header occupy the full 1440px shell while content components use their internal max-width contracts; no horizontal overflow. |
| 844×390 landscape | Live Game occupies all 844×390 pixels. Scoreboard, score zone, control bar and live feed each span the viewport; the document has neither horizontal nor vertical overflow; all live controls are at least 44×44px. |

The critical landscape regions measured as follows:

| Region | Position and size |
|---|---|
| Game screen | `0,0 — 844×390` |
| Game navigation | `0,0 — 844×40` |
| Scoreboard | `0,44 — 844×132` |
| Game status | `0,176 — 844×29` |
| Score zone | `0,205 — 844×62` |
| Controls | `0,267 — 844×54` |
| Live feed | `0,320 — 844×70` |

Safe-area insets are applied to the fixed mobile header, bottom navigation, sheets and dialogs for notched devices.

## 8. PWA/cache compatibility

`courtcall-design-system.css` is part of the service-worker shell and the cache version is `v17`. Browser testing also exercised the update lifecycle from the prior cache:

1. The running application detected the newer shell.
2. It presented the existing update notification.
3. Activating Reload moved the page to the new cache.
4. The new stylesheet parsed successfully with 77 CSS rules.
5. Direct route behavior and persisted local guest/game state remained intact.

This cache revision is intentional: it prevents users who saw an intermediate Phase 3 cache during development from retaining stale responsive rules.

## 9. Storage, Supabase and widget compatibility

Phase 3 introduces:

- no localStorage key changes;
- no storage payload or backup-schema changes;
- no Supabase table, column, RLS, RPC or client-library changes;
- no new remote dependency;
- no Canvas widget removal or dependency change;
- no Higgsfield asset reference or generation.

The standalone Canvas basketball widget remains exactly where Phase 1 documented it. Its safe removal belongs to the later implementation phase defined by the master plan.

## 10. Verification record

### 10.1 Automated suite

Command:

```text
node --test tests/*.test.js
```

| Tests | Passed | Failed | Skipped | Duration |
|---:|---:|---:|---:|---:|
| 64 | 64 | 0 | 0 | 1.018 s |

Eight Phase 3 contracts were added to the 56-test Phase 2 baseline. They verify stylesheet order and offline caching, complete token families, primitive coverage, responsive/accessibility rules, primary contrast, active-route/changelog behavior, recovery-session gating and balanced CSS block braces.

### 10.2 Browser workflow

| Check | Result |
|---|---|
| Stylesheet loaded and parsed | Pass — 77 CSS rules available through CSSOM. |
| One active route landmark | Pass — 1 active screen and 18 hidden/inert screens. |
| Dynamic skip target | Pass — follows the active screen, including Hub, Profile and Game. |
| Concise route announcement | Pass — route-specific live-region text. |
| Direct guest `#/reset-pin` | Pass — safely resolves to Hub rather than exposing recovery UI. |
| Changelog teardown | Pass — navigation and unknown-route fallback close modal and overlay. |
| Compact Hub status/focus | Pass — no duplicate global status overlap; route heading has no false interactive outline. |
| 320px auth/profile | Pass — no horizontal overflow; six-digit PIN layout preserved. |
| Landscape live game | Pass — full-width 844px layout; no overflow or undersized controls. |
| Score Team A +1 | Pass — score changed from 0–0 to 1–0 and live feed updated. |
| Undo | Pass — score and feed returned to the 0–0 baseline. |
| PWA update activation | Pass — existing update flow activated cache `v17`. |

### 10.3 Static quality checks

- `git diff --check`: pass; no whitespace errors.
- Static IDs remain unique through the existing accessibility test.
- Static images and buttons retain accessible names through the existing test.
- CSS block braces are balanced.
- No unrelated uncaught JavaScript or CSS error appeared in the browser.

## 11. Known constraints and deferred work

These items are not Phase 3 failures and remain for later phases:

- The configured Supabase project host still fails to resolve in this environment, so live Auth, database, RLS and RPC behavior remain unverified.
- The public-community synchronization logs `TypeError: Failed to fetch` when that host is contacted. This is the only browser error observed during Phase 3.
- Phase 3 establishes reusable primitives but does not yet convert every legacy screen to `.cc-*` markup. That migration begins with Phase 4's core game experience.
- The design layer supplies token-driven light and system themes, but a complete visual route-by-route light-theme acceptance pass belongs with the screen migrations.
- The 320px six-digit PIN cells are 33px wide to preserve a single row. They exceed the WCAG 2.2 24px minimum but cannot reach the preferred 44px width at that viewport without changing the interaction pattern.
- Existing inline HTML and legacy CSS remain large. Phase 3 intentionally avoids a risky architectural split before the core UI migration.
- Origin/backend reachability copy still depends on existing connectivity behavior documented in Phase 2.
- Higgsfield visuals, the standalone Canvas widget removal and replacement art remain untouched.

## 12. Phase 3 exit gate and Phase 4 readiness

Phase 3 exit criteria are satisfied:

- semantic tokens exist and support dark, light and system preferences;
- reusable primitives exist for every required component family;
- a responsive shell is proven at mobile, tablet, desktop and game-landscape sizes;
- route/landmark/focus/reduced-motion foundations are in place;
- functional, storage and backend hooks are preserved;
- the full automated suite and targeted browser workflows pass;
- no Phase 4 redesign, Higgsfield generation or Canvas-widget removal has started.

Phase 4 can now begin with the core game experience, adopting the `.cc-*` primitives and semantic tokens without reworking application contracts.
