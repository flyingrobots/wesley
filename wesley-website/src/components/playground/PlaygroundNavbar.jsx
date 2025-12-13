import { IconFile, IconCode, IconSearch, IconDatabase, IconPlus } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Box,
  Code,
  Group,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
  ScrollArea
} from '@mantine/core';
import cx from 'clsx';
import classes from './PlaygroundNavbar.module.css';

export default function PlaygroundNavbar({ 
  inputFiles, 
  outputFiles, 
  activeFile, 
  onSelect,
  onRunWesley
}) {
  const mainLinks = inputFiles.map((file) => (
    <UnstyledButton 
      key={file.file} 
      className={cx(classes.mainLink, { [classes.mainLinkActive]: activeFile === file.file })}
      onClick={() => onSelect(file.file)}
    >
      <div className={classes.mainLinkInner}>
        <IconFile size={20} className={classes.mainLinkIcon} stroke={1.5} />
        <span>{file.file}</span>
      </div>
    </UnstyledButton>
  ));

  const collectionLinks = outputFiles.map((file) => (
    <a
      href="#"
      onClick={(event) => { event.preventDefault(); onSelect(file.file); }}
      key={file.file}
      className={cx(classes.collectionLink, { [classes.mainLinkActive]: activeFile === file.file })} // Reuse active style
    >
      <Box component="span" mr={9} fz={16}>
        {file.file.endsWith('.sql') ? '🐘' : '📄'}
      </Box>{' '}
      {file.file}
    </a>
  ));

  return (
    <nav className={classes.navbar}>
      <div className={classes.section}>
        <Box p="md">
            <Text fw={700} size="sm">Wesley Project</Text>
            <Text size="xs" c="dimmed">Alpha Playground</Text>
        </Box>
      </div>

      <TextInput
        placeholder="Search files"
        size="xs"
        leftSection={<IconSearch size={12} stroke={1.5} />}
        rightSectionWidth={70}
        rightSection={<Code className={classes.searchCode}>Ctrl + K</Code>}
        styles={{ section: { pointerEvents: 'none' } }}
        mb="sm"
      />

      <div className={classes.section}>
        <div className={classes.mainLinks}>
          <UnstyledButton 
            className={cx(classes.mainLink, { [classes.mainLinkActive]: activeFile === 'database' })}
            onClick={() => onSelect('database')}
          >
            <div className={classes.mainLinkInner}>
              <IconDatabase size={20} className={classes.mainLinkIcon} stroke={1.5} />
              <span>Database Explorer</span>
            </div>
          </UnstyledButton>
        </div>
      </div>

      <div className={classes.section}>
        <Group className={classes.collectionsHeader} justify="space-between">
          <Text size="xs" fw={500} c="dimmed">
            Input Schema
          </Text>
          <Tooltip label="New file" withArrow position="right">
            <ActionIcon variant="default" size={18}>
              <IconPlus size={12} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <div className={classes.mainLinks}>{mainLinks}</div>
      </div>

      {collectionLinks.length > 0 && (
        <div className={classes.section}>
          <Group className={classes.collectionsHeader} justify="space-between">
            <Text size="xs" fw={500} c="dimmed">
              Generated Artifacts
            </Text>
          </Group>
          <div className={classes.collections}>{collectionLinks}</div>
        </div>
      )}
    </nav>
  );
}
