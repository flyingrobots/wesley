import React from 'react';
import { Box, Text, NavLink, ScrollArea } from '@mantine/core';

export default function FileExplorer({ files, activeFile, onSelect }) {
  return (
    <Box w={220} bg="gray.0" bd="1px solid gray.3" style={{ borderRight: '1px solid var(--mantine-color-gray-3)', display: 'flex', flexDirection: 'column' }}>
      <Text p="xs" size="sm" fw={600} bd="1px solid gray.3" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        Files
      </Text>
      <ScrollArea flex={1} p={5}>
        {files.map(file => (
          <NavLink
            key={file.file}
            label={file.file}
            active={activeFile === file.file}
            onClick={() => onSelect(file.file)}
            variant="light"
            style={{ borderRadius: 4, fontSize: 14 }}
          />
        ))}
      </ScrollArea>
    </Box>
  );
}