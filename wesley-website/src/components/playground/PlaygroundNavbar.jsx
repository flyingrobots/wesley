import { IconFile, IconSearch, IconDatabase } from '@tabler/icons-react';
import { Box, Code, Group, Text, TextInput, UnstyledButton } from '@mantine/core';
import cx from 'clsx';
import classes from './PlaygroundNavbar.module.css';

const emptyRefs = {};

export default function PlaygroundNavbar({
  inputFiles,
  outputFiles,
  activeFile,
  onSelect,
  isTutorialActive = false,
  tutorialStepId,
  onSelectSidebarItem,
  tutorialRefs = emptyRefs
}) {
  // Fall back to onSelect if onSelectSidebarItem is not provided; no-op if neither exists
  const handleSelect = onSelectSidebarItem || onSelect || (() => {});
  const mainLinks = inputFiles.map((file, idx) => (
    <UnstyledButton
      key={file.file}
      className={cx(classes.mainLink, { [classes.mainLinkActive]: activeFile === file.file })}
      onClick={() => handleSelect(file.file)}
      disabled={isTutorialActive && tutorialStepId !== 'edit-schema'}
      ref={idx === 0 ? tutorialRefs.editor || null : null}
    >
      <div className={classes.mainLinkInner}>
        <IconFile size={20} className={classes.mainLinkIcon} stroke={1.5} />
        <span>{file.file}</span>
      </div>
    </UnstyledButton>
  ));

  const collectionLinks = outputFiles.map((file, idx) => (
    <a
      href="#"
      onClick={(event) => {
        event.preventDefault();
        if (isTutorialActive && tutorialStepId !== 'sidebar-migrations') {
          return;
        }
        handleSelect(file.file);
      }}
      key={file.file}
      className={cx(classes.collectionLink, { [classes.mainLinkActive]: activeFile === file.file })}
      aria-disabled={isTutorialActive && tutorialStepId !== 'sidebar-migrations'}
      ref={idx === 0 ? tutorialRefs['sidebar-migrations'] || null : null}
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
          <Text fw={700} size="sm">
            Wesley Project
          </Text>
          <Text size="xs" c="dimmed">
            Alpha Playground
          </Text>
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
        disabled={isTutorialActive}
      />

      <div className={classes.section}>
        <div className={classes.mainLinks}>
          <UnstyledButton
            className={cx(classes.mainLink, {
              [classes.mainLinkActive]: activeFile === 'database'
            })}
            onClick={() => handleSelect('database')}
            disabled={isTutorialActive && tutorialStepId !== 'sidebar-database'}
            ref={tutorialRefs['sidebar-database'] || null}
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
