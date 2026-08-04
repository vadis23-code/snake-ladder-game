# CourtCall — Master Higgsfield + Codex Implementation Prompt

## Role

Act as a world-class digital product team combining:

- Award-winning creative director
- Basketball brand designer
- Senior sports-product UX designer
- Higgsfield / Seedance cinematic director
- Motion and interaction designer
- Accessibility specialist
- Performance engineer
- Senior vanilla JavaScript architect
- Supabase and offline-first PWA engineer
- QA lead

Your task is to rebuild and elevate **CourtCall** into an award-winning cinematic basketball website and fully functional pickup-basketball PWA.

The result must combine:

- A cinematic, scroll-driven public website
- A fast, reliable, one-handed basketball scoring application
- Team building and “Who Got Next” queue management
- Match history and player statistics
- Round-robin and knockout tournament management
- Basketball communities, events, posts, galleries, ratings and leaderboards
- Supabase authentication and cloud sync
- Offline-first local storage
- PWA installation
- Voice scoring
- Strong accessibility and mobile performance

The experience should feel like:

**NBA courtside energy × a premium sports operating system × a cinematic basketball campaign × an Awwwards-level interactive website.**

Do not copy any existing brand or product interface. Use premium sports products only as quality references.

---

# 1. Source of Truth and Precedence

Read the complete attached file:

`COURTCALL_SPEC.md`

Read it from beginning to end before editing code.

Treat the specification as a binding **feature, data and technical contract**.

The priority order is:

1. `COURTCALL_SPEC.md` technical and functional requirements
2. Existing working application behaviour and data compatibility
3. This prompt’s cinematic, visual and UX direction
4. New enhancements that do not conflict with items 1–3

When there is a conflict, the specification wins, **except for the explicit removal below**.

## Explicit project override — remove the standalone Canvas basketball

The standalone interactive Canvas basketball widget described in
`COURTCALL_SPEC.md` is intentionally excluded from this build.

This is the only deliberate override to the specification.

Therefore:

- Do not preserve, rebuild or reintroduce the standalone interactive basketball widget.
- Remove its HTML, CSS, JavaScript render loop, pointer handlers, touch handlers, inertia logic, spark effects and route lifecycle code if they exist.
- Remove references to `icons/basketball-3d.png` when they are used only by that widget.
- After removal, verify that no orphaned event listeners, animation frames, timers, asset requests or DOM references remain.
- Do not replace the removed widget with Three.js, WebGL or another interactive 3D-ball component.
- Canvas may still be used internally for the cinematic landing-page scroll sequence, frame rendering, lightweight particles or other non-widget effects.
- All other requirements in `COURTCALL_SPEC.md` remain binding.

Do not silently:

- Rename screen IDs
- Rename JavaScript functions
- Rename CSS hooks required by the specification
- Change localStorage key strings
- Change Supabase tables, columns or RLS behaviour
- Change authentication behaviour
- Change voice-command grammar
- Change game logic
- Remove guest mode
- Remove offline behaviour
- Remove or simplify community permissions
- Replace hash routing
- Introduce a build system or framework

Do not “clean up” legacy naming inconsistencies if other code depends on them.

Before writing code, produce a **specification compliance matrix** with:

- Requirement
- Relevant section of `COURTCALL_SPEC.md`
- Existing implementation location
- Status: working / incomplete / missing / uncertain
- Planned change
- Regression risk
- Test method

Do not begin a full redesign until this audit is complete.

---

# 2. Product Definition

CourtCall is a pickup-basketball scoring and community application.

Core positioning:

> **The pickup game operating system.**

Primary tagline:

> **Basketball pickup game scorer — score, build teams, run tournaments.**

Primary marketing message:

> **CALL THE SCORE.  
> RUN THE COURT.**

Supporting message:

> Score pickup games, build balanced teams, manage who has next, run tournaments and keep your basketball community together.

Primary call to action:

> **START A GAME**

Secondary call to action:

> **EXPLORE COURTCALL**

Final campaign message:

> **YOUR COURT.  
> YOUR CREW.  
> YOUR CALL.**

Emotional progression:

1. Anticipation before tip-off
2. Control during setup
3. Speed and momentum during play
4. Pressure during the final possession
5. Celebration after the win
6. Belonging through teams and communities

The public website should create desire.

The app should remove friction.

---

# 3. Target User and Human-Centred Rules

The primary user is a pickup basketball player checking a phone between runs.

Assume the user may be:

- Sweaty
- Distracted
- Standing outdoors
- Holding the phone in one hand
- Using a mid-range Android phone
- On an unreliable network
- Trying to correct an accidental score immediately

Non-negotiable interaction rules:

- Every tap must feel visually responsive in under 100ms.
- Use optimistic UI before Supabase network completion.
- Critical controls must be reachable by the thumb on a 390px-wide screen.
- Score, foul, timeout and undo controls must not require precise tapping.
- Undo must always remain visible during a game.
- Never create a dead end.
- Never make the user wait for an animation.
- Never require an internet connection to continue a game.
- Empty states must provide context and a meaningful action.
- Do not use “No data found” as the primary empty-state treatment.
- Gracefully hide optional intelligence features when data is insufficient.
- Preserve keyboard, screen-reader and reduced-motion access.

---

# 4. Non-Negotiable Technical Architecture

Preserve the architecture specified in `COURTCALL_SPEC.md`.

## Main application

- Main file: `basketball.html`
- One HTML file containing all application markup, CSS and JavaScript
- CSS inline
- JavaScript inline
- Plain ES2020 JavaScript
- No React
- No Vue
- No Angular
- No Svelte
- No Alpine
- No TypeScript
- No bundler
- No build step
- No external JavaScript library except the permitted Supabase CDN script
- Google Fonts may be loaded as allowed by the specification
- Static hosting compatible with GitHub Pages
- Hash-based routing
- Supabase for auth and sync
- localStorage as the primary offline-first data store
- Web Speech API for voice scoring

## Required supporting files

Preserve and complete:

- `basketball-sw.js`
- `basketball.manifest.json`
- `icons/icon.svg`
- Optimised cinematic media assets, if generated

The single-HTML restriction applies to application code. Generated images and videos may be stored as static assets, provided the app still functions when those assets fail.

## Important reconciliation

Do not import Lenis, GSAP, Three.js or another animation library.

Create the 3D-scroll experience using:

- Native scroll events
- `requestAnimationFrame`
- Canvas 2D only where useful for cinematic frame rendering or lightweight effects
- CSS transforms
- CSS sticky positioning
- Native video `currentTime` control or an image-frame sequence
- IntersectionObserver for loading and section activation

Do not violate the no-external-JavaScript rule in pursuit of cinematic effects.

---

# 5. Exact Data Compatibility

Use every data model from `COURTCALL_SPEC.md` exactly.

## localStorage

Preserve all existing keys and strings, including:

```javascript
const K = {
  profile: 'cc_profile',
  profiles: 'cc_profiles',
  players: 'cc_players',
  builder: 'cc_builder',
  matches: 'cc_matches',
  tournaments: 'cc_tournaments',
  settings: 'cc_settings',
  game: 'courtcall_v1',
  games: 'courtcall_games'
};

const STATS_KEY = 'courtcall_app_stats';
const OB_KEY = 'courtcall_onboarding_seen';

const KC = {
  communities: 'courtcall_communities',
  members: 'courtcall_community_members',
  joins: 'courtcall_community_joins',
  posts: 'courtcall_community_posts',
  players: 'courtcall_community_players',
  gallery: 'courtcall_community_gallery',
  events: 'courtcall_community_events',
  ratings: 'courtcall_community_ratings'
};

const K_PULSE = 'pickup_app_pulse_location';
const HELP_CHAT_KEY = 'courtcall_help_chat_history';
const HELP_FB_KEY = 'courtcall_help_feedback';
```

Do not change key strings, even if another naming convention appears cleaner.

Use defensive JSON helpers so corrupt local data does not crash the app.

Preserve:

- `getObj`
- `setObj`
- `getCol`
- `setCol`
- Existing migration or legacy support

## Supabase

Read Section 10 of `COURTCALL_SPEC.md` and create an exact mapping table before coding.

For each Supabase function, document:

- Function name
- Table name
- Operation
- Exact columns read
- Exact columns written
- Local model mapping
- Auth requirement
- Error behaviour
- Merge precedence
- RLS assumption

Do not change:

- Table names
- Column names
- Relationship assumptions
- User ownership rules
- Admin/member access rules
- RLS policies
- Existing upsert keys

Preserve local-first behaviour:

1. Update local state immediately.
2. Re-render immediately.
3. Attempt Supabase write in the background.
4. Show a non-blocking sync failure state if the write fails.
5. Never discard the local action because the network failed.
6. Merge cloud data according to the exact precedence rules in the specification.

PIN must never be stored in plaintext.

---

# 6. Required Screens and Navigation

Preserve every screen, route, ID, role and navigation flow in the specification.

Required product areas include:

- Landing
- Authentication and onboarding
- Profile
- Hub
- Game setup
- Live game
- Team Builder
- Match history
- Tournament hub
- Tournament detail
- Communities list
- Create community
- Community detail
- Settings
- Analytics
- CourtCall Pulse
- Basketball World
- Help Center
- CourtCall Assistant
- Privacy
- Terms
- Reset PIN
- Feedback
- Changelog
- PWA install prompt
- Offline status

Preserve the bottom navigation:

1. Home
2. Game
3. Teams
4. History
5. More

Preserve the More sheet entries and actions from the specification.

Preserve hash routing and `_PUBLIC_SCREENS`.

Do not normalize route or element names that are used by existing code.

The public landing page must remain part of the same single-page application.

The `START A GAME` CTA must transition into the correct CourtCall setup or authentication flow without a full-page reload.

---

# 7. Overall Creative Direction

Creative concept:

# MIDNIGHT ARENA OS

CourtCall should feel like a premium courtside control system inside a basketball arena at midnight.

## Visual language

Background:

- Near-black arena interior
- Graphite and midnight-blue surfaces
- Subtle polished-court reflections
- Faint court-line geometry
- Controlled atmospheric haze
- Deep seating silhouettes
- Sparse film grain

Team energy:

- Team A: orange stadium lighting
- Team B: blue away-team floodlighting
- Champion moments: restrained gold
- Fouls and urgent warnings: red
- Confirmed and synced states: green

Depth:

- Frosted glass only on overlapping surfaces
- Three-layer shadows: ambient, directional and colour glow
- Fine illuminated borders
- Limited shimmer on premium moments
- Clear foreground/background separation

Do not create a generic neon dashboard.

Do not apply glow to every object.

The strongest light treatment should be reserved for:

- Current leader
- Active score button
- Hot hand
- Critical shot clock
- Game winner
- Tournament champion
- Primary CTA

## Typography

Use:

- Bebas Neue or a technically compatible condensed display font for scores, team names, section titles, wins and CTAs
- Inter for product UI, labels, forms, help content and communities
- Tabular numerals for clocks, scores, ratings and standings

A game score should feel like a stadium billboard.

Functional text must remain readable outdoors.

---

# 8. Cinematic 3D-Scroll Public Website

The public landing page is the cinematic campaign layer.

The authenticated live application is the performance layer.

Do not run the full cinematic render loop after the user enters the app.

Scrolling down should feel like playing one complete game.

## Core journey

1. Empty Court
2. Tip-Off
3. The Run
4. Clutch Moment
5. Victory and Community

## Higgsfield / Seedance settings

Use the best available Higgsfield-supported Seedance model.

Preferred initial settings:

- Standard generation mode
- 1080p
- 16:9 desktop master
- No generated audio
- Approximately 8–10 seconds per clip
- Controlled realistic camera movement
- Realistic materials and basketball physics
- Two hero takes, not unlimited variations

Generate mobile-safe crops or alternate frames after the desktop sequence is approved.

Do not render text, product UI or brand logos inside generated video.

All copy and UI must be real HTML.

## Master reference image

Generate one definitive image first:

> A realistic premium orange composite-leather basketball resting exactly on the centre-circle line of a dark indoor basketball arena at midnight. The arena is mostly empty. Warm orange stadium lights illuminate the left half of the court. Cool electric-blue floodlights illuminate the right half. The polished maple floor reflects both colours. Deep black seating fades into the background. Subtle atmospheric haze catches the light. The basketball has realistic leather texture, deep black seams and a soft rim light. Extremely low courtside camera. Symmetrical composition. Premium sports-commercial cinematography. No players. No foreground crowd. No text. No letters. No logos. No watermark.

Generate two or three versions.

Choose the version with:

- Most realistic basketball
- Strongest centre composition
- Best court geometry
- Best orange/blue balance
- Cleanest space for HTML copy
- Most consistent lighting

Use that same reference for all clips.

Consistency is more important than individual clip spectacle.

## Continuous-shot workflow

Generate clips in order.

For each clip:

1. Export the final frame.
2. Use it as the next clip’s starting image.
3. Preserve camera direction.
4. Preserve court lines.
5. Preserve ball texture and scale.
6. Preserve architecture.
7. Preserve light direction.
8. Preserve motion continuity.
9. Preserve player wardrobe and silhouette where applicable.

No visible jump should occur between clips.

## Clip 1 — Empty Court

Purpose: anticipation.

Visual:

- Arena begins almost dark
- Ball rests at centre court
- Low camera pushes forward
- Orange lights ignite left
- Blue lights ignite right
- Court reflection appears
- Ball rolls only a few centimetres
- Far hoop becomes visible
- End with the ball centred

Pinned website content:

Eyebrow:
`THE PICKUP GAME OPERATING SYSTEM`

Headline:
`CALL THE SCORE.`
`RUN THE COURT.`

Supporting copy:
`Score pickup games, build balanced teams, manage who has next, run tournaments and keep your basketball community together.`

Actions:

- `START A GAME`
- `EXPLORE COURTCALL`

## Clip 2 — Tip-Off

Purpose: build the game.

Visual:

- Continue from Clip 1
- Camera moves past the ball
- Ball rises for tip-off
- Two non-identifiable athlete silhouettes enter
- Orange rim light on one side
- Blue rim light on the other
- Athletes jump
- Camera passes beneath the ball
- End looking upward at the centred ball

Pinned content:

`BUILD THE GAME`

Callouts:

- 3v3, 4v4, 5v5 or custom
- 1s and 2s or 2s and 3s
- Win by two
- Shot clock and game clock
- Team colours
- Player assignments

## Clip 3 — The Run

Purpose: live scoring and momentum.

Visual:

- Ball drops into the attacking player’s hands
- Low tracking camera follows the dribble
- Realistic ball compression and shoe movement
- Defender closes
- Fast break continues
- Controlled motion blur
- Ball remains sharp
- End as shooter gathers near the three-point line

Pinned content:

`SCORE IN THE MOMENT`

Feature callouts:

- Instant score controls
- Fouls
- Timeouts
- Possession
- One-tap undo
- Shot clock
- Game timer
- Voice scoring
- Offline-first operation

Fixed animated HUD:

- Quarter
- Game clock
- Score
- Possession
- Shot clock
- Pace
- Momentum

Use believable scroll-linked score progression.

## Clip 4 — Clutch Moment

Purpose: pressure and game intelligence.

Visual:

- Player plants behind the arc
- Defender closes
- Shooter rises
- Controlled orbit around shooter
- Ball leaves fingertips
- Camera follows flight
- Arena darkens
- Hoop remains illuminated
- End with ball just above the rim

Pinned content:

`EVERY POSSESSION MATTERS`

Game intelligence:

- Hot Hand
- Current run
- Game pace
- Comeback alert
- Score projection
- Win probability
- Foul-limit warning
- Voice score check

These are deterministic insights, not AI predictions.

Suggested messages:

- `THREE STRAIGHT. HOT HAND.`
- `DOWN FIVE. BACK TO EVEN.`
- `GAME POINT.`
- `ONE POSSESSION.`

## Clip 5 — Victory and Community

Purpose: payoff and belonging.

Visual:

- Ball drops through the hoop
- Net snaps
- Orange and blue light burst
- Camera travels through the hoop
- Players celebrate
- Restrained confetti grows
- Ball returns toward centre court
- More player silhouettes gather
- End on centred ball with subtle gold champion light

Pinned content:

`RUN THE TOURNAMENT`

- Round robin
- Knockout
- Standings
- Automatic bracket progression
- Champion reveal

Then:

`BUILD THE COMMUNITY`

- Feed
- Player profiles
- Ratings
- Events
- RSVPs
- Gallery
- Leaderboards
- Local basketball discovery

Final message:

`YOUR COURT. YOUR CREW. YOUR CALL.`

Actions:

- `START PLAYING`
- `CREATE YOUR COMMUNITY`

---

# 9. Scroll-Scrub Implementation

Implement the journey without external animation libraries.

Use the best reliable option after measuring performance:

Option A:
- One compressed video
- Map scroll progress to `video.currentTime`
- Draw video to Canvas when required

Option B:
- Extracted image frames
- Canvas image sequence
- Adaptive frame count by device capability

Option C:
- Hybrid: poster/stills on mobile and video scrub on desktop

Technical behaviour:

- Use `requestAnimationFrame` to interpolate target and rendered progress.
- Do not update the DOM on every raw scroll event.
- Use passive scroll listeners.
- Use sticky sections for pinned storytelling.
- Use IntersectionObserver to preload only the next sequence.
- Pause work when the landing screen is not active.
- Cancel animation loops on route change.
- Release large media references where possible.
- Scrolling upward must reverse smoothly.
- Do not hijack the wheel or prevent default scrolling.
- Preserve browser navigation.
- Keep CTA buttons clickable throughout.

Fallbacks:

- Poster image before load
- Five approved still frames for reduced motion
- Static gradient and product screenshots if video fails
- Lower frame density for slower devices
- No cinematic media requirement for app functionality

The page must remain usable before cinematic media finishes loading.

---

# 10. Public Website Structure

Build the landing page in this order:

1. Cinematic hero
2. Everything You Need to Run the Game
3. Build the Game
4. Score in the Moment
5. Build Fair Teams
6. Who Got Next
7. Every Possession Matters
8. Run the Tournament
9. Build the Community
10. Built for the Court
11. Final CTA
12. Footer

## Hero

Headline:
`CALL THE SCORE. RUN THE COURT.`

CTA:
`START A GAME`

Secondary:
`EXPLORE COURTCALL`

Include a live-looking scoreboard HUD, but do not fake unsupported product capabilities.

## Feature grid

Feature cards:

- Live Scoreboard
- Balanced Teams
- Who Got Next
- Tournaments
- Communities
- Voice Scoring

Each card should link to a real product area or real landing-page section.

## Product demonstrations

Use screenshots or live, safe, non-destructive previews of the actual implemented application.

Do not present invented features as complete.

## Built for the Court

Communicate:

- Offline-first
- Installable PWA
- One-handed controls
- Fast local response
- Voice scoring
- Export and restore
- Cloud sync when signed in
- Guest mode

## Footer

Include:

- Features
- Communities
- Tournaments
- Help
- Privacy
- Terms
- Feedback
- Contact: `vadi.s23@gmail.com`

---

# 11. Authentication and Profile

Preserve the complete sign-in, create-account, reset-PIN and guest flows.

Requirements include:

- Email + PIN authentication through Supabase
- Six PIN boxes
- Numeric keyboard
- Paste distribution
- Auto-advance
- Backspace navigation
- Show/hide toggle
- Inline errors
- Sign In and Create Account tabs
- Terms and Privacy links
- Returning-user email prefill
- Guest mode with no Supabase calls
- Reset PIN with confirmation
- No plaintext PIN storage

Design:

- Dark cinematic static background or poster crop
- Compact high-contrast auth card
- Clear guest explanation:
  `Continue locally without cloud sync.`
- Large thumb-friendly submit controls
- No autoplay sound

Preserve ARIA tablist and focus behaviour.

---

# 12. Hub

The Hub must answer:

1. Is a game in progress?
2. What is the next best action?
3. What has happened recently?

Hierarchy:

- Greeting and profile avatar
- Resume Game, when applicable
- Start Quick Game as the strongest action
- Weekly streak message
- Quick actions
- Career snapshot
- Recent activity where data exists

Suggested streak copy:

- `Three games this week. Keep the run alive.`
- `The court has been quiet. Start the next one.`
- `Four straight days on CourtCall 🔥`

Hide streak content when it cannot be calculated.

---

# 13. Game Setup

Preserve every setup field and default from the specification:

- Game type
- Team names
- Team colours
- Win score
- Scoring rules
- Free throws
- Shot clock
- Shot clock auto-reset
- Game clock
- Win by two
- Timeouts
- Player assignment
- Start Game

Design setup as grouped decisions, not one visually exhausting form.

Provide:

- Large chips
- Immediate selected states
- Team-colour preview
- Compact rule summary
- Conditional custom inputs
- Sticky or thumb-zone Start Game action where safe

Do not alter `freshState()` compatibility.

---

# 14. Live Game — Highest Priority Screen

Build and test the live scoreboard before polishing secondary screens.

Use a split-arena layout:

- Team A owns the left field
- Team B owns the right field
- Centre rail contains game state
- Bottom zone contains undo, voice and critical controls

Each side includes:

- Editable team name
- Giant score
- Score buttons
- Fouls
- Timeout when configured
- Possession indication

Centre includes:

- Quarter
- Shot clock
- Game clock
- Possession
- Pace
- Optional intelligence strip

## Score interaction

On score tap:

1. Update local state immediately.
2. Render the new number immediately.
3. Apply haptic feedback if enabled.
4. Trigger a restrained ripple.
5. Emit lightweight team-colour particles.
6. Use spring overshoot.
7. Add feed item optimistically.
8. Reset shot clock if configured.
9. Save locally.
10. Sync in background.

Effects must not block a second tap.

## Leading-team aura

Increase ambient team glow with lead size up to a controlled maximum.

When tied, rebalance smoothly.

Also indicate the leader using text or iconography, not colour alone.

## Foul

- Red pulse
- Brief count shake
- Urgent feed entry
- Undo remains visible
- Foul-limit state announced accessibly
- Sound only when enabled

## Win moment

Sequence:

- Dim background
- Winner enters
- Final score settles
- Champion symbol appears
- Lightweight confetti
- Winning colour plus restrained gold
- `SAVE & EXIT`
- `NEW GAME`

Reduced-motion mode shows the final state immediately.

## Voice scoring

Preserve the exact Web Speech API grammar and functions from the specification.

Do not rewrite voice commands based on assumptions.

Show:

- Listening state
- Recognised command
- Failure/help state
- Browser support state

## Game clocks

Preserve exact shot-clock and game-clock behaviour.

Timers must not create duplicate intervals after navigating away and returning.

---

# 15. Team Builder and Queue

Preserve:

- Players tab
- Teams tab
- Queue tab
- Player attributes
- Rating calculation
- Edit and delete
- Balanced generation
- Random generation
- Interactive snake draft
- RMSD-based fairness selection
- Winners Stay
- Rotation
- Queue reordering

Visual direction:

- Player cards feel like premium basketball cards
- Optional CSS 3D flip to show stats
- Balanced teams animate into place
- Display team totals or fairness difference
- Explain that the split is based on available ratings
- Do not claim mathematical perfection

Queue:

- Make the next team visually obvious
- Keep reorder and remove actions forgiving
- Preserve accessible alternatives to drag interactions

---

# 16. Match History

Preserve:

- All, Wins, Losses, Draws
- Career statistics
- Match cards
- Complete event log
- Max leads
- Lead changes
- Biggest run
- Quarters
- Fouls
- Tournament linkage
- Delete confirmation

Design cards like final-score broadcast cards.

The final score is the strongest element.

Swipe delete may exist, but an accessible button must also exist.

---

# 17. Tournaments

Preserve:

- Create tournament
- Round robin
- Knockout
- Custom win score
- Dynamic teams
- Fixture generation
- Result entry
- Standings
- Points, points for, points against and differential
- Byes
- Subsequent rounds
- Champion
- Delete
- Supabase persistence

Visual direction:

- Professional league table
- Scrollable knockout bracket on mobile
- Progressive bracket-line drawing
- Winner advance animation
- Restrained champion-gold state

Do not change calculation rules.

Test non-power-of-two knockout cases.

---

# 18. Communities

Preserve all community flows, objects, roles and permissions.

Required areas:

- My Communities
- Discover
- Create Community
- Join
- Request to Join
- Cancel request
- Approval and rejection
- Leave
- Community header
- Visibility badges
- Admin/contributor/member roles
- Read-only mode
- Comment lock
- Ratings disable
- Delete community

Community detail tabs:

1. Feed
2. Members
3. Players
4. Gallery
5. Events
6. Leaderboard
7. Settings for admins

## Feed

Preserve:

- All post types
- New post form
- Title
- Body
- Upload or URL
- Pin
- Edit
- Delete
- Reactions
- Comments
- Comment lock
- Filters
- Permissions

Reaction UI:

- Optimistic update
- Floating emoji
- Background sync
- Restore or flag state if write fails

## Members

Preserve:

- Join requests
- Approve
- Reject
- Role changes
- Remove
- Self-label
- Joined date

## Community Players

Preserve:

- Add and edit
- Position
- Jersey number
- Photo URL
- Games, wins, losses, points and MVPs
- Badges
- Seven rating attributes
- Ratings
- Average
- Delete permissions

Preserve badge IDs and labels exactly.

## Gallery

Preserve:

- Upload
- URL
- 2MB limit
- Supported file types
- Preview
- Caption
- Albums
- Player tags
- Likes
- Comments
- Delete permissions
- Base64 local-only handling according to the specification

## Events

Preserve:

- Event types
- Date
- Time
- Location
- Maximum players
- Upcoming/Past/All
- Going
- Maybe
- Can’t Go
- Need Team
- Running Late
- Attendee list
- Format suggestion
- Full-event behaviour
- Delete permissions

## Leaderboard

Preserve every category and exact ranking rule:

- Overall rating
- Top scorers
- Most games
- Win rate
- MVP count
- Sportsmanship

Respect minimum-game and minimum-rating conditions.

## Community Settings

Preserve:

- Community edit
- Visibility
- Join approval
- Posting lock
- Comment lock
- Ratings toggle
- Delete
- Leave community

Never show unauthorised controls.

---

# 19. Settings, Analytics, Pulse and Support

## Settings

Preserve:

- Profile and switching
- Default win score
- Sound toggle
- Vibration toggle
- Sync status
- Export
- Import
- Clear all data
- Load demo data
- Clear demo data
- Analytics
- Help Center
- CourtCall Assistant
- App version
- Changelog
- Privacy
- Terms
- Feedback
- Contact
- Sign out

## Analytics

Preserve all tracked metrics from the specification.

Do not invent analytics that are not collected.

## Pulse

Preserve:

- Location fields
- Category filters
- Search-link generation
- Demo feed
- Clear labelling that it is not a live news API
- `K_PULSE` storage

## Basketball World

Preserve the static curated resources.

## Help Center

Preserve:

- Search
- Categories
- Article accordions
- Knowledge base structure
- Steps
- Related features

## CourtCall Assistant

It is rule-based keyword matching, not an AI or LLM.

Keep the label:

`Beta Help · Keyword matching · Not AI`

Preserve:

- Knowledge-base scoring
- Confidence thresholds
- Suggestions
- Feedback
- Persistence limits
- Email fallback

Do not market it as generative AI.

## Feedback

Preserve email and copy options.

Use:
`vadi.s23@gmail.com`

---

# 20. Motion System

Use:

```css
--spring: cubic-bezier(.34,1.56,.64,1);
--standard: cubic-bezier(.4,0,.2,1);
--expo-out: cubic-bezier(.16,1,.3,1);
```

Timing guidance:

- Immediate feedback: 80–160ms
- Micro-interaction: 120–200ms
- Navigation: 180–280ms
- Card entry: 260–400ms
- Celebration: 600–1200ms

Use motion for:

- Score
- Foul
- Quarter
- Possession
- Tab changes
- New feed entry
- Reactions
- Player assignment
- Bracket progression
- Victory
- PWA installation
- Sync success/failure

Do not animate every element on every render.

Respect `prefers-reduced-motion` by disabling non-essential motion, not merely slowing it.

---

# 21. Sound and Haptics

Use progressive enhancement only.

Sound requires an enabled setting and prior user interaction.

Suggested optional cues:

- Score click or soft ball impact
- Foul warning
- Shot-clock buzzer
- Victory crowd swell

Do not play navigation sounds by default.

Suggested vibration patterns:

```javascript
+1: 10
+2: 14
+3: [12, 20, 18]
foul: [18, 25, 18]
victory: [20, 35, 25, 35, 45]
```

Use only when enabled and supported.

Failure must be silent.

---

# 22. Accessibility

Meet WCAG AA at minimum.

Preserve and verify:

- Skip link
- Semantic main area
- Bottom navigation semantics
- ARIA tablists
- Roving tabindex
- Modal `role="dialog"`
- `aria-modal`
- Modal labels
- Focus trap
- Focus restoration
- Keyboard closing
- Visible focus
- PIN group labels
- PIN digit labels
- Live score region
- Shot-clock alert
- Foul-limit alert
- Game-over alert
- Form labels
- Inline error association
- Colour contrast
- Non-colour status indicators
- 200% zoom
- Reduced motion

Routine score announcements should be polite.

Urgent alerts may use assertive regions.

Do not over-announce animations or decorative changes.

---

# 23. Security and Data Safety

Preserve and use:

- `escHtml`
- `escAttr`
- Safe dynamic HTML rendering
- Validation for user-controlled URLs
- File type and size validation
- No plaintext PIN storage
- No service-role Supabase key in client code
- No arbitrary HTML from posts or comments
- Safe `mailto:` composition
- Defensive JSON parsing
- Confirmation before destructive actions

Review every `innerHTML` assignment containing user data.

Do not trust imported backup data blindly.

Validate expected structures before restoration.

---

# 24. PWA and Offline

Preserve the exact service-worker and manifest contract from the specification.

Service worker:

- Cache name and shell list as specified
- Install
- Activate
- Same-origin stale-while-revalidate
- Font cache-first
- GET-only handling
- Safe network fallback

PWA:

- Install prompt
- Dismiss persistence
- Installed toast
- Manifest fields
- Quick Game shortcut
- Standalone display
- Portrait preference

Offline:

- Offline banner
- Online/offline listeners
- Local saves
- Non-blocking sync
- Clear messaging:
  `You’re offline — changes saved locally`

The active game must continue without network access.

Do not cache Supabase API responses as application shell assets.

---

# 25. Performance

Performance priorities:

1. Live scoring response
2. Route transitions
3. App startup
4. Offline behaviour
5. Cinematic landing experience

Requirements:

- No network dependency during a live game
- No large cinematic media loaded inside authenticated app routes
- Preload only the initial hero asset
- Lazy-load later clips
- Provide poster frames
- Produce WebM and MP4
- Use responsive images
- Cancel inactive animation frames
- Avoid repeated full-screen `innerHTML` replacement during scoring
- Avoid forced synchronous layout
- Use transform and opacity for animation
- Use passive touch and scroll listeners where appropriate
- Avoid duplicate timers
- Avoid simultaneous autoplay videos
- Compress media for web
- Use a reduced frame set on slower devices
- Prevent cumulative layout shift
- Keep console clean

The landing page must not delay the user from starting a game.

Provide a visible “Skip to App” path while media loads.

---

# 26. Responsive Behaviour

Test and design independently for:

- 390×844 mobile portrait
- 844×390 mobile landscape
- 768×1024 tablet
- 1440×900 desktop

Mobile:

- CTA in thumb zone
- Centre-safe cinematic crops
- Reduced particles
- Simplified HUD
- No text covering ball or hoop
- Bottom-safe navigation
- `env(safe-area-inset-*)`
- Swipeable horizontal content only where useful
- No accidental horizontal overflow

Landscape game mode:

- Recompose scoreboard for wider controls
- Keep score buttons large
- Preserve undo
- Keep clocks readable

Desktop:

- Wider cinematic storytelling
- More breathing room
- Enhanced hover states
- Keyboard navigation
- No mobile-only interactions required

---

# 27. Implementation Phases

Do not perform an uncontrolled rewrite.

## Phase 1 — Audit

- Read full spec
- Inspect repository
- Inventory files
- Produce compliance matrix
- Identify security risks
- Identify data-compatibility risks
- Identify performance risks
- Identify duplicate IDs and functions
- Locate every dependency of the standalone Canvas basketball widget
- Identify the safe removal boundary for its markup, styles, scripts, assets and lifecycle handlers
- Do not modify code yet

## Phase 2 — Regression Baseline

- Run existing app
- Record working flows
- Record console errors
- Export sample localStorage data
- Confirm route behaviour
- Confirm Supabase configuration points
- Create a backup branch or commit

## Phase 3 — Design Foundation

- Add design tokens
- Add typography
- Build reusable button, chip, card, form, modal, tab and nav styles
- Add responsive shell
- Add accessibility foundation
- Preserve functional hooks

## Phase 4 — Core Game

Complete and verify:

- Setup
- State creation
- Score
- Foul
- Timeout
- Undo
- Win by two
- Quarter
- Possession
- Shot clock
- Game clock
- Voice commands
- Save
- Resume
- Victory
- Match save

Stop and test before continuing.

## Phase 5 — Team and History

Complete and verify:

- Player CRUD
- Ratings
- Balanced teams
- Random teams
- Snake draft
- Queue
- Match history
- Career stats

## Phase 6 — Tournaments

Complete and verify:

- Round robin
- Knockout
- Byes
- Results
- Standings
- Bracket progression
- Champion

## Phase 7 — Communities

Complete every tab, role, permission and sync flow.

## Phase 8 — Supporting Product

Complete:

- Settings
- Analytics
- Pulse
- World
- Help Center
- Assistant
- Feedback
- Legal
- PIN reset
- Demo data
- Export/import

## Phase 9 — PWA and Supabase

Verify:

- Sign up
- Sign in
- Sign out
- PIN update
- Guest
- Offline
- Install
- Service worker
- Sync
- Failed sync
- Data merge

## Phase 10 — Cinematic Landing

Only after the core app is stable:

- Generate/select master image
- Generate chained clips
- Compress assets
- Implement scroll scrub
- Add pinned storytelling
- Add HUD
- Add fallbacks
- Integrate CTA

## Phase 11 — Polish

Add:

- Score particles
- Leading aura
- Hot hand
- Pace
- Comeback
- Prediction
- Win probability
- Reactions
- Bracket motion
- Empty states
- Sound
- Haptics

## Phase 12 — Final QA

Run full test matrix and fix all material failures.

---

# 28. Testing Matrix

Do not report “complete” until tested.

## Core game

Test:

- Game to 11
- Game to 15
- Game to 21
- Custom win score
- 1s and 2s
- 2s and 3s
- Free throws
- Win by two
- Undo score
- Undo foul
- Timeout use
- Shot clock off
- Shot clock 12, 14, 24 and 30
- Custom shot clock
- Auto-reset
- Pause/resume
- Count-up game clock
- Quarter changes
- Possession
- Save and resume
- Game over
- Save match
- New game

## Voice

Test supported browser behaviour for:

- Team A score
- Team B score
- Colour command
- Number word
- Undo
- Foul
- Score check
- Reset shot clock
- Unsupported browser
- Permission denied
- Microphone stopped

## Teams

Test:

- Player add
- Player edit
- Player delete
- Rating calculation
- Balanced split
- Random split
- Snake draft
- Re-shuffle
- Queue add
- Queue remove
- Queue reorder
- Winners Stay
- Rotation

## History

Test:

- Filters
- Career stats
- Detail
- Delete
- Empty state
- 200-item cap

## Tournaments

Test:

- 3-team round robin
- 4-team round robin
- 4-team knockout
- 6-team knockout
- Byes
- Tied result handling according to spec
- Standings sorting
- Next round
- Champion
- Delete
- Sync

## Communities

Test roles:

- Admin
- Contributor
- Member
- Non-member
- Guest

Test:

- Public
- Private
- Hidden
- Open join
- Approval
- Cancel request
- Approve
- Reject
- Leave
- Post
- Pin
- Edit
- Delete
- Reactions
- Comments
- Locked posting
- Locked comments
- Add player
- Edit player
- Rate player
- Disable ratings
- Add gallery
- Upload limit
- URL image
- Albums
- Tags
- Gallery comments
- Create event
- Every RSVP state
- Full event
- Format suggestion
- Leaderboards
- Admin settings
- Delete community

## Data

Test:

- Fresh localStorage
- Existing real data
- Corrupt JSON
- Demo data
- Clear demo
- Export
- Import
- Invalid import
- Guest mode
- Offline
- Supabase unavailable
- Failed write
- Sync merge
- Sign out
- Re-login

## PWA

Test:

- Install prompt
- Dismiss
- Install
- App shortcut
- Offline shell
- Service-worker update
- Cache invalidation
- Font failure
- Cinematic media failure

## Cinematic landing

Test:

- Clip continuity
- Scroll forward
- Scroll reverse
- HUD sync
- Pinned copy
- CTA
- Media loading
- Poster
- Mobile crop
- Slow device
- Reduced motion
- Skip to App
- Route cleanup
- No lingering RAF loop
- No impact on game performance

## Accessibility

Test:

- Keyboard only
- Screen reader labels
- Tab order
- Focus trap
- Focus restore
- Escape close
- Roving tabs
- 200% zoom
- Contrast
- Reduced motion
- Live score
- Urgent alerts
- Touch targets

## Quality

Confirm:

- No console errors
- No undefined functions
- No duplicate IDs
- No dead buttons
- No broken routes
- No uncaught promise rejections
- No invalid HTML
- No missing critical files
- No unsafe user HTML
- No horizontal overflow
- No unbounded timers
- No remaining references to the removed standalone Canvas basketball widget
- No orphaned animation frames, pointer handlers or asset requests from the removed widget
- No broken existing local data
- No schema changes

---

# 29. Deliverables

Deliver:

1. Updated `basketball.html`
2. Updated `basketball-sw.js`
3. Updated `basketball.manifest.json`
4. `icons/icon.svg`
5. Optimised Higgsfield media assets
6. Poster images and mobile-safe fallbacks
7. `README.md`
8. Feature-compliance matrix
9. Supabase mapping matrix
10. localStorage compatibility confirmation
11. Testing report
12. Accessibility report
13. Performance notes
14. Changelog
15. Known limitations
16. GitHub Pages deployment instructions

README must include:

- Product overview
- Architecture
- Files
- Local run instructions
- Supabase configuration
- PWA behaviour
- Media replacement instructions
- GitHub Pages deployment
- Cache update procedure
- Test summary
- Known limitations

---

# 30. Mandatory Quality Gates

Do not call the project complete unless:

- Every specified screen exists.
- Every required route works.
- Core game flows are tested.
- Existing local data remains readable.
- Supabase mappings are unchanged.
- Community permissions are correct.
- Voice grammar is preserved.
- Offline play works.
- PWA installation works.
- Reduced motion works.
- The cinematic sequence has fallbacks.
- The landing page does not slow the game.
- Mobile scoring is thumb-friendly.
- No critical console errors remain.
- No unsupported feature is marketed as complete.
- The feature-compliance matrix contains no unexplained missing item.

Do not say “fully tested” unless the tests were actually run.

Clearly distinguish:

- Implemented and tested
- Implemented but not externally verified
- Planned
- Blocked
- Unsupported in the current browser/environment

---

# 31. Final Instruction

The CourtCall specification is the skeleton.

The visual system is the muscle.

The motion is the energy.

The game experience is the heart.

Build a product that makes a pickup baller stop between games, show the phone to a teammate and say:

> **“We should use this for the next run.”**

Begin with Phase 1 only.

Read `COURTCALL_SPEC.md`, inspect the repository and return:

1. Compliance matrix
2. Architecture summary
3. Data-contract risks
4. Performance risks
5. Accessibility risks
6. Proposed implementation sequence
7. Any truly blocking questions

Do not edit files until the audit is complete and approved.
