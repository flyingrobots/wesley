// wesley-website/src/pages/TryNow.jsx
import React, { useState, useEffect } from 'react';
import { Button, Group, Loader, Title, Text, Box, Flex, Alert } from '@mantine/core'; // Keep Alert for Errors if needed
import { notifications } from '@mantine/notifications';
import { openConfirmModal } from '@mantine/modals';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
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
  };

  // --- Effects ---
  useEffect(() => {
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
  };

  const handleRunWesley = async () => {
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
          onSelectTable={handleSelectTable}
          query={dbQueryText}
          setQuery={setDbQueryText}
          onRun={() => handleRunDbQuery()}
          loading={dbLoading}
          result={dbQueryResult}
          // error={dbQueryError} // Removed: errors handled via notifications now
        />
      );
    }

    const inputContent = inputFiles.find(f => f.file === activeView)?.body;
    if (inputContent !== undefined) {
      return <CodeEditor value={inputContent} onChange={handleInputFileChange} language="graphql" />;
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
          <Button onClick={handleResetPlayground} variant="subtle" color="gray" size="xs">
            Reset Playground
          </Button>
        </Group>
      </Box>

      {/* Controls */}
      <Box className={classes.controls}>
        <Group mb="md">
          <ExplanationPopover 
            title="Compile Schema" 
            description="Compiles your GraphQL schema into SQL migrations and other artifacts right here in your browser."
          >
            <Button onClick={handleRunWesley} loading={isCompiling}>
              Run Wesley
            </Button>
          </ExplanationPopover>

          <ExplanationPopover 
            title="Apply Migrations" 
            description="Executes the generated SQL migrations against the in-memory PGLite database to create tables."
          >
            <Button 
              onClick={handleApplyToDatabase} 
              disabled={dbLoading || !lastCompileSuccess}
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
              disabled={dbLoading} 
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
            onSelect={setActiveView}
          />
          <Box flex={1} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {renderMainContent()}
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}