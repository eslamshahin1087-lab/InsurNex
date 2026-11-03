import assert from 'node:assert/strict';
import {
  readViewModePreference,
  writeViewModePreference,
} from '../src/layouts/view-mode-preference.js';

function withStorage(storage, run) {
  const previous = globalThis.window;
  globalThis.window = { localStorage: storage };
  try {
    run();
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

withStorage({
  getItem: () => 'desktop',
  setItem: () => {},
}, () => {
  assert.equal(readViewModePreference(), 'desktop');
});

withStorage({
  getItem: () => 'mobile',
  setItem: () => {},
}, () => {
  assert.equal(readViewModePreference(), 'mobile');
});

withStorage({
  getItem: () => 'tablet',
  setItem: () => {},
}, () => {
  assert.equal(readViewModePreference(), null);
});

withStorage({
  getItem: () => null,
  setItem: () => {},
}, () => {
  assert.equal(readViewModePreference(), null);
});

const writes = [];
withStorage({
  getItem: () => null,
  setItem: (key, value) => writes.push([key, value]),
}, () => {
  assert.equal(writeViewModePreference('desktop'), true);
  assert.equal(writeViewModePreference('mobile'), true);
  assert.equal(writeViewModePreference('tablet'), false);
});
assert.deepEqual(writes, [
  ['insurnex-view-mode', 'desktop'],
  ['insurnex-view-mode', 'mobile'],
]);

withStorage({
  getItem: () => { throw new Error('storage blocked'); },
  setItem: () => { throw new Error('storage blocked'); },
}, () => {
  assert.equal(readViewModePreference(), null);
  assert.equal(writeViewModePreference('desktop'), false);
});

const previous = globalThis.window;
delete globalThis.window;
assert.equal(readViewModePreference(), null);
assert.equal(writeViewModePreference('mobile'), false);
if (previous !== undefined) globalThis.window = previous;

console.log('View-mode preference persistence tests passed.');
