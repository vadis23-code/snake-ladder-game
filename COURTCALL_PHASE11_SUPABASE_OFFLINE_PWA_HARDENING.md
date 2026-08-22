# CourtCall Phase 11 — Supabase / Offline / PWA Hardening

**Branch:** `codex/phase11-supabase-offline-pwa-hardening` (uncommitted per stop conditions)
**Scope:** resilience only — no product redesign, no live-scoring UX changes, no RLS/security weakening, all existing localStorage keys and data formats preserved.

---

## 1. Issues found (audit)

| # | Area | Issue |
|---|------|-------|
| 1 | Supabase | No timeout on any cloud call — a stalled request left the sync indicator or the communities screen in "Syncing…/Loading…" forever. |
| 2 | Supabase | `supaFetchGames` ignored the `error` result and had no try/catch — a network failure surfaced as an empty games list. |
| 3 | Supabase | No bounded retry/backoff anywhere; every failure was one-shot. |
| 4 | Sync contract | The sync indicator could not distinguish AUTH REQUIRED or PERMISSION DENIED from a generic failure. |
| 5 | Sync | `retryCloudSync` was not single-flight and reconnect events fired it immediately — a flapping connection could stack concurrent full syncs. |
| 6 | Sync | Failed cloud deletes (match, tournament) were silently swallowed; the record silently reappears on the next pull with no user visibility. |
| 7 | Service worker | **Offline shell integrity bug:** precached shell JS/CSS was never served by the fetch handler — scripts/styles were served only from the bounded (48-entry LRU) runtime cache, so core scripts could be evicted and break the app offline even though the precache held them. |
| 8 | Service worker | A 5xx served during a deployment was passed through to a navigation, blanking the app instead of falling back to the cached shell. |
| 9 | Phase 10 | `discoverWrite` used an unguarded `localStorage.setItem` — a full/blocked storage quota threw and crashed the follow / submit / report / claim flows, or showed a success toast for a write that never landed. |
| 10 | Local-first | `setCol`/`setObj` swallowed write failures silently — the user believed data was saved when it wasn't. |
| 11 | Local-first | `getCol` returned non-array JSON (e.g. a corrupt `{}`) as-is; no duplicate-id recovery existed. |
| 12 | Game | A failed active-game save kept showing "● Saved on device" from the previous successful save. |
| 13 | Auth | A `SIGNED_OUT` event while offline (failed token refresh) destroyed the local profile view and forced the sign-in screen the device could not complete; offline startup with an unrestorable session did the same. |
| 14 | A11y | The sync indicator announced every transient state flicker (`Saving locally…` → `Online · Saved…`, ~250 ms) through `aria-live`, producing screen-reader noise. |
| 15 | Misc | Several small unguarded `localStorage.setItem` calls (onboarding, Pulse location, seen-version, PWA dismissal) could throw on quota. |

Already solid (verified, unchanged): community view-state model (offline ≠ empty ≠ error), merge logic that retains unmatched local records on every pull (no destructive overwrite from stale cloud data), idempotent upserts with `onConflict`, in-flight dedupe for community/post sync, non-destructive logout, guest isolation, OTP request gate, Phase 10 provenance normalization (never auto-VERIFIED), atomic-precache-on-install with delete-on-failure.

## 2. Sync-state model (F)

`courtcall-cloud-state.js` now carries the full contract:

- **SYNC states:** `ONLINE_SYNCED` (only after a real cloud success), `ONLINE_LOCAL` (local only), `SAVING_LOCAL`, `SYNCING`, `OFFLINE_SAVED`, `FAILED`, **new:** `AUTH_REQUIRED` ("Saved on this device · Sign in to sync"), **new:** `PERMISSION_DENIED` ("Saved on this device · Cloud sync not permitted").
- **FAILURE classes:** `offline`, `timeout`, `auth_required`, `permission_denied`, `server_unavailable`, `unknown` via `classifyFailure(error,{online})`, each with user copy (`failureMessage`) and a mapping onto sync states (`syncStateForFailure`) that can never return a success state.
- `ONLINE_SYNCED` is set only when an actual cloud operation resolved without error; `K.lastSync` is stamped only then (pre-existing rule, preserved).

## 3. Supabase resilience changes (A, G)

- **Timeouts everywhere it matters** via new `withTimeout` (works on Supabase thenables): community sync 15 s, full account sync 45 s, community writes/RPCs 12 s, game save 12 s, games fetch 12 s, event RSVP 12 s. Timeout errors classify as `timeout` and surface as `FAILED` — loading/syncing can no longer hang indefinitely.
- **`supaFetchGames`** now checks `error`, wraps in try/catch, and returns `null` on failure so failure is distinguishable from an empty account.
- **Classification wired into every failure path**: `supaSaveGame`, `_runCommunityCloudWrite`, `_runCommunityRpc`, `supaSetEventRsvp`, `_pushLocalDataToCloud`, `retryCloudSync`, `syncAllUserDataFromDB` set the classified sync state (offline / auth / permission / failed) instead of a blanket `FAILED`.
- **Bounded retry/backoff** via new `runWithRetry`: exponential 800→1600→3200 ms capped at 8 s, hard-capped at 5 attempts, never retries auth/permission failures, stops when the device goes offline. Applied to the idempotent account pull inside `retryCloudSync` (2 attempts). Writes are not auto-duplicated: all writes are id-keyed `upsert … onConflict` (deterministic IDs), so the existing outbox push stays idempotent.
- **Single-flight + debounce:** `retryCloudSync` shares one in-flight promise across reconnect events, manual Retry, and renders; the `online` event settles 800 ms before triggering it.
- **Failed cloud deletes now visible:** match and tournament deletion show "Deleted on this device · the cloud copy may reappear until sync succeeds" when the cloud delete fails while signed in and online.

## 4. Local-first safeguards (B, K)

- `getCol` reads through `safeJsonParse` + `dedupeById`: corrupt JSON → `[]`, non-array JSON → `[]`, junk entries dropped, duplicate ids keep first occurrence, id-less records kept (never silently deleted).
- `getObj` rejects wrong-shaped values (primitives, arrays where objects are expected) and falls back to the default.
- `setCol` / `setObj` / `discoverWrite` return success booleans, log, and show a throttled (≤1/min) "could not be saved on this device" toast on failure instead of silently losing data.
- New compatible metadata: `cc_local_write_meta` records an ISO timestamp per key on every local write (additive key, covered by the existing `cc_` wipe rule; nothing reads it as a requirement, so old clients are unaffected).
- Active-game `save()` failure now flips the on-screen state to "● Not saved — device storage is full" instead of continuing to claim "Saved on device".
- Remaining unguarded writes (onboarding flag, Pulse location, seen-version, PWA dismissal) wrapped; Pulse save aborts its success toast on failure.
- Stale-cloud protection unchanged and asserted by tests: every pull merges by id and retains unmatched device records; community/member retention rules untouched.

## 5. Offline UX (C) and accessibility (L)

- Offline the shell, gameplay, tournaments, history, Help, and Phase 10 discovery all remain usable (verified in browser QA); previously loaded community data stays visible via the local mirror (`VIEW.OFFLINE` copy, unchanged).
- Sync indicator states are text + border-color (never color-only); new CSS for `auth_required` / `permission_denied` on both the floating indicator and the dashboard pill.
- `aria-live` on the sync indicator is now `off` during the transient states (`saving_local`, `syncing`, `online_local`) and `polite` for meaningful ones (offline, failed, synced, auth, permission); the label only updates when its text actually changes — no repeated announcements. Keyboard navigation untouched.
- Reconnect: one debounced, single-flight push-then-pull; the indicator transitions Offline → Syncing → an honest final state.

## 6. Service-worker changes (D, E) — cache `v56`

`basketball-sw.js` (`CACHE_VERSION` **v55 → v56**):

1. **Shell-precache fallback for static assets** — `staleWhileRevalidate` now falls back to the versioned app-shell precache when the bounded runtime cache misses, fixing the offline-integrity bug (#7). Runtime-cache-first behavior online is unchanged.
2. **5xx navigation fallback** — a ≥500 response to a navigation serves the cached shell; 404s still pass through so the honest `404.html` behavior is preserved (no HTML for missing static assets: asset misses still return the empty 504 response).
3. Precache entry for `courtcall-cloud-state.js` now version-pinned (`?v=20260823`) to match the updated `index.html` script tag, so the changed module can't be served stale by the runtime cache.

Unchanged and re-verified: atomic install (delete-cache-on-failure), obsolete cache cleanup on activate, `skipWaiting` only on user request, `clients.claim`, relative `./` paths for root/project-path compatibility, HTML-response guard in precache validation, runtime cache LRU bound, no repository-internal files in the artifact (builder-enforced).

**Update / stale-client safety (E):** update flow is user-driven (prompt → Reload); `controllerchange` reloads only after the user opts in — no forced destructive reload mid-game. Mixed-version risk is minimized by version-pinned asset URLs plus network-first navigations. Verified live (see QA): waiting-worker prompt appears, reload activates v-next, obsolete caches are removed, and a seeded active game survives the update reload.

## 7. Auth/session (H), communities (I), Phase 10 (J)

- **H:** a `SIGNED_OUT` auth event while offline no longer clears the local profile (explicit sign-out flows manage their own UI); offline startup with an unrestorable session keeps the cached profile instead of forcing a sign-in loop; the next online restore re-evaluates honestly. Guest mode, OTP error mapping, non-destructive logout unchanged and covered by tests.
- **I:** community fetch failure states already distinguish offline/error/auth/permission from empty; the screen-level sync indicator now maps permission and auth failures to their specific states instead of generic `FAILED`. Phase 7 permissions untouched. Optimistic-mutation rollback paths untouched (existing tests still pass).
- **J:** discover follow/submission/report/claim writes fail safely and only claim success after the write lands; corrupt discovery collections normalize (dedupe, enum clamping, HTTPS-only links) without crashing; followed IDs remain stable sorted sets; submissions remain `PENDING`, never auto-`VERIFIED`; storage keys unchanged so future Supabase migration mapping is preserved.

## 8. Files changed

| File | Change |
|------|--------|
| `courtcall-cloud-state.js` | FAILURE taxonomy, `classifyFailure`, `failureMessage`, `syncStateForFailure`, `isRetryableFailure`, `retryDelayMs`, `withTimeout`, `runWithRetry`, `safeJsonParse`, `dedupeById`; SYNC `AUTH_REQUIRED`/`PERMISSION_DENIED` + copy. All previous exports byte-compatible. |
| `basketball-sw.js` | v56; shell-precache fallback for runtime assets; 5xx navigation fallback; version-pinned cloud-state precache entry. |
| `index.html` | Storage helper hardening + write-meta; sync indicator a11y + new-state CSS; timeouts/classification/single-flight/debounce/retry wiring; auth offline guards; discover write safety; delete-failure visibility; guarded misc writes; cloud-state script tag `?v=20260823`. |
| `tests/courtcall-phase11-resilience.test.js` | **New** — 30 focused Phase 11 tests. |
| 11 existing test files | Pinned service-worker cache version updated v55 → v56 (per-phase convention); landing-hub test updated for the 5xx navigation fallback while still asserting network-first navigation. |

No other files touched. No backup ZIP present in the working tree; nothing outside the repo was modified.

## 9. Focused Phase 11 test results (M)

`node --test tests/courtcall-phase11-resilience.test.js` → **30/30 pass**, covering: the six failure classes; no failure maps to a success state; honest auth/permission copy; `withTimeout` resolve/reject; bounded backoff (800/1600), no auth/permission retries, attempt cap, offline stop; corrupt JSON, junk records, duplicate ids, missing ids; safe write failure paths incl. active-game save; newer-local retention on pulls; failed-fetch ≠ empty; loading cannot hang (timeout wiring); reconnect single-flight; offline SIGNED_OUT/startup guards; session-restore validity; quiet aria states; SW v56, shell fallback, 5xx fallback, 504 asset misses, precache/tag version match, user-driven update; community state mapping; Phase 10 write safety, corruption normalization, stable following, delete-failure visibility.

## 10. Full regression results

`node --test tests/*.test.js` → **216/216 pass** (186 pre-existing + 30 new). `node --check` clean on every root JS module, test file, and build tool; the inline `index.html` script parses clean.

## 11. Production artifact result

`node tools/build-public-artifact.mjs` → **69 files built**, all required assets present, no repository internals (tests/tools/supabase/.github/sql/zip/md) selected.

## 12. Browser / offline QA (N)

Headless Chromium against the built artifact served on localhost. The Supabase host is unreachable from this environment's network, which doubles as a live exercise of the failure paths (all resulting console entries are the classified, logged network failures — the UI stayed honest throughout: "Saved on this device", never "Synced").

**Main pass — 25/25:** SW active with cache `courtcall-v56`, 36-entry shell precache; all eight routes (`/`, `#/landing`, `#/hub`, `#/tournament`, `#/tournament/discover`, `#/communities`, `#/analytics`, `#/help`) render with content and no horizontal overflow; sample-data follow persists and survives reload; sync label honest online and offline; **offline:** full reload served by the SW, hub/tournament/help usable, following intact, "Offline · Saved on this device"; **reconnect:** returns to online state; seeded active game survives reload; **mobile portrait (390×844) and landscape (844×390):** no overflow on landing/hub/discover/help; no unexpected console errors; **zero 404s**.

**Update-flow pass — 4/4:** with a new SW version deployed to the (scratch) server, the "newer version" prompt appears for the waiting worker; clicking Reload activates it; obsolete `courtcall-v56*` caches are cleaned; the active game survives the update reload; the new worker controls the page.

## 13. Limitations

- Real production (`courtcall13.win`) and the real Supabase project are unreachable from this environment (egress policy), so cloud **success** paths (actual sync, OTP delivery, RLS responses) were exercised only through the module-level contract and mocks, not end-to-end.
- Browser QA ran in headless Chromium only; Safari/iOS PWA install behavior not re-verified this phase.
- `runWithRetry` is wired into the account pull; individual community writes intentionally stay one-shot (visible failure + manual Retry) to avoid any duplication risk on partially-applied multi-step writes.
- The persistent offline mutation outbox remains future work (unchanged from the existing changelog's "upcoming").

## 14. Remaining manual / external checks

1. On a network with Supabase access: sign in, confirm `ONLINE_SYNCED` appears only after a real pull/push, and that a revoked-permission account shows the new "Cloud sync not permitted" state.
2. Airplane-mode test on a real phone: start a game offline, finish it, reconnect, confirm the game upserts once (no duplicates).
3. After the eventual deploy: confirm SW `v56` activates, the update prompt appears on stale tabs, and an in-progress game survives applying it.
4. Screen-reader spot check (VoiceOver/TalkBack): offline/failed announcements audible once; local-save flickers silent.
