/**
 * Deterministic tests for WatchCommand
 */

import { describe, test } from 'node:test';
import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { FakeClock } from '@wesley/core';
import { WatchCommand, createWatcher, watch } from '../src/commands/watch.mjs';

class FakeWatcher {
  constructor(watched = { '.': ['schema.graphql'] }) {
    this.handlers = new Map();
    this.watched = watched;
    this.closed = false;
  }

  on(eventName, handler) {
    const handlers = this.handlers.get(eventName) || [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);
    return this;
  }

  emit(eventName, payload) {
    for (const handler of this.handlers.get(eventName) || []) {
      handler(payload);
    }
  }

  getWatched() {
    return this.watched;
  }

  async close() {
    this.closed = true;
  }
}

class FakeProcess {
  constructor() {
    this.platform = 'linux';
    this.listeners = new Map();
  }

  on(eventName, handler) {
    const handlers = this.listeners.get(eventName) || [];
    handlers.push(handler);
    this.listeners.set(eventName, handlers);
  }

  off(eventName, handler) {
    const handlers = this.listeners.get(eventName) || [];
    this.listeners.set(
      eventName,
      handlers.filter((candidate) => candidate !== handler)
    );
  }

  listenerCount(eventName) {
    return (this.listeners.get(eventName) || []).length;
  }
}

function createTestContext(options = {}) {
  const clock = options.clock ?? new FakeClock('2026-03-22T00:00:00.000Z');
  const fakeWatcher = options.fakeWatcher ?? new FakeWatcher();
  const fakeProcess = options.fakeProcess ?? new FakeProcess();
  const consoleCalls = { log: [], error: [] };
  const fakeConsole = options.console ?? {
    log: (...args) => consoleCalls.log.push(args),
    error: (...args) => consoleCalls.error.push(args)
  };
  const fakeStdout = options.stdout ?? { write: () => {} };
  const watcherFactory = options.watcherFactory ?? (() => fakeWatcher);

  return {
    clock,
    fakeWatcher,
    fakeProcess,
    fakeConsole,
    fakeStdout,
    watcherFactory,
    consoleCalls
  };
}

describe('WatchCommand', () => {
  test('creates a watcher with injected seams', () => {
    const { clock, watcherFactory, fakeConsole, fakeStdout, fakeProcess } = createTestContext();
    const watcher = new WatchCommand({
      patterns: ['**/*.test.graphql'],
      cwd: '/tmp/watch-test',
      debounceMs: 100,
      clearConsole: false,
      clock,
      watcherFactory,
      console: fakeConsole,
      stdout: fakeStdout,
      processRef: fakeProcess
    });

    ok(watcher);
    strictEqual(watcher.debounceMs, 100);
    strictEqual(watcher.cwd, '/tmp/watch-test');
    strictEqual(watcher.isWatching, false);
  });

  test('starts and stops with fake watcher lifecycle', async () => {
    const context = createTestContext();
    const watcher = new WatchCommand({
      patterns: ['*.graphql'],
      cwd: '/tmp/watch-test',
      clearConsole: false,
      clock: context.clock,
      watcherFactory: context.watcherFactory,
      console: context.fakeConsole,
      stdout: context.fakeStdout,
      processRef: context.fakeProcess
    });

    const startPromise = watcher.start();
    context.fakeWatcher.emit('ready');
    await startPromise;

    strictEqual(watcher.isWatching, true);
    strictEqual(context.fakeProcess.listenerCount('SIGINT'), 1);
    strictEqual(context.fakeProcess.listenerCount('SIGTERM'), 1);

    await watcher.stop();

    strictEqual(watcher.isWatching, false);
    strictEqual(context.fakeWatcher.closed, true);
    strictEqual(context.fakeProcess.listenerCount('SIGINT'), 0);
    strictEqual(context.fakeProcess.listenerCount('SIGTERM'), 0);
  });

  test('debounces rapid changes with fake clock', async () => {
    const context = createTestContext();
    const events = [];
    const onchange = [];
    const watcher = new WatchCommand({
      patterns: ['*.graphql'],
      cwd: '/tmp/watch-test',
      debounceMs: 50,
      clearConsole: false,
      onchange: (eventType, filePath) => onchange.push({ eventType, filePath }),
      clock: context.clock,
      watcherFactory: context.watcherFactory,
      console: context.fakeConsole,
      stdout: context.fakeStdout,
      processRef: context.fakeProcess
    });

    watcher.on('change', (event) => {
      events.push(event);
    });

    const startPromise = watcher.start();
    context.fakeWatcher.emit('ready');
    await startPromise;

    context.fakeWatcher.emit('add', 'schema.graphql');
    await context.clock.advanceBy(25);
    strictEqual(events.length, 0);

    context.fakeWatcher.emit('change', 'schema.graphql');
    await context.clock.advanceBy(50);

    strictEqual(events.length, 1);
    deepStrictEqual(onchange, [{ eventType: 'change', filePath: 'schema.graphql' }]);
    strictEqual(events[0].eventType, 'change');
    strictEqual(events[0].filePath, 'schema.graphql');
    strictEqual(events[0].timestamp, '2026-03-22T00:00:00.075Z');

    await watcher.stop();
  });

  test('clears pending debounce work on stop', async () => {
    const context = createTestContext();
    let changed = false;
    const watcher = new WatchCommand({
      patterns: ['*.graphql'],
      cwd: '/tmp/watch-test',
      debounceMs: 50,
      clearConsole: false,
      onchange: () => {
        changed = true;
      },
      clock: context.clock,
      watcherFactory: context.watcherFactory,
      console: context.fakeConsole,
      stdout: context.fakeStdout,
      processRef: context.fakeProcess
    });

    const startPromise = watcher.start();
    context.fakeWatcher.emit('ready');
    await startPromise;

    context.fakeWatcher.emit('add', 'schema.graphql');
    await watcher.stop();
    await context.clock.advanceBy(50);

    strictEqual(changed, false);
  });

  test('supports factory helpers without real chokidar timing', async () => {
    const context = createTestContext();
    const factoryWatcher = createWatcher({
      patterns: ['*.gql'],
      cwd: '/tmp/watch-test',
      clearConsole: false,
      clock: context.clock,
      watcherFactory: context.watcherFactory,
      console: context.fakeConsole,
      stdout: context.fakeStdout,
      processRef: context.fakeProcess
    });

    ok(factoryWatcher instanceof WatchCommand);

    const utilityPromise = watch('*.graphql', () => {}, {
      cwd: '/tmp/watch-test',
      debounceMs: 50,
      clearConsole: false,
      clock: context.clock,
      watcherFactory: context.watcherFactory,
      console: context.fakeConsole,
      stdout: context.fakeStdout,
      processRef: context.fakeProcess
    });
    context.fakeWatcher.emit('ready');
    const utilityWatcher = await utilityPromise;

    ok(utilityWatcher instanceof WatchCommand);
    strictEqual(utilityWatcher.isWatching, true);

    await utilityWatcher.stop();
  });
});
