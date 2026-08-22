# CourtCall Phase 9.5 — Production Deployment & Supabase Recovery

Date: 22 August 2026  
Branch: `codex/phase9-5-production-recovery`  
Baseline: `45b914e2603a951eb7ab56600fdfcbee4a8cd275` (`Complete CourtCall Phase 9 OTP authentication`)  
Canonical application entry point: `index.html`  
Canonical production URL: `https://courtcall13.win/`

## 1. Deployment architecture found

The GitHub repository is `vadis23-code/snake-ladder-game`; its default and production branch is `master`. GitHub Pages is deployed by `.github/workflows/deploy.yml`, triggered by pushes to `master` or manual dispatch. The workflow builds `dist/`, uploads that directory with `actions/upload-pages-artifact`, and deploys it with `actions/deploy-pages`. Its public base URL is:

`https://vadis23-code.github.io/snake-ladder-game/`

The second deployment is Cloudflare Pages. GitHub's check run identifies the Cloudflare Pages project as `snake-ladder-game`; `courtcall13.win` responds through Cloudflare and is attached to the same `master` commit. The repository has no Wrangler configuration. The Cloudflare dashboard-only production branch, build command, and output-directory values are not publicly readable, although the commit check proves the project is connected to this repository.

`courtcall13.win` is the canonical product domain. GitHub Pages remains a secondary release verification/deployment surface. They must publish the same release, not independent application versions.

## 2. Root cause of stale public deployment

The Phase 9 application is on commit `45b914e`, while the public deployments are built from `master` at `cd137e6` (`Block repository internals on Cloudflare Pages`). Phase 9 was never merged into or deployed from `master`.

There was also an independent GitHub Pages packaging defect: the workflow copied a small hard-coded subset of the application. It could report a successful deployment even though required CSS, JavaScript, cinematic media, and atmosphere media were absent. The service worker installs atomically, so missing shell files could prevent the new worker from installing.

There is no `.gitignore`; ignored files are not the cause. Relative application paths are generally correct. The PWA manifest's former root-absolute `id`, `start_url`, `scope`, and shortcut URL were incompatible with the GitHub project-page base path and were corrected to `./`-relative values.

Live fingerprints before any public release:

- `https://courtcall13.win/`: 715,306 bytes, SHA-256 `C5FD3190667BD75BC2340052D0652842A74C7F5A216138000E2C9F6CD2ED8EEF`; contains `signInWithPassword`, not `signInWithOtp`, and does not load `courtcall-auth.js`.
- `https://vadis23-code.github.io/snake-ladder-game/`: 714,573 bytes, SHA-256 `F42658FF9684E86654D6DCDD424BE8EB655BCF2D4FF6F8EC9512F2D6DA9986EA`; same legacy-auth findings.

## 3. Missing-file analysis

The 31 files omitted from the previous GitHub Pages artifact were:

1. `courtcall-auth.css`
2. `courtcall-cinematic.css`
3. `courtcall-core-game.css`
4. `courtcall-design-system.css`
5. `courtcall-global-visual-system.css`
6. `courtcall-motion-foundation.css`
7. `courtcall-supporting-product.css`
8. `courtcall-team-history.css`
9. `courtcall-tournaments.css`
10. `courtcall-auth.js`
11. `courtcall-cinematic.js`
12. `courtcall-communities.js`
13. `courtcall-global-visual-system.js`
14. `courtcall-motion-foundation.js`
15. `courtcall-supporting-product.js`
16. `assets/cinematic/01-empty-court-poster.webp`
17. `assets/cinematic/01-empty-court.mp4`
18. `assets/cinematic/01-empty-court.webm`
19. `assets/cinematic/02-tip-off-poster.webp`
20. `assets/cinematic/02-tip-off.mp4`
21. `assets/cinematic/02-tip-off.webm`
22. `assets/cinematic/03-the-run-poster.webp`
23. `assets/cinematic/03-the-run.mp4`
24. `assets/cinematic/03-the-run.webm`
25. `assets/cinematic/04-clutch-moment-poster.webp`
26. `assets/cinematic/04-clutch-moment.mp4`
27. `assets/cinematic/04-clutch-moment.webm`
28. `assets/cinematic/05-victory-poster.webp`
29. `assets/cinematic/05-victory.mp4`
30. `assets/cinematic/05-victory.webm`
31. `assets/cinematic/courtcall-master.webp`

The old allowlist also omitted dependencies discovered indirectly at runtime: the five cinematic mobile stills, `courtcall-master-mobile.webp`, and ten desktop/mobile atmosphere images. It omitted `basketball.html`, which remains the compatibility redirect for old links.

`tools/build-public-artifact.mjs` now derives the production media set from the canonical runtime files, validates that every selected file is non-empty, copies the complete application into `dist`, and rejects tests, tools, SQL, repository metadata, Markdown, and ZIP files. The verified artifact contains 67 files and 39,033,033 bytes.

## 4. GitHub Pages findings

- Source branch: `master`.
- Source mechanism: GitHub Actions, not root, `/docs`, or a Pages branch.
- Published directory: generated `dist/` artifact.
- Base URL: `/snake-ladder-game/`.
- Workflow correction: `.github/workflows/deploy.yml` now runs `node tools/build-public-artifact.mjs dist`.
- Relative assets: production dependencies resolve relative to the deployment scope.
- Manifest: `id`, `start_url`, `scope`, and Quick Game shortcut are now `./`-relative.
- Hash routing: remains client-side and does not require server rewrites.
- Compatibility: `basketball.html` is included and continues to route old links to the canonical entry point.
- Missing-asset behavior: `404.html` prevents Cloudflare Pages' automatic SPA fallback from returning `index.html` with HTTP 200 for an unknown asset.

No application feature was removed to reduce artifact size.

## 5. Second deployment findings

Provider: Cloudflare Pages.  
Project: `snake-ladder-game`.  
Observed source commit/branch: `master` at `cd137e6`.  
Observed public domain: `https://courtcall13.win/`.  
Current state: intentionally active but stale.

The repository's `_redirects` protects repository-internal paths on the root-publishing Cloudflare surface. Public evidence does not expose the configured Cloudflare build command or output directory. Before the next release, the Cloudflare project must be set to production branch `master`, build command `node tools/build-public-artifact.mjs dist`, and output directory `dist`. That dashboard action is required to guarantee that Cloudflare and GitHub Pages consume the same artifact.

The custom domain should be updated, not redirected or retired. GitHub Pages should remain secondary.

## 6. Canonical production URL decision

`https://courtcall13.win/` is the canonical public application because it is the product-owned domain and is already represented in `robots.txt`, `sitemap.xml`, metadata, and the existing Cloudflare project. GitHub Pages is retained as a secondary deployment at `https://vadis23-code.github.io/snake-ladder-game/`.

There is one canonical application, `index.html`. The repository does not duplicate the current application into `basketball.html`; that file remains a compatibility redirect and is included in the release artifact.

## 7. Supabase status

Configured project ref: `jfeegcocynozbjpzbjae`  
Region: `ap-southeast-2`  
Database: PostgreSQL 17  
Initial status: `INACTIVE`  
Final status: `ACTIVE_HEALTHY`

The existing project was restored successfully; no replacement project was created. The client URL resolves to the same project ref. The configured legacy anonymous JWT declares that ref and the `anon` role and is not expired. Supabase reports both an enabled legacy key and an enabled modern publishable key; no private key was written to this report.

All 11 public tables are present and RLS-enabled: `profiles`, `games`, `communities`, `community_members`, `community_posts`, `community_events`, `tournaments`, `community_players`, `community_ratings`, `community_gallery`, and `community_join_requests`. Every table currently has zero rows.

Auth restarted successfully (GoTrue v2.195.0). The available project tooling does not expose hosted Auth Site URL, redirect allowlist, SMTP, or email-template settings, so those require dashboard verification.

## 8. Migration status

Before recovery, the remote ledger contained:

- `community_access_hardening`
- `client_schema_alignment`
- `legacy_definer_execution_lockdown`

The local `20260817000000_phase7_community_permissions.sql` migration was missing remotely. The live tables/columns it depends on were present, and the migration is transactional and repeat-safe through named replacement of policies/triggers and `CREATE OR REPLACE` functions. That migration alone was applied successfully and is now recorded remotely as version `20260822020318`, name `phase7_community_permissions`.

Post-migration verification found all 9 expected policy guards, all 6 atomic reaction/comment RPCs, and 11 RLS-enabled public tables. Phase 9 OTP needs Auth configuration but no database migration.

No other SQL file was rerun.

## 9. OTP live validation

The production OTP client contract is present locally and covered by automated tests: `signInWithOtp` sends normalized email with `shouldCreateUser: true`; `verifyOtp` submits one normalized six-digit token with type `email`; OTPs are not logged or persisted.

A real end-to-end OTP was not performed. The public domain still serves the old password build, and no safe real email inbox was provided. No email address, OTP, token, or session was invented or captured.

Dashboard checks still required:

- Site URL is `https://courtcall13.win/`.
- Redirect allowlist includes `https://courtcall13.win/**` and the intended GitHub Pages/local test origins where appropriate.
- Email template presents `{{ .Token }}` as a six-digit code rather than only a magic link.
- Custom SMTP is configured for production deliverability and rate limits.
- OTP expiry and resend limits are intentional. Current Supabase production guidance recommends an OTP expiry no greater than one hour and custom SMTP for production.

## 10. RLS validation

Server-side structural verification passed:

- RLS is enabled on all 11 public tables.
- The Phase 7 restrictive contributor, read-only, ratings, member-deletion, manager-update, post-edit, and post-delete guards exist.
- The six reaction/comment RPCs exist.
- An anonymous insert into `communities` was denied under the database `anon` role and the probe row does not exist.

Full real-session role validation for owner, admin, contributor, member, and non-member was not possible because the live database has zero profiles and no real OTP identity was available. Client-side tests cover the permission matrix, but this is not claimed as a substitute for authenticated server tests.

The post-migration Security Advisor reports ten warnings: nine intentionally authenticated `SECURITY DEFINER` RPCs and leaked-password protection disabled. The RPCs are deliberately callable only by authenticated users and perform their own membership/ownership checks with fixed empty search paths; they are required for atomic member-scoped writes. Each should still be reviewed against the [Supabase function-execution advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Leaked-password protection is lower relevance after the OTP-only migration but remains an Auth advisor item. Performance Advisor reports 53 non-blocking findings: 4 unindexed foreign keys, 31 RLS init-plan warnings, 15 unused indexes on the empty database, and 3 multiple-permissive-policy warnings.

## 11. Service-worker/cache findings

Current cache version: `v52`  
Shell cache: `courtcall-v52`  
Runtime cache: `courtcall-runtime-v52`

The worker precaches the application shell atomically, rejects HTML responses for non-navigation shell assets, deletes the incomplete shell if installation fails, and removes obsolete `courtcall-*` caches during activation while preserving the current shell/runtime caches. Navigation is network-first with a four-second timeout and cached root fallback. Same-origin scripts, styles, images, fonts, and manifests use bounded stale-while-revalidate; runtime cache capacity is 48 entries. Range requests are excluded so cinematic video streaming is not intercepted.

The built artifact served every one of its 67 URLs with HTTP 200. All shell files, current auth JS/CSS, cinematic stills/videos, atmosphere images, icons, manifest, service worker, and compatibility page were present. No localStorage was cleared.

## 12. Production browser QA

Current canonical public URL was inspected before release. It opens the old hub rather than the dedicated cinematic landing, contains no cinematic video, does not load `courtcall-auth.js`, and its auth surface contains a password input rather than the Phase 9 OTP experience. Browser console inspection found no errors, but this does not make the stale build acceptable.

The exact release artifact generated by the corrected workflow was browser-tested at `http://127.0.0.1:8876/`:

- Root routed to `#/landing` and displayed the five-stage cinematic landing.
- Cinematic video and current auth module were present.
- Current OTP input was present; cloud OTP UX did not replace legacy local-profile PIN compatibility.
- No console warnings/errors were observed.
- All 67 artifact URLs returned HTTP 200.
- No page-level horizontal overflow at 320×568, 390×844, 844×390, 768×1024, or 1440×900.
- The manifest is linked relatively and hash routing remained intact.

Authenticated Hub/Teams/History/Tournaments/Communities/Analytics/Pulse/World/Help, session restore/logout, and public service-worker replacement cannot be honestly certified against `courtcall13.win` until the artifact is released and real OTP is completed.

## 13. Automated tests

Syntax checks: 30 JavaScript files passed `node --check`.

Full regression result: **177 passed, 0 failed**. This includes the original 173 tests plus four focused Phase 9.5 tests:

- Complete production artifact with no repository-internal leakage.
- Pages workflow uses the validated production builder.
- Manifest navigation works at root and GitHub project paths.
- Missing static assets use a real non-app-shell 404 page.

An initial invocation using `node --test tests` was rejected by Node on Windows because the directory is not expanded as a test target. The suite was rerun correctly with the explicit sorted `*.test.js` list and passed completely; this was a runner invocation issue, not a product failure.

## 14. Remaining blockers

1. No commit or push is permitted in this phase, so neither public deployment can yet contain the recovered artifact.
2. Cloudflare's production branch/build/output settings require dashboard access and cannot be verified through public repository APIs.
3. Supabase Auth Site URL, redirect allowlist, email template, SMTP, and OTP settings require dashboard verification.
4. A real email inbox is required for OTP delivery and session validation.
5. Five real authenticated identities (or an agreed controlled role fixture) are required for owner/admin/contributor/member/non-member RLS testing.
6. Public cache replacement and complete public browser QA require the new release to be live.

No Phase 10 or Discover India work was started.

## 15. Exact manual actions still required

Perform these in order:

1. Review the uncommitted Phase 9.5 changes. Preserve the unrelated `backup-before-rollback-current-version-20260530-153108.zip` outside the release artifact.
2. Commit this Phase 9.5 work on `codex/phase9-5-production-recovery` and merge it into `master`; push `master`. No commit or push was performed by this run.
3. In Cloudflare Pages project `snake-ladder-game`, set production branch to `master`, build command to `node tools/build-public-artifact.mjs dist`, and output directory to `dist`; then allow the `master` push to deploy. Do not use repository root as the public output.
4. Confirm GitHub Pages remains configured for **GitHub Actions**. Verify the successful workflow artifact contains 67 production files and that `https://vadis23-code.github.io/snake-ladder-game/` shows the current landing/OTP application.
5. In Supabase project `jfeegcocynozbjpzbjae`, verify Auth URL/redirect, email template, custom SMTP, OTP expiry, and resend settings listed in section 9.
6. Supply a safe real test inbox, request one OTP from `https://courtcall13.win/#/auth`, and manually read the code. Do not paste it into logs or this report. Verify session creation, profile reuse/onboarding, Hub entry, refresh restore, logout, and post-logout route gating.
7. Create or assign controlled owner, admin, contributor, member, and non-member identities; run server-denial tests for every Phase 7 mutation. Remove controlled test data afterward through an approved cleanup process.
8. On the public custom domain, verify root cinematic landing, rolling basketball media, every major route, hash reloads, service-worker `v52` activation, old-cache removal, network/console cleanliness, and absence of the old password/PIN app as the primary experience.

Phase 9.5 stops here because steps 2–8 require explicitly prohibited push/deployment actions, external dashboard configuration, or a real user-controlled email/OTP.
