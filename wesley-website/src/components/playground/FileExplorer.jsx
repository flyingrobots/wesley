import React from 'react';
import { Box, Text, NavLink, ScrollArea } from '@mantine/core';
import classes from './Playground.module.css';

export default function FileExplorer({ files, activeFile, onSelect }) {
  return (
    <Box className={classes.sidebar}>
      <Text className={classes.sidebarHeader}>Files</Text>
      <ScrollArea className={classes.fileList}>
        {files.map(file => (
          <NavLink
            key={file.file}
            label={file.file}
            active={activeFile === file.file}
            onClick={() => onSelect(file.file)}
            variant="subtle"
            className={classes.fileItem}
          />
        ))}
      </ScrollArea>
    </Box>
  );
}
