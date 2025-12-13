// wesley-website/src/pages/TryNow.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Button, Group, Loader, Title, Text, Box, Flex, Alert, Dialog, RingProgress } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { openConfirmModal } from '@mantine/modals';
import { IconCheck, IconX, IconAlertCircle, IconGauge } from '@tabler/icons-react';
import { createDbSession } from '../db/pglite';
import { compileSchemaInBrowser } from '@wesley/host-browser';
import classes from '../components/playground/Playground.module.css';

import PlaygroundNavbar from '../components/playground/PlaygroundNavbar';
import CodeEditor from '../components/playground/CodeEditor';
import DatabasePanel from '../components/playground/DatabasePanel';
import ExplanationPopover from '../components/playground/ExplanationPopover';

// Initial Files Configuration
const initialInputFiles = [
  {
    file: 'schema.graphql',
    body: `type User {
  id: ID!
  name: String
  email: String! @wes_unique
}

type Product {
  id: ID!
  name: String!
  price: Float!
}`
  },
  {
    file: 'another.graphql',
    body: `type Order {
  id: ID!
  userId: ID! @wes_link(table: "User")
  total: Float!
}`
  }
];

const initialOutputFiles = [];

const TUTORIAL_STEPS = [
  { id: 'welcome', title: "Welcome to Wesley", message: "This tutorial will guide you through the basics of using the Wesley playground. Click 'Next' to begin.", target: null },
  { id: 'edit-schema', title: "1. The Editor", message: "This is where you write your GraphQL schema. Feel free to edit the text, then click 'Run Wesley' when you're ready.", target: 'editor' },
  { id: 'run-wesley', title: "2. Compile Your Schema", message: "Click 'Run Wesley' to compile your schema into SQL migrations.", target: 'run-wesley-button' },
  { id: 'review-artifacts', title: "3. Review Artifacts", message: "Wesley has generated SQL. Click 'migrations.sql' in the sidebar to see the result.", target: 'sidebar-migrations' },
  { id: 'apply-db', title: "4. Apply to Database", message: "Now, execute these migrations against the in-browser database.", target: 'apply-db-button' },
  { id: 'explore-db', title: "5. Explore Database", message: "Your tables are live! Click 'Database Explorer' to view and query them.", target: 'sidebar-database' },
  { id: 'run-query', title: "6. Run a Query", message: "Select a table from the sidebar to auto-generate a query, or write your own, then click 'Run'.", target: 'run-query-button' },
  { id: 'finished', title: "Tutorial Complete!", message: "You've successfully used the schema-first workflow! Feel free to experiment further.", target: null }
];

export default function TryNow() {
  // --- State ---
  const [activeView, setActiveView] = useState(initialInputFiles[0].file); 
  const [inputFiles, setInputFiles] = useState(initialInputFiles);
  const [outputFiles, setOutputFiles] = useState(initialOutputFiles);
  const [isCompiling, setIsCompiling] = useState(false);
  const [lastCompileSuccess, setLastCompileSuccess] = useState(false);
  const [dbSession, setDbSession] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbTables, setDbTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableSchema, setTableSchema] = useState([]);
  const [dbQueryText, setDbQueryText] = useState("SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'public';");
  const [dbQueryResult, setDbQueryResult] = useState(null);
  const [compileErrors, setCompileErrors] = useState([]);
  const [dbQueryError, setDbQueryError] = useState(null);

  // --- Tutorial State ---
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // --- Refs for Tutorial Highlighting ---
  const tutorialRefs = {
    editor: useRef(null),
    'run-wesley-button': useRef(null),
    'sidebar-migrations': useRef(null),
    'apply-db-button': useRef(null),
    'sidebar-database': useRef(null),
    'run-query-button': useRef(null),
  };

  // --- Tutorial Logic ---
  useEffect(() => {
    // This effect manages the highlighting class
    if (!tutorialActive) return;

    Object.values(tutorialRefs).forEach(ref => {
      if (ref.current) {
        ref.current.removeAttribute('data-tutorial-highlight');
      }
    });

    const currentStep = TUTORIAL_STEPS[tutorialStep];
    const targetRef = tutorialRefs[currentStep.target];
    if (targetRef && targetRef.current) {
      targetRef.current.setAttribute('data-tutorial-highlight', 'true');
    }
  }, [tutorialStep, tutorialActive]);
  
  const startTutorial = () => {
    setTutorialActive(true);
    setTutorialStep(0);
  };

  const advanceTutorial = () => setTutorialStep(prev => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
  const backTutorial = () => setTutorialStep(prev => Math.max(0, prev - 1));
  
  const closeTutorial = () => {
    setTutorialActive(false);
    localStorage.setItem('wesley_tutorial_completed', 'true');
    // Clean up highlight on exit
    const currentStep = TUTORIAL_STEPS[tutorialStep];
    const targetRef = tutorialRefs[currentStep.target];
    if (targetRef && targetRef.current) {
      targetRef.current.removeAttribute('data-tutorial-highlight');
    }
  };
  
  const resetTutorial = () => {
    openConfirmModal({
      title: 'Reset Tutorial?',
      children: <Text size="sm">Are you sure you want to reset the tutorial progress?</Text>,
      labels: { confirm: 'Reset', cancel: 'Cancel' },
      onConfirm: () => {
        setTutorialActive(false);
        setTutorialStep(0);
        localStorage.removeItem('wesley_tutorial_active');
        localStorage.removeItem('wesley_tutorial_step');
        localStorage.removeItem('wesley_tutorial_completed');
        notifications.show({ title: 'Tutorial Reset', message: 'Tutorial progress cleared.', color: 'gray' });
      },
    });
  };

  // --- Core Handlers (with Tutorial Hooks) ---
  const handleRunWesley = async () => {
    if (tutorialActive && TUTORIAL_STEPS[tutorialStep].id !== 'run-wesley') return;
    if (tutorialActive) advanceTutorial();
    // ... (rest of the logic)
  };

  // ...(other handlers similarly wrapped)

  // --- Render ---
  return (
    <Box p="lg" h="calc(100vh - 60px)" display="flex" style={{ flexDirection: 'column' }}>
        {/* ... existing header and controls */}
        {/* ... inside controls */}
        <Button onClick={startTutorial}>Start Tutorial</Button>
        {/* ... existing buttons now wrapped in divs with refs */}
        <div ref={tutorialRefs['run-wesley-button']}>
            <Button onClick={handleRunWesley} ... />
        </div>
        {/* ... etc */}

        {/* ... existing workspace */}
        
        {/* Tutorial Dialog */}
        <Dialog
            opened={tutorialActive}
            withCloseButton
            onClose={closeTutorial}
            size="lg"
            radius="md"
            position={{ bottom: 20, right: 20 }}
            className={classes.tutorialDialog}
        >
            <Group align="center" mb="md">
                <RingProgress
                    sections={[{ value: ((tutorialStep + 1) / TUTORIAL_STEPS.length) * 100, color: 'blue' }]}
                    label={
                    <Text c="blue" fw={700} ta="center" size="xl">
                        {tutorialStep + 1}
                    </Text>
                    }
                />
                <Box>
                    <Text fw={700} size="lg">{TUTORIAL_STEPS[tutorialStep].title}</Text>
                    <Text size="sm" c="dimmed">Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}</Text>
                </Box>
            </Group>
            
            <Text size="sm" mb="md">
                {TUTORIAL_STEPS[tutorialStep].message}
            </Text>
            
            <Group justify="flex-end">
                <Button variant="subtle" color="gray" onClick={closeTutorial}>Exit Tutorial</Button>
                <Button variant="light" onClick={backTutorial} disabled={tutorialStep === 0}>Back</Button>
                <Button onClick={advanceTutorial} disabled={tutorialStep >= TUTORIAL_STEPS.length - 1}>Next</Button>
            </Group>
        </Dialog>
    </Box>
  );
}