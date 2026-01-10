import { describe, it, expect } from 'vitest';
import { generateEcho } from '../src/index.mjs';

describe('generateEcho', () => {
  it('should generate Rust structs from AppState', async () => {
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

    const result = await generateEcho(ir);
    const rustFile = result.files.find(f => f.path.endsWith('.rs'));
    
    expect(rustFile).toBeDefined();
    expect(rustFile.content).toContain('pub struct AppState');
    expect(rustFile.content).toContain('pub enum Theme');
  });
});
