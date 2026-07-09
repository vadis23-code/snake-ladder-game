# Velora One — Premium Landing Site

A single-page, static luxury landing website for **Velora One** — premium event planning & décor, Bengaluru.

**Files**

| File | Purpose |
|---|---|
| `index.html` | All content, SEO meta, and schema markup |
| `styles.css` | Design system (colours, typography, layout, animations) |
| `script.js` | Menu, accordion, reveal animations, WhatsApp form logic |

No build step. Open `index.html` in a browser, or deploy the folder as-is.

---

## 1. Replacing image placeholders with real photos

Every placeholder is a `div` with class `ph` and a code comment starting with `REPLACE-IMAGE:` right above it in `index.html`. Search the file for `REPLACE-IMAGE` to find them all.

**How to replace** — swap the placeholder `div` for an `<img>`:

```html
<!-- before -->
<div class="ph ph-tile ph-g1" role="img" aria-label="..."></div>

<!-- after -->
<img src="images/gallery/birthday-decor.webp"
     alt="Elegant birthday décor setup by Velora One in Bengaluru"
     loading="lazy" width="800" height="1000">
```

**Recommended sizes** (keep each file under ~200 KB):

| Location | Size | Notes |
|---|---|---|
| Full-page backdrop | 1920 × 1280 | Replace `images/celebration-bg.jpg` — a defocused/wide evening celebration shot works best; it shows through the hero, quote band, and final CTA |
| Hero visual | 1200 × 1440 | Your single best décor shot |
| About visual | 900 × 1100 | Brand/venue mood shot |
| Gallery tiles | 800 × 1000 | Large tile: 1000 × 1250 |
| Before/after | 800 × 600 each | Same venue, same angle |
| Moodboards | 800 × 500 | Style-representative shots |
| Instagram previews | 700 × 700 square | Link each to its real post |

**Optimising:** export as **WebP** (use [squoosh.app](https://squoosh.app) — free, in-browser), quality ~75. Always keep `loading="lazy"` on everything except the hero image, and write descriptive **alt text** including the event type and "Bengaluru" (good for SEO).

**Testimonials:** the four reviews are marked as placeholders in the HTML — replace names, event types, and quotes with real client feedback as it comes in.

---

## 2. Connecting the inquiry form

Right now the form validates and opens **WhatsApp** with all details pre-filled — zero backend needed, works immediately. To also *store* leads, see the large comment block in `script.js` (section 7). Summary of options, easiest first:

1. **Formspree** — create a free form at formspree.io, add one `fetch()` call at the marked hook in `script.js`. Leads arrive by email. ~5 minutes.
2. **Netlify Forms** — if you deploy on Netlify, add `data-netlify="true"` to the form tag; leads appear in the Netlify dashboard.
3. **Google Forms** — mirror the fields in a Google Form and POST to its `formResponse` URL; responses land in a Google Sheet.
4. **Supabase** — create a `leads` table with RLS (INSERT-only anon policy) and insert via `supabase-js`. Best long-term option if you later want an admin dashboard.
5. **Email/CRM backend** — a small serverless function (Vercel/Netlify) that forwards leads anywhere.

Keep the WhatsApp redirect in all cases — it's the primary conversion path; the backend is a silent backup so no lead is lost.

## 3. WhatsApp inquiry

All WhatsApp links use `https://wa.me/916366463924?text=...`. If the number ever changes, update:
- `WHATSAPP_NUMBER` at the top of `script.js`
- Search `index.html` for `916366463924` and replace all occurrences

## 4. Visitor tracking

The "1,000+ Page Visitors" figure is a static placeholder. `script.js` section 8 documents wiring a real counter via **Google Analytics 4** (add the gtag snippet to `<head>` for your own dashboard — recommended first step), **Plausible**, **Supabase**, **Firebase**, or a simple counter API. Keep the on-page number rounded ("1,200+") — never a live ticker.

## 5. Instagram

- Handle and links (`@veloraoneevents`) are already wired throughout.
- The 6 preview cards are placeholders — replace each with a real post image and link it to the actual post URL.
- For a **live feed** later: use [Behold.so](https://behold.so), Elfsight, or SnapWidget (all offer free tiers) and paste their embed snippet in place of the `.insta-grid` div. Instagram's official oEmbed requires a Facebook developer app — third-party widgets are far simpler.

## 6. Google Reviews & Business Profile (later)

1. Create a **Google Business Profile** (business.google.com) for "Velora One", category *Event planner*, Bengaluru. This is the single highest-impact local SEO step you can take.
2. Once you have real Google reviews, replace the placeholder Client Love cards and add `aggregateRating` to the LocalBusiness schema in `index.html`.
3. Add your Business Profile short link near the reviews section ("Review us on Google").

## 7. Deployment (GitHub + Vercel or Netlify)

**Vercel:** vercel.com → *Add New Project* → import this repo → set the root directory to `velora-one/` → Deploy. Every push auto-deploys.

**Netlify:** app.netlify.com → *Import from Git* → pick the repo → base directory `velora-one`, no build command, publish directory `velora-one` → Deploy.

**Custom domain:** buy `veloraone.in` (or similar), add it in the Vercel/Netlify domain settings, then update every `https://veloraone.in/` URL in `index.html` (canonical, Open Graph, schema `@id`/`url`) to the final domain.

## 8. SEO next steps

- ✅ Already in place: title/description/keywords, Open Graph, Twitter cards, LocalBusiness + Service + FAQPage schema, semantic headings, alt text.
- Add a real **og-image** (1200 × 630) and uncomment the two image meta tags in `<head>`.
- Add `sitemap.xml` + `robots.txt` at the deployed root, submit to **Google Search Console**.
- Publish the **Google Business Profile** and keep NAP (name, address, phone) identical everywhere.
- Post consistently on Instagram with Bengaluru-related tags; backlinks from local directories (JustDial, WeddingWire, UrbanPro) strengthen local ranking.
- Once real photos are added, run [PageSpeed Insights](https://pagespeed.web.dev) and keep images WebP + lazy-loaded.

## 9. Future premium upgrades

| Upgrade | Approach |
|---|---|
| Booking form with date availability | Supabase table + a small calendar UI |
| Event packages PDF / downloadable brochure | Design in Canva → link as `/brochure.pdf` with a "Download Our Brochure" button |
| Google Reviews feed | Business Profile API or an embed widget |
| Instagram live feed | Behold.so embed (see §5) |
| Admin dashboard | Supabase + a simple protected page listing leads |
| Supabase lead database | §2 option 4 — do this first; everything else builds on it |
| Payment collection (advances) | Razorpay payment links — no backend needed initially |
| Customer event tracker | Per-client status page (Supabase row + shareable link) |
| Moodboard generator | A quiz-style picker that composes a WhatsApp message with the chosen style |
