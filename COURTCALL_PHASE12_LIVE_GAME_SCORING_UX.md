# CourtCall Phase 12 — Live Game Scoring UX

**Branch:** `codex/phase12-live-game-scoring-ux` (uncommitted per stop conditions)
**Scope:** live-game scoring interaction only. No tournament logic, Supabase schema, or RLS changes; Phase 11 offline/local-first behavior intact; no product-wide redesign.

---

## 1. UX problem identified

With player mode enabled, scoring a specific player took **two steps and a modal**: tap the team's `+2`, then pick the player from a bottom-sheet ("Who scored?"). Consequences:

- A first-time user looking at the live screen saw only team `+1/+2/+3` buttons. Nothing on screen answered *"how do I give Player C two points?"* — the answer was hidden behind a modal that only appeared after committing to a point value.
- Players and their scores appeared in a read-only roster strip below the buttons, so identity and action were visually separated.
- The modal interrupted rapid play: two taps plus an animated sheet per basket, with the sheet stealing focus mid-game.
- `Last call` copy read `+2 · Player C` — the value and player were present, but the **team was not**, so on a shared scoreboard the entry was ambiguous.
- The live feed had the same gap: it showed the scorer's name in a team color, meaning **team was conveyed by color alone**.

## 2. Final interaction model

Each active player now owns a **scorer row** that is always visible during live scoring:

```
Player C                          2 PTS
[  +1  ] [   +2   ] [  +3  ]
```

- **One tap scores.** No select-then-score step; no long-press; no menus.
- **`+2` is the emphasized control** — taller (3.8rem vs 3.4rem), 2px border, brighter fill. The emphasis follows the active rule set rather than being hardcoded: in a 2s-and-3s game `+2` is emphasized, in streetball 1s-and-2s `+1` is (`_emphasisScoreValue`).
- **Row shows identity + personal score**, plus a foul count that appears only once the player has fouls (`3F`, or `3F · LIMIT` at five).
- **A dashed "Team basket · no player attribution" row** closes each roster, preserving the old picker's escape hatch as a single tap.
- Buttons carry explicit accessible names: `Add 2 points to Player C (Team A)`.
- The legacy team-only pad is unchanged for games started **without** players, and the player picker modal remains in the codebase for the foul flow (`handleFoulTap` → `openPlayerPicker(team, 0, 'foul')`).

**Score-state integration:** player buttons call `_addScorePlayer(team, pts, playerId)` — the same engine function the old picker called. No new score state, no duplicated math. That function runs `ensureGameStarted` → `state.history.unshift` → `recomputeGameFromHistory(true)` → haptics/sound (existing settings) → shot-clock auto-reset → `save()` → `renderGame()` → `runScoreFeedback()` → `checkWin()`. Voice scoring still routes through `addScore`, the team pad through `addScore`, and player rows through `_addScorePlayer`; all three converge on the same timeline, so **team totals are always recomputed from history rather than incremented in the UI**.

**Feedback on tap:** the player row pulses (`.scorer-row.scored`, suppressed under reduced motion), the personal total updates in place, the giant team score uses the existing score spring and particles, the feed gains an entry, and the announcer says *"Player C scores 2 for Team A. 2 to 0."*

**Last call is now structured** (`describeLastCall`):

```
LAST SCORE   TEAM A · PLAYER C · +2
LAST CALL    TEAM B · PLAYER D · FOUL
```

The kicker distinguishes a basket (`Last score`) from a foul/timeout (`Last call`). A pre-existing Phase 4 rule hid that kicker below 480px; Phase 12 restores it compactly on narrow screens, since it is the only thing separating the two message types. Feed entries now read `Team A · Player C  +2` — **team named in text, never by color alone**.

## 3. Mobile scorer behavior

Below 48rem (768px) the layout keeps both giant scores at the top and shows **one roster at a time** beneath them, selected by a two-tab switcher:

- `role="tablist"` / `role="tab"` with `aria-selected`, roving `tabindex`, and arrow-key/Home/End navigation via the shared `_wireTablist` helper already used elsewhere in the app.
- The selected tab is marked three ways — filled background, brighter label, and a colored underline — plus a team-colored dot, so selection is never color-only.
- **Switching the roster never touches possession or any game state.** `setScorerTeam` only writes a `data-scorer` attribute and tab ARIA; it contains no reference to `state`, `possession`, `save`, or `history` (test-enforced, and verified live: possession before/after a tab switch is identical).
- No horizontal scrolling is ever required to reach a scoring control; the `+2` button measured 92px wide × 61px tall at 320px and 115 × 61 at 390px, fully inside the viewport.

## 4. Desktop behavior

At 48rem and above the switcher disappears and **both rosters render side by side** in their team colors, one tap per control, with the existing Midnight Arena broadcast rail (live feed pinned right, giant scores dominant). The scorer tabs were added to the desktop and short-landscape grid-column lists so the broadcast layout stays intact. Short landscape (≤31.25rem tall) compacts row padding and button heights so every primary action stays on screen.

## 5. Files changed

| File | Change |
|------|--------|
| `index.html` | `_scorerRowHTML`, `_emphasisScoreValue`, rewritten `renderScorePads`, `setScorerTeam`, delegated `wireScorePads` player branch, in-place `renderPlayerRosters`, `describeLastCall` + `renderLastAction`, feed copy with team names, `runScoreFeedback(team, points, playerId)` row pulse, scorer-tabs markup, `last-action-kicker` id, game CSS link pinned `?v=20260824`. |
| `courtcall-core-game.css` | Phase 12 block: scorer tabs, scorer rows, `.btn-pscore` (+ `.emph`), team-basket row, row-pulse keyframes, narrow/wide/landscape rules, reduced-motion and forced-colors handling, narrow-screen last-call kicker; `scorer-tabs` added to two grid-column lists. |
| `basketball-sw.js` | `CACHE_VERSION` **v56 → v57**; precache entry pinned to `courtcall-core-game.css?v=20260824`. |
| `tests/courtcall-phase12-live-scoring.test.js` | **New** — 21 focused Phase 12 tests. |
| 11 existing test files | Pinned cache version v56 → v57 (per-phase convention); Phase 4 + motion tests updated for the versioned CSS URL and the new `!==signature` rebuild guard. |

Nothing else was touched. No backup ZIP exists in the working tree; nothing outside the repo was modified.

## 6. Rapid-tap result

The earlier QA run tripped the victory overlay mid-burst because the burst reached the default 21-point target — a script setup problem, not a defect. The scenario now runs with a target the burst cannot reach, and the win path is exercised separately (§7).

| Check | Result |
|---|---|
| `C +2`, `A +3`, `D +2`, `B +1` (no waits, includes a team-tab flip) | C=4, A=3, D=5, B=1 · **Team A 7, Team B 6** · DOM matches state |
| Event count for those 4 taps | **exactly 4** scoring events — no drops, no double-processing |
| 10 immediate same-player `+2` taps | C 4 → **24**, Team A 7 → **27** |
| Event count for the burst | **exactly 10** events |

The reason rapid input is safe: score pads are rebuilt **only when the roster signature changes** (`if(pad.dataset.scoreControls!==signature)`), and per-tap updates mutate only the text nodes of existing rows (`renderPlayerRosters` touches `[data-role="pts"]`/`[data-role="fouls"]`, never `innerHTML`). Taps therefore never race a DOM replacement, and totals are recomputed from the authoritative timeline on every event.

## 7. Win / undo result

Run separately with target 4:

| Step | Result |
|---|---|
| `C +2` → one score below victory | Team A 2, game still live |
| `C +2` through the **player** control | Victory overlay shown, `gameOver` true, Team A 4, C 4, winner "Team A" |
| Undo offered on the post-game overlay | Yes |
| Undo pressed | Overlay hidden, `gameOver` **false** |
| Rollback | Team A 4 → **2**, C 4 → **2**, giant score DOM `2`, timeline back to 1 event |
| Controls usable again | `C +1` scored immediately → Team A 3, C 3, last call `Team A · Player C · +1` |

Player attribution does not touch winner evaluation: `evaluateAutomaticOutcome` still decides first-to-target, win-by-two, and tie handling on team scores alone, verified across six rule permutations in the focused tests.

## 8. Save / reload result

After scoring entirely through player buttons (Team A 27, C 24), a full page reload restored **Team A 27 / C 24** from `courtcall_v1` — team totals, player totals, and the timeline all persisted. Storage keys and the game-state shape are unchanged, so Phase 11's save/resume and corruption safeguards apply unmodified. Offline (network disabled), the game screen resumed from the service-worker shell and `Player A +1` scored normally to 28 — **local scoring never depends on the network**.

## 9. Test totals

- **Focused Phase 12: 21/21 pass** — direct one-tap scoring and accessible names; engine routing with no duplicated math; team-basket row; rule-aware `+2` emphasis; scoreboard hierarchy; structured last call; feed team naming; row-pulse feedback; undo completeness; rapid mixed/repeated sequences; rebuild-guard; win rules across six permutations; roster switcher ARIA and its isolation from possession; retention of every existing control; touch-target/spacing/reduced-motion/forced-colors; SW version pinning; desktop grid.
- **Full regression: 237/237 pass** (216 pre-existing + 21 new). `node --check` clean on every root JS file, test file, and build tool, plus the extracted inline `index.html` script. CSS braces balanced (261/261).
- **Production artifact: 69 files built**, no repository internals leaked.

## 10. Browser QA result

**29/29 passed** against the built artifact in headless Chromium. Beyond the rapid/win/undo/reload results above: the required spec sequence (`C +2` → C=2/A=2 with `Team A · Player C · +2`; `D +3` → D=3/B=3; `C +1` → C=3/A=3; undo → C=2/A=2) all passed; the feed read `Team A · Player C`; no 404s; no unexpected console errors (14 filtered entries are the unreachable Supabase host in this sandbox).

Responsive matrix — no horizontal overflow anywhere, `+2` always ≥40px tall and inside the viewport, both giant scores always visible:

| Viewport | Overflow | `+2` size | Rosters |
|---|---|---|---|
| 320×568 | none | 92×61 | tabbed |
| 390×844 | none | 115×61 | tabbed |
| 844×390 | none | 89×46 | both |
| 768×1024 | none | 110×61 | both |
| 1440×900 | none | 163×61 | both |

**First-time-user criterion:** on the rendered mobile portrait screen, "Player C" and a large `+2` sit on the same row with nothing to open first — the answer to *"how do I give Player C two points?"* is on screen at rest. Verified programmatically (button present, visible, ≥40px, labelled `Add 2 points to Player C (Team A)`) and by inspecting the rendered screenshots at 320px, 390px, and 1440px.

## 11. Service worker version

**`CACHE_VERSION = 'v57'`** (Phase 11 shipped v56). `courtcall-core-game.css` is precached as `./courtcall-core-game.css?v=20260824`, matching the page's `<link>` exactly so the restyled scorer cannot be served stale from the runtime cache.

## 12. Remaining limitations

- Everything was exercised in headless Chromium at the five required viewports; no real iOS/Android device pass, so **haptics (`navigator.vibrate`) and real touch latency are untested** — the haptic call itself is unchanged and still gated by the existing vibration setting.
- The "first-time user understands it immediately" criterion was validated by structural checks plus visual inspection, **not by testing with an actual first-time person** — that remains a human check.
- Voice scoring still attributes to the **team**, not a player (`addScore`), exactly as before this phase; per-player voice attribution was out of scope.
- Fouls still use the player-picker modal. That was deliberate — section J required preserving foul behavior, and fouls are far less frequent than baskets — but it is now the only two-step action left on the live screen.
- Rosters longer than about five players per side will push the last-call bar and controls below the fold on a 320px-tall-ish screen (vertical scrolling only; horizontal reach is unaffected).
- Screen-reader announcements were verified by inspecting `aria-live` regions and announcement text, **not with VoiceOver/TalkBack**.

## 13. Remaining manual checks

1. Score a real pickup game on a phone with vibration enabled — confirm haptics fire per basket and taps feel instant under sweaty/gloved conditions.
2. Hand an unbriefed person the live screen and ask them to give Player C two points; time it.
3. VoiceOver/TalkBack pass over a scorer row, the team tabs, and the last-call bar.
4. After deployment: confirm SW v57 activates, the update prompt appears on stale tabs, and an in-progress player-mode game survives applying it.
