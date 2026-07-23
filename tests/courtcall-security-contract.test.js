'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const accessSql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260713162416_community_access_hardening.sql'), 'utf8');
const alignmentSql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260713170000_client_schema_alignment.sql'), 'utf8');
const definerLockdownSql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260723143500_legacy_definer_execution_lockdown.sql'), 'utf8');
const clientHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('public community directory cannot expose invite codes', () => {
  const directoryDefinition = accessSql.match(/create or replace view public\.community_directory[\s\S]*?from public\.communities[\s\S]*?where visibility = 'public';/i)?.[0] || '';
  assert.ok(directoryDefinition, 'community directory view must exist');
  assert.doesNotMatch(directoryDefinition, /invite_code/i);
  assert.match(accessSql, /with \(security_invoker = true, security_barrier = true\)/i);
  assert.match(accessSql, /revoke select \(invite_code\)[\s\S]*?from public, anon, authenticated/i);
});

test('invite RPCs are authenticated and membership self-promotion is blocked', () => {
  assert.match(accessSql, /revoke all on function public\.join_community_by_invite\(text, text\)[\s\S]*?from public, anon, authenticated/i);
  assert.match(accessSql, /grant execute on function public\.join_community_by_invite\(text, text\)[\s\S]*?to authenticated/i);
  assert.match(accessSql, /new\.user_id = \(select auth\.uid\(\)\)[\s\S]*?new\.role := old\.role/i);
  assert.doesNotMatch(accessSql, /set search_path = pg_catalog/i);
});

test('trigger-only and compatibility definers are not exposed as browser RPCs', () => {
  assert.match(definerLockdownSql, /revoke all on function public\.handle_new_user\(\)[\s\S]*?from public, anon, authenticated/i);
  assert.match(definerLockdownSql, /revoke all on function public\.is_community_member\(text, uuid\)[\s\S]*?from public, anon, authenticated/i);
  assert.doesNotMatch(definerLockdownSql, /to anon|to authenticated/i);
});

test('RSVP updates use the atomic member-scoped RPC and restore rejected changes', () => {
  assert.match(alignmentSql, /create or replace function public\.set_community_event_rsvp/i);
  assert.match(alignmentSql, /where event\.id = p_event_id\s+for update;/i);
  assert.match(alignmentSql, /current_user_is_community_member\(event_community_id\)/i);
  assert.match(clientHtml, /supa\.rpc\('set_community_event_rsvp'/i);
  assert.match(clientHtml, /all\[idx\]\.rsvps=previousRsvps/i);
});

test('inline handler arguments preserve hostile-looking IDs as inert strings', () => {
  const escAttrSource = clientHtml.match(/function escAttr\(s\)\{[^\n]+/)?.[0];
  const jsArgSource = clientHtml.match(/function jsArg\(value\)\{[^\n]+/)?.[0];
  assert.ok(escAttrSource && jsArgSource, 'argument serializer must be present');

  const payload = `');globalThis.__courtcallXss=true;//`;
  const context = { payload, encoded: null };
  vm.runInNewContext(`${escAttrSource}\n${jsArgSource}\nencoded=jsArg(payload);`, context);
  const decoded = context.encoded
    .replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  let received = null;
  Function('openCommunity', `openCommunity(${decoded})`)(value => { received = value; });

  assert.equal(received, payload);
  assert.equal(globalThis.__courtcallXss, undefined);
  assert.doesNotMatch(clientHtml, /openCommunity\('\$\{escHtml\(c\.id\)\}'\)/);
});
