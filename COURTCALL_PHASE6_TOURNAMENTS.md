# CourtCall Phase 6 — Tournaments

Date: 2026-08-15  
Scope: Phase 6 tournament system only  
Canonical production entry point: `index.html`  
Production test origin: `http://127.0.0.1:8765/`  
Git operations: none

## Result

Phase 6 is complete. CourtCall now provides a compatible tournament hub and dedicated tournament detail route, complete Round Robin standings, deterministic Knockout brackets with byes, real-game result integration, idempotent progression, champion history, reload/resume behavior, and contained mobile scrolling. The full repository suite passes: **132 tests passed, 0 failed** (baseline: 120 passed).

No cinematic landing files, community permissions, Supabase schema, storage key, or unrelated visual system behavior were redesigned. Phase 7 was not started.

## 1. Audit findings

The audit was completed before implementation against `COURTCALL_SPEC.md`, `COURTCALL_PHASE4_CORE_GAME.md`, `COURTCALL_PHASE5_TEAM_HISTORY.md`, `COURTCALL_GLOBAL_VISUAL_SYSTEM.md`, the canonical `index.html`, `courtcall-core.js`, tournament styling, the service worker, and the complete automated test suite.

### Existing capability before Phase 6

- `cc_tournaments` already stored local tournament records.
- Supabase already used a `tournaments` table and a compatible upsert/delete path.
- Round Robin and Knockout fixture generators existed in `courtcall-core.js`.
- The game model already carried `tournamentId` and `fixtureId` context.
- A basic tournament screen could create tournaments, display fixtures, and launch games.
- Existing Phase 4 logic already covered scoring, manual endings, rematches, history normalization, and the post-game victory surface.
- Existing visual primitives included a Championship atmosphere suitable for tournament screens.

### Gaps found

1. There was no durable tournament-history view separated from active tournaments.
2. Tournament details were embedded in the hub instead of having a deep-linkable detail route.
3. Round Robin standings were not persisted or fully displayed; played, draws, points against, and differential were missing from the table.
4. Round Robin completion did not safely distinguish a unique champion from an unresolved specification-level tie.
5. Knockout ordering used random shuffling, so byes were not deterministic.
6. Knockout completion did not reliably persist the tournament winner and completed state.
7. Result application was not idempotent by both fixture and match ID.
8. Rematches could retain tournament context and risk duplicate progression.
9. Tournament `Save & Exit` returned to Hub instead of the originating detail screen.
10. Active tournament matches did not expose a clear resume action in tournament details.
11. The bracket could create page-level overflow and mixed match controls into the bracket surface.
12. Legacy tournament records were read directly, with insufficient normalization of old names, formats, scores, and snake_case fields.
13. Browser testing exposed two lifecycle defects: cancelling a 0–0 game was re-saved while leaving the game screen, and `handleBackFromGame` accessed a removed `resume-card` without a null check.

## 2. Files changed

### Application

- `index.html`
- `courtcall-core.js`
- `courtcall-tournaments.css` (new, tournament-scoped presentation)
- `courtcall-global-visual-system.css`
- `courtcall-global-visual-system.js`
- `basketball-sw.js`

The global visual files were changed only to register and style the new tournament-detail route with existing Championship primitives. The service-worker shell is now `v44` and includes `courtcall-tournaments.css`.

### Tests

- `tests/courtcall-phase6-tournaments.test.js` (new)
- `tests/courtcall-design-foundation.test.js`
- `tests/courtcall-global-visual-system.test.js`
- `tests/courtcall-landing-hub-separation.test.js`
- `tests/courtcall-phase4-core-game.test.js`
- `tests/courtcall-phase5-team-history.test.js`
- `tests/courtcall-visual-motion-foundation.test.js`

The existing test files were updated only where the new route, return path, tournament stylesheet, or service-worker shell version changed their integration contract.

## 3. Round Robin work

- Enforces 2–16 named, case-insensitively unique teams.
- Enforces a non-empty, case-insensitively unique tournament name while permitting genuinely similar names.
- Retains the existing first-to score choices and bounded custom score.
- Generates every required pairing once, including correct odd-team scheduling in the existing core generator.
- Records fixture status, match ID, scores, winner, and outcome once.
- Derives and persists standings with:
  - played
  - wins
  - losses
  - draws
  - points for
  - points against
  - point differential
  - standings points
- Ranks exactly by standings points, then differential, then points scored.
- Updates standings immediately after the real game result is accepted.
- Marks pending and completed fixtures explicitly.
- Determines a champion only when the leading team is unique after the specified tie-breaks.

### Draw behavior

The normalized/core standings model can represent legacy or explicitly allowed tied fixtures. The live tournament scorer requires a winner, so a normal live tournament game cannot be manually ended tied. This preserves Knockout progression and the current tournament-game rule without inventing a new draw workflow.

### Tie-break limitation

`COURTCALL_SPEC.md` stops after points, point differential, and points scored. If all three remain equal, CourtCall completes the fixtures but sets `winner: null`, exposes `tiebreak_required`, and tells the user the champion is unresolved. It does not invent head-to-head, alphabetical, coin-flip, or other rules.

## 4. Knockout work

- Accepts the same valid 2–16 team range.
- Uses deterministic insertion order; random shuffling was removed.
- Builds the next power-of-two bracket without creating `BYE` vs `BYE` matches.
- Creates explicit round/slot links for progression.
- Labels Final, Semifinal, Quarterfinal, and larger rounds consistently.
- Advances each bye winner automatically and exactly once.
- Advances played winners into the correct downstream slot exactly once.
- Prevents a played fixture from accepting a second result.
- Prevents a match ID from being applied to another fixture.
- Prevents an eliminated team from re-entering the bracket.
- Prevents undo from rewriting a downstream match that has already been played.
- Persists the final winner and moves the tournament into completed history.

The browser-tested five-team tournament produced three deterministic first-round byes, four playable matches, and one champion (`Atlas`). The final persisted after reload.

## 5. Tournament detail and history

- Hub route: `#/tournament`
- Canonical detail route: `#/tournament/:id`
- Legacy-compatible detail route: `#/tourn-detail/:id`
- Unknown IDs fall back safely to the tournament hub.
- Detail refresh restores the same tournament.
- The detail screen shows name, format, first-to rule, date, status, team count, progress, next match, team roster, standings or bracket, completed/pending matches, and champion/tie-break state.
- The hub separates current tournaments from completed tournament history.
- Reopening a completed tournament preserves its bracket, scores, winner, and history status.

## 6. Game integration

- Tournament fixtures launch `Phase4GameCore.createState`; there is no alternate or fake scorer.
- Fixture teams populate the real scoreboard.
- `tournamentId` and `fixtureId` remain in the persisted active-game context.
- `Save & Exit` returns to the originating tournament detail route.
- A result updates the tournament before history is finalized.
- A duplicate tournament result prevents a duplicate history record.
- Post-game rematch paths clear tournament context, so a rematch is a pickup game and cannot double-count the fixture.
- Leaving an active tournament game exposes `Resume Match` only on its originating fixture and blocks other fixtures.
- Reloading the tournament detail route preserves the resume action.
- Cancelling a 0–0 abandoned match clears the active-game record after the route lifecycle finishes; it creates no fixture result and immediately unblocks every pending fixture.
- The removed legacy `resume-card` lookup is null-safe, eliminating the console error found during browser testing.

## 7. Data compatibility

### localStorage

- Key remains `cc_tournaments`.
- No tournament data is deleted or bulk rewritten.
- Old shapes normalize at read time.
- Unknown compatible fields are preserved.
- Derived UI-only fields (`status`, progress counts, and next fixture) are not added to the stored record.
- Old `title`, `type`, `win_score`, string-team, object-team, fixture ID, home/away, score, match ID, status, and timestamp variants are accepted where unambiguous.
- Missing legacy fixture IDs receive stable per-read fallback IDs based on the tournament and fixture position.

### Supabase

The established table and mapping remain:

| Local meaning | Supabase column |
|---|---|
| ID | `id` |
| Owner | `user_id` |
| Name | `name` |
| Format | `format` |
| Win score | `win_score` |
| Teams | `teams` |
| Fixtures | `fixtures` |
| Standings | `standings` |
| Completed | `completed` |
| Winner | `winner` |
| Settings/compatible metadata | `settings` |
| Created | `created_at` |
| Updated | `updated_at` |

Upserts continue to conflict on `id`. No migration, table rename, column rename, RLS change, community permission change, or new RPC was introduced.

### Renamed/deleted player compatibility

Tournament teams and fixtures retain team-name snapshots and do not depend on live player-directory records. Renaming or deleting an individual player therefore does not invalidate an existing tournament. CourtCall does not silently rewrite historical tournament team names from later player/team edits.

## 8. Responsive verification

All checks ran against the canonical production application. Page/document/active-screen horizontal overflow was `0px` at every required viewport. Controls measured at least `44px` high.

| Viewport | Page overflow | Knockout bracket | Round Robin standings |
|---|---:|---|---|
| 320×568 | 0px | Local scroll, 266px viewport / 797px content | Local scroll, 266px / 672px |
| 390×844 | 0px | Local scroll, 325px / 961px | Local scroll, 325px / 672px |
| 844×390 | 0px | Local scroll, 763px / 912px | Fits, 763px / 763px |
| 768×1024 | 0px | Local scroll, 687px / 912px | Fits, 702px / 702px |
| 1440×900 | 0px | Fits, 1086px / 1086px | Fits, 1086px / 1086px |

Only `.tournament-bracket-scroll` and `.standings-scroll` move horizontally on narrow screens. Tabs, match controls, tournament actions, and page navigation remain outside those local scrollers.

## 9. Test results

### Automated

Command: bundled Node runtime with `node --test tests/*.test.js`

- **132 passed**
- **0 failed**
- **0 skipped**
- `courtcall-core.js` syntax check passed.
- The single inline production script in `index.html` parsed successfully.

Focused Phase 6 coverage includes legacy normalization, minimum size, duplicate teams, same/similar tournament names, complete Round Robin standings, unresolved specification ties, deterministic five-team byes, full Knockout champion progression, safe undo, round labels, deep-link routing, production integration markup, responsive local scrollers, offline shell inclusion, storage/Supabase contracts, cancellation cleanup, null-safe return navigation, and balanced CSS.

The complete suite also re-ran existing even/odd Round Robin generation, power-of-two and five-team Knockout generation, fixture result rules, rematch behavior, game outcomes, history, routing, accessibility, visual system, motion, community security, and settings contracts.

### Browser production workflow

Tested origin: `http://127.0.0.1:8765/`

Round Robin detail tested:  
`http://127.0.0.1:8765/#/tournament/tourn_1786757238025`

Knockout detail tested:  
`http://127.0.0.1:8765/#/tournament/tourn_1786757406581`

Verified through the production UI:

- Created a four-team Round Robin (`Orbit`, `Ember`, `Glacier`, `Summit`).
- Launched `Orbit` vs `Summit` in the real game screen.
- Scored and saved a 21–0 result.
- Returned to the same tournament detail route.
- Confirmed immediate standings: Orbit P1/W1/PF21/PA0/Diff+21/Pts2.
- Reloaded the detail route and retained the result and next fixture.
- Left the tournament incomplete to verify active/current-tournament persistence.
- Reloaded and resumed a 0–0 `Glacier` vs `Ember` match, cancelled it, confirmed no result was added, and confirmed all five pending fixtures were immediately scoreable again.
- Created a five-team Knockout (`Atlas`, `Blaze`, `Comets`, `Dynasty`, `Eclipse`).
- Verified three deterministic byes.
- Played every real game through the Final.
- Confirmed automatic advancement, 4/4 completion, champion `Atlas`, zero remaining score actions, reload persistence, and completed-history placement.
- Reopened tournaments repeatedly through hub cards and direct hashes.
- Confirmed an exact duplicate tournament name is rejected and a similar name remains eligible without creating another record.
- Confirmed only two test tournament cards exist; the similar-name check did not submit.

The final clean-tab console run contained no tournament errors. The only error was the pre-existing local-environment community sync fetch failure:

`[Supa] _doSyncCommunitiesFromDB EXCEPTION: TypeError: Failed to fetch`

That error is unrelated to tournament logic and occurs because the local environment could not reach the configured Supabase community endpoint.

## 10. Remaining limitations

1. A fully tied Round Robin after points, differential, and points scored intentionally has no champion until a future product rule is specified.
2. Live tournament matches require a winner; draws remain representable only for compatible legacy/explicitly allowed records.
3. Supabase tournament code and column contracts were verified, but a successful authenticated cloud round trip remains environment-dependent because the local Supabase fetch was unavailable.
4. Malformed legacy records that contain no recoverable tournament name, no recoverable team names, or contradictory played scores cannot be made authoritative without inventing data; they remain safely normalized only as far as their available fields allow.
5. The locally created Phase 6 verification tournaments remain in the browser profile because the instruction explicitly prohibited deleting tournament data.

## Stop point

Phase 6 is complete. Phase 7 has not started. No commit or push was performed.
