import React from 'react';
import { Box, Code } from '@mantine/core';
import classes from './Playground.module.css';

export default function CodeEditor({ value, onChange, readOnly = false }) {
  return (
    <div className={classes.editorContainer}>
      <Code block style={{ height: '100%', borderRadius: 0 }}>
        <textarea
          className={`${classes.editor} ${readOnly ? classes.editorReadOnly : ''}`}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
        />
      </Code>
    </div>
  );
}
