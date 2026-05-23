import React from 'react';
import { Box } from '@mantine/core'; // Removed Code from import
import { CodeHighlight } from '@mantine/code-highlight';
import classes from './Playground.module.css';
import RichEditor from './RichEditor'; // Import RichEditor

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

  // Use RichEditor for editable content
  return <RichEditor value={value} onChange={onChange} />;
}
