'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cloud = require('../courtcall-cloud-state.js');

test('offline and true empty communities have distinct copy', () => {
  const offline = cloud.communityCopy(cloud.VIEW.OFFLINE);
  const empty = cloud.communityCopy(cloud.VIEW.EMPTY);
  assert.match(offline.title, /offline/i);
  assert.match(offline.title, /saved on this device/i);
  assert.match(empty.title, /match your current filters/i);
  assert.notEqual(offline.title, empty.title);
});

test('request failure offers Retry and is not presented as empty', () => {
  const failed = cloud.communityCopy(cloud.VIEW.ERROR);
  assert.equal(failed.title, 'We couldn’t load public communities.');
  assert.equal(failed.action, 'Retry');
});

test('permission and authentication failures are classified separately', () => {
  assert.equal(cloud.classifyError({ code: '42501' }), cloud.VIEW.PERMISSION_DENIED);
  assert.equal(cloud.classifyError({ status: 401 }), cloud.VIEW.AUTH_REQUIRED);
  assert.equal(cloud.classifyError(new Error('Network request failed')), cloud.VIEW.ERROR);
});

test('sync labels never claim cloud success while offline or failed', () => {
  assert.equal(cloud.syncCopy(cloud.SYNC.ONLINE_SYNCED), 'Online · Synced');
  assert.equal(cloud.syncCopy(cloud.SYNC.ONLINE_LOCAL), 'Online · Saved on this device');
  assert.equal(cloud.syncCopy(cloud.SYNC.SYNCING), 'Syncing…');
  assert.equal(cloud.syncCopy(cloud.SYNC.OFFLINE_SAVED), 'Offline · Saved on this device');
  assert.equal(cloud.syncCopy(cloud.SYNC.FAILED), 'Sync failed · Retry');
});
