'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../brawlers/brawlers-core.js');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'brawlers', 'index.html'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'brawlers', 'firestore.rules'), 'utf8');

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function roster(skills) {
  return skills.map((skill, i) => ({ name: `P${i + 1}`, skill }));
}

test('session day uses India time, not UTC', () => {
  // 04:00 IST on 6 Oct is still 5 Oct in UTC — the old toISOString() bug.
  assert.equal(core.sessionDay(new Date('2026-10-05T22:30:00Z')), '2026-10-06');
  assert.equal(core.sessionDay(new Date('2026-10-05T18:29:00Z')), '2026-10-05');
  assert.equal(core.sessionDay(new Date('2026-10-05T18:30:00Z')), '2026-10-06');
});

test('names are cleaned, validated, and keyed case- and space-insensitively', () => {
  assert.equal(core.cleanName('  Big   Vj '), 'Big Vj');
  assert.equal(core.nameKey('Big  VJ'), core.nameKey('big vj'));
  assert.ok(!core.nameKey('a/b').includes('/'), 'keys must be valid Firestore document ids');
  assert.equal(core.validateName('Arun'), '');
  assert.equal(core.validateName('அருண்'), '');
  assert.notEqual(core.validateName('   '), '');
  assert.notEqual(core.validateName('..'), '');
  assert.notEqual(core.validateName('x'.repeat(31)), '');
});

test('skill and team count inputs are bounded', () => {
  assert.equal(core.normalizeSkill('4'), 4);
  assert.equal(core.normalizeSkill(0), null);
  assert.equal(core.normalizeSkill(6), null);
  assert.equal(core.normalizeSkill(2.5), null);
  assert.equal(core.clampTeamCount('9'), 4);
  assert.equal(core.clampTeamCount('x'), 2);
});

test('shuffle is a permutation and does not mutate input', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = core.shuffle(input, seeded(7));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(out.slice().sort(), input);
});

test('balanced teams keep everyone, keep sizes within one, and equalise skill', () => {
  const players = roster([5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
  const { teams, totals, spread } = core.balanceTeams(players, 2, { random: seeded(1) });
  assert.equal(teams.flat().length, 10);
  assert.deepEqual(teams.flat().map((p) => p.name).sort(), players.map((p) => p.name).sort());
  assert.deepEqual(teams.map((t) => t.length), [5, 5]);
  assert.deepEqual(totals, [15, 15]);
  assert.equal(spread, 0);
});

test('stacked line-ups are broken up instead of randomly grouped', () => {
  const players = roster([5, 5, 5, 1, 1, 1]);
  const { teams } = core.balanceTeams(players, 2, { random: seeded(3) });
  for (const team of teams) {
    assert.ok(team.some((p) => p.skill === 5) && team.some((p) => p.skill === 1));
  }
});

test('uneven counts across 3 and 4 teams stay fair', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const random = seeded(seed);
    const skills = Array.from({ length: 11 + (seed % 6) }, () => 1 + Math.floor(random() * 5));
    for (const k of [3, 4]) {
      const { teams, spread } = core.balanceTeams(roster(skills), k, { random: seeded(seed * 31 + k) });
      const sizes = teams.map((t) => t.length);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `sizes ${sizes}`);
      assert.equal(sizes.reduce((a, b) => a + b, 0), skills.length);
      assert.ok(spread <= 2, `spread ${spread} for ${skills} into ${k}`);
    }
  }
});

test('unrated players count as the default skill', () => {
  const { totals } = core.balanceTeams([{ name: 'A' }, { name: 'B', skill: null }], 2, { random: seeded(2) });
  assert.deepEqual(totals, [core.DEFAULT_SKILL, core.DEFAULT_SKILL]);
});

test('regenerating gives different but equally fair line-ups', () => {
  const players = roster([3, 3, 3, 3, 3, 3, 3, 3]);
  const seen = new Set();
  for (let seed = 1; seed <= 10; seed++) {
    const { teams, spread } = core.balanceTeams(players, 2, { random: seeded(seed) });
    assert.equal(spread, 0);
    seen.add(teams[0].map((p) => p.name).sort().join(','));
  }
  assert.ok(seen.size > 1, 'line-ups should vary between generations');
});

test('stale-team detection finds players who joined after teams were made', () => {
  const missing = core.playersMissingFromTeams(['Arun', 'big vj', 'Kiran'], [['Arun'], ['Big VJ']]);
  assert.deepEqual(missing, ['Kiran']);
});

test('WhatsApp message shares teams when they exist, otherwise the numbered list', () => {
  const base = { title: 'Brawlers', dateLabel: 'Mon, 5 Oct 2026', sessionType: 'Full Court', players: ['A', 'B', 'C', 'D'], link: 'https://x.web.app/' };
  const withTeams = core.buildShareMessage({ ...base, teams: [['A', 'C'], ['B', 'D']] });
  assert.match(withTeams, /\*Team 1\* \(2\)\n• A\n• C/);
  assert.match(withTeams, /Total players: 4/);
  assert.match(withTeams, /Join the list: https:\/\/x\.web\.app\//);
  const listOnly = core.buildShareMessage({ ...base, teams: [] });
  assert.match(listOnly, /1\. A\n2\. B/);
});

test('page never injects player data as HTML and has no client-side password', () => {
  const script = page.slice(page.indexOf('<script type="module">'));
  assert.doesNotMatch(script, /\.(?:inner|outer)HTML\s*=|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(script, /prompt\(/);
  assert.doesNotMatch(page, /toISOString\(\)\.slice/);
});

test('firestore rules gate admin actions on the admins collection', () => {
  assert.match(rules, /function isAdmin\(\)[\s\S]*?exists\(\/databases\/\$\(database\)\/documents\/admins\/\$\(request\.auth\.uid\)\)/);
  assert.match(rules, /match \/players\/\{pid\}[\s\S]*?allow delete: if isAdmin\(\) \|\| \(signedIn\(\) && resource\.data\.uid == request\.auth\.uid\)/);
  assert.match(rules, /allow update: if false;\s*\}\s*\}\s*\}\s*\}\s*$/);
  assert.match(rules, /match \/roster\/\{key\}[\s\S]*?allow create, update: if isAdmin\(\)/);
});
