# CourtCall — Complete Recreation Specification

**Version:** Single HTML file PWA (no build system)  
**Contact / feedback email:** vadi.s23@gmail.com  
**App version constant:** `APP_VERSION` (read from JS, shown in Settings and "What's New" toast)

---

## 1. Overview & Tech Stack

**What it is:** CourtCall ("CourtCall") is a pickup-basketball scoring and community app. It runs as a single HTML file (basketball.html) deployed to static hosting (GitHub Pages). No build step, no framework, no bundler.

**Tagline:** "Basketball pickup game scorer — score, build teams, run tournaments."

### Tech stack
- Single-file HTML with inline CSS and inline JavaScript — no external JS files except the service worker
- **Supabase** for cloud auth and data sync (CDN-loaded client SDK via script tag)
- **Web Speech API** for voice scoring
- **Canvas 2D API** for the 3D basketball renderer
- **localStorage** as the primary data store (offline-first)
- **Service Worker** (`basketball-sw.js`) for PWA + offline caching
- **Google Fonts** (Inter) loaded via `<link>` in `<head>`
- No React, Vue, Angular, or any component framework
- No TypeScript — plain ES2020 JavaScript
- Icons: a single SVG at `icons/icon.svg`; a basketball photo texture at `icons/basketball-3d.png`

### Hosting
- Static file hosting (GitHub Pages)
- URL: `./basketball.html` with hash routing (`#/screenname`)
- Manifest: `basketball.manifest.json`
- Service worker: `basketball-sw.js`

### Auth model
- Supabase email+password authentication
- PIN is used as the Supabase password (6 digits, `inputmode="numeric"`)
- PIN is never stored plaintext; it is passed directly to Supabase sign-in / sign-up
- Guest mode: no Supabase interaction, localStorage-only
- `supaUser` = Supabase Auth user object (null if guest)
- `currentProfile` = local profile object keyed in localStorage at `cc_profile`

---

## 2. Design System

### Color tokens (CSS custom properties on `:root`)

```css
--bg: #05070d          /* darkest background */
--s1: #0d1117          /* surface 1 */
--s2: #161b27          /* surface 2 */
--s3: #1e2535          /* surface 3 */
--s4: #252d40          /* surface 4 */
--border: rgba(255,255,255,0.09)
--border-strong: rgba(255,255,255,0.16)
--text: #f1f5f9
--text-dim: #cbd5e1
--muted: #94a3b8
--muted2: #64748b
--gold: #f59e0b
--danger: #ef4444
--success: #22c55e
--ca: #f97316          /* Team A / primary orange */
--ca2: #ea580c         /* Team A darker */
--cb: #3b82f6          /* Team B / blue */
--ga: rgba(249,115,22,0.35)   /* Team A glow */
--gb: rgba(59,130,246,0.35)   /* Team B glow */
--glow-ca: rgba(249,115,22,0.45)
--orange: #f97316
```

### Border-radius tokens
```css
--r1: 10px
--r2: 16px
--r3: 22px
--r4: 32px
```

### Transition tokens
```css
--t1: 0.14s ease
--t2: 0.26s ease
```

### Spacing tokens
```css
--sp-1: 4px
--sp-2: 8px
--sp-3: 12px
--sp-4: 16px
--sp-5: 20px
--sp-6: 24px
--sp-8: 32px
```

### Typography
- Font family: `'Inter', system-ui, -apple-system, sans-serif` loaded from Google Fonts
- Base font size: 16px on `<body>`
- Body: `color: var(--text)`, `background: var(--bg)`
- `font-feature-settings: 'kern' 1, 'liga' 1`

### Theme colors for teams
`COLORS` map object in JS — 8 options used for team color picker:
```javascript
{
  orange: { hex: '#FF5722', glow: 'rgba(255,87,34,0.35)' },
  red:    { hex: '#F44336', glow: 'rgba(244,67,54,0.35)' },
  green:  { hex: '#43A047', glow: 'rgba(67,160,71,0.35)' },
  purple: { hex: '#9C27B0', glow: 'rgba(156,39,176,0.35)' },
  blue:   { hex: '#2979FF', glow: 'rgba(41,121,255,0.35)' },
  teal:   { hex: '#00BCD4', glow: 'rgba(0,188,212,0.35)' },
  gold:   { hex: '#FFB300', glow: 'rgba(255,179,0,0.35)' },
  pink:   { hex: '#E91E63', glow: 'rgba(233,30,99,0.35)' }
}
```

### Key animation / transition classes
- `.hidden` — `display: none !important`
- `.show` — used with `.offline-banner` to show offline state
- `.screen` — full-screen div, positioned absolutely, fills viewport
- `.active` — active nav button
- `.on` — active chip/tab state
- `@keyframes sparkFly` — used by 3D ball sparks; `--stx` and `--sty` custom props drive translate
- `focus-visible` outlines for keyboard accessibility (custom style on `:focus-visible`)
- `@media (prefers-reduced-motion: reduce)` — all animations/transitions suppressed

### Scrollbar
- Thin scrollbar: `scrollbar-width: thin`, `scrollbar-color: var(--s4) transparent`
- WebKit: `::-webkit-scrollbar { width: 4px }`, `::-webkit-scrollbar-thumb { background: var(--s4) }`

### Key component CSS classes (non-exhaustive, all critical ones)
- `.btm-nav` — fixed bottom navigation bar (5 tabs)
- `.bn-btn` — bottom nav button
- `.bn-icon` / `.bn-lbl` — icon + label inside nav button
- `.more-sheet` — slide-up sheet for "More" menu
- `.more-grid` — 4-column grid of menu items
- `.more-item` / `.more-icon` / `.more-lbl` — item structure
- `.nav-drawer` — side drawer for landing page nav on mobile
- `.screen` — each app screen
- `.page-nav` — top bar: back button + title + optional right action
- `.btn-back` — back button in page-nav
- `.page-title` — center title in page-nav
- `.auth-card` / `.auth-tabs` / `.auth-form` — auth screen
- `.pin-row` / `.pin-box` / `.pin-eye` / `.pin-label` / `.pin-label-row` — PIN input
- `.auth-btn` — primary action button on auth screens
- `.auth-error` / `.auth-error.hidden` — inline error message
- `.game-screen` — game scoreboard layout
- `.score-panel` — Team A or Team B scoring area
- `.score-num` — large score number
- `.btn-score` — score buttons (+1, +2, +3)
- `.btn-foul` — foul button
- `.btn-undo` — undo button
- `.voice-btn` / `.voice-btn.active` — microphone toggle
- `.shot-clock-wrap` / `.shot-clock-num` / `.shot-clock-bar` — shot clock display
- `.game-clock-display` — elapsed game timer
- `.comm-card` / `.comm-logo` / `.comm-info` / `.comm-name` / `.comm-type` / `.comm-loc` — community listing card
- `.comm-badge` — pill badge (Public, Private, Admin, Member, Contributor)
- `.cd-tab` / `.cd-tab.on` — community detail tab
- `.cd-panel` — community tab content panel
- `.post-card` / `.post-card-pinned` / `.post-top` / `.post-author-row` / `.post-reactions` — feed post card
- `.player-card` / `.player-card-top` / `.player-ava` / `.player-main` / `.player-avg-wrap` — community player card
- `.lb-row` / `.lb-rank` / `.lb-avatar` / `.lb-info` / `.lb-stat` — leaderboard row
- `.evt-card` / `.evt-header` / `.evt-date-block` / `.evt-info` / `.evt-rsvp-row` — event card
- `.gal-card` / `.gal-img-wrap` / `.gal-img` / `.gal-body` — gallery card
- `.hc-card` / `.hc-card-head` / `.hc-card-body.hidden` — help center accordion item
- `.help-chat-wrap` / `.help-chat-wrap.open` — sliding help chat panel
- `.help-msg` / `.help-msg.user` / `.help-msg.bot` — chat message
- `.offline-banner` / `.offline-banner.show` — top offline indicator strip
- `.pwa-install-bar` / `.pwa-install-bar.hidden` — PWA install prompt bar
- `.modal-overlay` / `.modal` / `.modal.hidden` / `.modal-header` / `.modal-body` / `.modal-footer` — modal dialogs (Feedback, Changelog)
- `.toast` / `.toast.show` — toast notification
- `.uiconfirm-overlay` / `.uiconfirm` — confirm dialog
- `.comm-chip` / `.comm-chip.on` — multi-select chip
- `.ff-chip` / `.ff-chip.on` — feed/gallery filter chip
- `.btn-new-post` — "New Post" action button in tabs
- `.add-player-form` / `.post-form` / `.add-evt-form` / `.add-gal-form` — inline form panels

---

## 3. Screens & Navigation

### Bottom Navigation (visible after profile screen)
Fixed bar at bottom, 5 tabs, id=`btm-nav`, initially `.hidden`:
1. **Home** (🏠) → `showScreen('hub')`
2. **Game** (🏀) → `handleGameNav()` — goes to active game or to setup
3. **Teams** (👥) → `showScreen('teams')`
4. **History** (📋) → `showScreen('history')`
5. **More** (⋯) → `showMoreMenu()`

Active tab gets `.active` class on the `.bn-btn`. `data-nav` attribute on each button.

### More Sheet
Slide-up modal (id=`more-sheet`), 4-column grid:
- Tournaments (🏆) → `showScreen('tournament')`
- Communities (🏘) → `showScreen('communities')`
- Pulse (📡) → `showScreen('pulse')`
- Basketball World (🌍) → `showScreen('world')`
- Profile (👤) → `showScreen('profile')`
- Settings (⚙) → `showScreen('settings')`
- Feedback (💬) → `openFeedback()`
- Invite Friends (🔗) → `inviteFriends()`

### Screen IDs (all `<div id="s-{name}" class="screen">`)
- `profile` — auth / onboarding
- `hub` — home dashboard
- `setup` — game setup
- `game` — live scoreboard
- `teams` — team builder
- `history` — match history
- `tournament` — tournament hub
- `tourn-detail` — tournament detail / fixtures
- `communities` — communities list
- `comm-create` — create community form
- `comm-detail` — community detail (6 tabs)
- `settings` — settings menu
- `s-analytics` — usage analytics
- `s-help-center` — help center
- `s-privacy` — privacy policy
- `s-terms` — terms of service
- `reset-pin` / `s-reset-pin` — set new PIN
- `pulse` — CourtCall Pulse / news
- `world` — Basketball World (global links)
- `landing` — marketing landing page (for non-authenticated users)

### Hash routing
`showScreen(name)` updates `location.hash = '#/' + name`.  
On load, `_routeFromHash()` reads `location.hash` and routes accordingly.  
`_PUBLIC_SCREENS` Set contains screens accessible without auth: `privacy`, `terms`, `communities`, `world`.

### Navigation drawer (landing page, ≤900px)
`id=nav-drawer`, `role="dialog"`, `aria-modal="true"`. Links:
- Features → `scrollToSection('lp-features')`
- How it Works → `scrollToSection('lp-s5')`
- Communities → `showScreen('communities')`
- Discover → `showScreen('world')`
- Log In (id=`nav-drawer-auth`) → `showScreen('profile')`

---

## 4. Screen-by-Screen Feature Specs

### 4.1 Profile Screen (`s-profile`)
Auth and onboarding screen. Shown on first launch and for sign-in.

**Hero area:**
- Orange basketball emoji (🏀) as `.ph-ball`
- Title: "CourtCall" as `.ph-title`
- Subtitle: "Your pickup basketball crew" as `.ph-sub`

**Auth card** (`.auth-card`):
- Tab bar (`.auth-tabs`, `role="tablist"`) with two tabs:
  - "Sign In" (id=`tab-si`, `data-tab="signin"`)
  - "Create Account" (id=`tab-cr`, `data-tab="create"`)
- ARIA roving tabindex wired to `.auth-tabs`

**Sign In tab** (panel id=`panel-si`):
- Email input: `id=inp-si-email`, `type=email`, placeholder "Email", `autocomplete=email`
- PIN label row + eye toggle
- PIN input row: `id=pin-si`, 6 boxes, `role=group`, label "Enter your 6-digit PIN"
- Each box: `class=pin-box`, `type=password`, `inputmode=numeric`, `maxlength=1`
- Eye button: `onclick=togglePinVis('pin-si',this)`, `aria-label="Show or hide PIN"`
- Error div: `id=auth-err-si`, `class=auth-error hidden`
- Submit button: `class=auth-btn`, `onclick=signIn()`, text "Sign In"
- Forgot PIN link: `onclick=showScreen('reset-pin')`, text "Forgot PIN?"
- Guest link: `onclick=continueAsGuest()`, text "Continue as guest"

**Create Account tab** (panel id=`panel-cr`):
- Name input: `id=inp-cr-name`, `type=text`, placeholder "Your name", `maxlength=40`
- Email input: `id=inp-cr-email`, `type=email`, placeholder "Email"
- PIN label + eye toggle
- PIN row: `id=pin-cr`, 6 boxes, label "Choose a 6-digit PIN"
- Confirm PIN row: `id=pin-cf`, 6 boxes, label "Confirm PIN"
- Win score chip row: `id=cr-win`, chips for 11, 15, 21, custom — default selected: 21
- Error div: `id=auth-err-cr`, `class=auth-error hidden`
- Submit button: `onclick=createAccount()`, text "Create Account"
- Guest link: `onclick=continueAsGuest()`, text "Skip — continue as guest"
- Terms notice: "By creating an account you agree to our Terms of Service and Privacy Policy" with links

**Returning user flow:**
- If profile exists (`K.profile` in localStorage), pre-fill email in sign-in tab
- Show sign-in screen immediately
- On successful sign-in, `supaUser` is set, profile loaded, `renderHub()` called, `showScreen('hub')`

**Guest flow:**
- `continueAsGuest()` sets `currentProfile = { id: 'guest', name: 'Guest' }`, skips Supabase
- Shows hub, shows bottom nav

**PIN input behavior:**
- `_initPinRow(rowId)` wires each box: on keydown digit → fill box → focus next; on Backspace → clear + focus prev; on paste → distribute digits
- `_readPin(rowId)` collects all 6 digits into a string

**Auth functions:**
- `signIn()` — reads email + `_readPin('pin-si')` → `supa.auth.signInWithPassword({email, password: pin})` → on success sets `supaUser`, loads profile, calls `syncAllUserDataFromDB()`, shows hub
- `createAccount()` — validates name (required), email, PIN match + min 4 digits → `supa.auth.signUp({email, password: pin, options:{data:{name}}})` → on success creates local profile, saves to `K.profile`, calls Supabase, shows hub
- `continueAsGuest()` — no Supabase call
- `togglePinVis(rowId, btn)` — toggles `type` between `password` and `text` for all boxes in row
- `submitNewPin()` (Reset PIN screen) — reads new PIN + confirm, verifies match, calls `supa.auth.updateUser({password: newPin})`, shows success toast, navigates to profile

### 4.2 Hub Screen (`s-hub`)
Main dashboard after login.

**Layout:**
- Top bar: greeting + profile name
- Row of action cards
- In-progress game card (if game is saved and not over)
- Quick stats strip

**Top bar:**
- Left: greeting "Good morning / afternoon / evening, [name]" (hour-based)
- Right: avatar circle with first initial of profile name, `onclick=showScreen('profile')`

**Quick action cards** (horizontally scrollable row or grid):
- "Start Quick Game" → `showScreen('setup')`
- "Team Builder" → `showScreen('teams')`
- "Tournament" → `showScreen('tournament')`
- "Communities" → `showScreen('communities')`
- "Pulse" → `showScreen('pulse')`
- "Settings" → `showScreen('settings')`

**In-progress game card** (shown if `load()` returns non-null and `!gameState.gameOver`):
- "Resume Game" card showing team names and current score
- Button: `onclick=resumeGame()` which calls `loadGame()` then `showScreen('game')`

**Stats strip:**
- Shows total games played, win rate — pulled from `K.matches` localStorage

**`renderHub()` function:** populates all hub content from localStorage.

### 4.3 Setup Screen (`s-setup`)
Game configuration before starting.

**Fields:**
1. **Game Type** — chip row: 3v3, 4v4, 5v5, Custom (id=`cr-type`)
2. **Team A Name** — text input (id=`inp-ta`), default "Team A"
3. **Team B Name** — text input (id=`inp-tb`), default "Team B"
4. **Team A Color** — color picker chips using `COLORS` map (8 options), default orange
5. **Team B Color** — same, default blue
6. **Win Score** — chip row (id=`cr-win`): 11, 15, 21, Custom; shows custom number input when Custom selected
7. **Scoring Rule** — chip row: "1s & 2s" or "2s & 3s"
8. **Allow Free Throws** — toggle (adds +1 button to game screen)
9. **Shot Clock** — chip row: Off, 12s, 14s, 24s, 30s, Custom; Auto-reset toggle
10. **Game Clock** — chip row: Off, Count Up
11. **Win By 2** — toggle; requires winning team to be ≥2 points ahead
12. **Timeouts Per Team** — chip row: 0, 1, 2, 3
13. **Add Players** — toggle; enables player assignment to teams from builder pool
14. **Start Game** button: `onclick=startGame()` — validates inputs, builds `freshState()`, sets `gameState`, saves, navigates to game screen

**`freshState()` returns:**
```javascript
{
  gameType: '3v3', winScore: 21,
  ptsSmall: 1, ptsLarge: 2,
  allowFreeThrow: true,
  shotClockDuration: 0, shotClockAutoReset: true,
  gameClockMode: 'off',
  winBy2: false, withPlayers: false,
  timeoutsPerTeam: 0, timeoutsUsedA: 0, timeoutsUsedB: 0,
  teamA: { name: 'Team A', score: 0, fouls: 0, colorKey: 'orange', players: [] },
  teamB: { name: 'Team B', score: 0, fouls: 0, colorKey: 'blue', players: [] },
  quarter: 1, possession: 'a',
  history: [], maxLead: { a: 0, b: 0 },
  voiceActive: false, gameOver: false, startTime: null
}
```

**Color application:** `applySetupColors()` reads `teamColors.a` and `teamColors.b` and updates CSS variables `--ca`, `--ca2`, `--ga`, `--cb`, `--gb` on the document root.

**`teamColors` object:** `{ a: 'orange', b: 'blue' }` — persisted via `save()`

### 4.4 Game Screen (`s-game`)
Live scoreboard.

**Layout (two columns, Team A left, Team B right):**

Each side `.score-panel`:
- Team name at top (editable on long press or tap of name)
- Large score display `.score-num`
- Color-coded background using team color
- Score buttons:
  - `+1` button (visible if `allowFreeThrow || ptsSmall===1`)
  - `+2` button
  - `+3` button (visible if `ptsLarge===3`)
- Foul button: `.btn-foul`; shows foul count as `(N)` in button
- Timeout button: shown if `timeoutsPerTeam > 0`; shows remaining timeouts

**Center area:**
- Quarter indicator: "Q1", "Q2", "Q3", "Q4" (increments on button press)
- Possession indicator: small basketball icon on current team's side
- Shot clock widget (if enabled):
  - `.shot-clock-wrap` containing `.shot-clock-num` (countdown) + `.shot-clock-bar` (SVG arc progress)
  - ▶ pause/resume button, ↺ reset button
  - Turns red when ≤5s remaining
  - Auto-resets after each score if `shotClockAutoReset` is true
- Game clock widget (if mode = 'count-up'):
  - `.game-clock-display` showing MM:SS elapsed
  - Starts when first score is added (`startTime` is set)

**Bottom controls:**
- `↩ Undo` button: reverts last history item (score or foul)
- `🎤 Voice` button (`.voice-btn`): toggles voice recognition

**Voice scoring:**
- Uses `window.SpeechRecognition || window.webkitSpeechRecognition`
- Continuous mode, interimResults: false
- On transcript: `handleVoiceCommand(transcript)`
- Commands matched case-insensitively:
  - `"{colorName} {N}"` or `"{colorName} {word}"` → adds points to team with matching color
  - `"team a {N}"` / `"orange {N}"` etc. → Team A
  - `"team b {N}"` / `"blue {N}"` etc. → Team B
  - `"undo"` → undoScore()
  - `"score check"` → speaks current score via SpeechSynthesis
  - `"reset shot clock"` → resets shot clock
- Shows visual feedback when command recognized
- `voiceActive` flag in game state

**Game over state:**
- Triggered when a team's score reaches `winScore` (and winBy2 is satisfied if enabled)
- `checkWin(state)` returns winning team key or null
- Shows victory overlay: winner name, final score
- Buttons: "New Game" → clears state, goes to setup; "Save & Exit" → `saveMatch()` then history

**`addScore(team, pts)` function:**
- Pushes `{type:'score', team, pts, quarter}` to `history`
- Updates `teamA.score` or `teamB.score`
- Updates `maxLead.a` / `maxLead.b`
- Increments `leadChanges` if lead changes
- Tracks `biggestRun`
- Resets shot clock if `shotClockAutoReset`
- Calls `checkWin()` and triggers game-over flow if won
- Saves state via `save()`

**`save()` / `load()` / `clearSave()`:**
- Key: `K.game = 'courtcall_v1'`
- `save()` = `localStorage.setItem(K.game, JSON.stringify(gameState))`
- `load()` = `JSON.parse(localStorage.getItem(K.game))`

**`saveMatch(state)`:**
- Builds match object from game state
- Pushes to `K.matches` array (max 200 entries)
- Calls `supaSaveGame()` if logged in
- Calls `trackEvent('game_completed')`

**Event log** (`.game-event-log`):
- Scrolling list of all history entries for current game
- Each entry shows: type (score/foul/timeout), team color indicator, points, quarter
- Newest entries appear at top

### 4.5 Teams Screen (`s-teams`)
Team Builder — multi-tab view.

**Tab bar** (`id=tb-tabs-bar`, `role=tablist`):
- Players tab
- Teams tab
- Queue tab

**Players tab:**
- List of all players in `builderState.players`
- `+` button to add new player
- Each player card shows: name, overall rating badge, attribute stars (Shoot/Def/Speed/Stamina)
- Edit (✏) and delete (🗑) buttons per player

**Add/Edit Player form** (inline, below player list):
- Name input (required)
- Attribute rating grid (`initAttrGrid()`): 4 attributes × 5 stars each
  - Shooting, Defense, Speed, Stamina
  - Clicking star N selects 1–N
- Overall: auto-calculated as rounded average of 4 attributes
- Nickname input (optional)
- Save / Cancel buttons

**Player rating storage:**
```javascript
{
  id: 'player_' + Date.now(),
  name, nickname,
  attrs: { shoot: N, def: N, speed: N, stamina: N },
  rating: N,  // overall 1-10 scale
  isDemo, demoBatchId
}
```

**Teams tab:**
- "Generate Teams" button → shows mode picker: Balanced, Random, Snake Draft
- Team cards showing assigned players per team
- "Reshuffle" button

**Balanced algorithm (snake-draft with RMSD minimization):**
- Players sorted by overall rating descending
- Snake draft order distributes highest-rated players alternately
- RMSD (root mean square deviation) of team totals computed
- Multiple arrangements tried; lowest RMSD wins
- Ensures fairest split

**Random algorithm:** shuffle players, split into N teams of game-type size.

**Snake Draft algorithm:**
- Interactive draft: user picks one player at a time, alternating team
- Draft order: Team A picks 1, Team B picks 2, Team B picks 3, Team A picks 4... (snake pattern)

**Queue tab:**
- List of teams waiting to play (`.queue-list`)
- Mode toggle: "Winners Stay" or "Rotation"
- Add team to queue button
- Remove / reorder teams
- In Winners Stay mode: winning team from game result stays; losing team goes to back
- `builderState.queueMode`, `builderState.queuePointer`

**`builderState` object:**
```javascript
{
  players: [],    // all builder players
  teams: [],      // generated teams (array of arrays of player refs)
  queue: [],      // team names / objects in queue
  queueMode: 'winners-stay',
  queuePointer: 0
}
```
Persisted in `localStorage` at `'cc_builder'` key.

### 4.6 History Screen (`s-history`)
Match history list.

**Filter bar** (`id=history-filter-bar`, `role=tablist`):
- All, Wins, Losses, Draws — filter applied to `K.matches` array

**Match list:**
Each match card shows:
- Team A name vs Team B name
- Final score
- Date, duration
- Winner highlighted
- Game type badge (3v3, 4v4, 5v5)
- Tournament name if linked (`tournamentId`)

**Match detail** (tapping a card):
- Expanded inline or navigated to detail view
- Shows: complete event log (history array), all stats
  - Max lead A/B, lead changes, biggest run, quarters played
  - Fouls per team

**Delete match:** swipe or long-press to reveal delete option. Confirm dialog.

**Career stats panel** (at top of history screen):
- Total games, wins, losses
- Win rate percentage
- Average score differential
- Computed from all matches in `K.matches`

### 4.7 Tournament Screen (`s-tournament`)
Tournament management hub.

**Top area:**
- "Create Tournament" button → opens create form inline

**Create Tournament form:**
- Tournament name input
- Format chip row: "Round Robin" / "Knockout"
- Win score chip row: 11, 15, 21, Custom
- Team name inputs (dynamic, start with 2, "Add Team" button adds more)
- "Generate Fixtures" button → `createTournament()`

**`createTournament()` flow:**
- Generates `id = 'tourn_' + Date.now()`
- For Round Robin: generates all pairs `(i, j)` where i < j — N*(N-1)/2 fixtures
- For Knockout: generates bracket based on power-of-2 rounding (byes for non-power-of-2 counts), first round fixtures
- Saves to `K.tournaments`
- Calls `supaUpsertTournament()`
- Navigates to `s-tourn-detail`

**Tournament list:**
- Cards for each saved tournament
- Shows: name, format, teams count, completion status
- "Open" button → `openTournament(id)` → `showScreen('tourn-detail')`

**Tournament Detail Screen (`s-tourn-detail`):**

**Header:**
- Tournament name, format badge, teams count

**Fixtures list:**
Each fixture card:
- Team A name vs Team B name
- If played: show score and winner (highlighted)
- If unplayed: "Record Result" button
- "Record Result" form:
  - Score A input (number)
  - Score B input (number)
  - "Save Result" → `saveFixtureResult(tournId, fixtureId, scoreA, scoreB)`
  - Determines winner: highest score wins; if equal, option to enter tiebreaker

**`saveFixtureResult()` flow:**
- Updates fixture: `{scoreA, scoreB, winner, played: true}`
- For Round Robin: recalculates standings
- For Knockout: if all fixtures in round played, generates next-round fixtures
- Saves to localStorage
- Calls `supaUpsertTournament()`
- Re-renders tournament detail

**Standings table (Round Robin):**
Columns: Team, Played, Won, Lost, Points (2 per win, 1 per draw), Pts For, Pts Against, Diff  
Sorted by points desc, then diff desc.

**Bracket view (Knockout):**
Visual bracket showing rounds. Won team advances. Champion shown when final played.

**Delete tournament:** confirm dialog → remove from localStorage → `supaDeleteTournament()`

### 4.8 Communities Screen (`s-communities`)
Communities list — two sections.

**Top bar:**
- "Create Community" button → `showScreen('comm-create')`

**"My Communities" section:**
- Lists communities where current user is member or creator
- Empty state: "No communities yet. Create one or discover public groups."

**"Discover" section:**
- Lists public communities where user is not a member
- Empty state: "No public communities found." + "Create one" button

**Community card (`commCardHTML`):**
- Logo emoji (large)
- Name, type, location (area + city + state joined with comma)
- Visibility badge (Public / Private / Hidden) + Role badge (Admin / Contributor / Member)
- Member count with 👥 icon
- "Open" button → `openCommunity(id)`

**Sync:** on render, `syncCommunitiesFromDB()` is called if logged in; re-renders after sync.

### 4.9 Create Community Screen (`s-comm-create`)
Form to create a new community.

**Fields:**
- Name input (id=`cc-name`, required, maxlength=50)
- Type chip row (id=`cc-type-row`): "Pickup Group", "Recreational League", "Training Squad", "Neighborhood Crew", "Pro Am", "School Team", "Corporate Team"
- Country input (id=`cc-country`)
- State/Province input (id=`cc-state`)
- City input (id=`cc-city`)
- Area/Neighborhood input (id=`cc-area`)
- Court name input (id=`cc-court`)
- Description textarea (id=`cc-desc`, maxlength varies)
- Emoji logo picker (id=`cc-emoji-row`, row of emoji buttons): 🏀 ⚡ 🏆 🔥 💪 🎯 👑 🌟 🦁 🐉 🎪 🏟 etc.; first is default selected
- Visibility chip row (id=`cc-vis-row`): 🌐 Public / 🔒 Private / 👁 Hidden; default Public
- Join Approval chip row (id=`cc-approval-row`): "No — Open Join" / "Yes — Admin Approval"; default No
- "Create Community" button → `createCommunity()`
- Back button → `showScreen('communities')`

**`createCommunity()` flow:**
- Validates name
- Builds community object (id=`'community_'+Date.now()`)
- Derives `location` from `[city, state, country].filter(Boolean).join(', ')`
- Saves to `KC.communities` localStorage
- Creates admin member record in `KC.members`
- Calls `supaCreateCommunity(community, memberRecord)`
- Calls `trackEvent('community_created')`
- Toast "🎉 [name] created!" → `showScreen('communities')`

**`resetCommCreateForm()`:** clears all form inputs; resets all chip selections to defaults.

### 4.10 Community Detail Screen (`s-comm-detail`)
7-tab view for a single community.

**Top nav:**
- Back button → `showScreen('communities')`
- Community name (id=`cd-nav-title`) as center title
- No right action

**Header area (id=`cd-header`):**
- Large logo emoji (`.cd-logo`)
- Name, type + location (`.cd-info`)
- Description (if set)
- Badges: visibility, role, read-only, comments-locked, ratings-disabled, member count

**Join bar (id=`cd-join-bar`, only for non-members):**
- Open community: "Join [name]" bar with "Join" button → `joinCommunity(id)`
- Approval-required: "Join [name]" bar + "Request to Join" button → sends join request
- Private/Hidden: "Private Community" bar + "Request to Join" button
- Pending request: "Request Pending — Waiting for admin approval" + "Cancel" button → `cancelJoinReq(id)`
- Members see nothing here

**Tab bar (id=`cd-tabs`, `role=tablist`):**
1. Feed (💬)
2. Members (👥)
3. Players (🏅)
4. Gallery (📸)
5. Events (📅)
6. Leaderboard (🏆)
7. Settings (⚙) — only shown to admins (`id=cd-settings-tab`)

**Tab content container** (id=`cd-tab-content`): re-rendered on each `setCommTab(tab)`

#### Feed Tab
- Header row: "Feed" label + "New Post" / "✕ Close" button (for admin/contributor/member only, unless readOnly)
- Locked banners: read-only banner if `c.readOnly`; comments-locked banner if `c.commentsLocked`
- Filter chip row: All, plus one chip per POST_TYPE
- Create Post form (if `showCreateForm` and `canPost`):
  - Post type chip row (11 types: General Post, Announcement, Match Result, Upcoming Game, Tournament Update, Photo Post, Player Spotlight, Poll, MVP Vote, Training Tip, Court Update)
  - Title input (maxlength=80, optional)
  - Body textarea (maxlength=600)
  - Photo section: "Upload Photo" button (file input, max 2 MB, JPG/PNG/WEBP) + OR "Image URL" text input
  - "Publish" button → `submitPost(communityId)`
  - "Cancel" button
- Posts list (sorted: pinned first, then by createdAt desc):
  Each post card:
  - Type badge (emoji + type name)
  - Pinned badge (📌 Pinned) if pinned
  - Author avatar (initial letter in circle) + author name + relative time
  - Title (if set)
  - Body text
  - Image (if set) with onerror hiding
  - Reaction row: 👍 Like (count), 🔥 Fire (count), 👏 Clap (count) + 💬 comment count button
  - Admin/author actions: Pin/Unpin, Remove Photo, Edit, Delete
  - Comments section (if expanded):
    - Each comment: avatar + author name + body + time + delete button (author or admin)
    - Add comment input + Send button (if not comments-locked)
    - "Comments locked by admin" notice if locked

**`feedFilter`** state variable (default 'all')
**`showCreateForm`** state (default false)
**`newPostType`** state (default 'General Post')
**`editingPostId`** state (null or post id)
**`expandedComments`** Set of post ids

#### Members Tab
- Pending Join Requests section (admin only): each request card shows name, time, Approve / Reject buttons
- Members list: each card shows:
  - Avatar circle (initial, colored by role: admin=orange, contributor=gold, member=green)
  - Name + "(You)" if self
  - Role label in role color
  - "Joined [date]"
  - Admin actions (if viewer is admin, not self): "Make Contributor" / "Make Member" toggle + "Remove" button

#### Players Tab
- Header: "Players · N" count + "Add Player" button (admin/contributor only)
- Add Player form (if `showAddPlayerForm`):
  - Full name (required), nickname, jersey number, photo URL
  - Position chip row: PG, SG, SF, PF, C, Combo
  - Stats inputs: Games, Wins, Losses, Points, MVPs
  - Badges multi-select (10 badges, each toggleable)
  - "Add Player" / "Cancel"
- Player cards:
  - Photo (if photoUrl) or initial avatar
  - Name, nickname in quotes, position badge, jersey #
  - Average rating display (N★ + "N ratings")
  - Badges row (badge chips)
  - Stats row: Games, Wins, Loss, Pts, MVP
  - Action buttons: ⭐ Rate, ✏ Edit, 🗑 Delete
  - Rating form (if `ratingPlayerId === player.id`):
    - 7 attributes × 5 stars: Shooting, Defense, Passing, Speed, Teamwork, Clutch, Sportsmanship
    - "Submit Rating" / "Cancel"
    - Note: "Ratings are community-based and meant to be constructive."
  - Edit form (if `editingPlayerId === player.id`):
    - Same fields as add form, pre-filled

**Player badges (10):**
| id | icon | label |
|---|---|---|
| clutch_shooter | 🎯 | Clutch Shooter |
| lockdown_defender | 🔒 | Lockdown Defender |
| hustle_king | 💪 | Hustle King |
| floor_general | 🎙 | Floor General |
| silent_killer | ⚡ | Silent Killer |
| fast_break_king | 💨 | Fast Break King |
| game_point_killer | 🔥 | Game Point Killer |
| best_teammate | 🤝 | Best Teammate |
| most_improved | 📈 | Most Improved |
| positive_energy | 🌟 | Positive Energy |

**Rating attributes (7):** shooting, defense, passing, speed, teamwork, clutch, sportsmanship

#### Gallery Tab
- Header: photo count + "Add Photo" button (admin/contributor)
- Add Photo form (if `showAddGalleryForm`):
  - Mode tabs: "📁 Upload" | "🔗 Image URL"
  - Upload mode: tap area → file picker (JPG/PNG/WEBP, max 2 MB); shows preview card with filename, size, Remove button
  - URL mode: URL input
  - Caption textarea
  - Album chip row: Match Day Photos, Winners Gallery, Player Highlights, Training Sessions, Tournament Photos
  - Tag Players chips (multi-select from community players list)
  - "📸 Save Photo" / "Cancel"
- Filter chips: All 📸, Match Day Photos, Winners Gallery, Player Highlights, Training Sessions, Tournament Photos
- Gallery grid (`.gal-grid`):
  Each gallery card:
  - Image (`.gal-img`) or placeholder (📸)
  - Album badge
  - Caption
  - Tagged player chips
  - "By [uploader] · [time]"
  - Like button (❤️ count) + Comment button (💬 count) + Delete button (uploader or admin)
  - Comments section (if expanded): same pattern as feed comments

**Note:** Base64 uploads are stored in localStorage. Supabase upload skips base64 items (`imageSourceType === 'upload'`).

#### Events Tab
- Filter chips: Upcoming 📅, Past, All
- Count + "Add Event" button (admin/contributor)
- Add Event form (if `showAddEventForm`):
  - Event type chips: Pickup Game, Tournament, Practice Session, Social Event, Training Camp, Watch Party
  - Title input (required)
  - Description textarea
  - Date input (type=date)
  - Time input (type=time)
  - Location input
  - Max Players input (0 = no limit)
  - "📅 Create Event" / "Cancel"
- Events list sorted by date (upcoming: ascending, past: descending):
  Each event card:
  - Date block: day number + 3-letter month (MMM)
  - Type badge (colored per type)
  - Title
  - Time + location meta items
  - Description
  - Count pills: ✅ Going (N/max), 🤔 Maybe (N), 🏀 Need team (N), ⏰ Late (N)
  - Format suggestion strip (admin/contributor, upcoming only):
    - ≥10 confirmed → suggest 5v5
    - ≥8 → 4v4
    - ≥6 → 3v3
  - RSVP buttons (2 rows, upcoming only):
    - Row 1: ✅ Going (disabled if full), 🤔 Maybe, ❌ Can't Go
    - Row 2: 🏀 Need Team, ⏰ Running Late
    - Tapping same status = toggle off (remove RSVP)
  - "Show attendees (N)" toggle → attendee chip list with status colors
  - Delete button (creator or admin)

**RSVP status colors:**
- going: green chip
- maybe: yellow chip
- not_going: red chip
- need_team: orange chip
- running_late: teal chip

**Event types and colors:**
| Type | Background | Text |
|---|---|---|
| Pickup Game | rgba(255,107,53,.18) | var(--ca) |
| Tournament | rgba(255,179,0,.18) | var(--gold) |
| Practice Session | rgba(0,200,81,.18) | var(--success) |
| Social Event | rgba(100,181,246,.18) | #64b5f6 |
| Training Camp | rgba(206,147,216,.18) | #ce93d8 |
| Watch Party | rgba(129,212,250,.18) | #81d4fa |

#### Leaderboard Tab
- If `c.ratingsDisabled`: show disabled message
- If no players: show empty state
- Category chip row (6 chips):
  - ⭐ Overall Rating (key: 'rating')
  - 🏀 Top Scorers (key: 'scoring')
  - 🎮 Most Games (key: 'games')
  - 📈 Win Rate (key: 'winrate')
  - 🥇 MVP Count (key: 'mvp')
  - 🤝 Sportsmanship (key: 'sport')
- Section label: "[category] — Top Players"
- Leaderboard rows (top 10):
  Each row:
  - Rank (🥇/🥈/🥉 for top 3, number after)
  - Avatar (initial letter)
  - Name + position / nickname subtitle
  - Stat value + unit
  - Rows 1-3 have special background colors (gold/silver/bronze)

**Ranking logic:**
- `rating`: average of all 7 attribute averages across all raters (min 1 rating)
- `scoring`: `player.points` (raw total)
- `games`: `player.gamesPlayed`
- `winrate`: `Math.round((wins/gamesPlayed)*100)` — only players with ≥3 games shown
- `mvp`: `player.mvpCount`
- `sport`: average sportsmanship rating from all raters

#### Settings Tab (admin only)
- Community Name input (pre-filled)
- Description textarea (pre-filled)
- Visibility chip row (pre-selected from current value)
- Join Approval chip row (pre-selected)
- "Save Changes" button → `saveCommEdit(id)`
- Danger Zone section (⚠ Moderation):
  - Lock/Unlock Posting (read-only toggle)
  - Lock/Unlock Comments
  - Enable/Disable Ratings
  - Delete Community (with confirm dialog)
- For non-admin members: shows "Settings are managed by the community admin" + "Leave Community" button

### 4.11 Settings Screen (`s-settings`)
App settings and utilities.

**Profile section:**
- Current profile name + avatar
- "Switch Profile" button

**Game Defaults section:**
- Default Win Score (chip row: 11, 15, 21)
- Sound effects toggle (stored in settings)
- Vibration toggle (stored in settings)

**Sync / Data section:**
- "Export Data" → downloads JSON of all localStorage keys
- "Import Data" → file picker for JSON restore
- "Clear All Data" → destructive confirm dialog
- Supabase sync status (signed in / guest)
- "Load Demo Data" button + subtitle (shows "✓ Demo data loaded" if already loaded)
- "Clear Demo Data" button

**Analytics section:** → `showScreen('s-analytics')`

**Help section:**
- "Help Center" → `showScreen('s-help-center')`
- "Ask CourtCall Assistant" → `openHelpChat()`

**About / Legal section:**
- App version display (`APP_VERSION`)
- "What's New" (Changelog) → `openChangelog()`
- "Privacy Policy" → `showScreen('s-privacy')`
- "Terms of Service" → `showScreen('s-terms')`
- "Send Feedback" → `openFeedback()`
- Contact email: vadi.s23@gmail.com

**Sign out button** (if logged in): calls `supa.auth.signOut()`, clears `supaUser`, clears local profile-sensitive data, goes to profile screen

### 4.12 Analytics Screen (`s-analytics`)
Usage stats dashboard from `STATS_KEY` localStorage.

**Stats shown:**
- Total visits / sessions
- App launch date
- Last visit date
- Profiles created
- Guest sessions
- Games started
- Games completed
- Matches saved
- Players added
- Tournaments created
- Communities created
- Voice commands used

**Layout:** grid of stat cards, each with large number + label.

### 4.13 Pulse Screen (`s-pulse`)
"CourtCall Pulse" — local basketball news aggregator.

**Location form:**
- Country input (id=`pulse-country`, default "India")
- State input (id=`pulse-state`, default "Karnataka")
- City input (id=`pulse-city`, default "Bengaluru")
- Area input (id=`pulse-area`, optional)
- Court name input (id=`pulse-court`, optional)
- "Save Location" button → `savePulseLocation()` → stores in `K_PULSE='pickup_app_pulse_location'`

**Category filter chips** (`.pf-chip`):
- All, Basketball, Local Sports, Tournaments, Community, Weather, National Basketball

**Search Links section** (id=`pulse-link-list`):
- Dynamically generated from `buildNewsQueries(loc)` filtered by `pulseFilter`
- Each link opens Google News or Google Search in new tab
- Links include:
  - `{city} basketball news` → news.google.com
  - `{state} basketball` (if state provided)
  - `{city} local sports`
  - `{city} basketball tournament`
  - `{state} sports tournament {year}` (if state)
  - `{city} community sports event`
  - `weather {city} weekend` → google.com
  - `{country} basketball news`
  - `India basketball federation`
  - `"{court}" basketball court {city}` (if court provided)

**Demo news feed** (id=`pulse-feed`):
- 8 hardcoded demo cards covering: basketball, tournament, local, community, weather, national categories
- Each card: category badge, "Demo" badge, headline, summary (first basketball card substitutes city name), source, time, "Read More ↗" link (opens Google News search for headline+city)
- Filter applies: shows only cards of selected category

**Purpose:** Pulse generates smart search links. It does NOT fetch live news directly. Production integration note comment present in source for NewsAPI, GNews, Bing News, SerpAPI.

**localStorage key:** `K_PULSE = 'pickup_app_pulse_location'`

### 4.14 Basketball World Screen (`s-world`)
Global basketball info screen with links to international basketball content, leagues, and resources. Static HTML with curated external links. No dynamic data.

### 4.15 Landing Page (`s-landing`)
Marketing landing page shown to unauthenticated users at the app root.

**Sections:**
- Hero: app name, tagline, "Get Started" CTA
- Features section (id=`lp-features`): feature cards
- How it Works section (id=`lp-s5`): step-by-step
- Communities preview
- CTA section

**Nav bar:** desktop nav with links; hamburger + nav drawer on mobile (≤900px).

### 4.16 Help Center Screen (`s-help-center`)
Full-text help documentation.

**Layout:**
- Search input (id=`hc-search`, `oninput=renderHelpCenter()`)
- Category filter chips (id=`hc-cats`)
- Articles list (id=`hc-articles`)
- "Ask CourtCall Assistant" button at bottom

**Category filter chips:** All + unique categories from KB (Getting Started, Quick Game, Scoring, Fouls and Undo, Shot Clock, Game Clock, Voice Scoring, Team Builder, Player Ratings, Queue / Who Got Next, Match History, Tournament, Communities, Community Feed, Community Players, Community Gallery, Community Events, CourtCall Pulse, Basketball World, Settings, Backup / Export, Feedback, Troubleshooting)

**Each article accordion card:**
- Category label
- Title
- Arrow indicator (›, rotates to ▼ when open)
- Hidden body: shortAnswer text + numbered steps list + Related features line
- Toggle: `hcToggle(id)` — toggles `.hidden` on body and `.open` on arrow

**`renderHelpCenter()`:** filters KB by active category and search query (title, shortAnswer, category, keywords), renders accordion cards.

### 4.17 Privacy Policy & Terms of Service Screens
Static HTML legal text screens with page-nav back button.

**Privacy Policy last updated:** May 30, 2026  
**Terms of Service last updated:** May 30, 2026  
**`closeLegal()`** navigates back.

### 4.18 Reset PIN Screen (`s-reset-pin`)
For changing PIN after login.

**Fields:**
- New 6-digit PIN row (id=`pin-rs`)
- Confirm new PIN row (id=`pin-rsc`)
- Error div (id=`auth-err-rs`)
- "Update PIN" button → `submitNewPin()`
- "Cancel" → `showScreen('profile')`

---

## 5. Core Game Logic

### State management
`gameState` global object — matches `freshState()` structure.  
`save()` serializes to `K.game` localStorage key.  
`load()` deserializes from `K.game`.  
`clearSave()` removes `K.game`.

### `addScore(team, pts)`
1. Push `{type:'score', team, pts, quarter: gameState.quarter}` to `gameState.history`
2. `gameState.team[team].score += pts`
3. Compute current lead; update `maxLead.a` and `maxLead.b`
4. If lead changed direction (was A leading, now B or tied, vice versa): `leadChanges++`
5. Track current run: increment same-team run counter, reset on score change; update `biggestRun` if exceeded
6. If `shotClockAutoReset`: reset shot clock countdown to `shotClockDuration`
7. Call `checkWin(gameState)` — if winner: set `gameState.gameOver = true`, show win overlay
8. Call `save()`
9. Update UI (re-render scoreboard)

### `checkWin(state)`
```
Returns 'a' if teamA.score >= winScore AND (not winBy2 OR teamA.score >= teamB.score + 2)
Returns 'b' if teamB.score >= winScore AND (not winBy2 OR teamB.score >= teamA.score + 2)
Returns null otherwise
```

### `undoScore()`
1. If `history.length === 0` return
2. Pop last item from `history`
3. If type='score': `team.score -= pts`; recalculate maxLead from remaining history
4. If type='foul': `team.fouls--`
5. Set `gameOver = false`
6. `save()`; re-render

### `addFoul(team)`
1. Push `{type:'foul', team, quarter}` to `history`
2. `gameState.team[team].fouls++`
3. `save()`; update UI

### Shot clock
- Countdown timer (setInterval at 100ms intervals)
- `shotClockRemaining` tracks current value (seconds)
- CSS `--sc-frac` variable drives the SVG arc animation
- Turns red (class added) when ≤ 5 seconds
- Auto-resets on score if `shotClockAutoReset`
- Pause/resume: clearInterval / restart interval
- Manual reset: `resetShotClock()`

### Game clock
- `startTime` = `Date.now()` when first score added (or manually started)
- `gameClockMode === 'count-up'`: display `Math.floor((Date.now() - startTime) / 1000)` as MM:SS
- Updated every second via setInterval
- Paused with shot clock pause

### Voice scoring (`handleVoiceCommand(transcript)`)
Matches patterns (case-insensitive):
- Color name + number word: "orange two" → +2 to team with colorKey orange
- "team a" / "team b" + number: → respective team
- Number alone if context established
- "undo" → `undoScore()`
- "score check" → `speechSynthesis.speak(new SpeechSynthesisUtterance("Team A ${scoreA}, Team B ${scoreB}"))`
- "reset shot clock" → `resetShotClock()`
- "foul [team]" → `addFoul(team)`

Number word mapping: one→1, two→2, three→3, plus variants ("+1", "+2", "+3", "1", "2", "3")

---

## 6. Team Builder Logic

### Player structure
```javascript
{
  id: 'player_' + Date.now(),
  name: String,
  nickname: String,
  attrs: { shoot: 1-5, def: 1-5, speed: 1-5, stamina: 1-5 },
  rating: 1-10,  // auto-calculated
  isDemo: Boolean,
  demoBatchId: String
}
```

### Rating calculation
`rating = Math.round((attrs.shoot + attrs.def + attrs.speed + attrs.stamina) / 4 * 2)` → maps 1-5 average to 1-10 scale (multiply by 2, round)

### `initAttrGrid()`
Wires star buttons in the team builder attribute grid. Each star group is a row of 5 star buttons; clicking star N selects 1-N (fills all previous stars).

### Balanced team generation
1. Sort all players by `rating` descending
2. Apply snake draft: player 0 → Team 0, player 1 → Team 1, ..., player N-1 → Team N-1, player N → Team N-1, player N+1 → Team N-2... (snake back)
3. Compute RMSD of team total ratings
4. Try multiple random permutations (e.g., 50 shuffles), keep the arrangement with lowest RMSD
5. Return teams array

### Random generation
Fisher-Yates shuffle of player array, then split into groups of game-type size.

### Snake draft (interactive)
- `draftOrder` computed: alternating teams in snake pattern
- User clicks on player card to assign; draft position auto-advances
- Remaining players shown in pool; picked players shown on team cards

### Queue (Who Got Next)
- `builderState.queue`: array of team objects `{name, players, id}`
- `builderState.queueMode`: `'winners-stay'` or `'rotation'`
- `builderState.queuePointer`: index of next team to play
- Winners Stay: after game result entered, losing team goes to end of queue; queue pointer advances 1
- Rotation: queue rotates regardless of result
- UI shows queue list with arrows to reorder, remove button per team

---

## 7. Tournament Logic

### Tournament structure
```javascript
{
  id: 'tourn_' + Date.now(),
  name: String,
  format: 'roundrobin' | 'knockout',
  winScore: Number,
  teams: [{ name: String }],
  fixtures: [
    {
      id: String,
      teamA: String (team name),
      teamB: String (team name),
      scoreA: Number | null,
      scoreB: Number | null,
      winner: String | null,
      played: Boolean
    }
  ],
  completed: Boolean,
  winner: String | null,
  winScore: Number,
  createdAt: String,
  isDemo: Boolean,
  demoBatchId: String
}
```

### Round Robin fixture generation
For N teams, generate all pairs: `for i in 0..N-1, for j in i+1..N-1: {teamA: teams[i].name, teamB: teams[j].name}`
Results in N*(N-1)/2 fixtures.

### Knockout fixture generation
1. Determine bracket size = next power of 2 ≥ N
2. Add bye slots (empty strings) to fill to power-of-2
3. Shuffle or seed teams
4. Pair: teams[0] vs teams[1], teams[2] vs teams[3], etc.
5. Subsequent rounds generated as each round completes

### `saveFixtureResult(tournId, fixtureId, scoreA, scoreB)`
1. Find tournament and fixture
2. Update fixture: `{scoreA, scoreB, winner: (scoreA > scoreB ? teamA : teamB), played: true}`
3. If Round Robin:
   - Recalculate standings from all played fixtures
   - If all fixtures played: `completed = true`, `winner = top of standings`
4. If Knockout:
   - If all fixtures in current round played: generate next round fixtures with winners
   - If final fixture played: `completed = true`, `winner = fixture.winner`
5. Save to `K.tournaments` via `setCol()`
6. Call `supaUpsertTournament(tournament)`

### Standings calculation (Round Robin)
For each team, count:
- `played` = fixtures where team appears and `played === true`
- `won` = fixtures where `winner === team.name`
- `lost` = `played - won - drawn`
- `points` = `won * 2 + drawn * 1`
- `ptsFor` = sum of team's scores in played fixtures
- `ptsAgainst` = sum of opponent's scores
- `diff` = `ptsFor - ptsAgainst`
Sort: points desc → diff desc → ptsFor desc

---

## 8. Match History & Career Stats

### Match object (saved to `K.matches` array)
```javascript
{
  id: String,
  teamA: { name, score, players: [] },
  teamB: { name, score, players: [] },
  winner: { name, score } | null,
  gameType: String,
  winScore: Number,
  scoringRule: String,
  duration: String,  // "28m 14s"
  foulsA: Number, foulsB: Number,
  maxLead: { a: Number, b: Number },
  leadChanges: Number,
  biggestRun: Number,
  quartersPlayed: Number,
  tournamentId: String | null,
  fixtureId: String | null,
  date: String (toLocaleDateString),
  history: [{ type, team, pts, quarter }],
  isDemo: Boolean, demoBatchId: String
}
```

### `saveMatch(state)`
1. Compute `duration = formatDuration(Date.now() - state.startTime)`  
   `formatDuration(ms)` → `"${m}m ${s}s"` (minutes + seconds)
2. Build match object from `state`
3. `setCol(K.matches, [match, ...existing].slice(0, 200))`
4. Call `supaSaveGame(match)`
5. Increment `games_played` in profile, save to `K.profile`
6. Call `trackEvent('game_completed')`

### Career stats computation
From `K.matches`:
- `totalGames` = matches.length
- `wins` = matches where `winner.name === userProfile.name` (or team name matching) (note: victory is tracked by team name, not player)
- `winRate` = wins / totalGames * 100
- `avgScore` = average of (teamA.score + teamB.score) / 2 across all games
- Highest score game, lowest score game, etc.

### Filter logic (history screen)
- "All": all matches
- "Wins": matches where your team name was winner (based on profile team name or last used team)
- "Losses": where opponent won
- "Draws": no winner (unlikely in normal play but handled)

---

## 9. Communities Feature

### Data structures (localStorage keys from `KC` object)
```javascript
const KC = {
  communities: 'courtcall_communities',
  members: 'courtcall_community_members',
  joins: 'courtcall_community_joins',
  posts: 'courtcall_community_posts',
  players: 'courtcall_community_players',
  gallery: 'courtcall_community_gallery',
  events: 'courtcall_community_events',
  ratings: 'courtcall_community_ratings',
}
```

### Community object
```javascript
{
  id: 'community_' + Date.now(),
  name, type, country, state, city, area, court, description,
  logo: String (emoji),
  visibility: 'public' | 'private' | 'hidden',
  joinApproval: Boolean,
  createdBy: profileId,
  createdAt: String,
  memberCount: Number,
  location: String (derived),
  readOnly: Boolean,       // admin moderation
  commentsLocked: Boolean, // admin moderation
  ratingsDisabled: Boolean, // admin moderation
  isDemo: Boolean
}
```

### Member object
```javascript
{
  id: 'member_' + Date.now(),
  communityId, profileId, profileName,
  role: 'admin' | 'contributor' | 'member',
  joinedAt: String
}
```

### Roles and permissions
| Action | Admin | Contributor | Member | Guest |
|---|---|---|---|---|
| Post in feed | ✓ | ✓ | ✓ | ✗ |
| Comment | ✓ | ✓ | ✓ | ✗ |
| Add player | ✓ | ✓ | ✗ | ✗ |
| Rate player | ✓ | ✓ | ✓ | ✗ |
| Add gallery | ✓ | ✓ | ✗ | ✗ |
| Create event | ✓ | ✓ | ✗ | ✗ |
| RSVP event | ✓ | ✓ | ✓ | ✗ |
| Pin post | ✓ | ✗ | ✗ | ✗ |
| Delete any post | ✓ | ✗ | ✗ | ✗ |
| Change member role | ✓ | ✗ | ✗ | ✗ |
| Remove member | ✓ | ✗ | ✗ | ✗ |
| Edit community settings | ✓ | ✗ | ✗ | ✗ |
| Lock posting | ✓ | ✗ | ✗ | ✗ |
| Approve join requests | ✓ | ✗ | ✗ | ✗ |
| View settings tab | ✓ | ✗ | ✗ | ✗ |

**Override:** if `c.readOnly`, only admin can post (contributors and members blocked).  
**Override:** if `c.commentsLocked`, only admin can comment.

### Join flow
- **Public, no approval:** `joinCommunity(id)` → create member record immediately
- **Public, approval required:** create join request with `status: 'pending'`; admin approves/rejects
- **Private / Hidden:** always requires join request even if joinApproval is false
- **Already pending:** show "Request Pending" state; "Cancel" removes request

### Post object
```javascript
{
  id: 'post_' + Date.now(),
  communityId, authorId, authorName,
  type: String (one of POST_TYPES),
  title, body, imageUrl,
  pinned: Boolean,
  createdAt: ISO String,
  reactions: { like: [profileId], fire: [profileId], clap: [profileId] },
  comments: [{ id, authorId, authorName, body, createdAt }],
  isDemo, demoBatchId
}
```

### POST_TYPES (11)
General Post, Announcement, Match Result, Upcoming Game, Tournament Update, Photo Post, Player Spotlight, Poll, MVP Vote, Training Tip, Court Update

### Player (community) object
```javascript
{
  id: 'player_' + Date.now(),
  communityId, name, nickname,
  jerseyNumber, photoUrl,
  position: 'PG'|'SG'|'SF'|'PF'|'C'|'Combo',
  gamesPlayed, wins, losses, points, mvpCount,
  badges: [badgeId],
  createdBy, createdAt: ISO String
}
```

### Rating (community) object
```javascript
{
  id: 'rating_' + Date.now(),
  playerId, communityId, raterProfileId,
  shooting, defense, passing, speed, teamwork, clutch, sportsmanship,  // all 1-5
  createdAt, updatedAt: ISO String
}
```
One rating per (player, rater) pair — upsert on conflict.

### Gallery item object
```javascript
{
  id: 'gallery_' + Date.now(),
  communityId, imageSourceType: 'upload'|'url',
  imageData: String (base64 if upload),
  imageUrl: String (if url mode),
  fileName,
  caption, album,
  taggedPlayers: [playerId],
  uploadedBy, uploaderName,
  createdAt: ISO String,
  likes: [profileId],
  comments: [{ id, authorId, authorName, text, createdAt }]
}
```

### Event object
```javascript
{
  id: 'event_' + Date.now(),
  communityId, title, description,
  type: String (one of EVT_TYPES),
  date: 'YYYY-MM-DD', time: 'HH:MM',
  location, maxPlayers: Number,
  createdBy, creatorName,
  createdAt: ISO String,
  rsvps: [{ profileId, profileName, status, updatedAt }]
}
```

### RSVP statuses: going, maybe, not_going, need_team, running_late

### Join request object
```javascript
{
  id: 'join_' + Date.now(),
  communityId, profileId, profileName,
  status: 'pending' | 'approved' | 'rejected',
  requestedAt: ISO String
}
```

### `fmtPostTime(iso)` — relative time formatting
- < 60s: "just now"
- < 1h: "Nm ago"
- < 24h: "Nh ago"
- < 7d: "Nd ago"
- else: `toLocaleDateString()`

---

## 10. Supabase Integration

### Client initialization
```javascript
const SUPA_URL = '...';  // project URL
const SUPA_KEY = '...';  // anon public key
const supa = window.supabase?.createClient(SUPA_URL, SUPA_KEY);
```
Loaded from CDN: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>`

### Auth state
- `supaUser` — Supabase Auth user object or null
- On init: `supa.auth.getUser()` to restore session
- `supa.auth.onAuthStateChange()` listener updates `supaUser`

### Database schema (see `/home/user/snake-ladder-game/supabase-schema.sql`)

**Tables:**
- `profiles (id uuid PK→auth.users, name text, nickname text, games_played int, created_at timestamptz)`
- `games (id text PK, user_id uuid FK→profiles, team_a_name, team_b_name, score_a, score_b, winner, game_type, win_score, scoring_rule, duration, fouls_a, fouls_b, max_lead_a, max_lead_b, lead_changes, biggest_run, quarters_played, tournament_id, fixture_id, players_a jsonb, players_b jsonb, created_at)`
- `tournaments (id text PK, user_id uuid FK, name, format, win_score, teams jsonb, fixtures jsonb, standings jsonb, completed bool, winner, settings jsonb, created_at, updated_at)`
- `communities (id text PK, creator_id uuid FK, name, description, type, visibility, logo, location, invite_code)`
- `community_members (community_id, user_id uuid, role, profile_name)`
- `community_posts (id text PK, community_id, author_id, author_name, type, title, body, image_url, pinned, reactions jsonb, comments jsonb, created_at)`
- `community_players (id text PK, community_id, creator_id, name, nickname, jersey_num, photo_url, position, badges jsonb, games_played, wins, losses, points, mvp_count, created_at)`
- `community_ratings (id text PK, player_id, community_id, rater_id, shooting, defense, passing, speed, teamwork, clutch, sportsmanship, created_at, updated_at)` — unique on (player_id, rater_id)
- `community_gallery (id text PK, community_id, uploader_id, uploader_name, image_url, caption, album, tagged_players jsonb, likes jsonb, comments jsonb, created_at)`
- `community_events (id text PK, community_id, title, description, type, date, time, location, max_players, created_by, creator_name, rsvps jsonb, created_at)`
- `community_join_requests (id text PK, community_id, user_id, profile_name, status, requested_at)`
- RLS enabled on all tables; own-data policies for read/insert/update

**Auto-create profile trigger:** `handle_new_user()` — inserts into `profiles` on `auth.users` insert using `raw_user_meta_data->>'name'` or email prefix.

**Indexes:** `idx_games_user_id`, `idx_games_created_at DESC`

### Write functions

**`supaSaveGame(match)`**
```javascript
await supa.from('games').upsert({
  id, user_id: supaUser.id,
  team_a_name: match.teamA.name, team_b_name: match.teamB.name,
  score_a: match.teamA.score, score_b: match.teamB.score,
  winner: match.winner?.name,
  game_type: match.gameType, win_score: match.winScore, scoring_rule: match.scoringRule,
  duration: match.duration,
  fouls_a: match.foulsA, fouls_b: match.foulsB,
  max_lead_a: match.maxLead?.a, max_lead_b: match.maxLead?.b,
  lead_changes: match.leadChanges, biggest_run: match.biggestRun,
  quarters_played: match.quartersPlayed,
  tournament_id: match.tournamentId, fixture_id: match.fixtureId,
  players_a: match.teamA.players, players_b: match.teamB.players,
  created_at: match.date
})
```

**`supaUpsertTournament(tournament)`**
```javascript
await supa.from('tournaments').upsert({
  id, user_id: supaUser.id,
  name: tournament.name, format: tournament.format,
  win_score: tournament.winScore,
  teams: tournament.teams, fixtures: tournament.fixtures,
  standings: derived_standings,
  completed: tournament.completed, winner: tournament.winner,
  settings: { winScore: tournament.winScore },
  created_at: tournament.createdAt,
  updated_at: new Date().toISOString()
})
```

**`supaDeleteTournament(id)`** — `supa.from('tournaments').delete().eq('id', id)`

**`supaCreateCommunity(community, member)`**
```javascript
await supa.from('communities').upsert({
  id: community.id, creator_id: supaUser.id,
  name, description, type, visibility, logo, location,
  invite_code: community.id
})
await supa.from('community_members').upsert({
  community_id, user_id: supaUser.id,
  role: 'admin', profile_name
})
```

**`supaJoinCommunity(communityId)`**
```javascript
await supa.from('community_members').upsert({
  community_id: communityId, user_id: supaUser.id,
  role: 'member', profile_name: currentProfile.name
})
```

**`supaSubmitPost(post)`**
```javascript
await supa.from('community_posts').upsert({
  id: post.id, community_id, author_id, author_name, type, title, body, image_url,
  pinned: false, reactions, comments: [],
  created_at
})
```

**`supaUpdatePost(postId, updates)`**
```javascript
await supa.from('community_posts').update(updates).eq('id', postId)
```

**`supaHardDeletePost(postId)`**
```javascript
await supa.from('community_posts').delete().eq('id', postId)
```

**`supaUpsertCPlayer(player)`**
```javascript
await supa.from('community_players').upsert({
  id, community_id, creator_id: supaUser.id,
  name, nickname, jersey_num: player.jerseyNumber, photo_url: player.photoUrl,
  position, badges, games_played, wins, losses, points, mvp_count: player.mvpCount,
  created_at
})
```

**`supaDeleteCPlayer(playerId)`** — delete from `community_players`

**`supaUpsertCRating(rating)`**
```javascript
await supa.from('community_ratings').upsert({
  id, player_id, community_id, rater_id: supaUser.id,
  shooting, defense, passing, speed, teamwork, clutch, sportsmanship,
  created_at, updated_at
}, { onConflict: 'player_id,rater_id' })
```

**`supaSubmitGalleryItem(item)`**
- If `item.imageSourceType === 'upload'`: does NOT write to Supabase (base64 skipped)
- If URL mode:
```javascript
await supa.from('community_gallery').upsert({
  id, community_id, uploader_id: supaUser.id, uploader_name, image_url: item.imageUrl,
  caption, album, tagged_players, likes: [], comments: [],
  created_at
})
```

**`supaUpdateGalleryItem(itemId, updates)`** — update community_gallery

**`supaDeleteGalleryItem(itemId)`** — delete from community_gallery

**`supaCreateEvent(evt)`**
```javascript
await supa.from('community_events').upsert({
  id, community_id, title, description, type,
  date, time, location, max_players, created_by, creator_name,
  rsvps: [], created_at
})
```

**`supaUpdateEvent(eventId, updates)`** — update community_events (for RSVP changes)

**`supaCreateJoinRequest(req)`**
```javascript
await supa.from('community_join_requests').upsert({
  id, community_id, user_id: supaUser.id,
  profile_name, status: 'pending', requested_at
})
```

**`supaCancelJoinRequest(communityId)`** — delete from `community_join_requests` where community_id + user_id

**`supaUpdateJoinRequest(reqId, status)`** — update status field

**`supaLeaveComm(communityId)`** — delete from `community_members` where community_id + user_id

### Read / sync functions

**`syncAllUserDataFromDB()`** — calls all sync functions in parallel:
- `_syncGamesFromDB()`
- `_syncTournamentsFromDB()`
- `_syncCPlayersFromDB()`
- `_syncCRatingsFromDB()`
- `_syncJoinRequestsFromDB()`
- `syncCommunitiesFromDB()`

**`_syncGamesFromDB()`**
- Query `games` table ordered by `created_at DESC`
- Merge with local: DB records take precedence for DB-known fields; local fields fill gaps
- `players_a`/`players_b` default to local values if DB null
- Merged result capped at 200 entries, saved to `K.matches`

**`_syncTournamentsFromDB()`**
- Query `tournaments` ordered by `created_at DESC`
- Merge with local: DB wins; `status === 'completed'` maps to `completed: true`
- `teams`, `fixtures`, `winner`, `winScore` merged

**`_syncCPlayersFromDB()`**
- Query `community_players` where `community_id IN [user's community ids]`
- Merge with local

**`_syncCRatingsFromDB()`**
- Query `community_ratings` where `rater_id = supaUser.id`
- Merge with local

**`_syncJoinRequestsFromDB()`**
- Two queries: own requests + pending requests for admin communities
- De-duplicate by id, merge with local

**`syncCommunitiesFromDB()`**
- Queries: communities where user is creator OR member
- Merges community list and member list

**`syncPostsFromDB(communityId)`**
- Queries `community_posts` for given community
- Merges with local posts; DB reactions/comments take precedence; local fills gaps

**`_mergeReactions(dbReactions, localReactions)`**
- Combines arrays for each reaction type (like, fire, clap), deduplicating by profileId

---

## 11. PWA & Offline

### Service Worker (`basketball-sw.js`)
- Cache name: `courtcall-v8`
- Shell files cached on install: `['./basketball.html', './basketball.manifest.json', './icons/icon.svg']`
- **Install:** `caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())`
- **Activate:** delete all caches where key ≠ CACHE; `self.clients.claim()`
- **Fetch:** GET only; two strategies:
  - Same-origin: stale-while-revalidate — return cached immediately, fetch+update in background; fall back to cache if fetch fails
  - `fonts.googleapis.com` and `fonts.gstatic.com`: cache-first — return cached if exists, otherwise fetch+cache; 503 response on network failure
  - All other origins: pass through (no interception)

### Registration
```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./basketball-sw.js', { scope: './' }).catch(() => {});
  });
}
```

### PWA manifest (`basketball.manifest.json`)
- name: "CourtCall"
- short_name: "CourtCall"
- description: "Basketball pickup game scorer — score, build teams, run tournaments"
- start_url: "./basketball.html"
- scope: "./"
- display: "standalone"
- background_color: "#0F0F23"
- theme_color: "#FF5722"
- orientation: "portrait"
- categories: ["sports", "utilities"]
- icons: `icons/icon.svg` (any size, SVG, purpose: "any" and "maskable")
- shortcuts: `[{ name: "Quick Game", short_name: "Play", url: "./basketball.html#setup" }]`

### PWA install prompt
- `_deferredInstall` captures `beforeinstallprompt` event
- Shows `#pwa-install-bar` banner unless `localStorage.getItem('pwa_dismissed')` is set
- `triggerInstall()` calls `_deferredInstall.prompt()`
- `dismissInstall(e)` hides bar and sets `pwa_dismissed`
- On `appinstalled` event: hide bar, show "CourtCall installed! 🎉" toast

### Offline indicator
- `#offline-banner` strip at top
- `_updateOnlineStatus()` toggles `.show` class based on `!navigator.onLine`
- Wired to `window.addEventListener('online', ...)` and `window.addEventListener('offline', ...)`
- Shows toast "You're offline — changes saved locally" when going offline

### localStorage keys
```javascript
const K = {
  profile: 'cc_profile',           // current user profile
  profiles: 'cc_profiles',         // all profiles (multi-profile)
  players: 'cc_players',           // team builder players
  builder: 'cc_builder',           // team builder state
  matches: 'cc_matches',           // match history
  tournaments: 'cc_tournaments',   // tournament list
  settings: 'cc_settings',         // app settings
  game: 'courtcall_v1',            // active game state
  games: 'courtcall_games'         // (legacy)
};
const STATS_KEY = 'courtcall_app_stats';    // analytics
const OB_KEY = 'courtcall_onboarding_seen'; // onboarding flag
const KC = {
  communities: 'courtcall_communities',
  members: 'courtcall_community_members',
  joins: 'courtcall_community_joins',
  posts: 'courtcall_community_posts',
  players: 'courtcall_community_players',
  gallery: 'courtcall_community_gallery',
  events: 'courtcall_community_events',
  ratings: 'courtcall_community_ratings',
};
const K_PULSE = 'pickup_app_pulse_location';
const HELP_CHAT_KEY = 'courtcall_help_chat_history';
const HELP_FB_KEY = 'courtcall_help_feedback';
```

### Helper functions
- `getObj(key, default)` / `setObj(key, val)` — JSON parse/stringify for objects
- `getCol(key)` / `setCol(key, arr)` — JSON array read/write

---

## 12. Accessibility & UX

### ARIA roles and attributes
- Bottom nav: `<nav>` element
- More sheet: `role="dialog" aria-modal="true" aria-label="More menu"`
- Nav drawer: `role="dialog" aria-modal="true" aria-label="Navigation menu"`
- Help chat panel: `role="dialog" aria-modal="true" aria-label="CourtCall Assistant"`
- Feedback modal: `role="dialog" aria-modal="true"`
- Changelog modal: `role="dialog" aria-modal="true"`
- Auth tab bar: `role="tablist"`; each tab: `role="tab"`; panels: `role="tabpanel"`
- Community tab bar: `role="tablist"` (id=`cd-tabs`)
- Tournament tab bar: `role="tablist"` (id=`tc-tabs`)
- History filter bar: `role="tablist"` (id=`history-filter-bar`)
- Team builder tabs: `role="tablist"` (id=`tb-tabs-bar`)
- PIN rows: `role="group"` with `aria-label`
- Each PIN box: `aria-label="Digit N"` (e.g. "Enter digit 1", etc.)
- Eye toggle: `aria-label="Show or hide PIN"`
- Help FAB: `aria-label="Open help chat"`
- Modal close buttons: `aria-label="Close"`

### Roving tabindex (`_wireTablist(container)`)
- Wired to all `[role="tablist"]` containers on DOMContentLoaded
- On `keydown ArrowRight/ArrowLeft/ArrowDown/ArrowUp`: moves focus to next/prev tab
- `Home` / `End`: focus first/last tab
- On focus: sets `tabindex=0` on focused tab, `tabindex=-1` on all others
- `_setTabSelected(tablist, tabEl)` updates `tabindex` values and `aria-selected`

### Focus management
- `focus-visible` CSS rule: `:focus-visible { outline: 2px solid var(--ca); outline-offset: 2px; }`
- Help chat: `setTimeout(() => document.getElementById('help-input')?.focus(), 320)` after open
- Modal overlays intercept clicks to close

### Skip link
- `<a href="#main-content" class="skip-link">Skip to main content</a>` at top of body
- Visible only on focus (CSS: `.skip-link { position: absolute; left: -9999px; ... } .skip-link:focus { left: 0; }`

### Reduced motion
- `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`

### `uiConfirm(message)` → Promise<boolean>
Custom confirm dialog replacing `window.confirm`:
- Creates overlay + dialog with message text
- "Confirm" button resolves `true`; "Cancel" button resolves `false`
- Classes: `.uiconfirm-overlay`, `.uiconfirm`

### Toast notifications (`showToast(message, duration=2500)`)
- Appends `.toast` div to body with message
- Adds `.show` class to trigger CSS transition (slide up + fade in)
- After `duration` ms: removes `.show`, then removes element after transition

### `escHtml(s)` / `escAttr(s)`
- `escHtml`: escapes `&`, `<`, `>`, `"`, `'` for safe HTML injection
- Used everywhere dynamic content is inserted into innerHTML

---

## 13. Settings (All Options)

### Game Defaults
- **Default Win Score:** chip row (11, 15, 21); saved to `K.settings.defaultWinScore`; applied as default selection in Setup screen
- **Sound Effects:** toggle; `K.settings.soundEnabled`
- **Vibration:** toggle; `K.settings.vibrationEnabled`

### Profile
- **Switch Profile:** shows list of profiles from `K.profiles`; selecting sets `currentProfile`
- **Create New Profile:** opens auth/setup flow

### Sync & Data
- **Export Data:** calls `exportData()` — creates JSON blob containing all localStorage keys, triggers download as `courtcall-backup-{date}.json`
- **Import Data:** file input for JSON; `importData(file)` — parses JSON, restores all keys
- **Clear All Data:** `clearAllData()` — confirm dialog → `localStorage.clear()` → reload
- **Load Demo Data:** `loadDemoData()` — populates 14 builder players, 5 match records, 1 tournament, 1 community with 5 members, 6 community players, 3 ratings, 3 posts, 2 gallery items, 2 events, 1 in-progress demo game
- **Clear Demo Data:** `clearDemoData()` — removes all items with `isDemo: true` or `demoBatchId === DEMO_BATCH_ID`

### Analytics
- Link to `s-analytics` screen showing usage stats

### Help
- **Help Center** → `showScreen('s-help-center')`
- **Ask CourtCall Assistant** → `openHelpChat()`

### About / Legal
- **App version** — displays `APP_VERSION` constant
- **What's New (Changelog)** → `openChangelog()` — opens modal with version history
- **Privacy Policy** → `showScreen('s-privacy')`
- **Terms of Service** → `showScreen('s-terms')`

### Feedback
- **Send Feedback** → `openFeedback()` — opens Feedback Modal
  - Type select: Bug Report, Suggest an Idea, General Feedback, Something is not working
  - Message textarea (maxlength=1000)
  - Name input (optional, maxlength=60)
  - "📧 Send via Email" → opens `mailto:vadi.s23@gmail.com?subject=...&body=...` with formatted content
  - "📋 Copy Feedback" → copies formatted text to clipboard via `navigator.clipboard`
  - "Cancel" → close

### Sign Out (if logged in via Supabase)
- Calls `supa.auth.signOut()`
- Clears `supaUser`
- Navigates to profile screen

---

## 14. CourtCall Assistant (Help Chat)

### Architecture
Rule-based keyword matching. NOT AI/LLM. Stated prominently in UI: "Beta Help · Keyword matching · Not AI".

### Knowledge base (`COURTCALL_HELP_KB`)
23 articles covering: Getting Started, Quick Game, Scoring, Fouls and Undo, Shot Clock, Game Clock, Voice Scoring, Team Builder, Player Ratings, Queue/Who Got Next, Match History, Tournament, Communities, Community Feed, Community Players, Community Gallery, Community Events, CourtCall Pulse, Basketball World, Settings, Backup/Export, Feedback, Troubleshooting.

Each article has: `id`, `title`, `category`, `keywords[]`, `shortAnswer`, `steps[]`, `relatedFeatures[]`.

### `answerCourtCallQuestion(query)` algorithm
1. Normalize query: lowercase, remove non-alphanumeric, collapse spaces
2. Split into words (filter <3 chars)
3. For each article: compute score
   - Full phrase match in query: `+= phrase.split(' ').length * 3`
   - Individual word match (exact, startsWith, or query word starts with keyword): `+= 1`
4. Best article = highest score
5. Confidence: score ≥ 6 → "high"; ≥ 2 → "medium"; < 2 → "low"
6. Return `{article, score, confidence}` (article = null if low confidence)

### Chat UI
- FAB button: `id=help-fab`, `class=help-fab`, `onclick=openHelpChat()`, label "💬 Help"
- Chat panel: `.help-chat-wrap` → `.help-chat-wrap.open` (CSS transition slides in from bottom)
- Header: 🏀 avatar, "CourtCall Assistant" title, "Beta Help · Keyword matching · Not AI" subtitle, Clear (↺) + Close (✕) buttons
- Messages area (`id=help-msgs`): user messages (`.help-msg.user`) + bot messages (`.help-msg.bot`)
- Suggestions area (`id=help-suggs`): 8 preset question buttons; hidden after first send
- Input row: text input (`id=help-input`, `onkeydown Enter → sendHelpMsg()`) + Send button (➤)

### Bot response format (HTML)
- Low confidence: fallback message suggesting email
- Medium confidence: italic prefix "I think this is what you're looking for…" + answer
- High confidence: direct answer
- Format: `<strong>title</strong>` + shortAnswer + `<ol class="help-msg-steps">` + related line
- Feedback row (if article found): "Was this helpful?" + 👍 Yes + 👎 No
- After feedback: "Glad that helped!" or email suggestion

### Persistence
- Last 20 messages saved to `HELP_CHAT_KEY` localStorage
- Last 50 feedback items saved to `HELP_FB_KEY`

### Preset suggestions (`_HSUGGS`)
1. "How do I start a quick game?"
2. "How does voice scoring work?"
3. "How do I add fouls?"
4. "How do I build balanced teams?"
5. "How do I create a tournament?"
6. "How do I create a community?"
7. "How do I upload pictures?"
8. "How do I export backup?"

---

## 15. 3D Basketball Renderer

### Location
Inline IIFE at end of `<script>` block. Targets `id=ball-canvas` (a `<canvas>` element on a specific screen, likely the hub or settings).

### Canvas setup
- Size: 260×260 logical pixels (DPR-scaled: `canvas.width = 260 * devicePixelRatio`)
- `ctx.scale(dpr, dpr)` for retina sharpness

### Two render paths

**Photo path (if `icons/basketball-3d.png` loads):**
- `_prepareBallTex(src)`:
  1. Draw cropped photo (4.5% border trim) to temp canvas
  2. Punch out near-white pixels (R>220, G>200, B>185 → α=0)
  3. Composite: fill orange base (#C84B00), draw photo on top (holes show orange)
- Scanline sphere projection: for each pixel column `px` in the sphere,
  - Compute normalized x (`nx = (px - cx) / r`)
  - Screen longitude `theta = asin(nx)`
  - Source longitude after rotation: `st = theta - angle`; wrap to `u = 0..1`
  - Sample texture column `srcX = u * TEX_SIZE`
  - Draw vertical strip with `ctx.drawImage(ballImg, srcX, 0, 1, texH, px, cy-halfH, 1, halfH*2)`
- Specular highlight: radial gradient white highlight (upper-left)
- Rim darkening: radial gradient dark at edge

**Fallback path (if texture not loaded):**
- Phong gradient ball: radial gradient `#FFAA5A → #E55500 → #BF4200 → #591400`
- 3D seam lines: 3 great circles (equatorial XZ, meridian YZ, meridian XY)
  - Pre-tilted 24° on X-axis: `applyTilt(x, y, z)` rotates around X
  - Y-rotated by `angle` per frame
  - Only draw seam segments with `z >= -0.06` (front-facing)
  - Seam line: dark brown stroke + lighter inner stroke
- Same specular + rim darkening overlays

### Animation loop
- `angle += speed` each frame (speed = 0.04 rad/frame)
- `requestAnimationFrame(loop)` continuous
- Drag interaction: `pointerdown/pointermove/pointerup` on canvas
  - `momentum = (offsetX - lastX) * 0.018`
  - On release: coast animation (`v *= 0.93` each frame until `|v| < 5e-4`)

### Spin button (id=`bd-btn`)
Click → random direction, random kick (`v = dir * (0.14 + random() * 0.18)`) → coast

### Dynamic effects (`_updateBDEffects()`)
- Computes `_dispSpd` (smoothed speed, 0–1)
- **Glow ring** (`id=bd-ring`): `box-shadow` radius and opacity scale with speed
- **Sweep ring** (`id=bd-sweep`): CSS animation duration shortens as speed increases (0.65s–3s range)
- **Arc fill** (`id=bd-arc-fill`): SVG `strokeDashoffset` from full (slow) to 0 (fast)
- **Arc pointer** (`id=bd-arc-ptr`): SVG triangle moves from lower-left (−130°) through top to lower-right (+130°) as speed increases
- **Sparks** (`id=bd-sparks`): when `_dispSpd > 0.55`, randomly spawn spark divs with `sparkFly` CSS animation; auto-removed after 700ms
- **Button glow**: `bd-btn.classList.toggle('spin', s > 0.18)`

---

## 16. Demo Data System

### `loadDemoData()`
Idempotent (checks `isDemoDataLoaded()` — returns true if any match has `demoBatchId === DEMO_BATCH_ID`).

Loads:
1. **14 builder players** with varied ratings (rating 8–9, attrs 3–5 each): Marcus T., Deja R., Zion K., Aaliyah B., Tyrese W., Simone F., Jalen C., Kamila V., Devon N., Priya S., Chase M., Nia H., Rahul D., Bex O. — adds to `K.players` AND `cc_builder` state.
2. **5 match records** with full history arrays, stats (duration, fouls, lead changes, runs), tournament linkage
3. **1 round-robin tournament** ("Summer Hoops Classic", 4 teams: Brawlers/Titans/Falcons/Warriors, 5/6 fixtures played)
4. **1 community** ("Westside Ballers", public, LA, 5 members)
5. **5 community members** (1 admin + 4 others with roles)
6. **6 community players** with stats and badges
7. **3 community ratings** (3 players rated)
8. **3 posts** (1 pinned, with reactions and comments)
9. **2 gallery items** (empty imageData, representative placeholder)
10. **2 events** (1 upcoming pickup, 1 upcoming tournament final, with RSVPs)
11. **1 in-progress demo game** (Brawlers 12–10 Titans, Q2, 24s shot clock) — only if no active game exists
12. **Analytics bootstrap** — only if no existing analytics: sets launch date, 47 visits, 12 games started, etc.

### `clearDemoData()`
Filters all localStorage arrays removing items where `isDemo === true` OR `demoBatchId === DEMO_BATCH_ID`.  
Also clears active game if it has `isDemo`.

---

## 17. Analytics Tracking

### `trackEvent(eventName)` 
Increments counters in `STATS_KEY` localStorage object.

**Event types tracked:**
- `app_opened` → `totalVisits++`, `lastVisitAt = now()`
- `game_started` → `gamesStarted++`
- `game_completed` → `gamesCompleted++`, `matchesSaved++`
- `player_added` → `playersAdded++`
- `tournament_created` → `tournamentsCreated++`
- `community_created` → `communitiesCreated++`
- `voice_command` → `voiceCommandsUsed++`
- Profile creation → `profilesCreated++`
- Guest session → `guestSessions++`

**`appLaunchDate`** set once on first `app_opened` if not already set.

---

## 18. "What's New" Toast and Changelog

### Version toast
On DOMContentLoaded:
```javascript
const seenVer = localStorage.getItem('cc_seen_version');
if (seenVer && seenVer !== APP_VERSION) {
  setTimeout(() => showToast(`Updated to ${APP_VERSION} — tap Settings › What's New`, 3500), 800);
}
if (!seenVer || seenVer !== APP_VERSION) {
  localStorage.setItem('cc_seen_version', APP_VERSION);
}
```

### Changelog Modal (id=`changelog-modal`)
- `openChangelog()` → removes `.hidden` from overlay + modal; populates `#changelog-body` with version history HTML
- `closeChangelog()` → adds `.hidden`
- Content: version-by-version bullet list of new features and fixes

---

## 19. Initialization Sequence (DOMContentLoaded)

```
1. trackEvent('app_opened')
2. initAttrGrid()           // wire team builder star grid
3. Load profile from K.profile
4. _initPinRow('pin-si'), _initPinRow('pin-cr'), _initPinRow('pin-cf')  // all PIN rows
5. If profile exists:
   a. currentProfile = saved profile
   b. Load game state; apply team colors
   c. applySetupColors()
   d. renderHub()
   e. syncCommunitiesFromDB() (async, non-blocking)
   f. Pre-fill email in sign-in input
   g. If hash route: _routeFromHash()
   h. Else: showScreen('profile')
6. If no profile:
   a. If hash is to a public screen: _routeFromHash()
   b. Else: showScreen('profile')
7. Apply saved settings (default win score chip)
8. Load builder state from 'cc_builder'
9. Wire ARIA tablist roving tabindex on:
   - .auth-tabs, #tc-tabs, #cd-tabs, #history-filter-bar, #tb-tabs-bar
10. Version toast check
```

---

## 20. Invite Friends (`inviteFriends()`)

1. Build URL = `window.location.href` without hash
2. If `navigator.share` available: use Web Share API with title/text/url
3. Else: render inline popup menu with:
   - "Share on WhatsApp" → `https://wa.me/?text={text+url}`
   - "Copy Link" → `navigator.clipboard.writeText(url)` + "Link copied!" toast
   - "Cancel"
4. Popup auto-dismisses on outside click

---

## 21. Feedback Modal (`id=feedback-modal`)

**`openFeedback()`** — removes `.hidden` from `#feedback-overlay` and `#feedback-modal`  
**`closeFeedback()`** — adds `.hidden`

**`sendFeedbackEmail()`:**
- Reads type, message, name
- Builds email body: type + message + name + app version
- Opens `mailto:vadi.s23@gmail.com?subject=CourtCall Feedback: [type]&body=[encoded]`
- Shows "Feedback sent via email app"

**`copyFeedback()`:**
- Copies formatted feedback text to clipboard
- Shows "Copied to clipboard!" toast
