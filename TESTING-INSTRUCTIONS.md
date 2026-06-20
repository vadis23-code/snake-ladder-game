# CourtCall — Complete Feature Testing Instructions for Claude Browser Extension

## How to Use These Instructions
1. Open **https://vadis23-code.github.io/snake-ladder-game/basketball.html** in one browser tab
2. Open **Claude.ai** (or the Claude browser extension) alongside it
3. Paste this entire document into Claude and say: **"Execute this test plan step by step"**
4. Claude will guide you through each test, tell you what to do in the app, what to check in Supabase, and record pass/fail

---

## Pre-Test Setup

### A. Open the Supabase Dashboard
- Go to: **https://supabase.com/dashboard/project/hoymciegbghfanzhnufy**
- Keep the **Table Editor** and **SQL Editor** open in separate tabs
- You will use the SQL Editor to verify data after each test

### B. Create a Test Account
In the CourtCall app:
1. Open the app → you will see the Profile / Sign In screen
2. Click **"Create Account"**
3. Use these test credentials:
   - **Name**: `Test Player`
   - **Email**: `testplayer@courtcall.test`
   - **PIN**: `1234`
4. Complete account creation

### C. Supabase Quick-Check Query
After each test, run this in the Supabase SQL Editor to see all test data:
```sql
-- Run after each test section to verify data
SELECT 'profiles' as tbl, count(*) from profiles
UNION ALL SELECT 'games', count(*) from games
UNION ALL SELECT 'communities', count(*) from communities
UNION ALL SELECT 'community_members', count(*) from community_members
UNION ALL SELECT 'community_posts', count(*) from community_posts
UNION ALL SELECT 'community_events', count(*) from community_events;
```

---

## TEST 1 — User Profile & Authentication

### Steps
1. Sign out (Settings → Sign Out)
2. Sign back in with `testplayer@courtcall.test` / PIN `1234`
3. Confirm you land on the Hub screen

### Database Check
```sql
SELECT id, name, nickname, games_played, created_at
FROM profiles
WHERE name = 'Test Player';
```

### Expected Result
- Row exists in `profiles` table
- `name = 'Test Player'`
- `games_played = 0` (or incremented if games were played)

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Sign in completes | Lands on Hub | | |
| Profile row in DB | Row exists | | |

---

## TEST 2 — Quick Game (Full Flow)

### Dummy Data to Create
Play a complete game with these details:
- **Game Type**: 3v3
- **Winning Score**: 21
- **Team A Name**: `Black Falcons`
- **Team B Name**: `White Hawks`

### Steps
1. From Hub → tap **"Start Quick Game"**
2. Set Game Type to **3v3**, Winning Score to **21**
3. Click **"Start Game"**
4. Score points:
   - Tap **+2** for Team A × 5 times (Team A = 10)
   - Tap **+3** for Team B × 3 times (Team B = 9)
   - Tap **+1** for Team A × 5 times (Team A = 15)
   - Tap **+2** for Team B × 3 times (Team B = 15)
   - Tap **+2** for Team A × 3 times (Team A = 21 → wins)
5. Confirm the **Post-Game screen** appears with winner
6. Tap **"Save & Exit"** (or equivalent)

### Database Check
```sql
SELECT id, team_a_name, team_b_name, score_a, score_b, winner,
       game_type, win_score, created_at
FROM games
ORDER BY created_at DESC
LIMIT 1;
```

### Expected Result
- New row in `games` table
- `score_a = 21`, `score_b` = 15
- `winner` = Team A name
- `game_type = '3v3'`
- `win_score = 21`

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Game screen loads | Score = 0:0 | | |
| Scoring works | Score increments correctly | | |
| Win detected | Post-game overlay appears | | |
| Saved to DB | Row in `games` table | | |

---

## TEST 3 — Undo Score

### Steps
1. Start a new game (any settings)
2. Tap **+2** for Team A (score = 2)
3. Tap **+3** for Team B (score = 3)
4. Tap **Undo** — confirm score goes back to 2:0
5. Tap **Undo** again — confirm back to 0:0

### Expected Result
- Undo correctly reverses the last scoring action
- Score display updates immediately

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| First undo | Score reverts to 2:0 | | |
| Second undo | Score reverts to 0:0 | | |

---

## TEST 4 — Foul Tracking

### Steps
1. In a live game, tap the **Foul A** button 3 times
2. Confirm the foul counter shows `F: 3` for Team A
3. Tap **Foul B** 5 times
4. Confirm Team B foul counter shows `F: 5`
5. Tap **Foul B** 5 more times (total 10)
6. Confirm warning state appears (red/danger styling)

### Expected Result
- Foul counts display correctly
- At 10 fouls the badge shows warning color

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Foul A × 3 | Badge shows F: 3 | | |
| Foul B × 10 | Warning color on badge | | |

---

## TEST 5 — Quarter / Period Tracking

### Steps
1. In a live game, tap the **Q1** chip in the nav bar
2. Confirm it advances to **Q2**
3. Tap again → **Q3**
4. Tap again → **Q4**
5. Tap again → **OT** (overtime)

### Expected Result
- Quarter advances through Q1 → Q2 → Q3 → Q4 → OT

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Q1 → Q2 | Chip label changes | | |
| Q4 → OT | Shows overtime label | | |

---

## TEST 6 — Shot Clock

### Steps
1. In a live game, find the **Shot Clock** display
2. Tap **▶** to start it
3. Confirm countdown runs (from 24s or configured time)
4. Tap **↺** to reset it
5. Confirm it resets to starting value

### Expected Result
- Shot clock counts down
- Reset works correctly

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Clock starts | Counts down | | |
| Clock resets | Returns to start value | | |

---

## TEST 7 — Team Builder

### Dummy Data to Create
Add these 6 players:

| Name | Rating |
|------|--------|
| Arjun | 5 |
| Jashwin | 4 |
| Vikram | 4 |
| Rohan | 3 |
| Manav | 3 |
| Priya | 2 |

### Steps
1. From bottom nav tap **Teams** → **Team Builder** tab
2. For each player: type name, set rating (1–5 dots), tap **Add Player**
3. After all 6 added, tap **Generate Teams** (Balanced)
4. Confirm two teams are shown with roughly balanced ratings
5. Tap **Randomize** — confirm teams shuffle

### Expected Result
- All 6 players appear in the roster
- Generated teams show player names split across Team A / Team B
- Total rating difference between teams ≤ 2

### Database Check
```sql
-- Players are stored locally (localStorage), not in Supabase
-- Verify in DevTools: Application → Local Storage → key starting with 'courtcall'
```

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| 6 players added | Roster shows all 6 | | |
| Generate Teams | Two balanced teams shown | | |
| Randomize | Teams change | | |

---

## TEST 8 — Game with Named Teams from Builder

### Steps
1. After generating teams in Team Builder, tap **"Use These Teams"** (or equivalent)
2. Confirm the game setup pre-fills Team A / Team B with the generated names
3. Start the game and confirm score displays use the custom team names

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Teams carry over | Custom names in scoreboard | | |

---

## TEST 9 — Match History

### Steps
1. Play 2 quick games end-to-end (any scores, save both)
2. Go to **History** screen (bottom nav)
3. Confirm both saved games appear as cards
4. Tap a game card — confirm detail view shows score, winner, game type, date

### Database Check
```sql
SELECT id, team_a_name, team_b_name, score_a, score_b, winner, game_type, created_at
FROM games
ORDER BY created_at DESC
LIMIT 5;
```

### Expected Result
- At least 2 game rows in `games` table
- History screen shows correct scores and winner names

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Games saved | 2+ rows in `games` table | | |
| History screen | Both games visible | | |
| Game detail | Correct score shown | | |

---

## TEST 10 — Tournament

### Dummy Data to Create
- **Tournament Name**: `Summer Hoops 2026`
- **Format**: Knockout
- **Teams**: `Black Falcons`, `White Hawks`, `Blue Thunder`, `Red Storm`

### Steps
1. From bottom nav → **More** → **Tournaments**
2. Tap **Create Tournament**
3. Enter name: `Summer Hoops 2026`, select Knockout, add 4 teams
4. Tap **Generate Fixtures**
5. Confirm bracket shows 2 semi-final matches
6. Enter a result: set `Black Falcons 21 – 14 White Hawks`
7. Confirm bracket advances `Black Falcons` to the final

### Database Check
```sql
-- Tournaments are stored in localStorage
-- Check DevTools: Application → Local Storage → search 'tournament'
```

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Tournament created | Name appears in list | | |
| Fixtures generated | 4-team bracket shown | | |
| Result entered | Winner advances in bracket | | |

---

## TEST 11 — Community: Create

### Dummy Data to Create
- **Name**: `CourtCall QA Crew`
- **Type**: Pickup Group
- **Description**: `Testing community for QA`
- **Visibility**: Public
- **Location**: `Chennai, India`

### Steps
1. Bottom nav → **More** → **Communities**
2. Tap **+ Create Community**
3. Fill in all fields above
4. Tap **Create**
5. Confirm community appears in the list with the correct name and emoji

### Database Check
```sql
SELECT id, name, description, type, visibility, location, created_at
FROM communities
WHERE name = 'CourtCall QA Crew';
```

### Expected Result
- Row exists in `communities` table
- All fields match what was entered

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Community created | Appears in list | | |
| Row in DB | `communities` table has row | | |
| Fields correct | Name, type, location match | | |

---

## TEST 12 — Community: Post

### Dummy Data to Create
Create 3 posts:
1. **Type**: General Post — `"First QA post — testing feed persistence"`
2. **Type**: Match Result — `"QA game done: Black 21 – White 14"`
3. **Type**: Announcement — `"Community is live and tested!"`

### Steps
1. Open `CourtCall QA Crew` community
2. Tap **+ New Post** for each post type above
3. Confirm all 3 posts appear in the Feed tab

### Database Check
```sql
SELECT id, author_name, type, content, created_at
FROM community_posts
WHERE community_id IN (
  SELECT id FROM communities WHERE name = 'CourtCall QA Crew'
)
ORDER BY created_at DESC;
```

### Expected Result
- 3 rows in `community_posts`
- Each has correct `type` and `content`

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| General Post saved | Appears in feed + DB | | |
| Match Result saved | Appears in feed + DB | | |
| Announcement saved | Appears in feed + DB | | |

---

## TEST 13 — Community: Reactions & Comments

### Steps
1. In the community feed, tap the 👍 reaction on Post 1
2. Confirm reaction count increments to 1
3. Tap the 🔥 reaction on Post 2
4. Open Post 1 → add comment: `"Great test post!"`
5. Confirm comment appears below the post

### Database Check
```sql
SELECT id, content, reactions, comments
FROM community_posts
WHERE community_id IN (
  SELECT id FROM communities WHERE name = 'CourtCall QA Crew'
);
```

### Expected Result
- `reactions` JSONB column updated with count > 0
- `comments` JSONB array has 1 entry

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Reaction added | Count shows 1 | | |
| Comment added | Comment visible in feed | | |
| DB updated | `reactions` + `comments` in DB | | |

---

## TEST 14 — Community: Event

### Dummy Data to Create
- **Title**: `QA Pickup Run`
- **Date**: Next Saturday (enter manually)
- **Location**: `Court 2, Marina Beach`
- **Description**: `Test event for QA validation`

### Steps
1. In the community → **Events** tab
2. Tap **+ Add Event**
3. Fill in all fields above
4. Save the event
5. Confirm it appears in the Events tab

### Database Check
```sql
SELECT id, title, event_date, location, description, created_at
FROM community_events
WHERE community_id IN (
  SELECT id FROM communities WHERE name = 'CourtCall QA Crew'
);
```

### Expected Result
- Row in `community_events` with correct title and location

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Event created | Appears in Events tab | | |
| Row in DB | `community_events` has row | | |

---

## TEST 15 — Community: Members & Leaderboard

### Steps
1. In the community → **Members** tab
2. Confirm your profile appears as **Admin**
3. Go to **Leaderboard** tab
4. Confirm your name appears with game stats

### Database Check
```sql
SELECT cm.user_id, cm.role, cm.profile_name, cm.joined_at
FROM community_members cm
JOIN communities c ON c.id = cm.community_id
WHERE c.name = 'CourtCall QA Crew';
```

### Expected Result
- 1 row in `community_members` with `role = 'admin'`

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Members tab | Your name shown as Admin | | |
| Leaderboard | Stats visible | | |
| DB check | Member row exists | | |

---

## TEST 16 — Tip-Off Decider (Basketball Widget)

### Steps
1. On the Hub screen, locate the **DRAG & SPIN** basketball widget
2. Drag the ball left/right — confirm it spins faster
3. Tap the **DRAG & SPIN** button — confirm the ball gets a random kick
4. Observe:
   - Orange glow ring intensity changes with spin speed
   - Speed arc pointer moves (SLOW → FAST)
   - Sweep animation speeds up at high spin
5. Let the ball slow down — confirm arc pointer returns to SLOW side

### Expected Result
- Ball rotates continuously
- All visual effects respond to spin speed
- No console errors (`F12` → Console tab)

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Drag spins ball | Ball rotates faster | | |
| DRAG & SPIN btn | Ball kicks randomly | | |
| Glow scales | Orange ring brighter at speed | | |
| Arc pointer | Moves SLOW→FAST with speed | | |
| Slows down | Returns to idle state | | |

---

## TEST 17 — Settings

### Steps
1. Open **Settings** screen (bottom nav → More → Settings)
2. Change **Default Winning Score** to `15`
3. Toggle **Win by 2** ON (if available)
4. Start a new game — confirm winning score defaults to 15
5. Back in Settings → tap **Export Data**
6. Confirm a JSON file downloads (or data is shown)

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Win score saved | New game defaults to 15 | | |
| Export works | JSON data downloaded | | |

---

## TEST 18 — Offline Mode

### Steps
1. Open browser DevTools (`F12`) → **Network** tab
2. Set throttling to **Offline**
3. Refresh the app — confirm it still loads from cache
4. Navigate to History — confirm saved games still show
5. Start and complete a quick game — confirm it saves locally
6. Turn network back **Online**
7. Confirm offline banner disappears and data syncs

### Expected Result
- App loads offline
- Red offline banner appears at top when disconnected
- Banner disappears when reconnected

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| App loads offline | Loads from SW cache | | |
| Offline banner shown | Red bar at top | | |
| Local save works | Game saved to localStorage | | |
| Back online | Banner disappears | | |

---

## TEST 19 — Voice Scoring (if microphone available)

### Steps
1. In a live game, tap the **🎤 Mic** button in controls bar
2. Say: `"Orange two"` — confirm Team A gets +2
3. Say: `"Blue three"` — confirm Team B gets +3
4. Say: `"Undo"` — confirm last action reverses
5. Type `"Score check"` in the voice test input and tap →
6. Confirm the app reads back current score

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Mic activates | Listening indicator shown | | |
| "Orange two" | +2 added to Team A | | |
| "Undo" | Score reversed | | |
| "Score check" | Score read back | | |

---

## TEST 20 — PWA Install

### Steps
1. Look for the **"Add CourtCall to your home screen"** install banner
2. If it appears, tap **Install**
3. Confirm app installs to home screen / desktop
4. Open from home screen — confirm it loads without browser UI

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Install prompt appears | Banner shown | | |
| Install completes | Icon on home screen | | |
| Standalone mode | Opens without browser chrome | | |

---

## TEST 21 — Navigation & Routing

### Steps
1. From Hub, use each bottom nav tab: Game, Teams, History, More
2. Open More sheet — use each option: Tournament, Communities, Settings, Analytics
3. Go back using browser **Back** button — confirm it navigates correctly
4. Manually add `#game` to the URL — confirm app routes to game screen
5. Refresh the page — confirm it returns to Hub (not broken state)

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| All nav tabs work | Each screen loads | | |
| More sheet options | All navigate correctly | | |
| Browser back button | Returns to previous screen | | |
| Hash routing | `#game` loads game screen | | |
| Refresh | Returns to Hub | | |

---

## TEST 22 — Analytics Screen

### Steps
1. After playing 2+ games, open **Analytics** (More → Analytics)
2. Confirm stats are shown:
   - Total games played
   - Win rate
   - Most common game type
   - Average score

### Report
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Analytics loads | No blank/error screen | | |
| Stats shown | Numbers reflect played games | | |

---

## Final Master Database Verification

Run this query in Supabase SQL Editor at the end of all tests:

```sql
-- Full QA data audit
SELECT 'profiles' as table_name, id::text, name as label, created_at
FROM profiles WHERE name = 'Test Player'

UNION ALL

SELECT 'games', id, concat(team_a_name, ' vs ', team_b_name, ' — ', score_a, ':', score_b), created_at
FROM games ORDER BY created_at DESC LIMIT 3

UNION ALL

SELECT 'communities', id, name, created_at
FROM communities WHERE name = 'CourtCall QA Crew'

UNION ALL

SELECT 'community_members', user_id::text, role, joined_at
FROM community_members WHERE community_id IN (
  SELECT id FROM communities WHERE name = 'CourtCall QA Crew'
)

UNION ALL

SELECT 'community_posts', id, left(content, 60), created_at
FROM community_posts WHERE community_id IN (
  SELECT id FROM communities WHERE name = 'CourtCall QA Crew'
)

UNION ALL

SELECT 'community_events', id, title, created_at
FROM community_events WHERE community_id IN (
  SELECT id FROM communities WHERE name = 'CourtCall QA Crew'
);
```

---

## Final Report Template

After completing all 22 tests, fill in and return this summary:

```
# CourtCall QA Test Report
Date: ___________
Tester: Claude Browser Extension
App URL: https://vadis23-code.github.io/snake-ladder-game/basketball.html
Supabase Project: hoymciegbghfanzhnufy

## Results Summary
| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | User Auth / Profile | ✅ PASS / ❌ FAIL | |
| 2 | Quick Game Full Flow | ✅ / ❌ | |
| 3 | Undo Score | ✅ / ❌ | |
| 4 | Foul Tracking | ✅ / ❌ | |
| 5 | Quarter Tracking | ✅ / ❌ | |
| 6 | Shot Clock | ✅ / ❌ | |
| 7 | Team Builder | ✅ / ❌ | |
| 8 | Teams → Game | ✅ / ❌ | |
| 9 | Match History | ✅ / ❌ | |
| 10 | Tournament | ✅ / ❌ | |
| 11 | Community Create | ✅ / ❌ | |
| 12 | Community Posts | ✅ / ❌ | |
| 13 | Reactions & Comments | ✅ / ❌ | |
| 14 | Community Events | ✅ / ❌ | |
| 15 | Members & Leaderboard | ✅ / ❌ | |
| 16 | Tip-Off Decider | ✅ / ❌ | |
| 17 | Settings | ✅ / ❌ | |
| 18 | Offline Mode | ✅ / ❌ | |
| 19 | Voice Scoring | ✅ / ❌ | |
| 20 | PWA Install | ✅ / ❌ | |
| 21 | Navigation & Routing | ✅ / ❌ | |
| 22 | Analytics | ✅ / ❌ | |

## Database Row Counts (from final audit query)
- profiles: ___
- games: ___
- communities: ___
- community_members: ___
- community_posts: ___
- community_events: ___

## Bugs Found
1. ___
2. ___

## Overall Score: ___ / 22 passed
```
