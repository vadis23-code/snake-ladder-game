# CourtCall Phase 4 — Core Game Completion Report

Date: 2026-08-05  
Branch: `codex/phase4-core-game`  
Status: Complete and regression-tested

## Scope boundary

Phase 4 completes the setup-to-victory core game loop. Phase 5 work has not started. No Higgsfield assets were generated, `basketball.html` was not changed, and the removed standalone Canvas basketball widget was not restored or modified.

## Specification compliance

| # | Phase 4 requirement | Status | Implementation and verification |
|---|---|---|---|
| 1 | Setup | Complete | Essentials are grouped separately from a semantic, persistent Advanced disclosure. Setup validates game type, names, target, scoring, periods, clocks, win condition, timeouts, and optional players before enabling Start Game. |
| 2 | State creation | Complete | Pure state construction normalizes setup and legacy saves into the compatible game shape. A rolling-cache adapter keeps the app usable while an older cached core module is being replaced. |
| 3 | Score | Complete | Only configured point values render and execute. Score updates include distinct haptics, optional sound, score animation, team color feedback, leader aura, live-feed entry, and an announced last-action message. |
| 4 | Foul | Complete | Team and optional player foul counts increment safely, animate without color-only meaning, persist, enter the feed, and can be undone. |
| 5 | Timeout | Complete | Per-team timeout limits are enforced, remaining counts are announced, actions persist, and timeout use can be undone. |
| 6 | Undo | Complete | Score, foul, and timeout actions recompute state without negative values. A winning score can be undone after completion, including deletion of the just-saved local/cloud result and reopening the game. |
| 7 | Win by two | Complete | The game continues at the target until the leading margin reaches two. A 7–3 configured victory was verified in-browser. |
| 8 | Quarter | Complete | The live period control advances Q1 through Q4, then OT, OT2, and later overtimes. Period mode can be disabled for a single game. |
| 9 | Possession | Complete | Possession toggles between teams, updates the team label, announces the new owner, and remains visible at 320 px. |
| 10 | Shot clock | Complete | Deadline-based timing avoids interval drift; start, pause, reset, score reset, custom duration, persistence, and background restoration are supported. |
| 11 | Game clock | Complete | Timestamp-based count-up timing starts with the first score or manual Start, supports pause/resume, saves a snapshot, and does not accrue while the game is parked on the Hub. |
| 12 | Voice commands | Complete with platform fallback | Scoring, undo, and score-check commands use the actual configured scoring values. Permission-denied and unsupported browsers expose a typed command test path. `Falcons three` was verified to produce the correct score and announcement. |
| 13 | Save | Complete | Active games save locally after material actions with clock/context metadata and a visible “Saved on device” status. |
| 14 | Resume | Complete | Team names, scores, history, period, possession, timeouts, rules, and paused clock state restore from the existing active-game key. A controlled Hub wait confirmed 0:43 resumed as 0:43. |
| 15 | Victory | Complete | The accessible modal presents winner, score, narrative, duration, biggest lead, fouls, optional player stats, correction, Save & Exit, share, rematch, swap/rematch, and new-setup actions. Save & Exit receives initial focus. Reduced motion suppresses confetti. |
| 16 | Match save | Complete | Completed results are normalized, stored locally, mirrored to the legacy winners list when applicable, and sent to Supabase on a best-effort authenticated path. Save & Exit clears the active save without creating a blank resumable game. |

## Architecture and files

### Modified in Phase 4

- `index.html` — setup composition, live-game arena, state orchestration, clock modules, persistence, voice feedback, team rename dialog, victory flow, and lifecycle fixes.
- `courtcall-core.js` — pure setup validation, game-state construction, allowed score values, period progression, action descriptions, haptic patterns, and persisted-clock restoration.
- `basketball-sw.js` — Phase 4 stylesheet shell caching and cache version `v23`.
- `tests/courtcall-phase4-core-game.test.js` — Phase 4 contract, compatibility, accessibility, persistence, CSS, and lifecycle regression coverage.
- `tests/courtcall-design-foundation.test.js` — final cache-version contract.

### Added in Phase 4

- `courtcall-core-game.css` — Phase 4 setup and live-game presentation layer, responsive arena/feed layouts, state effects, modal styles, reduced-motion rules, and forced-colors support.
- `COURTCALL_PHASE4_CORE_GAME.md` — this completion record.

Phase 3 design-foundation files remain the lower layer. Existing unrelated and user-owned working-tree artifacts were preserved.

## State and storage compatibility

No existing localStorage key was renamed.

| Key | Use | Phase 4 compatibility |
|---|---|---|
| `courtcall_v1` | Active game | Preserved. Adds optional `_sc` and `_gcc` snapshots while retaining `_gc` context and backward-compatible `_gce` elapsed time. Old saves without the new fields still load. |
| `cc_matches` | Normalized match history | Preserved. History is capped at the specification limit of 200. |
| `courtcall_games` | Legacy winners-only history | Preserved for older readers and capped at 20. Ties/no-contests do not fabricate a winner. |
| `cc_settings` | User and quick-game settings | Preserved. Adds only optional `setupAdvancedOpen`; missing values receive defaults. |

The active save stores `voiceActive: false`, so microphone state is never silently resumed. Clock snapshots record elapsed/current values, running state, and save time; restoration accounts for background time only when the corresponding clock was running.

## Supabase mapping

Phase 4 keeps the established `games` table contract and does not require a migration.

| Application field | Supabase column |
|---|---|
| Match ID | `id` |
| Authenticated owner | `user_id` |
| Team names | `team_a_name`, `team_b_name` |
| Scores | `score_a`, `score_b` |
| Winner/no-contest label | `winner` |
| Game configuration | `game_type`, `win_score`, `scoring_rule` |
| Duration and fouls | `duration`, `fouls_a`, `fouls_b` |
| Lead/run statistics | `max_lead_a`, `max_lead_b`, `lead_changes`, `biggest_run` |
| Periods | `quarters_played` |
| Tournament linkage | `tournament_id`, `fixture_id` |
| Optional player arrays | `players_a`, `players_b` |
| Match timestamp | `created_at` |

Local save is authoritative offline. Cloud upsert is best effort and only runs for an authenticated Supabase user. Undo waits for an in-flight cloud save before requesting deletion, avoiding a save/delete race.

## Functional baseline now established

The following end-to-end loop works:

1. Configure essentials and optional advanced rules.
2. Start a normalized game.
3. Score with the configured values; start and manage clocks.
4. Record and undo scores, fouls, and timeouts.
5. Change possession, advance periods, and rename teams safely.
6. Leave for the Hub and resume the same paused game.
7. Detect a normal or win-by-two result.
8. Correct the winning score if necessary.
9. Save the match, clear the active save, and return to the Hub.
10. Start a same-team rematch, swapped rematch, or new setup.

## Defects found and closed during regression

- Mixed service-worker cache could serve new HTML with an older core module and crash during state creation. A small compatibility adapter now bridges the rolling upgrade, and the behavior has an automated contract test.
- Saving and exiting a completed game could create a blank active save during screen teardown. The exit/reset order now prevents it; browser verification found zero Resume cards afterward.
- Team rename focus restoration referenced a nulled global in its delayed callback. The return element is now captured before cleanup; the final browser session restored focus with no error.
- The legacy sub-360 px rule hid the possession column. The Phase 4 layer explicitly retains it.
- Quarter, team rename, foul, and timeout controls were brought to a minimum 44 px target in portrait and short landscape.
- Pausing to the Hub previously saved before clocks were stopped. The paused clock snapshot is now written after both clocks pause.

## Verification evidence

### Automated

- Command: bundled Node.js `--test tests/*.test.js`
- Result: **76 passed, 0 failed**
- Coverage includes game outcomes, win-by-two, undo, fouls, rematches, route recovery, storage/security contracts, Phase 3 design/accessibility contracts, and Phase 4 setup/state/clocks/voice/persistence/victory behavior.

### Browser

| Viewport | Result |
|---|---|
| 320×568 portrait | No horizontal overflow; possession visible; all visible game buttons at least 44×44 px. |
| 390×844 portrait | No horizontal overflow; setup and live game visually verified; dialog focus returned to the rename trigger. |
| 844×390 landscape | No document overflow; 224 px live-feed rail; all visible game buttons at least 44×44 px. |
| 1440×900 desktop | No document overflow; 1088 px arena plus 352 px live-feed rail; all visible game buttons at least 44×44 px. |

Functional browser checks covered setup validation, custom configuration, clocks, scoring, leader state, feed entries, timeout/foul undo, possession, periods, typed voice fallback, team rename, pause/resume, win-by-two victory, undo-after-victory, match history, Save & Exit, and PWA cache upgrades. The final post-fix console window contained authentication-status logs only and no runtime errors.

## Deferred verification and blockers

- A real microphone command requires a browser/device with Web Speech support and granted microphone permission. The parser, permission-denied state, and typed fallback are verified.
- An authenticated remote Supabase upsert/delete was not exercised in the guest browser session. The existing mapping and best-effort local-first path are covered statically and by the broader suite.
- Native share-sheet behavior remains platform-dependent; the fallback copy path is unchanged.

These are environment-dependent verification items, not blockers to completing Phase 4. There are no truly blocking questions for this phase.

## Phase 5 handoff

Phase 5 should begin from this tested core-game baseline. It should not change the established storage keys, game outcome semantics, rolling-cache adapter, clock snapshot format, or Save & Exit lifecycle without extending the corresponding regression tests.
