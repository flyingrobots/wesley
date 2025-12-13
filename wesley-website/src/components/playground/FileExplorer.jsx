import React from 'react';
import { Box, Text, NavLink } from '@mantine/core';
import classes from './Playground.module.css';

export default function FileExplorer({ files, activeFile, onSelect }) {
  return (
    <div className={classes.sidebar}>
      <div className={classes.sidebarHeader}>Files</div>
      <div className={classes.fileList}>
        {files.map(file => (
          <NavLink
            key={file.file}
            label={file.file}
            active={activeFile === file.file}
            onClick={() => onSelect(file.file)}
            variant="light"
            className={classes.fileItem}
          />
        ))}
      </div>
    </div>
  );
}
