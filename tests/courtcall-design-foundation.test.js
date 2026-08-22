const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'courtcall-design-system.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'basketball-sw.js'), 'utf8');

function channelToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const clean = hex.replace('#', '');
  const channels = [0, 2, 4].map(offset => parseInt(clean.slice(offset, offset + 2), 16));
  return 0.2126 * channelToLinear(channels[0])
    + 0.7152 * channelToLinear(channels[1])
    + 0.0722 * channelToLinear(channels[2]);
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('Phase 3 stylesheet is loaded after legacy inline styles and cached offline', () => {
  const inlineEnd = html.indexOf('</style>');
  const foundationLink = html.indexOf('<link rel="stylesheet" href="./courtcall-design-system.css">');

  assert.ok(inlineEnd >= 0, 'legacy inline style block must remain present');
  assert.ok(foundationLink > inlineEnd, 'foundation stylesheet must load after legacy styles');
  assert.match(serviceWorker, /CACHE_VERSION = 'v53'/);
  assert.match(serviceWorker, /'\.\/courtcall-design-system\.css'/);
});

test('design foundation defines the complete semantic token families', () => {
  [
    '--cc-color-canvas', '--cc-color-surface-1', '--cc-color-text',
    '--cc-color-action-fill', '--cc-color-focus', '--cc-color-team-a',
    '--cc-font-display', '--cc-font-ui', '--cc-type-display-xl',
    '--cc-type-body', '--cc-type-numeric-xl', '--cc-space-1', '--cc-space-24',
    '--cc-radius-sm', '--cc-radius-xl', '--cc-shadow-modal', '--cc-gutter',
    '--cc-ease-spring', '--cc-ease-standard', '--cc-duration-fast'
  ].forEach(token => assert.ok(css.includes(token), `missing token ${token}`));
});

test('reusable primitives cover actions, chips, cards, forms, dialogs, tabs and layout', () => {
  [
    '.cc-button', '.cc-button--primary', '.cc-button--secondary',
    '.cc-chip', '.cc-card', '.cc-card--interactive', '.cc-field', '.cc-input',
    '.cc-dialog', '.cc-tablist', '.cc-tab', '.cc-container', '.cc-stack', '.cc-grid'
  ].forEach(selector => assert.ok(css.includes(selector), `missing primitive ${selector}`));
});

test('foundation includes accessibility and responsive contracts', () => {
  assert.match(css, /--cc-control-min:\s*2\.75rem/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-contrast: more\)/);
  assert.match(css, /orientation: landscape/);
  assert.match(css, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.help-chat-wrap\[aria-hidden='true'\]/);
  assert.ok(contrast('#c2410c', '#ffffff') >= 4.5, 'primary action must meet AA contrast with white text');
});

test('route foundation maintains one active landmark and tears down stale changelog state', () => {
  assert.match(html, /function _syncActiveScreenA11y\(name\)/);
  assert.match(html, /screen\.toggleAttribute\('inert',!active\)/);
  assert.match(html, /screen\.setAttribute\('aria-hidden',active\?'false':'true'\)/);
  assert.match(html, /skip\.setAttribute\('href',`#\$\{activeScreen\.id\}`\)/);
  assert.match(html, /focusTarget\.focus\(\{preventScroll:true\}\)/);
  assert.match(html, /closeChangelog\(\{restoreFocus:false\}\)/);
  assert.match(html, /_syncActiveScreenA11y\(name\);/);
});

test('legacy password recovery is retired in favor of the OTP identity path', () => {
  assert.doesNotMatch(html, /id="s-reset-pin"|resetPasswordForEmail|updateUser\(\{password/);
  assert.match(html, /event === 'SIGNED_IN' \|\| event === 'PASSWORD_RECOVERY'/);
  assert.match(html, /CourtCallAuth\.verifyEmailOtp/);
});

test('design foundation has balanced block braces', () => {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const opens = (withoutComments.match(/\{/g) || []).length;
  const closes = (withoutComments.match(/\}/g) || []).length;
  assert.equal(opens, closes);
});
