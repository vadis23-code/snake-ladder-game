# CourtCall Phase 2 Regression Baseline

Audit date: 2026-08-04  
Workspace: `C:\Users\Vadiv\OneDrive\Documents\CourtCall`  
Phase: 2 only — run and record the existing application  
Application files modified: none  
Redesign work: not started  
Standalone Canvas basketball widget: not removed or edited  
Higgsfield assets: not generated

## 1. Executive result

The local-first basketball workflow is viable and reproducible. A fresh visitor is gated correctly, guest entry works, a game can be configured and played, score/foul/undo state survives reload, a result is saved to history, and the built-in JSON export/import round trip succeeds. The existing 56 automated tests also remain green.

The cloud baseline is blocked. The configured host `jfeegcocynozbjpzbjae.supabase.co` returns no DNS record in the test environment while `supabase.com` resolves normally. The browser consequently logs a failed public-community synchronization on repeated page loads. No assertion about deployed tables, grants, RLS, RPC permissions, authentication, recovery or cross-user isolation is possible until a valid project endpoint and approved test identities are available.

Phase 2 also reproduced route-state, connectivity-copy, accessibility and mobile usability defects that must be protected by failing regression tests before the redesign begins.

## 2. Reproducible environment and backup point

| Item | Baseline |
|---|---|
| Git branch | `codex/phase2-regression-baseline` |
| Starting commit | `2f91cb0` |
| Prior branch | `codex/cloudflare-private-paths` |
| Local server | Python `http.server`, bound to `127.0.0.1:8765` |
| Browser | Codex in-app browser, clean CourtCall origin at test start |
| Test date/time zone | 2026-08-04, Asia/Calcutta |
| Entry point exercised | `index.html` through `/` |
| Sample backup | `COURTCALL_PHASE2_SAMPLE_EXPORT.json` |
| Existing user artifact preserved | `backup-before-rollback-current-version-20260530-153108.zip` remained untouched |

The branch is the Phase 2 backup point. No tracked application content was edited while establishing it.

## 3. Automated regression baseline

Command:

```text
node --test tests/*.test.js
```

Result:

| Tests | Passed | Failed | Skipped | Duration |
|---:|---:|---:|---:|---:|
| 56 | 56 | 0 | 0 | 685.65 ms |

The suite covers score/outcome logic, undo, fouls, rematches, round robin and knockout scheduling, queues, hash resolution, notifications, cloud-state messaging, community security contracts, settings, static ID uniqueness, accessible names and validation cleanup. It does not replace the live browser, device or Supabase checks below.

## 4. Browser flow baseline

### 4.1 Cold start and identity gate

| Check | Result | Evidence |
|---|---|---|
| Fresh `/` load | Pass | Canonicalized to `#/profile` with `s-profile` active. |
| Page title | Pass | `CourtCall 🏀`. |
| Initial auth state | Pass | Console reported `INITIAL_SESSION` with no valid session. |
| Public legal links | Pass | Privacy and Terms links were present on the profile screen. |
| Guest entry | Pass | “Continue without profile details” opened `#/hub`; dashboard greeted `Guest`. |
| Guest data mode | Pass | UI identified the profile as local-only and reported device save state. |

### 4.2 Game and history flow

| Step | Result | Observed state |
|---|---|---|
| Open Quick Game | Pass | `#/setup` displayed all current defaults and controls. |
| Configure teams | Pass | Set `Baseline Orange` vs `Baseline Blue`, 3v3, first to 11, 1s/2s. |
| Start game | Pass | `#/game`, 0–0, Team A possession, live feed initialized. |
| Team A +1 | Pass | Score 1–0; lead copy and timeline updated. |
| Team B +2 | Pass | Score 1–2; lead copy and timeline updated. |
| Team A foul | Pass | Foul count changed 0 → 1 and feed recorded the foul. |
| Undo | Pass | Latest foul was removed and Team A returned to 0 fouls. |
| Reload active game | Pass | Direct refreshed `#/game` retained 1–2, fouls, possession and timeline. |
| Manual end | Pass | Custom confirmation dialog appeared. |
| Confirm result | Pass | Summary showed Baseline Blue as the only winner, 1–2. |
| History persistence | Pass | `#/history` listed the saved 1–2 match. |
| Match detail | Pass | Modal showed game metadata, scoring timeline and result narrative. |
| Inactive game route | Pass | After completion, a later direct `#/game` resolved to `#/hub`. |

### 4.3 Backup/export/import flow

| Check | Result | Evidence |
|---|---|---|
| Export action | Pass | Settings “Last Backup” changed from empty to `Aug 4, 2026, 10:57 PM`. |
| Download | Pass | `courtcall-backup-2026-08-04.json`, 4,173 bytes, was created in Downloads. |
| Credentials excluded | Pass | Export metadata contains `credentialsExcluded: true`; no auth token was present. |
| Schema version | Pass | Export uses schema version 3. |
| Import validation | Pass | UI identified 23 data sections and warned that local sections would be replaced while cloud data would not change automatically. |
| Import confirmation | Pass | UI reported `Backup imported successfully`. |
| Workspace sample | Pass | A content-equivalent sample is retained as `COURTCALL_PHASE2_SAMPLE_EXPORT.json`. |

Export compatibility observations:

- Current and legacy match representations coexist with the same match ID. This is expected compatibility behavior and must remain deduplicated on import.
- The sample includes one completed match and analytics counters of one game started/completed/saved, but the guest profile still has `gamesPlayed: 0`. That derived/profile counter is inconsistent with the stored history.
- The completed game remains in the export as `activeGame` with `gameOver: true`, even though the route resolver correctly treats it as inactive and sends `#/game` to Hub.
- `settings` exports as an empty object while the UI renders defaults. Import currently reconstructs defaults successfully; future schema changes must preserve that behavior.
- The export contains no credentials or Supabase session objects.

## 5. Route baseline

### 5.1 Anonymous visitor

| Requested hash | Actual hash / active screen | Result |
|---|---|---|
| `#/profile` | `#/profile` / `s-profile` | Public |
| `#/onboarding` | `#/onboarding` / `s-onboarding` | Public |
| `#/hub` | `#/profile` / `s-profile` | Identity-gated |
| `#/setup` | `#/profile` / `s-profile` | Identity-gated |
| `#/game` | `#/profile` / `s-profile` | Identity-gated; no active game |
| `#/teams` | `#/profile` / `s-profile` | Identity-gated |
| `#/history` | `#/profile` / `s-profile` | Identity-gated |
| `#/tournament` | `#/profile` / `s-profile` | Identity-gated |
| `#/communities` | `#/communities` / `s-communities` | Public directory |
| `#/comm-create` | `#/profile` / `s-profile` | Identity-gated |
| `#/community/unknown-baseline-id` | `#/communities` / `s-communities` | Unknown ID safely falls back |
| `#/pulse` | `#/profile` / `s-profile` | Identity-gated |
| `#/world` | `#/world` / `s-world` | Public |
| `#/settings` | `#/profile` / `s-profile` | Identity-gated |
| `#/analytics` | `#/profile` / `s-profile` | Identity-gated |
| `#/help-center` | `#/profile` / `s-profile` | Identity-gated |
| `#/privacy` | `#/privacy` / `s-privacy` | Public |
| `#/terms` | `#/terms` / `s-terms` | Public |
| `#/reset-pin` | `#/profile` / `s-profile` | Gated without identity |
| `#/changelog` | `#/profile` / `s-profile` | Gated without identity |
| `#/unknown-route` | `#/profile` / `s-profile` | Safe fallback |

### 5.2 Local guest identity

| Requested hash | Actual hash / active screen | Result |
|---|---|---|
| `#/hub` | `#/hub` / `s-hub` | Pass |
| `#/setup` | `#/setup` / `s-setup` | Pass |
| `#/game` without active game | `#/hub` / `s-hub` | Pass |
| `#/teams` | `#/teams` / `s-teams` | Pass |
| `#/history` | `#/history` / `s-history` | Pass |
| `#/tournament` | `#/tournament` / `s-tournament` | Pass |
| `#/communities` | `#/communities` / `s-communities` | Pass |
| `#/comm-create` | `#/comm-create` / `s-comm-create` | Pass |
| `#/community/unknown-baseline-id` | `#/communities` / `s-communities` | Safe fallback |
| `#/pulse` | `#/pulse` / `s-pulse` | Pass |
| `#/world` | `#/world` / `s-world` | Pass |
| `#/settings` | `#/settings` / `s-settings` | Pass |
| `#/analytics` | `#/analytics` / `s-analytics` | Pass |
| `#/help-center` | `#/help-center` / `s-help-center` | Pass |
| `#/privacy` | `#/privacy` / `s-privacy` | Pass |
| `#/terms` | `#/terms` / `s-terms` | Pass |
| `#/reset-pin` | `#/reset-pin` / `s-reset-pin` | Defect: guest can open recovery UI without a recovery session |
| `#/changelog` after reset route | `#/changelog`; changelog modal over `s-reset-pin` | Defect: modal action retains the prior screen |
| Unknown route after changelog | `#/hub` / `s-hub`; changelog modal still open | Defect: fallback does not close route-opened modal |

Route conclusion: the main public/private resolver is reliable. The special changelog modal and reset-PIN routes need explicit state cleanup and recovery-session authorization tests.

## 6. Console and runtime errors

The browser captured 21 console entries during the run:

| Level | Count | Detail |
|---|---:|---|
| Log | 14 | Session initialization, sign-out/local-only state and skipped unauthenticated cloud save. |
| Error | 7 | All seven were `_doSyncCommunitiesFromDB EXCEPTION: TypeError: Failed to fetch`. |
| Warning | 0 | None captured. |

The repeated cloud error occurred across root, game, resume, settings/export, mobile-game and desktop reloads. There was no unrelated uncaught JavaScript error during the tested local workflows.

The game-save path correctly logged that Supabase persistence was skipped while unauthenticated and retained the match locally.

## 7. PWA and offline behavior

Procedure:

1. Load the application online and exercise multiple routes.
2. Verify the exact local test-server process.
3. Stop that process.
4. Reload the current `#/hub` navigation with the origin unavailable.

Result: the app shell, guest state, recent match and live-game resume card loaded successfully. This is strong browser evidence that the service worker/cache can serve a repeat navigation offline.

Defect: the app still announced `Online · Saved on this device` while the origin server was stopped. `navigator.onLine`-style connectivity is not equivalent to backend/origin reachability. Status copy must not claim online/cloud availability until a real request succeeds.

Not proven in this run:

- first-ever install while offline;
- install prompt behavior;
- service-worker update activation and cache invalidation;
- offline mutations followed by reconnect/cloud reconciliation;
- cache behavior on iOS Safari or installed Android PWA.

## 8. Supabase configuration and live reachability

### 8.1 Static configuration points

| Point | Current state |
|---|---|
| Client library | Repository-local minified browser bundle in `basketball-supa.js`. |
| Client creation | `index.html` calls `supabase.createClient(SUPA_URL, SUPA_KEY)`. |
| URL | Hard-coded project host `jfeegcocynozbjpzbjae.supabase.co`. |
| Key | Hard-coded legacy anonymous JWT, not a service-role key. Do not replace it with a secret key in browser code. |
| Session bootstrap | `getSession()` plus `onAuthStateChange()`. |
| Auth flows | Sign-up/sign-in, reset email and password update are wired. |
| Public read | `community_directory`, with legacy public-community fallback. |
| Authenticated tables | Profiles, games, tournaments and community domain tables listed in `COURTCALL_AUDIT_V2.md`. |
| RPCs | `get_my_community_invite_codes`, `join_community_by_invite`, `set_community_event_rsvp`. |

### 8.2 Reachability result

| Check | Result |
|---|---|
| Resolve `supabase.com` | Pass; general DNS/network path works. |
| Resolve configured project host | Fail; no A record returned. |
| Anonymous REST read of `community_directory` | Not reached; DNS resolution failed before HTTP. |
| Browser public-directory sync | Fail; repeated `TypeError: Failed to fetch`. |
| Deployed schema/RLS/RPC checks | Blocked. |
| Auth/recovery checks | Blocked. |

This failure is consistent across the browser and PowerShell client. It is not evidence of a PostgREST grant, RLS policy or column error because no HTTP response was reached.

Current Supabase behavior makes the live check more important: new public tables may require explicit Data API exposure/grants, and grants remain separate from RLS. See the official [Supabase breaking-change log](https://supabase.com/changelog?types=breaking-change) and [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).

## 9. Responsive and mobile baseline

### 9.1 Measurements

| Viewport | Screen | Horizontal overflow | Result |
|---|---|---:|---|
| 390 × 844 | Hub | 0 px | Content stacks correctly; header is crowded. |
| 390 × 844 | Live game | 0 px | Score and core actions fit; three controls are below minimum target dimensions. |
| 844 × 390 | Live game | 0 px | Major usability defect: UI remains a narrow left column with large unused black space and lower actions clipped by short height. |
| 768 × 1024 | Hub | 0 px | Main content spans 736 px with 16 px side margins. |
| 1440 × 900 | Hub | 0 px | Main content centers at 1,120 px width. |

### 9.2 Touch-target findings

At 390 × 844:

- Hub `Start Game` was approximately 109 × 33 px.
- Hub menu button was approximately 36 × 44 px.
- Live-game foul badges were approximately 52 × 38 px.
- Live-game possession control was approximately 34 × 34 px.

These miss a 44 × 44 CSS-pixel target in at least one dimension. The high-frequency score buttons themselves were comfortably larger.

### 9.3 Visual findings

- The fixed connection badge overlaps/competes with compact header actions on portrait mobile.
- The header shows a clipped/very narrow Log In action beside Start Game and the menu.
- The fixed bottom navigation and Help control compete for lower-right space on the Hub.
- Landscape does not adapt the scoreboard to the available width and height; the result is functionally portrait-sized content inside a wide canvas.
- No horizontal document overflow was observed at the four measured viewports.

## 10. Accessibility baseline observations

Positive observations:

- The skip link exists.
- Primary game actions have descriptive accessible names.
- Score values expose team-specific labels.
- Setup control groups are named and pressed/selected states are exposed.
- History match and modal controls are named.
- Confirmation prompts use `alertdialog` semantics.

Risks reproduced:

- The closed CourtCall Assistant appears in every DOM/accessibility snapshot as a `dialog`, including its controls. It needs a real hidden/inert state while closed.
- Hash navigation changes the visible screen but did not demonstrate focus movement to the new screen heading.
- The changelog modal can outlive the route that opened it, leaving stale modal state over another screen.
- Direct guest access to Reset PIN exposes recovery UI without proof of a recovery session.
- Several touch controls are smaller than 44 × 44 px.
- Automated names and static markup checks pass, but no screen-reader or full keyboard-only session was performed.

## 11. Newly confirmed defects and risks

| Priority | Finding | Impact | Required regression |
|---|---|---|---|
| P0 blocker | Configured Supabase project hostname does not resolve | Cloud auth, sync, public directory and live security validation are unavailable | DNS + anonymous directory smoke test against approved project |
| P1 | Public community sync retries/fails on repeated guest reloads | Console noise, wasted network/retry work, unclear empty/error state | One classified error, bounded retry/backoff, no unhandled exception |
| P1 | UI reports Online while origin is unavailable | False confidence about sync/connectivity | Origin/API reachability state test |
| P1 | Guest can open `#/reset-pin` without recovery session | Misleading or unsafe recovery surface | Recovery-token/session gate test |
| P1 | Changelog modal retains prior screen and survives fallback navigation | Stale overlay, confusing back/focus behavior | Modal-route teardown tests |
| P1 mobile | 844 × 390 game view uses only a narrow left column | Core scoring is poor in common landscape use | Landscape screenshot/layout regression |
| P2 accessibility | Closed assistant remains exposed as dialog content | Screen-reader noise and extra focusable controls | Hidden/inert accessibility-tree test |
| P2 mobile | Multiple controls are smaller than 44 × 44 px | Missed taps during live play | Computed target-size checks |
| P2 data | Guest `gamesPlayed` remains 0 after one completed saved match | Profile/stat drift | Derived counter update/normalization test |
| P2 data | Completed `activeGame` remains in export | Ambiguous restore/resume semantics | Import completed-game routing test |

## 12. Working-feature baseline to preserve

The redesign must not regress these Phase 2-proven behaviors:

1. Anonymous public/private route gating.
2. Guest entry and local-only operation.
3. Setup defaults and named configuration controls.
4. Score, foul, possession, lead and timeline rendering.
5. Undo of the latest action.
6. Active-game persistence across a full reload.
7. Manual-end confirmation and one-winner result logic.
8. Match history persistence and detail modal.
9. Repeat offline shell load from the service-worker cache.
10. JSON export with credentials excluded.
11. Confirmed JSON import of all 23 current sections.
12. Responsive Hub behavior at portrait, tablet and desktop widths.
13. Local fallback when unauthenticated cloud save is unavailable.
14. All 56 current automated contracts.

## 13. Not exercised or not certifiable in Phase 2

- Live sign-up, sign-in, logout, recovery email and PIN reset.
- Live CRUD, merge, deletion and cross-device sync against Supabase.
- RLS isolation between unrelated users.
- Owner/admin/moderator/member community role combinations.
- Invite-code and event-RSVP RPC behavior against the deployed database.
- Microphone permission and voice scoring accuracy.
- Background game/shot clocks and visibility changes.
- Web Share, clipboard and mail-client fallbacks on target devices.
- Geolocation and local Pulse behavior.
- Push notifications.
- Storage quota/gallery failures.
- Local-profile and multi-account switching isolation.
- Screen-reader and full keyboard-only flows.
- iOS/Android installed-PWA lifecycle.
- Production headers, caching and CDN behavior.

These remain required gates; they must not be described as working based only on source or unit tests.

## 14. Phase 3 entry criteria and implementation order

Before visual redesign or widget removal:

1. Resolve or deliberately retire the configured Supabase project endpoint.
2. Add failing tests for the confirmed reset-PIN, changelog teardown, false-online, hidden-assistant, touch-target, landscape and guest-stat issues.
3. Decide the required deploy entry filename (`index.html` versus the specified `basketball.html`).
4. Approve the application structure strategy: preserve the current inline architecture or perform a staged modular extraction.
5. Confirm the canonical database naming for community posts/events and validate it against the live schema.
6. Provide approved Supabase test identities/roles before any cloud-security completion claim.
7. Preserve the Phase 2 sample export as a migration fixture.
8. Preserve the 56-test baseline and add browser-route/offline tests before changing markup.
9. Only then remove the standalone Canvas basketball widget using the dependency boundary in `COURTCALL_AUDIT_V2.md`.
10. Begin design-system and screen-by-screen work after the functional baseline is protected.

## 15. Truly blocking questions

1. Is `jfeegcocynozbjpzbjae.supabase.co` still the intended production project? If yes, the project/DNS must be restored; if no, provide the approved replacement project URL and public client key.
2. Can Phase 3 receive an approved set of Supabase test identities (at minimum two unrelated users plus an owner/admin/member role set) and read-only project/schema access?
3. Must delivery create and use `basketball.html`, or is `index.html` the canonical entry despite the specification naming conflict?
4. Is a staged modular extraction allowed, or must the application remain primarily inline in the active HTML file?
5. Which schema vocabulary is canonical for production: current client/migrations (`user_id`, `content`, `event_date`, `event_time`, `event_type`, `max_attendees`, `creator_id`) or the specification’s alternate post/event names?
6. Should signed-in PIN accounts remain a browser-to-Supabase password adaptation, or may authentication move to a server-validated flow before launch?

Until questions 1–2 are answered, Supabase/RLS completion is blocked. Until questions 3–6 are answered, implementation can proceed only in carefully isolated areas that do not lock in those architecture and contract choices.
