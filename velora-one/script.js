/* ============================================================
   VELORA ONE — script.js
   Plain vanilla JS, no dependencies.
   Features: sticky header state, mobile menu, reveal-on-scroll,
   FAQ single-open accordion, back-to-top, form validation +
   WhatsApp submission, footer year, visitor counter placeholder.
   ============================================================ */

(function () {
  'use strict';

  var WHATSAPP_NUMBER = '916366463924'; // Velora One WhatsApp (country code + number, no "+")

  /* ------------------------------------------------------------
     1. STICKY HEADER — subtle shadow once the page is scrolled
     ------------------------------------------------------------ */
  var header = document.getElementById('siteHeader');
  var backTop = document.getElementById('backTop');

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    header.classList.toggle('scrolled', y > 10);
    backTop.classList.toggle('visible', y > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------
     2. MOBILE MENU
     ------------------------------------------------------------ */
  var navToggle = document.getElementById('navToggle');
  var siteNav = document.getElementById('siteNav');

  navToggle.addEventListener('click', function () {
    var open = siteNav.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  // Close the menu after tapping any link inside it
  siteNav.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      siteNav.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  /* ------------------------------------------------------------
     3. REVEAL-ON-SCROLL — IntersectionObserver adds .in-view
     (Elements are visible by default if IO is unsupported.)
     ------------------------------------------------------------ */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  }

  /* ------------------------------------------------------------
     4. FAQ ACCORDION — only one <details> open at a time
     ------------------------------------------------------------ */
  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        faqItems.forEach(function (other) {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  /* ------------------------------------------------------------
     5. BACK TO TOP
     ------------------------------------------------------------ */
  backTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ------------------------------------------------------------
     6. FOOTER YEAR
     ------------------------------------------------------------ */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------
     7. INQUIRY FORM → WHATSAPP
     Validates required fields, builds a formatted message from
     the entered details, and opens a wa.me chat with Velora One.
     Nothing is sent until the visitor presses "send" in WhatsApp.

     ▸ CONNECTING A REAL BACKEND LATER (pick one):

       a) FORMSPREE (easiest):
          - Create a form at https://formspree.io → get an endpoint URL.
          - Inside handleSubmit below, before opening WhatsApp, add:
              fetch('https://formspree.io/f/YOUR_ID', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });

       b) NETLIFY FORMS (if deployed on Netlify):
          - Add `name="inquiry" method="POST" data-netlify="true"`
            to the <form> tag in index.html and a hidden input:
              <input type="hidden" name="form-name" value="inquiry">
          - Remove `e.preventDefault()` OR post via fetch with
            'application/x-www-form-urlencoded' encoding.

       c) SUPABASE (own lead database):
          - Create a `leads` table (columns matching the field names below).
          - Load @supabase/supabase-js, then inside handleSubmit:
              await supabase.from('leads').insert([data]);
          - Use the anon key + Row Level Security INSERT-only policy.

       d) GOOGLE FORMS:
          - Build a matching Google Form, use its `formResponse` URL and
            entry IDs, then POST via fetch (mode: 'no-cors').

       e) EMAIL BACKEND / CRM:
          - Point a fetch() at your own endpoint (e.g. a serverless
            function on Vercel/Netlify) that emails you or pushes the
            lead into your CRM.

     In every case, KEEP the WhatsApp redirect — it is the primary
     conversion path; the backend call is a silent backup.
     ------------------------------------------------------------ */
  var form = document.getElementById('inquiryForm');
  var errorBox = document.getElementById('formError');

  function fieldValue(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function markInvalid(id, invalid) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('invalid', invalid);
  }

  form.addEventListener('submit', function handleSubmit(e) {
    e.preventDefault();

    var data = {
      name: fieldValue('fName'),
      mobile: fieldValue('fMobile'),
      email: fieldValue('fEmail'),
      eventType: fieldValue('fType'),
      eventDate: fieldValue('fDate'),
      location: fieldValue('fLocation'),
      guests: fieldValue('fGuests'),
      budget: fieldValue('fBudget'),
      style: fieldValue('fStyle'),
      requirement: fieldValue('fReq'),
      message: fieldValue('fMsg')
    };

    // --- Validation: name, mobile, event type are required ---
    var problems = [];

    var nameOk = data.name.length >= 2;
    markInvalid('fName', !nameOk);
    if (!nameOk) problems.push('your full name');

    // Accept Indian mobile formats: optional +91/0 prefix, 10 digits
    var digits = data.mobile.replace(/[^\d]/g, '');
    var mobileOk = /^(91)?0?[6-9]\d{9}$/.test(digits) || /^[6-9]\d{9}$/.test(digits);
    markInvalid('fMobile', !mobileOk);
    if (!mobileOk) problems.push('a valid 10-digit mobile number');

    var typeOk = data.eventType !== '';
    markInvalid('fType', !typeOk);
    if (!typeOk) problems.push('your event type');

    // Email is optional, but validate the format if provided
    var emailOk = data.email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
    markInvalid('fEmail', !emailOk);
    if (!emailOk) problems.push('a valid email address');

    if (problems.length) {
      errorBox.hidden = false;
      errorBox.textContent = 'Please provide ' + problems.join(', ') + '.';
      var firstInvalid = form.querySelector('.invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    errorBox.hidden = true;
    errorBox.textContent = '';

    // --- Build the WhatsApp message ---
    var lines = [
      'Hi Velora One, I would like to enquire about an event.',
      '',
      'Name: ' + data.name,
      'Mobile: ' + data.mobile,
      'Email: ' + (data.email || '-'),
      'Event Type: ' + data.eventType,
      'Event Date: ' + (data.eventDate || '-'),
      'Location: ' + (data.location || '-'),
      'Guest Count: ' + (data.guests || '-'),
      'Budget: ' + (data.budget || '-'),
      'Preferred Style: ' + (data.style || '-'),
      'Requirement Type: ' + (data.requirement || '-'),
      'Message: ' + (data.message || '-'),
      '',
      'Please contact me.'
    ];

    var url = 'https://wa.me/' + WHATSAPP_NUMBER +
              '?text=' + encodeURIComponent(lines.join('\n'));

    // ▸ Backend hook: fire your Formspree/Supabase/etc. call HERE,
    //   before the redirect, so the lead is stored even if the
    //   visitor abandons the WhatsApp step.

    window.open(url, '_blank', 'noopener');
  });

  /* ------------------------------------------------------------
     8. VISITOR COUNTER (placeholder)
     The "1,000+" figure in #visitorCount is static for now.

     ▸ CONNECTING A REAL COUNTER LATER (pick one):

       a) GOOGLE ANALYTICS 4 (recommended for insight, not display):
          - Create a GA4 property → add its gtag.js snippet to <head>.
          - GA is for YOUR dashboard; to display counts on the page
            you'd need the GA Data API via a small serverless function.

       b) PLAUSIBLE (privacy-friendly):
          - Add their one-line <script> to <head>; use their Stats API
            to fetch the visitor total and set:
              document.getElementById('visitorCount').textContent = n;

       c) SUPABASE:
          - Create a `page_visits` table or a Postgres function that
            increments and returns a counter; call it on page load:
              const { data } = await supabase.rpc('increment_visits');
              visitorCount.textContent = data.toLocaleString('en-IN') + '+';

       d) FIREBASE:
          - Use a Realtime Database counter with a transaction-based
            increment on page load, then render the value.

       e) SIMPLE COUNTER APIS (e.g. counterapi.dev — CountAPI is
          discontinued): one fetch() to hit + read the counter.

     Keep the displayed number tasteful — round it ("1,200+") rather
     than showing a live ticking figure.
     ------------------------------------------------------------ */

})();
