import { describe, it, expect } from 'vitest';
import { TaskDefinition, TaskGraph } from '../src/index.mjs';

describe('TaskDefinition', () => {
  it('tracks dependencies, resources, and tags', () => {
    const task = new TaskDefinition('build', {
      name: 'Build artifacts',
      dependencies: ['lint'],
      resources: ['docker'],
      tags: ['ci'],
      metadata: { owner: 'release' }
    });

    task.dependsOn('test').requires('cache').tag('nightly');

    expect(task.name).toBe('Build artifacts');
    expect(Array.from(task.dependencies)).toContain('test');
    expect(Array.from(task.resources)).toContain('cache');
    expect(Array.from(task.tags)).toContain('nightly');

    expect(task.canExecuteWith(new Set(['docker', 'cache']))).toBe(true);
    expect(task.canExecuteWith(new Set(['docker']))).toBe(false);

    expect(task.dependenciesSatisfied(new Set(['lint', 'test']))).toBe(true);
    expect(task.dependenciesSatisfied(new Set(['lint']))).toBe(false);

    const extended = task.extend({ priority: 5, metadata: { owner: 'platform' } });
    expect(extended).not.toBe(task);
    expect(extended.priority).toBe(5);
    expect(extended.metadata.owner).toBe('platform');
    expect(Array.from(extended.dependencies)).toEqual(Array.from(task.dependencies));
  });
});

describe('TaskGraph', () => {
  it('returns ready tasks in priority order as dependencies complete', () => {
    const prepare = new TaskDefinition('prepare', { priority: 1 });
    const lint = new TaskDefinition('lint', { priority: 5 });
    const testTask = new TaskDefinition('test', {
      dependencies: ['prepare', 'lint'],
      priority: 3
    });

    const graph = new TaskGraph();
    graph.addTask(prepare);
    graph.addTask(lint);
    graph.addTask(testTask);

    // No tasks completed yet → highest priority ready task first
    expect(graph.getReadyTasks().map(t => t.id)).toEqual(['lint', 'prepare']);

    // Once lint is done, prepare remains ready
    expect(graph.getReadyTasks(new Set(['lint'])).map(t => t.id)).toEqual(['prepare']);

    // Once both prep + lint done, test is ready
    expect(graph.getReadyTasks(new Set(['lint', 'prepare'])).map(t => t.id)).toEqual(['test']);
  });

  it('detects dependency cycles', () => {
    const a = new TaskDefinition('a', { dependencies: ['c'] });
    const b = new TaskDefinition('b', { dependencies: ['a'] });
    const c = new TaskDefinition('c', { dependencies: ['b'] });

    const cyclic = new TaskGraph();
    cyclic.addTask(a).addTask(b).addTask(c);

    const cycles = cyclic.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
    // Each reported cycle should include the three task ids we created
    expect(cycles[0]).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });
});
