// wesley-website/src/pages/TryNow.jsx
import React, { useState, useEffect } from 'react';
import { Button, Group, Loader, Title, Text, Box, Flex, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { openConfirmModal } from '@mantine/modals';
import { IconCheck, IconX, IconAlertCircle, IconGauge } from '@tabler/icons-react'; // Import IconGauge
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

export default function TryNow() {
  // --- State ---
  const [activeView, setActiveView] = useState(initialInputFiles[0].file); 
  
  // Files
  const [inputFiles, setInputFiles] = useState(initialInputFiles);
  const [outputFiles, setOutputFiles] = useState(initialOutputFiles);

  // Compilation Status (for loading state only)
  const [isCompiling, setIsCompiling] = useState(false);
  const [lastCompileSuccess, setLastCompileSuccess] = useState(false);

  // Database
  const [dbSession, setDbSession] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbTables, setDbTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableSchema, setTableSchema] = useState([]);
  const [dbQueryText, setDbQueryText] = useState("SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'public';");
  const [dbQueryResult, setDbQueryResult] = useState(null);
  // We keep local error state for persistent display if needed, but notifications handle transient errors
  const [compileErrors, setCompileErrors] = useState([]);
  const [dbQueryError, setDbQueryError] = useState(null);

  // --- Tutorial State ---
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0); // 0 = Welcome, increment for next steps

  const TUTORIAL_STEPS = [
    { id: 'welcome', title: "Welcome to Wesley", message: "Wesley is a schema-first compiler. You write GraphQL, we generate the database. Let's see how.", target: null, allowedActions: ['start-tutorial'] },
    { id: 'edit-schema', title: "1. Edit Schema", message: "This is your GraphQL schema editor. You can type or edit your schema here. Make a small change, or just keep it as is. Then click 'Run Wesley'.", target: "editor", allowedActions: ['edit-input', 'run-wesley'] },
    { id: 'run-wesley', title: "2. Run Wesley", message: "Click 'Run Wesley' to compile your schema into SQL migrations and other artifacts.", target: "run-wesley-button", allowedActions: ['run-wesley'] },
    { id: 'review-artifacts', title: "3. Review Artifacts", message: "Wesley has generated SQL and a schema representation. Click 'migrations.sql' in the sidebar to view it.", target: "sidebar-migrations", allowedActions: ['select-output'] },
    { id: 'apply-db', title: "4. Apply to Database", message: "Now, click 'Apply to Database' to run these migrations against your in-browser Postgres.", target: "apply-db-button", allowedActions: ['apply-db'] },
    { id: 'explore-db', title: "5. Explore Database", message: "Your database is ready! Click 'Database Explorer' in the sidebar to view your tables and run queries.", target: "sidebar-database", allowedActions: ['select-database'] },
    { id: 'run-query', title: "6. Run a Query", message: "The public tables are listed in the sidebar. Select a table, or type your own SQL query and click 'Run'.", target: "run-query-button", allowedActions: ['run-query', 'select-table'] },
    { id: 'finished', title: "Tutorial Complete!", message: "You've successfully deployed a schema-first database! Feel free to experiment. You can always restart the tutorial.", target: null, allowedActions: ['reset-tutorial'] }
  ];

  const startTutorial = () => {
    setIsTutorialActive(true);
    setTutorialStep(0);
    localStorage.setItem('wesley_tutorial_active', 'true');
    localStorage.setItem('wesley_tutorial_step', '0');
  };

  const nextTutorialStep = () => {
    setTutorialStep(prev => {
      const newStep = prev + 1;
      localStorage.setItem('wesley_tutorial_step', newStep.toString());
      return newStep;
    });
  };

  const prevTutorialStep = () => {
    setTutorialStep(prev => {
      const newStep = Math.max(0, prev - 1);
      localStorage.setItem('wesley_tutorial_step', newStep.toString());
      return newStep;
    });
  };

  const skipTutorial = () => {
    setIsTutorialActive(false);
    setTutorialStep(TUTORIAL_STEPS.length -1);
    localStorage.setItem('wesley_tutorial_active', 'false');
    localStorage.setItem('wesley_tutorial_completed', 'true');
    notifications.show({ title: 'Tutorial Skipped', message: 'You can restart it anytime.', color: 'gray' });
  };

  const resetTutorial = () => {
    openConfirmModal({
      title: 'Reset Tutorial?',
      children: <Text size="sm">Are you sure you want to reset the tutorial progress?</Text>,
      labels: { confirm: 'Reset', cancel: 'Cancel' },
      onConfirm: () => {
        setIsTutorialActive(false);
        setTutorialStep(0);
        localStorage.removeItem('wesley_tutorial_active');
        localStorage.removeItem('wesley_tutorial_step');
        localStorage.removeItem('wesley_tutorial_completed');
        notifications.show({ title: 'Tutorial Reset', message: 'Tutorial progress cleared.', color: 'gray' });
      },
    });
  };

  // --- Helpers ---
  const fetchTables = async (session) => {
    if (!session) return;
    try {
      const res = await session.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);
      setDbTables(res.rows.map(r => r.table_name));
    } catch (e) {
      console.error('Failed to fetch tables:', e);
    }
  };

  const handleSelectTable = async (tableName) => {
    setSelectedTable(tableName);
    setDbQueryText(`SELECT * FROM "${tableName}" LIMIT 100;`);
    
    if (dbSession) {
        try {
            const schemaRes = await dbSession.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = '${tableName}'
                ORDER BY ordinal_position;
            `);
            setTableSchema(schemaRes.rows);
            handleRunDbQuery(`SELECT * FROM "${tableName}" LIMIT 100;`);
        } catch (e) {
            console.error(e);
        }
    }
    // Tutorial step check
    if (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id === 'run-query') {
      nextTutorialStep(); // User selected a table, assume they'll run query next
    }
  };

  // --- Effects ---
  useEffect(() => {
    // Load tutorial state from localStorage on mount
    const savedActive = localStorage.getItem('wesley_tutorial_active') === 'true';
    const savedStep = parseInt(localStorage.getItem('wesley_tutorial_step') || '0', 10);
    const completed = localStorage.getItem('wesley_tutorial_completed') === 'true';

    if (savedActive && !completed) {
      setIsTutorialActive(true);
      setTutorialStep(savedStep);
    }
    // If completed, don't auto-start

    let cancelled = false;
    let session;

    async function initDb() {
      try {
        const s = await createDbSession();
        if (cancelled) return; 
        
        session = s;
        setDbSession(session);
        await fetchTables(session);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to initialize DbSession:', error);
          notifications.show({
            title: 'Database Init Failed',
            message: error.message,
            color: 'red',
            icon: <IconX size="1.1rem" />,
          });
        }
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    }
    initDb();

    return () => {
      cancelled = true;
    };
  }, []);

  // --- Handlers ---
  const handleInputFileChange = (body) => {
    setInputFiles(prev => prev.map(f => 
      f.file === activeView ? { ...f, body } : f
    ));
    if (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id === 'edit-schema') {
        nextTutorialStep();
    }
  };

  const handleRunWesley = async () => {
    // Tutorial step check
    if (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id === 'run-wesley') {
        nextTutorialStep();
    }
    
    setIsCompiling(true);
    setLastCompileSuccess(false);
    setOutputFiles(initialOutputFiles);
    setCompileErrors([]);

    try {
      const result = await compileSchemaInBrowser(inputFiles);

      if (result.ok) {
        setOutputFiles(result.outputFiles);
        setLastCompileSuccess(true);
        notifications.show({
          title: 'Compilation Successful',
          message: 'Schema generated successfully.',
          color: 'green',
          icon: <IconCheck size="1.1rem" />,
        });
        // Tutorial step check
        if (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id === 'review-artifacts') {
          setActiveView('migrations.sql'); // Auto-select for tutorial
          nextTutorialStep();
        }
      } else {
        setCompileErrors(result.errors || []);
        notifications.show({
          title: 'Compilation Failed',
          message: 'Check the error panel for details.',
          color: 'red',
          icon: <IconX size="1.1rem" />,
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Compilation Error',
        message: error.message,
        color: 'red',
        icon: <IconX size="1.1rem" />,
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleApplyToDatabase = async () => {
    // Tutorial step check
    if (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id === 'apply-db') {
        nextTutorialStep();
    }

    if (!dbSession || !lastCompileSuccess) return;
    try {
      setDbLoading(true);
      const migrationsSql = outputFiles.find(f => f.file === 'migrations.sql')?.body;
      if (migrationsSql) {
        const statements = migrationsSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        await dbSession.applyMigrations(statements);
      }
      await fetchTables(dbSession);
      setActiveView('database'); 
      notifications.show({
        title: 'Database Updated',
        message: 'Migrations applied successfully.',
        color: 'green',
        icon: <IconCheck size="1.1rem" />,
      });
      // Tutorial step check
      if (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id === 'explore-db') {
        nextTutorialStep();
      }
    } catch (error) {
      notifications.show({
        title: 'Migration Failed',
        message: error.message,
        color: 'red',
        icon: <IconX size="1.1rem" />,
      });
    } finally {
      setDbLoading(false);
    }
  };

  const handleRunDbQuery = async (queryOverride) => {
    // Tutorial step check
    if (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id === 'run-query') {
        nextTutorialStep();
    }

    const sql = queryOverride || dbQueryText;
    if (!dbSession || !sql.trim()) return;
    if (queryOverride) setDbQueryText(sql);

    setDbLoading(true);
    setDbQueryResult(null);
    setDbQueryError(null);
    try {
      const result = await dbSession.query(sql);
      setDbQueryResult(result);
      if (sql.match(/create|drop|alter/i)) {
          await fetchTables(dbSession);
      }
    } catch (error) {
      setDbQueryError(error.message);
      notifications.show({
        title: 'Query Failed',
        message: error.message,
        color: 'red',
        icon: <IconAlertCircle size="1.1rem" />,
      });
    } finally {
      setDbLoading(false);
    }
  };

  const handleResetDatabase = () => {
    openConfirmModal({
      title: 'Reset Database?',
      children: (
        <Text size="sm">
          Are you sure you want to reset the database? This will clear all tables and data.
        </Text>
      ),
      labels: { confirm: 'Reset', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!dbSession) return;
        setDbLoading(true);
        setDbQueryResult(null);
        setDbQueryError(null);
        try {
          await dbSession.reset();
          await fetchTables(dbSession);
          setSelectedTable(null);
          setTableSchema([]);
          notifications.show({
            title: 'Database Reset',
            message: 'The database has been cleared.',
            color: 'blue',
            icon: <IconCheck size="1.1rem" />,
          });
        } catch (error) {
          notifications.show({
            title: 'Reset Failed',
            message: error.message,
            color: 'red',
            icon: <IconX size="1.1rem" />,
          });
        } finally {
          setDbLoading(false);
        }
      },
    });
  };

  const handleResetPlayground = () => {
    openConfirmModal({
      title: 'Reset Playground?',
      children: (
        <Text size="sm">
          Are you sure you want to reset the entire playground? This will clear all your GraphQL schemas and reset the database.
        </Text>
      ),
      labels: { confirm: 'Reset Everything', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setIsCompiling(false);
        setLastCompileSuccess(false);
        setInputFiles(initialInputFiles);
        setOutputFiles(initialOutputFiles);
        setCompileErrors([]);
        setDbQueryText("SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'public';");
        setDbQueryResult(null);
        setDbQueryError(null);
        setActiveView(initialInputFiles[0].file);
        setSelectedTable(null);
        setTableSchema([]);
        
        if (dbSession) {
            setDbLoading(true);
            try {
                await dbSession.reset();
                await fetchTables(dbSession);
                notifications.show({
                    title: 'Playground Reset',
                    message: 'All state has been cleared.',
                    color: 'gray',
                });
            } catch (e) {
                console.error(e);
            } finally {
                setDbLoading(false);
            }
        }
      },
    });
  };

  // --- Render Helpers ---
  const renderMainContent = () => {
    if (activeView === 'database') {
      return (
        <DatabasePanel 
          tables={dbTables}
          selectedTable={selectedTable}
          tableSchema={tableSchema}
          onSelectTable={(tableName) => {
            if (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id === 'run-query') {
              // Allow selecting a table in run-query step
              handleSelectTable(tableName);
              // Do not nextStep here, wait for query run
            } else if (!isTutorialActive || TUTORIAL_STEPS[tutorialStep].id === 'explore-db') {
              handleSelectTable(tableName);
              if (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id === 'explore-db') {
                nextTutorialStep(); // Selected first table after explore-db
              }
            } else {
              notifications.show({
                title: 'Tutorial Hint',
                message: 'Please follow the tutorial instructions.',
                color: 'blue',
                icon: <IconAlertCircle size="1.1rem" />,
              });
            }
          }}
          query={dbQueryText}
          setQuery={setDbQueryText}
          onRun={() => handleRunDbQuery()}
          loading={dbLoading}
          result={dbQueryResult}
          // error={dbQueryError} // Removed: errors handled via notifications now
          isTutorialActive={isTutorialActive}
          tutorialStepId={isTutorialActive ? TUTORIAL_STEPS[tutorialStep].id : null}
        />
      );
    }

    const inputContent = inputFiles.find(f => f.file === activeView)?.body;
    if (inputContent !== undefined) {
      return <CodeEditor 
                value={inputContent} 
                onChange={handleInputFileChange} 
                language="graphql" 
                readOnly={isTutorialActive && TUTORIAL_STEPS[tutorialStep].id !== 'edit-schema'}
              />;
    }

    const outputContent = outputFiles.find(f => f.file === activeView)?.body;
    if (outputContent !== undefined) {
      const ext = activeView.split('.').pop();
      const lang = ext === 'sql' ? 'sql' : ext === 'json' ? 'json' : 'graphql';
      return <CodeEditor value={outputContent} readOnly language={lang} />;
    }

    return <Text p="md" c="dimmed">Select a file to view</Text>;
  };

  return (
    <Box className={classes.container}>
      {/* Header */}
      <Box className={classes.header}>
        <Group justify="space-between" mb="md">
          <Box>
            <Title order={1} className={classes.title}>Wesley Playground (Alpha)</Title>
            <Text className={classes.subtitle}>
              Edit GraphQL schemas, compile to Postgres, and query live.
            </Text>
          </Box>
          <Group>
            {!isTutorialActive && localStorage.getItem('wesley_tutorial_completed') !== 'true' && (
              <Button onClick={startTutorial} variant="default" size="xs" leftSection={<IconGauge size="1.1rem" />}>
                Start Tutorial
              </Button>
            )}
            {isTutorialActive && (
                <Button onClick={resetTutorial} variant="subtle" size="xs">Reset Tutorial</Button>
            )}
            <Button onClick={handleResetPlayground} variant="subtle" color="gray" size="xs" disabled={isTutorialActive}>
              Reset Playground
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Controls */}
      <Box className={classes.controls}>
        <Group mb="md">
          <ExplanationPopover 
            title="Compile Schema" 
            description="Compiles your GraphQL schema into SQL migrations and other artifacts right here in your browser."
          >
            <Button 
              onClick={handleRunWesley} 
              loading={isCompiling}
              disabled={isTutorialActive && TUTORIAL_STEPS[tutorialStep].id !== "run-wesley"} // 'run-wesley' step
              data-tutorial-id="run-wesley-button"
            >
              Run Wesley
            </Button>
          </ExplanationPopover>

          <ExplanationPopover 
            title="Apply Migrations" 
            description="Executes the generated SQL migrations against the in-memory PGLite database to create tables."
          >
            <Button 
              onClick={handleApplyToDatabase} 
              disabled={dbLoading || !lastCompileSuccess || (isTutorialActive && TUTORIAL_STEPS[tutorialStep].id !== "apply-db")} // 'apply-db' step
              data-tutorial-id="apply-db-button"
              variant="light"
            >
              Apply to Database
            </Button>
          </ExplanationPopover>

          <ExplanationPopover 
            title="Reset Database" 
            description="Wipes all data and schema from the database, giving you a fresh start."
          >
            <Button 
              onClick={handleResetDatabase} 
              disabled={dbLoading || isTutorialActive} 
              color="orange" 
              variant="subtle"
            >
              Reset DB
            </Button>
          </ExplanationPopover>
          {dbLoading && <Loader size="sm" />}
        </Group>
      </Box>

      {/* Errors */}
      {(compileErrors.length > 0 || dbQueryError) && (
        <Box className={classes.alert}>
          {compileErrors.map((err, idx) => (
            <Alert key={idx} title="Compilation Error" color="red" withCloseButton onClose={() => setCompileErrors([])} mb="xs">
              {err.message}
            </Alert>
          ))}
          {dbQueryError && (
            <Alert title="Database Error" color="red" withCloseButton onClose={() => setDbQueryError(null)}>
              {dbQueryError}
            </Alert>
          )}
        </Box>
      )}

      {/* Workspace Area */}
      <Box className={classes.workspace}>
        <Flex h="100%" style={{ overflow: 'hidden' }}>
          <PlaygroundNavbar 
            inputFiles={inputFiles}
            outputFiles={outputFiles}
            activeFile={activeView}
            onSelect={(id) => {
              if (isTutorialActive) {
                if (TUTORIAL_STEPS[tutorialStep].id === 'review-artifacts' && id === 'migrations.sql') {
                  setActiveView(id);
                  nextTutorialStep();
                } else if (TUTORIAL_STEPS[tutorialStep].id === 'explore-db' && id === 'database') {
                  setActiveView(id);
                  nextTutorialStep();
                } else {
                  notifications.show({
                    title: 'Tutorial Hint',
                    message: 'Please follow the tutorial instructions.',
                    color: 'blue',
                    icon: <IconAlertCircle size="1.1rem" />,
                  });
                }
              } else {
                setActiveView(id);
              }
            }}
          />
          <Box flex={1} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {renderMainContent()}
          </Box>
        </Flex>
      </Box>

      {/* Tutorial Overlay */}
      {isTutorialActive && (
        <Box className={classes.tutorialOverlay}>
          <Box className={classes.tutorialCard} p="md" shadow="md" radius="md">
            <Text fw={700} size="lg" mb="xs">{TUTORIAL_STEPS[tutorialStep].title}</Text>
            <Text size="sm" mb="md">{TUTORIAL_STEPS[tutorialStep].message}</Text>
            <Group justify="space-between">
                <Button onClick={skipTutorial} variant="subtle" color="gray" size="xs">Skip</Button>
                <Group>
                    <Button onClick={prevTutorialStep} disabled={tutorialStep === 0} variant="light" size="xs">Previous</Button>
                    {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                        <Button 
                            onClick={nextTutorialStep} 
                            size="xs" 
                            disabled={
                              (TUTORIAL_STEPS[tutorialStep].id === 'edit-schema' && inputFiles[0].body === initialInputFiles[0].body) || // Require edit
                              (TUTORIAL_STEPS[tutorialStep].id === 'review-artifacts' && activeView !== 'migrations.sql') || // Require migrations.sql selected
                              (TUTORIAL_STEPS[tutorialStep].id === 'explore-db' && activeView !== 'database') // Require db selected
                            }
                        >
                            Next
                        </Button>
                    ) : (
                        <Button onClick={skipTutorial} size="xs" color="green">Finish</Button>
                    )}
                </Group>
            </Group>
            <Text size="xs" c="dimmed" ta="right" mt="xs">Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}