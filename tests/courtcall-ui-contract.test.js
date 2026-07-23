const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const markup = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

test('static markup has unique IDs and programmatically named form controls', () => {
  const ids = [...markup.matchAll(/\bid="([^"]+)"/gi)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);

  const labelledIds = new Set([...markup.matchAll(/<label\b[^>]*\bfor="([^"]+)"/gi)].map(match => match[1]));
  const unnamed = [];
  for (const match of markup.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const [, tag, attrs] = match;
    if (/\btype="(?:hidden|button|submit|reset|image)"/i.test(attrs)) continue;
    const id = attrs.match(/\bid="([^"]+)"/i)?.[1];
    const directName = /\baria-label(?:ledby)?="[^"]+"/i.test(attrs) || /\btitle="[^"]+"/i.test(attrs);
    if (!directName && !(id && labelledIds.has(id))) unnamed.push(`${tag}#${id || '?'}`);
  }
  assert.deepEqual(unnamed, []);
});

test('static images have alt text and buttons expose a name', () => {
  const missingAlt = [...markup.matchAll(/<img\b([^>]*)>/gi)]
    .filter(([, attrs]) => !/\balt="[^"]*"/i.test(attrs));
  assert.equal(missingAlt.length, 0);

  const unnamedButtons = [];
  for (const match of markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const [, attrs, body] = match;
    const directName = /\baria-label(?:ledby)?="[^"]+"/i.test(attrs) || /\btitle="[^"]+"/i.test(attrs);
    const visibleText = body.replace(/<[^>]+>/g, '').replace(/&\w+;|&#\d+;/g, ' ').trim();
    if (!directName && !visibleText) unnamedButtons.push(match[0].slice(0, 100));
  }
  assert.deepEqual(unnamedButtons, []);
});

test('player and tournament validation clear errors after successful input', () => {
  assert.match(html, /if\(!name\)\{setTbPlayerError\('Enter a player name'\);input\.focus\(\);return\}/);
  assert.match(html, /already checked in\. Add another player with this name\?/);
  assert.match(html, /input\.value='';setTbPlayerError\(''\)/);
  assert.match(html, /if\(!name\)\{setTournError\('Enter a tournament name'\)/);
  assert.match(html, /Team names must be unique/);
  assert.match(html, /button\.disabled=!valid/);
});
