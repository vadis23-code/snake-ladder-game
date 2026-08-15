# CourtCall Phase 5 — Team Builder, Queue, History, and Career Stats

Status: Complete  
Completed: 2026-08-05  
Branch: `codex/phase5-team-history`

## Mandatory branch and entry-point reconciliation

### Common baseline and inherited work

The common Git baseline is commit `2f91cb0e8b1df9921053e194fe7e605dbf4d0a9f` (`Add CourtCall redesign prompt audit and visual reference`). The Phase 2, Phase 3, Phase 4, and Phase 5 local branches all still point at this commit. Reflog confirms `codex/phase5-team-history` was created from `codex/phase4-core-game` on 2026-08-05 while the Phase 4 worktree was uncommitted.

Phase 4 inherited changes are:

- Phase 4 portions of `index.html`, `courtcall-core.js`, and `basketball-sw.js`
- `courtcall-core-game.css`
- `tests/courtcall-phase4-core-game.test.js`
- Phase 4 cache-contract adjustment in `tests/courtcall-design-foundation.test.js`
- `COURTCALL_PHASE4_CORE_GAME.md`

Phase 5 new changes are:

- Phase 5 portions of `index.html`, `courtcall-core.js`, and `basketball-sw.js`
- `courtcall-team-history.css`
- `tests/courtcall-phase5-team-history.test.js`
- Phase 5 cache-contract adjustments in the Phase 3/4 stylesheet tests
- `COURTCALL_PHASE5_TEAM_HISTORY.md`

Earlier uncommitted Phase 2 and Phase 3 artifacts also remain in the same worktree and are not Phase 5 work. Nothing has been reset, discarded, committed, or pushed.

Phase 4 can still be committed separately before Phase 5, but the shared-file changes are now interleaved. The safe sequence is:

1. Preserve the complete current worktree with a recoverable patch/archive and a safety branch reference.
2. Stage Phase 2/3/4-only files and carefully split the Phase 4 hunks in the shared files; do not use broad `git add .`.
3. Review the staged diff and run the Phase 4 regression suite against that staged snapshot in a clean worktree.
4. Commit the inherited Phase 2/3/4 baseline first.
5. Stage the remaining Phase 5-only files and hunks, review them, rerun all tests, and commit Phase 5 second.
6. Only then begin any later-phase commit.

Because `index.html`, `courtcall-core.js`, and `basketball-sw.js` contain both Phase 4 and Phase 5 work, an unsplit commit would erase the historical boundary. No retrospective split should be attempted without a safety copy and staged-diff review.

### Canonical production entry point

`index.html` is the canonical production application.

- The repository and baseline commit contain `index.html`; they do not contain an application copy named `basketball.html`.
- GitHub Pages serves `index.html` at `https://vadis23-code.github.io/snake-ladder-game/`.
- Cloudflare Pages/custom-domain hosting serves the repository root at `https://courtcall13.win/`.
- `basketball.manifest.json` uses `id`, `start_url`, and `scope` of `/` and its Quick Game shortcut targets `/#/setup`.
- `basketball-sw.js` pre-caches `./` and uses cached `./` as the navigation fallback.
- Every Phase 2–5 HTML contract test reads `index.html`.
- All Phase 4 and Phase 5 implementation exists in `index.html`; there is no separate version in `basketball.html`.

The canonical localhost URL used for Phase 5 testing was `http://127.0.0.1:8765/`, with route hashes such as `#/teams`, `#/setup`, `#/game`, and `#/history`. The browser was not pointed at an alternate HTML copy or test harness.

For compatibility, `basketball.html` is now a small redirect-only shim that preserves query/hash state and sends legacy static-host links to `./`. Cloudflare Pages and GitHub Pages can both serve that file directly, so the protected-path redirect policy remains unchanged. The application is not duplicated.

## Scope completed

Phase 5 implements the roadmap's complete local-first team and match-history workflow:

- Player create, edit, and confirmed delete
- Optional nicknames and four 1–5 skill attributes
- Exact 1–10 overall rating derived from the four attributes
- Random team generation with Fisher–Yates shuffling
- Balanced generation with snake seeding and RMSD minimization across 50 candidates
- Interactive two-to-four-team snake draft with a true forward/reverse pick order and undo
- Persistent queue with compatible team objects, accessible move controls, removal, Winners Stay, and Rotation
- Queue-to-game setup handoff with team names, colors, and player rosters
- Automatic post-match queue ordering with undo restoration support
- Match History filters for All, Wins, Losses, and Draws
- Explicit Home-side career summary with games, wins, losses, draws, win rate, and average margin
- Full match detail with score, rules, duration, periods, tournament context, fouls, player lines, and scoring timeline
- Player career leaderboard using stable player IDs where available
- Confirmed match deletion flow and 200-match storage cap

## Main implementation files

- `courtcall-core.js` — deterministic Phase 5 rating, team, queue, history, and career helpers
- `index.html` — Team Builder, queue, setup handoff, match lifecycle, History, and compatibility adapters
- `courtcall-team-history.css` — Phase 5 visual, responsive, reduced-motion, and forced-color layer
- `basketball-sw.js` — offline-cache version `v32` with the Phase 5 stylesheet
- `tests/courtcall-phase5-team-history.test.js` — 11 Phase 5 contract and algorithm tests

## Storage compatibility

No existing storage key was renamed or removed.

- `cc_builder` remains the Team Builder key.
- Legacy string queue entries are normalized into `{ id, name, players }` objects.
- Older queue modes migrate to the supported Rotation mode.
- Existing builder data is normalized both during initial construction and the later startup load.
- Existing match and legacy game collections are merged and de-duplicated for reading.
- Match deletion removes the matching ID from both current and legacy collections.
- Player IDs are preserved through setup, completed match records, and career aggregation.
- Completed match storage remains capped at 200 entries.

## Algorithms and outcome semantics

Player overall rating is:

`round(((shoot + defence + speed + stamina) / 4) * 2)`

Balanced generation sorts by rating, creates a snake-seeded split, evaluates shuffled candidates, and locally improves candidates through player swaps. Fairness UI reports team totals, maximum difference, RMSD, and the 50-candidate limit. It explicitly avoids claiming that a rating model guarantees a perfect matchup.

History and career results use the existing normalized outcome constants. Wins, losses, draws, cancelled games, ties, and winner orientation continue to follow the Phase 2–4 semantics. The History summary states that its record uses the Home side shown first on each card.

## Accessibility and mobile work

- Player attributes use named radiogroups with keyboard-operable radio buttons.
- Player edit/delete and queue reorder/remove controls expose specific accessible names.
- Queue reordering has explicit Up and Down actions; drag-only interaction is not required.
- Rating and queue controls measure at least 44×44 px.
- Draft teams expose named regions and the current pick is announced.
- History cards expose full matchup/result labels.
- Destructive player and match actions use the existing focus-trapped in-app confirmation dialog.
- Reduced-motion and forced-color modes have explicit Phase 5 rules.
- At 320 px, Team Builder and History have zero document overflow.
- The four History filters fit without internal horizontal scrolling.
- The queue add form stacks at the phone breakpoint instead of clipping its action.
- The floating Help action is hidden on Team Builder and History below 360 px so it cannot cover critical controls; Help remains available through More → Settings.
- Mobile sync status uses shorter visible copy without changing the full accessible status text.

## Rolling cache and compatibility fixes found during live testing

Live acceptance testing found and fixed four compatibility defects:

1. A later startup initializer replaced normalized `cc_builder` data with the raw legacy value.
2. The Hub queue summary rendered Phase 5 queue objects as `[object Object]`.
3. The narrow History filter grid inherited minimum-content widths and scrolled internally.
4. Player scorer-sheet focus restoration referenced a cleared global in its delayed callback.

The service-worker cache was advanced to `v32`, and the new HTML includes bounded Phase 5 fallbacks so a device remains usable while an older cached core module is being replaced.

## Verification

Automated verification:

- `node --test tests/*.test.js` — 87 passed, 0 failed
- Phase 5 focused tests — 11 passed, 0 failed
- `node --check courtcall-core.js` — passed
- `git diff --check` — passed

Live browser verification used the canonical production shell at `http://127.0.0.1:8765/` at 390×844 and 320×720. It covered:

- cache-update activation across multiple service-worker revisions
- player add, rating, edit, nickname, delete confirmation, and persistence
- balanced totals/RMSD, random generation, and reshuffle
- snake order A–B–B–A, draft undo, and completed rosters
- queue add, 44 px reorder controls, removal contract, Rotation, and Winners Stay
- queue-to-setup roster handoff
- a completed player-attributed queued match and automatic winner-stays ordering
- History summary, all four filters, empty Draws state, full match detail, timeline, and career leaderboard
- match-delete confirmation
- zero page overflow and no clipped Team Builder or History actions at 320 px

Expected local-only console noise was limited to unavailable Supabase network sync while testing from `127.0.0.1`. No new application exception remained after the scorer focus fix.

Production-dependent checks still remaining are authenticated Supabase writes/deletes, real Web Speech microphone permission, native share sheets, and deployment of the uncommitted local branch. These do not change the canonical-entry conclusion.

## Deferred by phase boundary

- No Phase 6 work was started.
- No Higgsfield assets were generated.
- No standalone Canvas basketball widget code was changed or removed.
- No new Supabase tables or schema mutations were introduced in Phase 5.

## Blocking questions

None. Phase 5 can hand off to the next roadmap phase.
