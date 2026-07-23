const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('settings expose and persist complete quick-game defaults', () => {
  for (const id of [
    'settings-game-type',
    'settings-scoring-rule',
    'settings-color-a',
    'settings-color-b',
    'settings-preferred-court',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /function applySavedGameDefaults\(\)/);
  assert.match(html, /function goSetup\(\)\{applySavedGameDefaults\(\)/);
});

test('score sound has a real volume-controlled implementation on both score paths', () => {
  assert.match(html, /id="settings-sound-volume"[^>]+type="range"/);
  assert.match(html, /function playScoreSound\(points,settings=getSettings\(\)\)/);
  assert.equal((html.match(/playScoreSound\(pts,s\);/g) || []).length, 2);
});

test('theme and reduced-motion preferences affect the document and 3D animation', () => {
  assert.match(html, /document\.documentElement\.dataset\.theme=theme/);
  assert.match(html, /document\.documentElement\.dataset\.reducedMotion=String\(!!settings\.reducedMotion\)/);
  assert.match(html, /const userReducedMotion=.*dataset\.reducedMotion==='true'/);
  assert.match(html, /courtcall-motion-change/);
});

test('settings surface successful sync and backup timestamps', () => {
  assert.match(html, /lastSync:'cc_last_successful_sync'/);
  assert.match(html, /lastBackup:'cc_last_backup'/);
  assert.match(html, /id="settings-last-sync"/);
  assert.match(html, /id="settings-last-backup"/);
  assert.match(html, /nextState===CourtCallCloudState\.SYNC\.ONLINE_SYNCED/);
});
