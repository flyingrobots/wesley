import { describe, it, expect } from 'vitest';
import { VuePlugin } from '../src/VuePlugin.mjs';
import { validatePlugin } from '@wesley/core';

const sampleIr = {
  types: [
    {
      name: 'Theme',
      kind: 'ENUM',
      values: ['LIGHT', 'DARK', 'SYSTEM']
    },
    {
      name: 'AppState',
      kind: 'OBJECT',
      fields: [
        { name: 'theme', type: 'Theme', required: true },
        { name: 'navOpen', type: 'Boolean', required: true },
        { name: 'routePath', type: 'String', required: true }
      ]
    }
  ]
};

function makeContext() {
  return Object.freeze({
    logger: { info() {}, warn() {}, error() {}, child() { return this; } },
    clock: { now() { return new Date().toISOString(); } },
    config: Object.freeze({}),
    runId: 'test-run-001'
  });
}

describe('VuePlugin — GeneratorPlugin contract', () => {
  it('passes plugin validation', () => {
    const plugin = new VuePlugin();
    expect(() => validatePlugin(plugin)).not.toThrow();
  });

  it('has apiVersion "1"', () => {
    const plugin = new VuePlugin();
    expect(plugin.apiVersion).toBe('1');
  });

  it('has name "vue"', () => {
    const plugin = new VuePlugin();
    expect(plugin.name).toBe('vue');
  });
});

describe('VuePlugin — unified entrypoint lifecycle', () => {
  it('plan declares types.generated.ts artifact', async () => {
    const plugin = new VuePlugin();
    const plan = await plugin.plan({ ir: sampleIr }, makeContext());

    expect(plan.artifacts).toHaveLength(1);
    expect(plan.artifacts[0].path).toBe('types.generated.ts');
    expect(plan.metadata).toBeDefined();
  });

  it('generate produces the declared artifact', async () => {
    const plugin = new VuePlugin();
    const plan = await plugin.plan({ ir: sampleIr }, makeContext());
    const artifacts = await plugin.generate(plan, makeContext());

    expect(Object.keys(artifacts)).toContain('types.generated.ts');
    const content = artifacts['types.generated.ts'];
    expect(content).toContain('export enum Theme');
    expect(content).toContain('export interface AppState');
  });

  it('init accepts custom outPath config', async () => {
    const plugin = new VuePlugin();
    plugin.init({ outPath: 'custom/types.ts' });

    const plan = await plugin.plan({ ir: sampleIr }, makeContext());
    expect(plan.artifacts[0].path).toBe('custom/types.ts');

    const artifacts = await plugin.generate(plan, makeContext());
    expect(Object.keys(artifacts)).toContain('custom/types.ts');
  });

  it('full lifecycle: init → plan → generate', async () => {
    const plugin = new VuePlugin();
    const ctx = makeContext();

    plugin.init({});
    const plan = await plugin.plan({ ir: sampleIr }, ctx);
    const artifacts = await plugin.generate(plan, ctx);

    expect(Object.keys(artifacts)).toHaveLength(1);
    expect(artifacts['types.generated.ts']).toContain('AUTO-GENERATED');
  });
});

describe('VuePlugin — covers previous generateVue capabilities', () => {
  it('generates enum types', async () => {
    const plugin = new VuePlugin();
    const plan = await plugin.plan({ ir: sampleIr }, makeContext());
    const artifacts = await plugin.generate(plan, makeContext());

    expect(artifacts['types.generated.ts']).toContain('export enum Theme');
    expect(artifacts['types.generated.ts']).toContain('LIGHT');
    expect(artifacts['types.generated.ts']).toContain('DARK');
    expect(artifacts['types.generated.ts']).toContain('SYSTEM');
  });

  it('generates interface types with correct TS types', async () => {
    const plugin = new VuePlugin();
    const plan = await plugin.plan({ ir: sampleIr }, makeContext());
    const artifacts = await plugin.generate(plan, makeContext());
    const content = artifacts['types.generated.ts'];

    expect(content).toContain('theme: Theme;');
    expect(content).toContain('navOpen: boolean;');
    expect(content).toContain('routePath: string;');
  });

  it('handles optional and list fields', async () => {
    const ir = {
      types: [
        {
          name: 'Item',
          kind: 'OBJECT',
          fields: [
            { name: 'id', type: 'ID', required: true },
            { name: 'label', type: 'String', required: false },
            { name: 'tags', type: 'String', required: true, list: true }
          ]
        }
      ]
    };

    const plugin = new VuePlugin();
    const plan = await plugin.plan({ ir }, makeContext());
    const artifacts = await plugin.generate(plan, makeContext());
    const content = artifacts['types.generated.ts'];

    expect(content).toContain('id: string;');
    expect(content).toContain('label?: string;');
    expect(content).toContain('tags: string[];');
  });
});

describe('VuePlugin — deprecation and migration', () => {
  it('repository references only unified entrypoint', async () => {
    // VuePlugin is importable from the package
    const mod = await import('../src/VuePlugin.mjs');
    expect(mod.VuePlugin).toBeDefined();
    expect(typeof mod.VuePlugin).toBe('function');
  });

  it('legacy generateVue still works for backward compatibility', async () => {
    const mod = await import('../src/index.mjs');
    expect(typeof mod.generateVue).toBe('function');

    const result = await mod.generateVue(sampleIr);
    expect(result.files).toHaveLength(1);
  });
});
