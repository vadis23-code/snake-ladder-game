# CourtCall Phase 14 — Final QA & Release Gate

**Branch:** `codex/phase14-final-qa-release` (from `origin/master`)
**Baseline / HEAD:** `86333d52f21a4e027b68b81d9f1c829be5f84694` — **unchanged**
**Service worker:** v58 (unchanged) · **Regression:** 249/249 · **Artifact:** 69 files

## Verdict

**RELEASE GATE: PASS — no code changes were made.**

The audit found **zero P0, P1, or P2 defects**. One P3 performance edge case is documented below and deliberately left unchanged. Because Phase 14 required every code change to be linked to a reproducible defect, and none qualified, the working tree is clean and production is untouched.

## A. Release baseline (verified)

| Check | Result |
|---|---|
| Branch from current `origin/master` | ✓ |
| HEAD == `86333d5…` | ✓ |
| Working tree clean | ✓ |
| No unexpected untracked files | ✓ (none) |
| No backup ZIP in clone | ✓ (none present) |
| SW cache version | ✓ v58 |
| Regression baseline | ✓ 249/249 |

## B. Issue ledger

| ID | Sev | Area | Finding | Disposition |
|---|---|---|---|---|
| **F-1** | **P3** | Live game / feed | The event feed renders the **entire** game history; `renderGame()` cost scales linearly. Measured: 0.4 ms (0 events) → 9 ms (100) → 18.8 ms (250) → 37.4 ms (500) → **70.6 ms (1000)**. DOM grows exactly **4 nodes per event**. | **Not changed.** A realistic pickup/tournament game is 15–100 events, where cost is ≤9 ms and imperceptible. Capping the feed would change product behaviour (users would lose full-game history) — a product decision, not a defect fix. Recommended for a future phase. |
| N-1 | — | Routing | `#/communities/<id>` does not open a community detail. | **Not a defect.** The canonical deep link is `#/community/<id>` (singular), which the app itself generates; the plural path degrades gracefully to the communities list. Verified all four behaviours. My initial probe used the wrong URL. |
| N-2 | — | Gating | `#/communities` renders without an identity. | **Not a defect.** `communities` is intentionally in `_PUBLIC_SCREENS` (with landing, profile, onboarding, privacy, terms, world, help) to allow public community discovery. |
| N-3 | — | Post-game | "Rematch" appeared to drop the roster. | **Not a defect.** My probe clicked `#pg-new-game` ("New Game" → setup, correct) and separately invoked `playAgain()` after `saveAndExitGame()` had reset state. Using the real **"🔄 Rematch (Same Teams)"** button, rosters are preserved with scores/fouls/timeline reset. |
| N-4 | — | PWA | `fonts.googleapis.com` failed to fetch after the update. | **Not a defect.** External CDN blocked by this sandbox's egress policy. Fonts load with `preconnect` + `display=swap` and full fallback stacks (`'Bebas Neue',sans-serif` / `'Inter',system-ui,…`), so text is always visible — confirmed by offline runs rendering 700–1900 chars. |
| N-5 | — | Endurance | "DOM duplication" flag. | **Miscalibrated assertion**, superseded by F-1: scorer rows stayed at 6, buttons at 18, and listener count grew by **+0** across 106 actions. Growth is feed content, not duplication. |

**Every "failure" surfaced by the harness was diagnosed before any code was touched; five of six were harness errors, and the sixth is a documented P3.**

## C. Production route QA

**Effective 42/42.** All routes render with content, correct screen, and no blank state: `/`, `#/landing`, `#/auth`, `#/hub`, `#/setup`, `#/game`, `#/teams`, `#/history`, `#/tournament`, `#/tournament/{discover,following,host}`, `#/communities`, `#/analytics`, `#/pulse`, `#/world`, `#/settings`, `#/help`, `#/help-center`, `#/privacy`, `#/terms`, `#/profile`, `#/onboarding`, `#/changelog`. (`#/auth` and `#/help` resolve to `s-hub`/`s-help-center` respectively — aliases handled by the resolver, not dead routes.)

- **Deep links:** tournament, community (canonical), and discovery-item deep links all open the right screen **and survive a hard refresh**; unknown community ids degrade to the list rather than a blank screen.
- **Back/Forward:** settings → history → hub and forward again all correct.
- **Gating:** hub, settings, history correctly require identity (→ profile); landing, privacy, terms correctly public.
- **Across 5 viewports (320/390/844L/768/1440):** no horizontal overflow, **no console errors, no 404s**, one primary heading per route.

## D. End-to-end game QA — **26/26**

Team A (Player A, Player C) vs Team B (Player B, Player D), all 20 prescribed steps:

- C +2 → C=2/A=2 with `Team A · Player C · +2`; D +3 → D=3/B=3; C +1 → C=3/A=3; undo → C=2/A=2.
- **Rapid burst** (C+2, A+3, D+2, B+1): exact totals C4/A3/D5/B1 → **7–6**, and **exactly 4 events**.
- **Mixed rapid taps:** exactly 5 events, totals consistent with the timeline.
- **8 repeated same-player taps:** all 8 landed, C +16.
- Foul, possession, timeout (2→1), period (correctly inert when disabled) all behave.
- **Voice scoring routes through the same engine** (`parseVoiceCmd('team a two')` → +2, no divergent path).
- **Winning basket** ends the game; **undo** reopens it, rolls back team + player + timeline by exactly one event; scoring resumes immediately.
- **History:** exactly one record, scores and winner match the game, **per-player stats persisted** (`Player A:7, Player C:23`), no duplicate ids.
- **Rematch** keeps rosters at 0-0 with a clean timeline; **Swap & Rematch** swaps sides; neither creates phantom history records.

## E. Endurance — **10/10** (with F-1 noted)

110 planned actions → **106 scoring actions + 4 undos**, alternating teams, 4 players, mixed +1/+2/+3, with fouls and timeouts interleaved:

- **No dropped actions** (106 events for 106 actions); **per-player totals exact** (A54/C54/B51/D53).
- **Team totals match an independent recomputation** of the timeline (108–104).
- **DOM score matches state** — no stale UI; **0 duplicate timeline events**.
- **+0 event listeners** across the whole session; scorer rows/buttons constant (6/18) — no duplication.
- Active game **survives reload** intact.
- Node growth attributed precisely to the feed (F-1), not a leak.

## F. Offline / reconnect — **18/18**

Start online → score → offline → score → **reload offline** → continue → **end game offline** → reconnect → sync → reload:

- No data loss at any step; **no duplicate games**; **no false "Synced"** at any point.
- Copy stayed honest: `Offline · Saved on this device` throughout, `Online · Saved on this device` after reconnect.
- Hub, History, Tournaments, **Discover India**, and Help all usable offline.
- Post-reconnect reload: 1 match, 1 unique id — no duplication.

## G. PWA update flow — **11/11**

Against the live v58 worker, with a temporary `v59-test` worker deployed **only in the test environment** (production `basketball-sw.js` re-verified at v58 afterwards):

- Waiting worker detected; **update prompt shown**; **no silent destructive reload** — the in-progress game stayed live and **remained scoreable while the update waited**.
- Reload activated the new worker; **obsolete v58 caches removed**; new worker controls the page.
- **In-progress game survived the update** (score and timeline intact).
- All same-origin shell assets resolved post-update (see N-4 for the external font CDN).

## H. Supabase / Auth real-world QA — **NOT PERFORMED (blocked)**

> **Re-attempted in a dedicated backend-validation pass — still blocked. See "Backend release gate" below for the authoritative result.**

`https://jfeegcocynozbjpzbjae.supabase.co` is **unreachable from this environment**: the egress proxy returns `403 CONNECT` (16 recorded denials). Per the "if network access permits" condition, **no real OTP, session, sync, or RLS testing was possible.** This is a genuine gap, not a pass.

What was verified **at contract level only** (no network) — 31/31:

- **OTP gate:** first send allowed; concurrent duplicate blocked; resend blocked during the 60 s cooldown and allowed after; **a failed send does not start a cooldown**; verify is single-flight.
- **Session validation:** null / token-without-user / user-without-token all rejected; only a complete session authenticates.
- **Error copy:** invalid code → "Incorrect or expired code"; offline verify does not blame the user's code; email normalised; OTP digits sanitised.
- **Community permission boundaries (13/13):** guest cannot post, member can; member cannot change roles, admin can; **admin cannot demote the owner or change their own role**; only the owner deletes the community; private hidden from non-members; read-only blocks members but not admins; members can delete only their own posts; **an unknown action fails closed**.

## Files changed

**None.** No production file, test, or configuration was modified. HEAD remains `86333d5…`, working tree clean.

## Limitations

- **Supabase/auth/RLS untested against the real backend** (section H) — the single largest gap in this gate.
- All browser QA was **headless Chromium on Linux**; no Safari/iOS, Firefox, or physical device. Touch targets are verified by measurement, not by real thumbs; haptics untested.
- **No Windows runtime verification.** Phase 13 proved the *test-assertion* CRLF class is safe via a controlled simulation, but Windows build/CI runtime behaviour remains unverified.
- Endurance was 106 actions in one session; multi-hour or multi-game soak testing was not performed.
- Contrast was not measured programmatically (carried over from Phase 13).
- Voice scoring was exercised through `parseVoiceCmd` (the same engine entry point), not a real microphone.

## Remaining manual checks before declaring general availability

1. **Run section H against the real Supabase project** from a network-permitted environment — OTP end-to-end, session restore, logout/login, sync, and the RLS boundaries above enforced *server-side*.
2. Real-device pass (iOS Safari + Android Chrome): scoring ergonomics, haptics, install/update prompt.
3. A Windows CI run to close the cross-platform question at runtime, not just at assertion level.
4. Optional: revisit **F-1** if long sessions become common — cap or virtualise the live feed.


---

# Backend Release Gate — Real Supabase Validation Attempt

**Outcome: GATE REMAINS OPEN. Sections 1–6 of the backend validation were NOT executed.**

## Real Supabase connectivity result — BLOCKED

The project `https://jfeegcocynozbjpzbjae.supabase.co` is unreachable from this environment. Verified across four independent paths so the conclusion does not rest on one tool:

| Probe | Result |
|---|---|
| `curl $SUPA/auth/v1/health` | `curl (56) CONNECT tunnel failed, response 403` → HTTP 000 |
| `curl $SUPA/rest/v1/` with the anon key | `curl (56) CONNECT tunnel failed, response 403` → HTTP 000 |
| DNS resolution of the project host | **Resolves** — so this is policy denial, not a DNS/typo failure |
| Real `supabase-js` client in the loaded app (browser) | `getSession()` returns in 1 ms with no session (local read, no network); `from('communities').select()` → **`TypeError: Failed to fetch`** |
| Control: `https://example.com` | HTTP 000 — **blanket egress policy**, not Supabase-specific |

Egress proxy record: **20 recorded denials, 15 against the Supabase host**, most recent `connect_rejected — gateway answered 403 to CONNECT (policy denial or upstream failure)`. Policy is non-selective (`selective: false`, `toolScoped: false`).

Per the standing environment rules, organisation egress denials must be reported rather than routed around, so no workaround was attempted.

## Results for the requested backend checks

| # | Area | Result |
|---|---|---|
| 1 | OTP auth (request, invalid code, valid sign-in, restore, logout, re-login, resend cooldown, no token leakage) | **NOT PERFORMED — backend unreachable** |
| 2 | Profile / account sync (cloud save, restore, `ONLINE_SYNCED` only after real success) | **NOT PERFORMED — backend unreachable** |
| 3 | Game sync (single cloud record, history restore, offline→reconnect, no duplicates) | **NOT PERFORMED — backend unreachable** |
| 4 | **RLS / server-side permission enforcement** | **NOT PERFORMED — backend unreachable** |
| 5 | Session / failure behaviour against real error responses | **NOT PERFORMED — backend unreachable** |
| 6 | Cleanup of test data | **Nothing created, so nothing to clean up** |

No test account was created, no OTP was requested, and no data was written or deleted. No OTP, token, secret, invite code, or private record was accessed, logged, or persisted.

## Defects found / fixes made

**None found; none made.** No code was changed. The working tree carries only this report; every production file remains byte-identical to the deployed release `86333d5…`, and the service worker stays at v58.

## What this gap does and does not mean

- The client-side permission contract was verified earlier (13/13, including *admin cannot demote the owner* and *unknown actions fail closed*). That is **not** evidence that the database enforces the same rules — client checks shape the UI; RLS is what actually protects data.
- Equally, **no RLS defect was observed** — nothing was observable at all. This is an unverified control, not a known-broken one.
- Everything testable without the backend passed comprehensively: routes 42/42, end-to-end game 26/26, endurance 10/10, offline/reconnect 18/18, PWA update 11/11, regression 249/249.

## Final release recommendation

### RELEASE WITH KNOWN LIMITATIONS

Justification: the build already deployed at `86333d5…` passes every check that can be executed here, and the frontend, offline, local-first, scoring, and PWA layers are thoroughly evidenced. The limitation is that **server-side authorization has not been independently verified in this gate**.

Conditions attached:

1. **Before treating community privacy or role boundaries as assured**, run backend items 1–5 from a network-permitted environment, using ordinary client sessions only — never service-role credentials. The bundled `supabase-rls-audit.sql` is the natural starting point.
2. Treat item 4 (RLS) as the **highest-priority** outstanding check: it is the only gap with a security, rather than functional, consequence.
3. The remaining Phase 14 limitations still stand — no real-device pass, no Safari/iOS or Firefox, and no Windows runtime verification.

**This recommendation should not be read as backend sign-off.** It reflects a product whose verifiable surfaces are in good shape, with one genuinely unverified control that a reviewer with network access must close.
