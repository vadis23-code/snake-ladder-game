# CourtCall Phase 9 — OTP Authentication

**Status:** Complete for local implementation and verification  
**Date:** 2026-08-22  
**Canonical production entry point:** `index.html`  
**Canonical browser-test URL:** `http://127.0.0.1:8765/`  
**Scope boundary:** Authentication modernization only. No game, storage-model, tournament, Community-permission, schema, or RLS behavior was redesigned.

## 1. Audit findings

The pre-edit audit found two different identity paths sharing one Profile screen:

- Cloud accounts used an email address plus a six-digit value passed to Supabase as a password.
- Device-only profiles used a PBKDF2 verifier and remained entirely local.
- A Supabase-authenticated user's durable identity was already the Supabase `auth.users.id` UUID, and `public.profiles.id` was designed to use that same UUID.
- Community ownership and membership records rely on that UUID; generating a replacement application ID would have broken identity continuity.
- Guest match and profile data could be offered for cloud synchronization, but the existing implementation began applying guest profile fields before the user accepted the merge.
- Logout called the broad local-storage wipe path, which made sign-out destructive.
- Password recovery and `#/reset-pin` were incompatible with a passwordless model.
- A requested private deep link could be lost while session restoration or authentication was in progress.
- The pinned browser client is Supabase JS 2.106.2 and already exposes `signInWithOtp` and `verifyOtp`; no SDK upgrade was required.

The linked Supabase project `jfeegcocynozbjpzbjae` reported `INACTIVE`. Static schema, trigger, and RLS review was possible, but live email delivery, live profile creation, and live policy execution were not.

## 2. Previous auth architecture

The former cloud flow presented separate sign-in and account-creation forms. Both collected a six-digit PIN, but that PIN was used as a Supabase password through password sign-in/sign-up APIs. The same surface also exposed password-reset behavior and a reset-PIN screen.

The local compatibility path was different: older device-only profiles stored a salted PBKDF2 verifier, not the clear PIN. That verifier remains readable so existing local users are not locked out. No new local-PIN account can be created in Phase 9.

The following risks were removed or isolated:

- low-entropy cloud passwords presented as PINs;
- destructive sign-out;
- cloud-password recovery UI in a passwordless product;
- ambiguous new-versus-returning account tabs;
- cross-account reuse of cached profile fields;
- guest-profile application before merge consent.

## 3. New OTP architecture

New and returning cloud users now share one flow:

1. Enter an email address.
2. Accept the Privacy Policy and Terms of Service.
3. Select **Send Code**.
4. Enter one six-digit email code in a single accessible input.
5. Select **Verify**.
6. Hydrate the profile whose ID exactly matches the authenticated Supabase UUID.
7. Continue to the remembered deep link, remembered Landing intent, existing onboarding, or Hub in that order.

The OTP request gate is in memory. It prevents overlapping requests and applies a 60-second client resend cooldown without treating that client timer as a security boundary. The server remains authoritative for expiration and rate limiting.

`courtcall-auth.js` contains the small, testable authentication contract. `index.html` owns application orchestration, route continuation, profile hydration, and guest-data consent. OTP values never enter CourtCall's storage model.

## 4. Supabase methods used

The implementation uses the current Supabase JavaScript passwordless contracts:

```js
supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: true }
});

supabase.auth.verifyOtp({
  email,
  token,
  type: 'email'
});
```

`shouldCreateUser: true` intentionally gives new and returning users one entry point. Verification explicitly uses the email-token type. Active sessions restore with `auth.getSession()` and do not request a fresh code.

The deployed Supabase email template must include `{{ .Token }}` for a six-digit code instead of relying only on a magic-link template. Production delivery also requires a working SMTP configuration and suitable Supabase Auth rate-limit settings. Reference: [Supabase passwordless email authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless), [signInWithOtp](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), and [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## 5. Profile compatibility

The authenticated Supabase UUID remains the only cloud identity key:

- `auth.users.id` → `public.profiles.id`;
- `public.games.user_id` → the same profile ID;
- Community creator, member, post, event, and related identity fields continue to use the existing user ID contract.

The static SQL defines `public.profiles.id uuid references auth.users on delete cascade primary key`. Its new-user trigger inserts a profile with `new.id`, and the RLS policies scope reads/inserts/updates to `auth.uid() = id`.

Hydration accepts a cached local profile only when its ID matches the active Supabase UUID. It first reads the matching cloud profile. A missing row can be upserted with the same UUID; a network or permission failure is not misclassified as a missing profile. Legacy PIN fields are not copied into the cloud-authenticated profile.

No Supabase table, column, migration, trigger, RPC, or RLS policy was changed in Phase 9.

## 6. Guest behavior

Guest mode remains an explicit secondary action. Selecting **Continue as Guest** does not invoke any OTP function. Optional local profile customization is collapsed by default so it does not obscure the primary cloud-authentication path.

Guest data remains local unless a successfully authenticated user explicitly accepts the existing synchronization offer. The Phase 9 correction moves all guest-profile remapping behind that consent. Declining leaves guest data intact on the device. Accepting uses the authenticated UUID and the established migration/synchronization path.

No implicit merge is performed based on a matching email, display name, or device profile. This prevents one account from inheriting another local account's fields.

## 7. Session restoration

Startup continues to open the cinematic Landing route when the URL has no explicit hash. For an explicit route, CourtCall resolves the hash while the Supabase session is restored.

An existing valid session is restored with `getSession()` and normal profile hydration. No OTP is sent on reload. If a visitor requests a private route, that hash is held in memory while authentication completes and then resumed. The Landing CTA intent also remains memory-only; it is not written to `localStorage` or `sessionStorage`.

The existing guest profile remains sufficient for local/private product routes. This preserves the app's established offline-first behavior without pretending that a guest is a Supabase user.

## 8. Logout

Logout is now non-destructive:

- Supabase sign-out is requested when a cloud client is available.
- Only the active profile pointer and the matching Supabase session identity are removed.
- Matches, teams, player history, tournaments, Communities, settings, backups, and unrelated local data are preserved.
- The user returns to the public Landing screen.

The broad storage wipe remains available only through the explicit **Clear All Data** operation. It is no longer called by ordinary logout.

## 9. Legacy PIN handling

Cloud PIN/password authentication, cloud password reset, and the `s-reset-pin` DOM screen are retired. The legacy `#/reset-pin` hash is retained only as a compatibility alias and safely redirects to Profile email-code sign-in with route reason `legacy_pin_retired`.

Pre-existing device-only profiles that contain the legacy PBKDF2 verifier can still reveal a clearly labelled local-PIN form. That form remains isolated from Supabase, retains its client lockout behavior, and never upgrades the PIN into a cloud credential. Users cannot create a new PIN-based cloud or local account.

## 10. Security review

Verified controls:

- OTP codes are normalized in memory and are not persisted or logged.
- No cloud password/PIN APIs remain in production authentication code.
- Email validation occurs before a request.
- Request errors are mapped to user-safe messages rather than exposing raw Supabase details.
- New and returning users receive the same request response, reducing account-enumeration signals in the UI.
- The request gate blocks overlapping sends and enforces the visible resend interval.
- Client throttling is treated only as usability protection; Supabase server limits remain authoritative.
- Profile hydration fails closed on a mismatched UUID.
- Guest synchronization requires explicit consent after authentication.
- Logout no longer erases unrelated device data.
- The browser uses the existing public Supabase client bundle and anon/publishable client context; no privileged server credential was added.

Static RLS review confirms owner-scoped `profiles` rules and the hardened Community policies already present in migrations. Live RLS behavior could not be exercised while the linked project was inactive.

## 11. Accessibility

The Profile authentication screen now provides:

- explicit labels for email and verification code;
- `autocomplete="email"` and `autocomplete="one-time-code"`;
- a single six-digit code field with numeric input hints, which supports typing and paste without six focus jumps;
- programmatically named consent and action controls;
- `role="status"`, polite live updates, and atomic status announcements;
- visible focus styling and keyboard-operable buttons/forms;
- disabled/loading states that do not remove accessible names;
- error text in addition to color;
- a clear separation between cloud sign-in, guest continuation, and legacy local-PIN compatibility;
- reduced-motion styling.

The final static UI suite also confirmed unique IDs, named form controls, alt text, and named buttons across the canonical page.

## 12. Responsive verification

The Phase 9 CSS and automated contracts cover the required target classes:

| Target | Verification |
|---|---|
| 320×568 | phone layout rules, single-column auth actions, bounded code/input widths, reduced vertical spacing |
| 390×844 | primary phone breakpoint and 344 px live control width |
| 844×390 | short-landscape rules and scrollable auth surface |
| 768×1024 | tablet-width fluid card contract |
| 1440×900 | centered desktop card with bounded line length |

The in-app browser provided a fixed 1280×720 window whose document viewport was 1265×720. On the canonical Profile page:

- page width: 1265 client / 1265 scroll;
- active-screen width: 1265 client / 1265 scroll;
- horizontal overflow: 0 px;
- email control: 344×47 px;
- Send Code action: 344×50 px;
- Continue as Guest action: 344×49 px;
- local-profile panel: collapsed with `aria-expanded="false"`.

Exact live viewport emulation for all five sizes was unavailable in the provided browser controller. Those sizes are therefore covered by responsive CSS/test contracts, while the actual production DOM was exercised at the fixed available viewport. This limitation is not represented as a five-viewport live-browser pass.

## 13. PWA/offline changes

The service-worker shell advanced from `v51` to `v52` and now precaches:

- `courtcall-auth.css?v=20260822`;
- `courtcall-auth.js?v=20260822`.

The navigation strategy was not changed. In the browser, the pending PWA update was accepted and reloaded; the update prompt then cleared. Direct HTTP verification returned 200 for the canonical page, both auth assets, and `basketball-sw.js`. SHA-256 comparison showed every served response was byte-for-byte identical to the working-tree file, ruling out a stale local shell for the tested assets.

When email delivery is unreachable, the auth surface gives a safe retry/offline message and keeps **Continue as Guest** available. OTP request and verification correctly remain unavailable offline; CourtCall does not simulate cloud authentication.

## 14. Automated test results

Final results:

| Gate | Result |
|---|---:|
| Root JavaScript syntax | 12/12 files passed |
| Inline `index.html` script parse | 1/1 passed |
| Focused Phase 9 suite | 14 passed, 0 failed |
| Full regression suite | 173 passed, 0 failed |

The focused suite verifies the Supabase request/verification arguments, normalization, resend gate, safe errors, UUID profile reuse, mismatched-cache rejection, onboarding, explicit guest behavior, session restoration, non-destructive logout, route gating, OTP non-persistence, legacy-PIN isolation, accessible UI, responsive rules, and offline-shell caching.

The full suite includes all prior cinematic, route-separation, game, team/history, tournament, Community, supporting-product, security, settings, UI, and motion contracts.

## 15. Browser verification

All interactive checks used the canonical production application at `http://127.0.0.1:8765/`, not a test harness or alternate HTML copy.

Verified in the production DOM:

- root loads the public cinematic Landing architecture;
- `#/profile` loads the passwordless email-code screen;
- auth JavaScript and CSS are the versioned Phase 9 files;
- the email field, consent checkbox, Send Code, live status, guest action, and local-profile toggle are present and programmatically named;
- the guest customization panel starts collapsed;
- a request against the unavailable cloud service produces a caught, user-safe status instead of an unhandled UI failure;
- **Continue as Guest** routes immediately to `#/hub`;
- the guest `#/history` deep link opens correctly and remains on `#/history` after reload;
- the Profile and Hub/History routes have zero page-level horizontal overflow at the available viewport;
- the PWA update was reloaded and the server delivered the exact current page, auth assets, and v52 worker.

The exercised DOM showed no application crash, stale update overlay, or visible runtime error. The browser controller did not expose a console-log export, so a literal console transcript could not be captured; syntax and 173 regression tests provide the additional executable error gate.

## 16. Environment-dependent checks

The following require an active and correctly configured Supabase environment:

- delivery of a real six-digit email;
- verification of a real code and expiry behavior;
- new-user creation with `shouldCreateUser: true`;
- returning-user sign-in to an existing account;
- authenticated profile-trigger execution;
- live profile SELECT/UPSERT under RLS;
- authenticated Community identity continuity under live RLS;
- real SMTP sender reputation, bounce handling, and deliverability;
- hosted Auth email template containing `{{ .Token }}`;
- hosted OTP expiry, resend, and rate-limit configuration;
- multi-device session restoration and sign-out propagation.

The local browser request path was allowed to fail honestly. No OTP, account, email delivery, cloud row, or RLS result was faked.

## 17. Remaining limitations

- The linked Supabase project was inactive, so the end-to-end cloud path remains an environment-dependent release check.
- The 60-second client countdown improves UX but cannot replace server-side throttling.
- The Terms/Privacy checkbox gates the client request but Phase 9 does not add a server-side consent-ledger table.
- An authenticated logout could not be exercised in the live browser without a deliverable OTP; its behavior is covered by focused tests and static call-path review.
- A clean first-visit browser profile was not destructively manufactured because the shared browser already contained legitimate local CourtCall data. Anonymous/private-route behavior is covered by pure route tests, and the existing guest path was tested live.
- Exact live emulation at 320×568, 390×844, 844×390, 768×1024, and 1440×900 was not available through the in-app browser controller; responsive contracts cover those targets, and the available 1265×720 production viewport was tested interactively.
- Direct console export was unavailable in the current browser controller. No visible/runtime failure occurred, all scripts parsed, and the full 173-test suite passed.

### Files changed

- `courtcall-auth.js` — isolated OTP contract and utilities.
- `courtcall-auth.css` — passwordless Profile/auth presentation and responsive states.
- `index.html` — OTP UI/orchestration, session/profile continuation, guest consent correction, and non-destructive logout.
- `courtcall-core.js` — legacy reset-PIN route compatibility.
- `basketball-sw.js` — v52 offline shell and auth assets.
- `COURTCALL_SPEC.md` — canonical passwordless-auth documentation and route compatibility.
- `tests/courtcall-phase9-otp-auth.test.js` — focused Phase 9 coverage.
- Existing phase/service-worker contract tests — v52 expectations and retired reset-PIN assertions.
- `COURTCALL_PHASE9_OTP_AUTH.md` — this verification report.

No commit or push was performed. Phase 10 was not started.
