import { describe, it, expect } from 'vitest';
import { generateVue } from '../src/index.mjs';

describe('generateVue', () => {
  it('should generate TS interfaces from AppState', async () => {
    const ir = {
      types: [
        {
          name: 'AppState',
          kind: 'OBJECT',
          fields: [
            { name: 'theme', type: 'Theme', required: true },
            { name: 'navOpen', type: 'Boolean', required: true },
            { name: 'routePath', type: 'String', required: true }
          ]
        },
        {
          name: 'Theme',
          kind: 'ENUM',
          values: ['LIGHT', 'DARK', 'SYSTEM']
        }
      ]
    };

    const result = await generateVue(ir);
    const tsFile = result.files.find((f) => f.path.endsWith('.ts'));

    expect(tsFile).toBeDefined();
    expect(tsFile.content).toContain('export interface AppState');
    expect(tsFile.content).toContain('export enum Theme');
  });
});
