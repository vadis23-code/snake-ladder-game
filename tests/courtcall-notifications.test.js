'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const notifications = require('../courtcall-notifications.js');

function fakeElement() {
  const classes = new Set();
  return {
    textContent: '',
    dataset: {},
    attributes: {},
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name)
    },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}

test('notifications carry the required typed metadata', () => {
  const item = notifications.normalizeNotification('Enter tournament name', {
    type: 'error', source: 'tournament', duration: 4000, id: 'validation-1'
  });
  assert.deepEqual(item, {
    id: 'validation-1', message: 'Enter tournament name', type: 'error',
    source: 'tournament', duration: 4000, persistent: false
  });
});

test('route changes clear non-persistent validation from another screen', () => {
  const element = fakeElement();
  const manager = notifications.createManager({ element, getRoute: () => 'teams' });
  manager.notify('Need at least 4 players for 2 teams', { type: 'error' });
  assert.equal(element.textContent, 'Need at least 4 players for 2 teams');
  assert.equal(manager.clearForRoute('tournament'), true);
  assert.equal(element.textContent, '');
  assert.equal(element.classList.contains('show'), false);
});

test('a successful action replaces the previous error and clears its live text', () => {
  const element = fakeElement();
  const manager = notifications.createManager({ element, getRoute: () => 'teams' });
  manager.notify('Enter player name', { type: 'error' });
  const success = manager.notify('Jordan added', { type: 'success' });
  assert.equal(manager.getActive().id, success.id);
  assert.equal(element.textContent, 'Jordan added');
  assert.equal(element.attributes.role, 'status');
  manager.dismiss(success.id);
  assert.equal(element.textContent, '');
});

test('only explicitly persistent global sync messages survive navigation', () => {
  const element = fakeElement();
  const manager = notifications.createManager({ element, getRoute: () => 'communities' });
  manager.notify('Offline · Saved on this device', {
    type: 'warning', source: 'global', persistent: true, duration: 0
  });
  assert.equal(manager.clearForRoute('settings'), false);
  assert.equal(manager.getActive().persistent, true);
});
