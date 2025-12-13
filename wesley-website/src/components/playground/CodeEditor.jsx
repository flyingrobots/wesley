import React from 'react';
import { Box, Code } from '@mantine/core';
import { CodeHighlight } from '@mantine/code-highlight';
import classes from './Playground.module.css';

export default function CodeEditor({ value, onChange, readOnly = false, language = 'graphql' }) {
  if (readOnly) {
    return (
      <Box className={classes.editorContainer}>
        <CodeHighlight 
          code={value} 
          language={language} 
          className={classes.codeBlock} 
          style={{ height: '100%', overflow: 'auto' }}
        />
      </Box>
    );
  }

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