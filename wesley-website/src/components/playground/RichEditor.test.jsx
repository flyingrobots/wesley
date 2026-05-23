import richEditorSource from './RichEditor.jsx?raw';
import { describe, expect, it } from 'vitest';

describe('RichEditor source compatibility', () => {
  it('does not pass unsupported preserveCursor options to setContent', () => {
    expect(richEditorSource).not.toContain('preserveCursor');
  });
});
