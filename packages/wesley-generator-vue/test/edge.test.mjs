import { describe, it, expect } from 'vitest';
import { generateVue } from '../src/index.mjs';

describe('generateVue edge cases', () => {
  it('marks optional fields with ? and maps scalars', async () => {
    const ir = {
      types: [
        {
          name: 'Thing',
          kind: 'OBJECT',
          fields: [
            { name: 'id', type: 'ID', required: true },
            { name: 'maybe', type: 'String', required: false },
            { name: 'flag', type: 'Boolean', required: true },
            { name: 'count', type: 'Int', required: true },
          ],
        },
      ],
    };

    const result = await generateVue(ir);
    const tsFile = result.files.find((f) => f.path.endsWith('.ts'));
    expect(tsFile?.content).toContain('export interface Thing');
    expect(tsFile?.content).toContain('id: string;');
    expect(tsFile?.content).toContain('maybe?: string;');
    expect(tsFile?.content).toContain('flag: boolean;');
    expect(tsFile?.content).toContain('count: number;');
  });

  it('emits list fields as arrays and unknown types as any', async () => {
    const ir = {
      types: [
        {
          name: 'Thing',
          kind: 'OBJECT',
          fields: [
            { name: 'tags', type: 'String', required: true, list: true },
            { name: 'mystery', type: 'NotInIR', required: true },
          ],
        },
      ],
    };

    const result = await generateVue(ir);
    const tsFile = result.files.find((f) => f.path.endsWith('.ts'));
    expect(tsFile?.content).toContain('tags: string[];');
    expect(tsFile?.content).toContain('mystery: any;');
  });

  it('throws on invalid IR shape (known failure mode)', async () => {
    await expect(generateVue(null)).rejects.toThrow(/IR object/i);
    await expect(generateVue({})).rejects.toThrow(/ir\.types/i);
  });
});
