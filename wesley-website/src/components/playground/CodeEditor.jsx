import React from 'react';
import { Box, Code } from '@mantine/core';

export default function CodeEditor({ value, onChange, readOnly = false }) {
  return (
    <Box flex={1} pos="relative" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Code block style={{ height: '100%', borderRadius: 0, padding: 0 }}>
        <textarea
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            padding: '15px',
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontSize: '14px',
            resize: 'none',
            backgroundColor: readOnly ? 'var(--mantine-color-gray-0)' : 'transparent',
            outline: 'none',
            color: 'var(--mantine-color-text)',
            boxSizing: 'border-box',
          }}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
        />
      </Code>
    </Box>
  );
}