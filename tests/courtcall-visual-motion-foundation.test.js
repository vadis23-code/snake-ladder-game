const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'courtcall-motion-foundation.css'), 'utf8');
const motion = fs.readFileSync(path.join(root, 'courtcall-motion-foundation.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'basketball-sw.js'), 'utf8');

test('motion foundation loads last and is available offline', () => {
  const design = html.indexOf('<link rel="stylesheet" href="./courtcall-design-system.css">');
  const game = html.indexOf('<link rel="stylesheet" href="./courtcall-core-game.css">');
  const teamHistory = html.indexOf('<link rel="stylesheet" href="./courtcall-team-history.css">');
  const motionCss = html.indexOf('<link rel="stylesheet" href="./courtcall-motion-foundation.css">');
  const motionJs = html.indexOf('<script src="./courtcall-motion-foundation.js"></script>');

  assert.ok(design < game && game < teamHistory && teamHistory < motionCss);
  assert.ok(motionJs > html.lastIndexOf('</script>', motionJs - 1));
  assert.match(serviceWorker, /CACHE_VERSION = 'v55'/);
  assert.match(serviceWorker, /'\.\/courtcall-motion-foundation\.css'/);
  assert.match(serviceWorker, /'\.\/courtcall-motion-foundation\.js'/);
});

test('motion tokens match the required easing and timing language', () => {
  assert.match(css, /--cc-motion-spring:\s*cubic-bezier\(\.34,\s*1\.56,\s*\.64,\s*1\)/);
  assert.match(css, /--cc-motion-standard:\s*cubic-bezier\(\.4,\s*0,\s*\.2,\s*1\)/);
  assert.match(css, /--cc-motion-entrance:\s*cubic-bezier\(\.16,\s*1,\s*\.3,\s*1\)/);
  assert.match(css, /--cc-motion-press:\s*100ms/);
  assert.match(css, /--cc-motion-nav:\s*240ms/);
  assert.match(css, /--cc-motion-card:\s*320ms/);
  assert.match(css, /--cc-motion-celebration:\s*900ms/);
});

test('live-game motion covers score, lead, foul, possession, period and feed', () => {
  [
    'ccMotionScoreSpring', 'ccMotionScoreRipple', 'ccMotionScoreParticle',
    '.team-panel.leading', 'ccMotionFoulPulse', 'ccMotionFoulShake',
    'ccMotionPossession', 'ccMotionPeriod', 'ccMotionFeedIn'
  ].forEach(hook => assert.ok(css.includes(hook), `missing ${hook}`));
  assert.match(css, /\.score-fx[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /translateY\(-\.625rem\)/);
  assert.match(motion, /index \* 40/);
  assert.doesNotMatch(motion, /preventDefault\(/);
  assert.match(html, /if\(pad\.dataset\.scoreControls===signature\)return/);
  assert.match(html, /pad\.dataset\.scoreControls=signature/);
});

test('data-backed signals do not fabricate hot-hand or comeback state', () => {
  assert.match(motion, /currentState\.history\.filter\(event => !event\.type \|\| event\.type === 'score'\)/);
  assert.match(motion, /if \(erased < 6 \|\| priorDifference >= 0 \|\| finalDifference < 0\) return null/);
  assert.match(motion, /banner\.classList\.contains\('active'\)/);
  assert.match(motion, /banner\.dataset\.motionLabel = 'HOT HAND'/);
  assert.match(motion, /currentState\.gameOver \|\| reducedMotion\(\)/);
});

test('victory keeps primary actions immediate and celebration restrained', () => {
  assert.equal((html.match(/id="pg-save-exit"/g) || []).length, 1);
  assert.equal((html.match(/id="pg-new-game"/g) || []).length, 1);
  assert.match(html, /class="pg-primary-actions"[\s\S]*?id="pg-save-exit"[\s\S]*?id="pg-new-game"/);
  assert.match(html, /for\(let i=0;i<24;i\+\+\)/);
  assert.match(html, /\.75\+Math\.random\(\)\*\.35/);
  assert.match(html, /setTimeout\(\(\)=>\{c\.innerHTML=''\},1500\)/);
  assert.match(css, /ccMotionFinalScore/);
});

test('navigation, cards, brackets and reactions remain presentation-only', () => {
  [
    '.screen.cc-motion-route-in', '.btm-nav .bn-btn::after',
    '@media (hover: hover) and (pointer: fine)', 'ccMotionBracketAdvance',
    'ccMotionBracketLine', '.cc-reaction-float'
  ].forEach(hook => assert.ok(css.includes(hook), `missing ${hook}`));
  assert.match(motion, /document\.addEventListener\('click'[\s\S]*?\.react-btn[\s\S]*?true\);/);
  assert.doesNotMatch(motion, /localStorage|sessionStorage|supabase|supaUpdate|fetch\(/i);
  assert.doesNotMatch(motion, /setInterval|requestIdleCallback|canvas|getContext/i);
  assert.doesNotMatch(`${css}\n${motion}`, /gsap|lenis|three\.js/i);
});

test('reduced motion covers both OS and in-app preferences', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /html\[data-reduced-motion='true'\]/);
  assert.match(css, /#pg-overlay \.cp \{ display: none !important; \}/);
  assert.match(motion, /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(motion, /document\.documentElement\.dataset\.reducedMotion === 'true'/);
});

test('motion files have balanced blocks and the application has no duplicate static IDs', () => {
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((cleanCss.match(/\{/g) || []).length, (cleanCss.match(/\}/g) || []).length);
  assert.equal((motion.match(/\{/g) || []).length, (motion.match(/\}/g) || []).length);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});
