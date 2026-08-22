const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('production builder emits the complete runtime without repository internals', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'courtcall-release-'));
  try {
    const result = spawnSync(process.execPath, ['tools/build-public-artifact.mjs', output], {
      cwd: root,
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const required = [
      'index.html', 'basketball.html', 'basketball-sw.js', 'basketball.manifest.json',
      'courtcall-auth.js', 'courtcall-auth.css', 'courtcall-cinematic.js',
      'courtcall-cinematic.css', 'courtcall-communities.js',
      'courtcall-motion-foundation.js', 'courtcall-supporting-product.js',
      'assets/cinematic/01-empty-court.mp4',
      'assets/cinematic/01-empty-court.webm',
      'assets/cinematic/courtcall-master.webp',
      'assets/atmospheres/arena.webp', 'icons/icon-192.png', '404.html'
    ];
    for (const file of required) {
      assert.ok(fs.statSync(path.join(output, file)).size > 0, `${file} missing or empty`);
    }

    for (const privatePath of ['tests', 'tools', 'supabase', '.github']) {
      assert.equal(fs.existsSync(path.join(output, privatePath)), false, `${privatePath} leaked`);
    }
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test('Pages workflow uses the validated production builder', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  assert.match(workflow, /branches:\s*\[master\]/);
  assert.match(workflow, /node tools\/build-public-artifact\.mjs dist/);
  assert.match(workflow, /path:\s*['"]dist['"]/);
});

test('PWA navigation is compatible with root and GitHub project paths', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'basketball.manifest.json'), 'utf8'));
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.shortcuts[0].url, './#/setup');
});

test('a missing static asset cannot be replaced by the application shell', () => {
  const notFound = fs.readFileSync(path.join(root, '404.html'), 'utf8');
  assert.doesNotMatch(notFound, /basketball-supa\.js|courtcall-core\.js/);
  assert.match(notFound, /noindex/);
});
