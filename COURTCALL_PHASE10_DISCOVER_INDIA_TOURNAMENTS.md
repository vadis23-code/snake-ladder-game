# CourtCall Phase 10 — Discover India Tournaments

## Outcome

Phase 10 adds an India-wide tournament discovery layer to the canonical `index.html` application without replacing or duplicating the established CourtCall tournament engine. The production-default discovery state is honest and empty unless locally stored records exist. Two invented records are available only through an explicit **Preview sample data** action and remain visibly marked **SAMPLE / DEMO** and **UNVERIFIED**.

Branch: `codex/phase10-discover-india-tournaments`  
Baseline: `187bd94` (`Merge CourtCall Phase 9.6 production QA hotfix`)  
Canonical local URL: `http://127.0.0.1:8765/`  
Commit/push/deploy: not performed

## Architecture

- `courtcall-discover-india.js` is an isolated, dependency-free domain module. It owns normalization, filters, locations, trust labels, HTTPS validation, following IDs, claim/report intents, and explicitly labeled demo records.
- `index.html` provides the view/controller integration. It reuses established escaping helpers and does not put untrusted content into raw executable markup.
- `courtcall-discover-india.css` extends Midnight Arena OS with mobile-first tabs, filter panels, location controls, cards, trust badges, details, and forms.
- The existing `CourtCallCore` tournament generator, fixtures, scoring, standings, history, Supabase mapping, and `cc_tournaments` collection remain the playable tournament engine.
- No Supabase schema, RLS, authentication, community, scoring, analytics, Pulse, Help, or cinematic contract was changed.

## Data model

Normalized discovered records have stable IDs and support title/name, slug, state, city, venue, dates, format, category/age group, gender, level, registration state/window, entry fee, prize, team size, maximum teams, organiser and contacts, registration/rules/maps/poster links, source name/type/URL, freshness, verification, listing type, description, and sample status.

`listingType` is restricted to `DISCOVERED` or `COURTCALL HOSTED`. Verification is restricted to `VERIFIED`, `ORGANISER_LISTED`, `COMMUNITY_LISTED`, `SOURCE_LISTED`, or `UNVERIFIED`; unknown values normalize to `UNVERIFIED`. Links are retained only when valid HTTPS URLs.

The lightweight location contract contains 16 states/territories and deterministic city lists, including every required Phase 10 market. State selection rebuilds the City options.

## Routing

Supported routes:

- `#/tournament` — existing My Tournaments hub
- `#/tournament/discover` — discovery index
- `#/tournament/following` — local watchlist
- `#/tournament/host` — host and submit pathways
- `#/tournament/discover/<id>` — discovered listing detail
- `#/tournament/<existingId>` — unchanged existing tournament detail

Subroute navigation uses browser history and preserves hash routing. Private-route identity gating remains with the existing router.

## Filters and location discovery

Discover includes search, State, cascading City, From/To date, 3X3/5X5/1X1 format, age/category, gender, level, registration status, maximum entry fee, and prize-present filters. It includes a result count, Clear filters, an honest empty state, an accessible loading-status location for future asynchronous providers, a compact 16-location map/filter surface, and a visible explanation of source/freshness badges.

## Trust and provenance

Cards expose organiser, location, date, format, category, registration status, fee, prize, source, last checked date, verification badge, and listing type. Details separate Overview, Categories, Schedule, Venue, Registration, Organiser, Trust & source, and Corrections/ownership.

External registration, source, rules, and map actions render only for normalized HTTPS URLs and use `target="_blank"` with `rel="noopener noreferrer"`. No sample record has a fake registration link or endorsement.

**Report incorrect info** creates a local `PENDING` report. It does not claim delivery to a moderation backend.

## Following

Following stores normalized, sorted, duplicate-free record IDs. Follow and unfollow update optimistically on-device, persist across reload, and do not claim cloud sync. Missing IDs are ignored safely. Followed sample records remain resolvable after reload but stay marked SAMPLE / DEMO.

## Host and submission

**Host with CourtCall** opens the existing playable tournament creation flow. Newly created records receive `settings.listingType: "COURTCALL HOSTED"` without altering the existing storage or Supabase columns.

**Submit a tournament** captures submitter role, name, organiser, state, city, venue, dates, format, category, gender, level, registration status/deadline, fee, prize, contact, registration/rules/source links, source name, and notes. Submissions are stored locally as `PENDING`, use `DISCOVERED`, and may be marked `ORGANISER_LISTED` or `COMMUNITY_LISTED`; they are never auto-verified or auto-published.

## Claim flow

Discovered details expose **Claim this tournament**. The local form records tournament ID, claimant name, email/contact, reason, timestamp, and `PENDING` status. It does not grant ownership, change `claimedBy`, or escalate verification.

## Storage keys added

- `cc_discovered_tournaments`
- `cc_followed_tournaments`
- `cc_tournament_submissions`
- `cc_tournament_claim_intents`
- `cc_tournament_reports`

Existing `cc_tournaments` data and its Supabase mapping are unchanged.

## Files changed

Application:

- `index.html`
- `courtcall-core.js`
- `basketball-sw.js`
- `courtcall-discover-india.js` (new)
- `courtcall-discover-india.css` (new)

Tests:

- `tests/courtcall-phase10-discover-india.test.js` (new)
- Ten existing PWA assertions updated only from the prior cache version to `v55`

Documentation:

- `COURTCALL_PHASE10_DISCOVER_INDIA_TOURNAMENTS.md` (new)

The pre-existing untracked backup ZIP was not touched.

## PWA and offline

Service-worker cache version is `v55`. The discovery JavaScript and stylesheet are in the precached shell. Stored discovery and following records are local-first and remain readable offline. External links remain visibly external and make no availability promise. The existing navigation fallback and runtime cache strategy were not changed.

## Tests

Syntax:

- `node --check courtcall-discover-india.js` — PASS
- `node --check courtcall-core.js` — PASS

Focused Phase 10 suite: **8 passed, 0 failed**. Coverage includes normalization, trust downgrade, HTTPS rejection, deterministic following, location/filter behavior, pending-only claims, sample transparency, new routes, legacy tournament deep links, and PWA asset inclusion.

Full regression suite: **186 passed, 0 failed**. This includes existing tournament creation, round robin, knockout, score return, champions/history, localStorage, and Supabase contract tests.

Production artifact: **PASS** — 69 runtime files built to a temporary directory with no missing/empty assets or repository-internal leakage.

## Browser QA

Tested the canonical page at `http://127.0.0.1:8765/` and these routes:

- `/`
- `#/tournament`
- `#/tournament/discover`
- `#/tournament/following`
- `#/tournament/host`
- `#/tournament/discover/sample_delhi_3x3`
- existing detail `#/tournament/tourn_1786757238025`

Verified four tabs, direct discovery routing, honest empty state, opt-in sample labels, State filtering, detail sections, Follow/Following, reload persistence, Host/submission content, and the existing My Tournament detail route. The service-worker update prompt was applied during QA and the new shell loaded.

Visual checks were performed at 320×568, 390×844, 844×390, 768×1024, and 1440×900. Controls remain touch-sized, the compact tab strip is intentionally locally scrollable at narrow widths, and no page-level horizontal scrollbar or Phase 10 visual obstruction was observed.

No Phase 10 console error occurred. One existing environment-dependent error was observed: the Supabase community hydration request failed to fetch on localhost. It did not affect tournament discovery and is not caused by Phase 10.

## Remaining limitations and future server work

- No live provider or central discovery dataset is connected; production correctly starts empty.
- Submission, report, claim, and following data are device-local. Clearing browser storage removes them.
- No moderation queue, ownership verification, server notifications, or cloud following exists.
- Source freshness is supplied record metadata; CourtCall does not scrape or silently refresh external sites.
- External registration availability and correctness require manual organiser/source verification.
- A future Supabase phase can map stable discovered IDs and the five local storage collections into server tables/RPCs after schema and RLS review. It must preserve the verification downgrade rules and never infer `VERIFIED` from submitter role.
- True offline network toggling and external-link reachability remain environment-dependent manual checks; shell inclusion and local-first behavior are covered by automated tests.

Phase 11 was not started.
