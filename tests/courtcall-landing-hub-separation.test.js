'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const cinematic = read('courtcall-cinematic.js');
const cinematicCss = read('courtcall-cinematic.css');
const globalVisuals = read('courtcall-global-visual-system.js');
const serviceWorker = read('basketball-sw.js');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is missing`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} has an unbalanced body`);
}

test('landing and hub are independent screens with one cinematic DOM', () => {
  assert.equal((html.match(/id="s-landing"/g) || []).length, 1);
  assert.equal((html.match(/id="s-hub"/g) || []).length, 1);
  assert.equal((html.match(/id="cc-cinema"/g) || []).length, 1);

  const hubStart = html.indexOf('id="s-hub"');
  const landingStart = html.indexOf('id="s-landing"');
  const cinemaStart = html.indexOf('id="cc-cinema"');
  assert.ok(hubStart >= 0 && landingStart > hubStart && cinemaStart > landingStart);
  assert.ok(html.indexOf('id="app-dashboard"') > hubStart);
  assert.ok(html.indexOf('id="app-dashboard"') < landingStart);
});

test('root startup always chooses landing while explicit hashes use the resolver', () => {
  const init = html.slice(html.indexOf("document.addEventListener('DOMContentLoaded'"));
  assert.match(init, /if\(location\.hash&&_routeFromHash\(\)\)[\s\S]*?showScreen\('landing'\)/);
  assert.equal((init.match(/showScreen\('landing'\)/g) || []).length, 2);
  assert.doesNotMatch(init.slice(0, init.indexOf('// Load builder state')), /showScreen\('hub'\)/);
});

test('landing is public and hub keeps the existing profile gate', () => {
  assert.match(html, /const _PUBLIC_SCREENS=new Set\(\['landing','profile'/);
  const publicSet = html.match(/const _PUBLIC_SCREENS=new Set\(\[([^\]]+)\]\)/)?.[1] || '';
  assert.doesNotMatch(publicSet, /'hub'/);
  assert.match(html, /ROUTE_LABELS=\{landing:'CourtCall'/);
});

test('CTA continuation is memory-only and routes setup after identity creation', () => {
  const fromLanding = functionBody(html, 'routeFromLanding');
  const afterIdentity = functionBody(html, 'routeAfterIdentity');
  assert.match(fromLanding, /_landingIntent=target/);
  assert.match(fromLanding, /showScreen\('profile'\)/);
  assert.match(afterIdentity, /if\(target==='setup'\)return goSetup\(\)/);
  assert.doesNotMatch(`${fromLanding}\n${afterIdentity}`, /localStorage|sessionStorage|setObj|getObj|Supabase|supa/i);
  assert.ok((html.match(/routeAfterIdentity\(\)/g) || []).length >= 4);
});

test('cinematic lifecycle is bound only to landing and fully tears down', () => {
  assert.match(cinematic, /els\.landing=document\.getElementById\('s-landing'\)/);
  assert.match(cinematic, /if\(active\|\|!cache\(\)\|\|!els\.landing\.classList\.contains\('active'\)\)return/);
  assert.match(cinematic, /name==='landing'/);
  assert.doesNotMatch(cinematic, /els\.hub|name==='hub'|classList\.contains\('app-mode'\)/);
  assert.match(cinematic, /cancelAnimationFrame\(rafId\)/);
  assert.match(cinematic, /listeners\.splice\(0\)/);
  assert.match(cinematic, /clearMediaListeners\(\)/);
  assert.match(cinematic, /observer\.disconnect\(\)/);
  assert.match(cinematic, /video\.removeAttribute\('src'\)/);
});

test('normal responsive browsers retain video while capability fallbacks are explicit', () => {
  const selectMode = functionBody(cinematic, 'selectMode');
  assert.match(selectMode, /'reduced-motion'/);
  assert.match(selectMode, /'save-data'/);
  assert.match(selectMode, /'low-memory'/);
  assert.match(selectMode, /'fallback'/);
  assert.match(selectMode, /'full-video'/);
  assert.doesNotMatch(selectMode, /MOBILE_QUERY|max-width|max-height/);
  assert.match(cinematicCss, /@media\(max-width:760px\)/);
});

test('Midnight Arena presentation explicitly yields the landing layer', () => {
  assert.match(globalVisuals, /if \(route === 'landing'\)/);
  assert.match(globalVisuals, /classList\.remove\('cc-visual-route'\)/);
  assert.doesNotMatch(globalVisuals, /landing:\s*\{\s*atmosphere:/);
});

test('PWA shell versions every changed landing asset without touching navigation strategy', () => {
  assert.match(serviceWorker, /CACHE_VERSION = 'v53'/);
  for (const asset of [
    'courtcall-cinematic.css?v=20260814b',
    'courtcall-cinematic.js?v=20260814b',
    'courtcall-global-visual-system.css?v=20260814b',
    'courtcall-global-visual-system.js?v=20260814b'
  ]) assert.ok(serviceWorker.includes(asset), `${asset} is not precached`);
  assert.match(serviceWorker, /if \(request\.mode === 'navigate'\)[\s\S]*?navigationResponse\(request\)/);
  assert.match(serviceWorker, /return await fetchWithTimeout\(request, NAVIGATION_TIMEOUT_MS\)/);
});
