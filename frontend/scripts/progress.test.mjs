import test from 'node:test';
import assert from 'node:assert/strict';

function browser(initial = null) {
  let raw = initial;
  const listeners = new Map();
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; }, removeItem: () => { raw = null; } };
  globalThis.window = { localStorage: storage,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name) };
  return { storage, listeners, setRaw: value => { raw = value; } };
}
async function store(name) { return import(`../lib/progress.ts?test=${name}`); }

test('denied storage preserves set, change and removal in memory', async () => {
  const { storage } = browser();
  for (const name of ['getItem', 'setItem', 'removeItem']) storage[name] = () => { throw Error('denied'); };
  const progress = await store('denied');
  progress.setProgress('java', 'known');
  assert.equal(progress.getProgressSnapshot('java'), 'known');
  progress.setProgress('java', 'repeat');
  assert.equal(progress.getProgressSnapshot('java'), 'repeat');
  progress.setProgress('java', null);
  assert.equal(progress.getProgressSnapshot('java'), null);
});
test('quota errors do not revert new values to old disk content', async () => {
  const { storage } = browser('{"old":"known"}');
  storage.setItem = () => { throw Error('quota'); };
  const progress = await store('quota');
  progress.setProgress('new', 'repeat');
  assert.equal(progress.getProgressSnapshot('old'), 'known');
  assert.equal(progress.getProgressSnapshot('new'), 'repeat');
});
test('storage events synchronize other tabs and clean up subscriptions', async () => {
  const { listeners, setRaw } = browser();
  const progress = await store('tabs');
  let notifications = 0;
  const unsubscribe = progress.subscribeProgress(() => notifications++);
  setRaw('{"java":"known"}');
  listeners.get('storage')({ key: 'devprep-progress' });
  assert.equal(progress.getProgressSnapshot('java'), 'known');
  assert.equal(notifications, 1);
  unsubscribe();
  assert.equal(listeners.has('storage'), false);
});
test('invalid storage is ignored and server snapshot stays neutral', async () => {
  browser('{broken');
  const progress = await store('invalid');
  assert.equal(progress.getProgressSnapshot('java'), null);
  assert.equal(progress.getProgressServerSnapshot(), null);
});
