import React from 'react';
import { Box, Code } from '@mantine/core';
import classes from './Playground.module.css';

export default function CodeEditor({ value, onChange, readOnly = false }) {
  return (
    <Box className={classes.editorContainer}>
      <Code block className={classes.codeBlock}>
        <textarea
          className={`${classes.editor} ${readOnly ? classes.editorReadOnly : ''}`}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
        />
      </Code>
    </Box>
  );
}
