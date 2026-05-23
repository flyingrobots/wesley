import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EventEmitter } from '../../src/index.mjs';

test('EventEmitter supports on/off/removeAllListeners and listenerCount', () => {
  const emitter = new EventEmitter();
  const seen = [];
  const listener = (payload) => seen.push(payload);

  emitter.on('test', listener);
  emitter.emit('test', { ok: true });

  assert.deepEqual(seen, [{ ok: true }]);
  assert.equal(emitter.listenerCount('test'), 1);

  emitter.off('test', listener);
  emitter.emit('test', { ok: false });

  assert.deepEqual(seen, [{ ok: true }]);
  assert.equal(emitter.listenerCount('test'), 0);

  emitter.on('test', listener);
  emitter.removeAllListeners('test');

  assert.equal(emitter.listenerCount('test'), 0);
});

test('EventEmitter once listeners fire a single time', () => {
  const emitter = new EventEmitter();
  let calls = 0;

  emitter.once('test', () => {
    calls += 1;
  });

  emitter.emit('test');
  emitter.emit('test');

  assert.equal(calls, 1);
});

test('EventEmitter publish supports subscribe and wildcard listeners', async () => {
  const emitter = new EventEmitter();
  const seen = [];

  const unsubscribe = emitter.subscribe('test', async (event) => {
    seen.push(`exact:${event.type}`);
    return 'exact';
  });

  emitter.subscribe('*', async (event) => {
    seen.push(`wildcard:${event.type}`);
    return 'wildcard';
  });

  const results = await emitter.publish({ type: 'test', payload: { ok: true } });

  assert.deepEqual(results, ['exact', 'wildcard']);
  assert.deepEqual(seen, ['exact:test', 'wildcard:test']);

  unsubscribe();
  await emitter.publish({ type: 'test', payload: { ok: false } });

  assert.deepEqual(seen, ['exact:test', 'wildcard:test', 'wildcard:test']);
});

test('EventEmitter publish surfaces handler failures', async () => {
  const emitter = new EventEmitter();

  emitter.subscribe('test', async () => {
    throw new Error('boom');
  });

  await assert.rejects(emitter.publish({ type: 'test' }), /boom/);
});
