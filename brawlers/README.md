# Brawlers Basketball Experience

A one-page daily sign-up list for the Brawlers pickup group. Players add their names, anyone generates **skill-balanced teams** that everyone sees live, and the list or teams are shared to WhatsApp.

Live: https://brawlers-basketball-exp-8a6c3.web.app/ (Firebase project `brawlers-basketball-exp-8a6c3`)

## Files

| File | Purpose |
|---|---|
| `index.html` | The page (Firebase JS SDK from gstatic, no build step) |
| `brawlers-core.js` | Pure logic: India-time session day, name rules, balancing algorithm, WhatsApp message. Tested by `tests/brawlers-core.test.js` |
| `firestore.rules` | **The real security boundary** — who can add, delete, rate, and administer |
| `firebase.json`, `.firebaserc` | Hosting + rules deploy config |
| `logo.jpeg` | **Not in the repo — copy the current logo here before deploying**, or the header logo and background disappear |

## How it works

- **Players** are signed in anonymously and can add a name and remove names they added. Names are unique per day, ignoring capitals and extra spaces; the database enforces this.
- **Teams**: anyone can press *Generate Balanced Teams*. The result is saved for the day, so everyone sees the same teams. If players join or leave afterwards, the page flags the teams as out of date.
- **Skill balancing**: admins rate players from 1 to 5 stars. Ratings are remembered across days, and unrated players count as 3. The algorithm:
  - keeps team sizes within one player of each other;
  - minimises the gap in total team strength, running about 200 randomised trials and swapping players between teams to even them out;
  - gives a different but equally fair line-up each time you regenerate.
- **Admins** sign in with Google. The page has no password. Admin status is a document in the `admins` collection, checked by the database rules.
- **Day** rolls over at midnight **India time**, even if the page stays open.

## One-time setup (Firebase console)

1. **Authentication → Sign-in method:** keep *Anonymous* enabled; enable *Google*.
2. **Deploy the rules and page** (below). Do this before anything else: the old page had no server-side protection.
3. **Make the first admin:**
   1. Open the page, tap *Admin sign-in (Google)*, and copy the ID it shows.
   2. In **Firestore → Data**, create collection `admins` with a document whose **ID is that value**.
   3. Give that document the fields `name` (string), `addedBy` (string, the same ID) and `addedAt` (timestamp).
4. **Make more admins:** each new admin signs in with Google and sends you their ID. Paste it under *Admin tools → Add admin*.

## Deploy

```bash
npm install -g firebase-tools
firebase login
cd brawlers
cp /path/to/logo.jpeg .
firebase deploy --only firestore:rules,hosting
```

## Notes and limits

- **Google sign-in inside WhatsApp's built-in browser** is usually blocked. Admins should open the link in Chrome or Safari.
- **Skill ratings are hidden from players in the page**, but any signed-in visitor could read them with developer tools. Hiding them completely needs a Cloud Function, which requires the paid Blaze plan.
- **Spam protection:** turn on Firebase **App Check** (reCAPTCHA v3) as a next step to stop scripted spam.
- **Players added by the old version of the page** have no owner, so only admins can remove them.
- **Cloudflare:** this folder is blocked on `courtcall13.win` by `/_redirects`. It is also not part of the GitHub Pages build.
