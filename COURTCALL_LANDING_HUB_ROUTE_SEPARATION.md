# CourtCall Landing / Hub Route Separation

Date: 2026-08-14  
Status: Implemented and browser-tested; awaiting review  
Canonical production entry: `index.html`  
Primary production test URL: `http://127.0.0.1:8765/`

## 1. Previous architecture

The cinematic campaign and the internal application dashboard were both children of `#s-hub` and both used the `#/hub` route. `renderHub()` applied `app-mode` when `cc_profile` was present. The cinematic stylesheet hid `.cc-cinema` in that mode, and the cinematic controller correctly refused to initialize while the Hub was in application mode.

Cold-start behavior also sent a recognized local profile directly to `showScreen('hub')`. The result was deterministic: returning users received the Midnight Arena dashboard and never saw the cinematic opening.

## 2. Root cause

The issue was architectural rather than a media or rendering failure:

- one route represented two different products states;
- profile recognition selected the internal state;
- `app-mode` suppressed the public state;
- the cinematic lifecycle was coupled to Hub presentation state;
- the root startup path treated recognition as permission to bypass the landing.

All ten video encodes had already been validated as decodable eight-second 1920×1080 media. The Empty Court clip and stills were not the cause.

## 3. New route architecture

```text
/
└── #/landing  public Higgsfield cinematic
    ├── Enter CourtCall → #/profile when identity is absent → #/hub
    ├── Enter CourtCall → #/hub when identity exists
    └── Start Game      → #/profile when identity is absent → #/setup
                        → #/setup when identity exists

#/hub                 internal Midnight Arena dashboard
```

The application now contains two independent `.screen` elements:

- `#s-landing`: public cinematic, landing navigation, campaign CTAs, feature proof and footer;
- `#s-hub`: internal navigation, PWA install prompt and application dashboard.

The existing `.cc-cinema` subtree was moved, not copied. Static and browser checks confirm one `#cc-cinema`, five video nodes and five cinematic story panels. `index.html` remains the only production application entry point; `basketball.html` was not changed.

The Midnight Arena global presentation controller explicitly yields on `landing`, removes `cc-visual-route`, and does not define a route atmosphere for the cinematic page. The internal sync badge is also hidden only while the landing is active so it cannot cover the public navigation CTA.

## 4. Startup behavior

An unqualified root always resolves to `#/landing`, whether or not a stored profile exists. An explicit hash is delegated to the existing route resolver.

- `/` → `#/landing` for anonymous and returning profiles;
- `#/landing` → always public;
- `#/hub` → Hub for a recognized local/guest profile;
- anonymous `#/hub` → `#/profile` with `auth_required`;
- other private routes retain the same profile gate;
- existing public legal, community-directory and discovery routes remain public.

`landing` was added to the core resolver's valid and public defaults. `hub` was removed from the application's `_PUBLIC_SCREENS` set.

## 5. Returning-user behavior

Browser acceptance on `http://127.0.0.1:8765/` with an existing local guest profile produced:

- final URL `http://127.0.0.1:8765/#/landing`;
- active screen `s-landing`;
- CTA text `Continue to CourtCall`;
- cinematic mode `full-video`;
- Empty Court WebM ready state `4`, duration `8` seconds;
- visible dark arena, center-court basketball, orange/blue lighting and the approved headline;
- `Continue to CourtCall` → `#/hub` with the application dashboard visible;
- Hub state with zero cinematic listeners and zero video `src` attributes.

The Hub logo is an accessible button that returns to `#/landing`.

## 6. CTA routing

Landing CTAs use `routeFromLanding()`:

- `setup`: opens Setup immediately for an existing profile; otherwise records an in-memory continuation and opens Profile/Auth;
- `hub`: opens Hub immediately for an existing profile; otherwise opens Profile/Auth;
- `communities`: follows the existing public community-directory route and leaves create/join permissions unchanged.

Successful Supabase sign-in, local sign-in, account creation, local account creation, detailed guest profile creation and simple guest continuation all use `routeAfterIdentity()`. A pending `setup` intent therefore reaches Game Setup after identity creation instead of being overwritten by a hard-coded Hub redirect.

The continuation is intentionally memory-only. It adds no localStorage or sessionStorage key and does not alter profile, game, community or cloud data models.

## 7. Cinematic lifecycle

The controller now binds to `#s-landing` only. Normal responsive browsers use `full-video`; mobile width or landscape height alone no longer forces still mode. Explicit fallback reasons are:

- `reduced-motion`;
- `save-data`;
- `low-memory` at a conservative `deviceMemory <= 2` capability threshold;
- `fallback` for unavailable video support or media failure.

On entry the controller:

- verifies that Landing is active;
- attaches one scroll, resize, visibility, motion-preference and relevant capability listener set;
- creates one IntersectionObserver;
- starts at most one pending render RAF;
- loads the first video and lazily loads later clips.

On exit it:

- cancels render and route RAF work;
- removes global and media listeners;
- disconnects the observer;
- pauses videos;
- removes video `src` attributes and calls `load()` to release media resources;
- publishes inactive diagnostic state.

No timer, autonomous playback loop, Canvas background, external animation library or application-data access was added.

## 8. Re-entry behavior

Five consecutive Landing → Hub → Landing cycles were browser-tested on the canonical application. Every cycle produced the same settled state:

| Route | Active | Global listeners | Video `src` attributes | Video nodes | Loaded videos | Scroll |
|---|---:|---:|---:|---:|---:|---:|
| Hub | false | 0 | 0 | 5 | 0 | n/a |
| Landing | true | 7 | 1 | 5 | 1 | 0 |

The node count remained five, listener counts did not grow, the opening clip reloaded at ready state `4`, and no memory-growth warning appeared. The observer is disconnected in `stop()` and created once in guarded `start()`; the focused automated lifecycle test verifies both contracts. Landing scroll intentionally resets to zero on every entry.

## 9. Service-worker changes

- cache version advanced to `v38`;
- cinematic and global visual assets use query revision `20260814b`;
- all four revised JS/CSS URLs are in the app shell;
- navigation remains network-first with the existing four-second timeout;
- runtime assets retain stale-while-revalidate behavior;
- prior CourtCall caches are removed during activation;
- localStorage, auth/session and application records are untouched.

The `v38` update was applied through the production PWA update control on `127.0.0.1:8765`; the page reloaded to `#/landing` in full-video mode and the update banner cleared.

## 10. Tests performed

### Automated

`node --test` ran the complete suite: **120 passed, 0 failed**. This includes new route-separation coverage plus the existing core outcomes, routing, security, design, game, team/history, community-permission, settings, accessibility, motion and PWA contracts.

New automated checks cover:

- one cinematic DOM in a dedicated landing screen;
- root startup for both profile states;
- public Landing and private Hub routing;
- memory-only CTA continuation;
- Landing-only controller guards and complete teardown;
- explicit full-video/fallback mode selection;
- Midnight Arena exclusion;
- `v38` shell and unchanged network-first navigation.

### Browser: canonical returning-profile origin

Tested at `http://127.0.0.1:8765/`:

- root → Landing with existing local profile;
- Landing → Hub;
- Landing → Setup from both primary and top-navigation CTAs;
- Hub → Landing;
- five repeated Hub/Landing cycles;
- direct `#/hub` and `#/landing`;
- forward and reverse stage navigation;
- Empty Court time changed from `0` to `0.627138` seconds through the visible stage control, confirming scroll-driven ball movement;
- reduced-motion setting → `reduced-motion`, zero video sources, approved still; preference restored afterward;
- `v38` service-worker update;
- final desktop visual capture with unobstructed CTAs.

### Browser: anonymous isolated origin using the same production files

Tested at `http://127.0.0.1:8766/`:

- `/` → `#/landing`, CTA `Enter CourtCall`, full video;
- anonymous direct `#/hub` → `#/profile`;
- direct `#/landing` remains public;
- Start Game → Profile/Auth → guest continuation → `#/setup`;
- default Setup → live Game;
- ten immediate +1 taps produced exactly `10–0` with no dropped scores;
- continued to `21–0`; victory overlay, Save & Exit and New Game were visible and enabled immediately;
- no horizontal overflow and no console warnings/errors on this isolated origin.

### Responsive production matrix

| Requested viewport | Mode | Cinematic stage | Horizontal overflow |
|---|---|---:|---:|
| 320×568 | full-video | 305×510 | 0 |
| 390×844 | full-video | 375×786 | 0 |
| 844×390 | full-video | 829×332 | 0 |
| 1440×900 | full-video | 1425×842 | 0 |

The 15-pixel width difference is the browser's vertical scrollbar allocation, not content overflow. The headline, first Start CTA and decoded active video remained visible at every size.

### Media-failure production test

A temporary clean origin at `http://127.0.0.1:8767/` loaded the real production page and decoded Empty Court. Its local server was then stopped before requesting Tip-Off. The controller changed to `fallback`, removed all video sources, applied `is-static is-media-fallback`, and displayed `02-tip-off-poster.webp` at 1920×1080 natural resolution. The temporary server process was stopped after the test.

## 11. Regression result

- Game logic and scoring models: unchanged; rapid score browser regression passed.
- Storage schemas and keys: unchanged; CTA continuation is not persisted.
- Supabase mappings/schema: unchanged.
- Tournament logic: unchanged; full tests green.
- Community permissions: unchanged; security and membership tests green.
- Motion foundation: unchanged; full tests green.
- Duplicate IDs: none; static uniqueness test green.
- Horizontal overflow: none at the four required viewports.
- Cinematic background activity on Hub: none after teardown.
- PWA navigation and shell contracts: green on `v38`.
- Media: no files regenerated or edited.

Files changed by this restoration:

- `index.html`
- `courtcall-cinematic.js`
- `courtcall-cinematic.css`
- `courtcall-global-visual-system.js`
- `courtcall-global-visual-system.css`
- `courtcall-core.js`
- `basketball-sw.js`
- `tests/courtcall-core.test.js`
- `tests/courtcall-cinematic-higgsfield.test.js`
- `tests/courtcall-global-visual-system.test.js`
- cache-version assertions in the existing Phase 3/4/5 and motion tests
- `tests/courtcall-landing-hub-separation.test.js`
- this report

## 12. Remaining limitations

- An authenticated Supabase-profile root could not be exercised because the local environment's Supabase community sync endpoint was unavailable. The recognized local-profile path uses the same startup branch and passed. The only production console errors were the existing environment-dependent `Failed to fetch` messages from `_doSyncCommunitiesFromDB`; there were no landing, routing, media, CSS or PWA errors. The anonymous isolated origin had no console errors.
- The browser connection does not expose Save-Data emulation. The `navigator.connection.saveData` branch, mode label, source unloading and static fallback are covered by automated contract tests, but a real Data Saver device/session remains an environment-dependent check.
- Browser memory instrumentation is not exposed. Stable listener/source/node counts across five re-entry cycles and the absence of memory-growth warnings are the available leak indicators.
- OS-level `prefers-reduced-motion` emulation was unavailable. The in-app Reduce Motion preference exercises the same `isReduced()` fallback path and was browser-verified, then restored.

No commit or push was created. No subsequent phase was started.
