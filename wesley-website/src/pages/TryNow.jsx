// wesley-website/src/pages/TryNow.jsx
import React, { useState, useReducer, useEffect } from 'react';
import { Button, Group, Loader, Title, Text, Box, Flex, Alert } from '@mantine/core';
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

// --- Reducers ---
let nextErrorId = 0;

const initialDbState = {
  session: null,
  loading: true,
  tables: [],
  selectedTable: null,
  tableSchema: [],
  queryText: "SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'public';",
  queryResult: null,
  errors: [],
};

function dbReducer(state, action) {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_TABLES':
      return { ...state, tables: action.payload };
    case 'SELECT_TABLE':
      return { ...state, selectedTable: action.payload };
    case 'SET_TABLE_SCHEMA':
      return { ...state, tableSchema: action.payload };
    case 'SET_QUERY_TEXT':
      return { ...state, queryText: action.payload };
    case 'SET_QUERY_RESULT':
      return { ...state, queryResult: action.payload };
    case 'ADD_ERROR':
      return { ...state, errors: [...state.errors, { ...action.payload, id: nextErrorId++ }] };
    case 'REMOVE_ERROR':
      return { ...state, errors: state.errors.filter(e => e.id !== action.payload) };
    case 'CLEAR_ERRORS':
      return { ...state, errors: [] };
    case 'RESET':
      return {
        ...state,
        tables: [],
        selectedTable: null,
        tableSchema: [],
        queryText: "SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'public';",
        queryResult: null,
        errors: [],
      };
    default:
      return state;
  }
}

const initialCompileState = {
  isCompiling: false,
  lastSuccess: false,
  errors: [],
};

function compileReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { isCompiling: true, lastSuccess: false, errors: [] };
    case 'SUCCESS':
      return { isCompiling: false, lastSuccess: true, errors: [] };
    case 'FAILURE':
      return { isCompiling: false, lastSuccess: false, errors: action.payload.map(e => ({ ...e, id: nextErrorId++ })) };
    case 'REMOVE_ERROR':
      return { ...state, errors: state.errors.filter(e => e.id !== action.payload) };
    case 'RESET':
      return initialCompileState;
    default:
      return state;
  }
}

// Valid SQL identifier pattern (alphanumeric and underscore only)
const VALID_TABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export default function TryNow() {
  // --- State ---
  const [activeView, setActiveView] = useState(initialInputFiles[0].file);

  // Files
  const [inputFiles, setInputFiles] = useState(initialInputFiles);
  const [outputFiles, setOutputFiles] = useState(initialOutputFiles);

  // Database state (consolidated)
  const [dbState, dispatchDb] = useReducer(dbReducer, initialDbState);

  // Compile state (consolidated)
  const [compileState, dispatchCompile] = useReducer(compileReducer, initialCompileState);

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
      dispatchDb({ type: 'SET_TABLES', payload: res.rows.map(r => r.table_name) });
    } catch (e) {
      console.error('Failed to fetch tables:', e);
    }
  };

  const handleSelectTable = async (tableName) => {
    // Validate table name to prevent injection (defense-in-depth)
    if (!VALID_TABLE_NAME.test(tableName)) {
      notifications.show({
        title: 'Invalid Table Name',
        message: 'Table name contains invalid characters.',
        color: 'red',
        icon: <IconAlertCircle size="1.1rem" />,
      });
      return;
    }

    // Additional check: ensure tableName is from our known tables list
    if (!dbState.tables.includes(tableName)) {
      notifications.show({
        title: 'Unknown Table',
        message: 'Selected table does not exist.',
        color: 'red',
        icon: <IconAlertCircle size="1.1rem" />,
      });
      return;
    }

    dispatchDb({ type: 'SELECT_TABLE', payload: tableName });
    dispatchDb({ type: 'SET_QUERY_TEXT', payload: `SELECT * FROM "${tableName}" LIMIT 100;` });

    if (dbState.session) {
      try {
        // Use parameterized query for information_schema lookup
        const schemaRes = await dbState.session.query(
          `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_name = $1
           ORDER BY ordinal_position;`,
          [tableName]
        );
        dispatchDb({ type: 'SET_TABLE_SCHEMA', payload: schemaRes.rows });
        handleRunDbQuery(`SELECT * FROM "${tableName}" LIMIT 100;`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // --- Effects ---
  useEffect(() => {
    let cancelled = false;
    let session = null;

    async function initDb() {
      try {
        const s = await createDbSession();
        if (cancelled) {
          // Cleanup if cancelled during init
          if (s && typeof s.close === 'function') {
            s.close().catch(() => {});
          }
          return;
        }

        session = s;
        dispatchDb({ type: 'SET_SESSION', payload: session });
        await fetchTables(session);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to initialize DbSession:', error);
          dispatchDb({ type: 'ADD_ERROR', payload: { title: 'Database Init Failed', message: error.message } });
        }
      } finally {
        if (!cancelled) dispatchDb({ type: 'SET_LOADING', payload: false });
      }
    }
    initDb();

    return () => {
      cancelled = true;
      // Cleanup: close/dispose session if it has a teardown method
      if (session) {
        if (typeof session.close === 'function') {
          session.close().catch(() => {});
        } else if (typeof session.dispose === 'function') {
          session.dispose().catch(() => {});
        }
      }
    };
  }, []);

  // --- Handlers ---
  const handleInputFileChange = (body) => {
    setInputFiles(prev => prev.map(f =>
      f.file === activeView ? { ...f, body } : f
    ));
  };

  const handleRunWesley = async () => {
    dispatchCompile({ type: 'START' });
    setOutputFiles(initialOutputFiles);

    try {
      const result = await compileSchemaInBrowser(inputFiles);

      if (result.ok) {
        setOutputFiles(result.outputFiles);
        dispatchCompile({ type: 'SUCCESS' });
        notifications.show({
          title: 'Compilation Successful',
          message: 'Schema generated successfully.',
          color: 'green',
          icon: <IconCheck size="1.1rem" />,
        });
      } else {
        dispatchCompile({ type: 'FAILURE', payload: result.errors || [] });
        notifications.show({
          title: 'Compilation Failed',
          message: 'Check the error panel for details.',
          color: 'red',
          icon: <IconX size="1.1rem" />,
        });
      }
    } catch (error) {
      dispatchCompile({ type: 'FAILURE', payload: [{ message: error.message }] });
      notifications.show({
        title: 'Compilation Error',
        message: error.message,
        color: 'red',
        icon: <IconX size="1.1rem" />,
      });
    }
  };

  const handleApplyToDatabase = async () => {
    if (!dbState.session || !compileState.lastSuccess) return;
    try {
      dispatchDb({ type: 'CLEAR_ERRORS' });
      dispatchDb({ type: 'SET_LOADING', payload: true });
      const migrationsSql = outputFiles.find(f => f.file === 'migrations.sql')?.body;
      if (!migrationsSql) {
        dispatchDb({ type: 'ADD_ERROR', payload: { title: 'No Migrations', message: 'No migrations.sql file found in compiled output.' } });
        dispatchDb({ type: 'SET_LOADING', payload: false });
        return;
      }
      // LIMITATION: This naive split on ';' will break SQL containing semicolons
      // inside string literals (e.g., INSERT INTO t VALUES ('a;b')).
      // A proper SQL-aware tokenizer would be needed for full support.
      // For now, we validate and warn the user about this limitation.
      const hasUnmatchedQuotes = (migrationsSql.match(/'/g) || []).length % 2 !== 0;
      if (hasUnmatchedQuotes) {
        dispatchDb({ type: 'ADD_ERROR', payload: { title: 'Migration Warning', message: 'SQL contains unmatched quotes. Migrations with semicolons inside string literals are not supported.' } });
        dispatchDb({ type: 'SET_LOADING', payload: false });
        return;
      }

      const statements = migrationsSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      await dbState.session.applyMigrations(statements);
      await fetchTables(dbState.session);
      setActiveView('database');
      notifications.show({
        title: 'Database Updated',
        message: 'Migrations applied successfully.',
        color: 'green',
        icon: <IconCheck size="1.1rem" />,
      });
    } catch (error) {
      dispatchDb({ type: 'ADD_ERROR', payload: { title: 'Migration Failed', message: error.message } });
    } finally {
      dispatchDb({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleRunDbQuery = async (queryOverride) => {
    const sql = queryOverride || dbState.queryText;
    if (!dbState.session || !sql.trim()) return;
    if (queryOverride) dispatchDb({ type: 'SET_QUERY_TEXT', payload: sql });

    dispatchDb({ type: 'CLEAR_ERRORS' });
    dispatchDb({ type: 'SET_LOADING', payload: true });
    dispatchDb({ type: 'SET_QUERY_RESULT', payload: null });
    try {
      const result = await dbState.session.query(sql);
      dispatchDb({ type: 'SET_QUERY_RESULT', payload: result });
      if (sql.match(/\b(create|drop|alter)\b/i)) {
        await fetchTables(dbState.session);
      }
    } catch (error) {
      dispatchDb({ type: 'ADD_ERROR', payload: { title: 'Query Failed', message: error.message } });
    } finally {
      dispatchDb({ type: 'SET_LOADING', payload: false });
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
        if (!dbState.session) return;
        dispatchDb({ type: 'SET_LOADING', payload: true });
        dispatchDb({ type: 'SET_QUERY_RESULT', payload: null });
        try {
          await dbState.session.reset();
          await fetchTables(dbState.session);
          dispatchDb({ type: 'SELECT_TABLE', payload: null });
          dispatchDb({ type: 'SET_TABLE_SCHEMA', payload: [] });
          notifications.show({
            title: 'Database Reset',
            message: 'The database has been cleared.',
            color: 'blue',
            icon: <IconCheck size="1.1rem" />,
          });
        } catch (error) {
          dispatchDb({ type: 'ADD_ERROR', payload: { title: 'Reset Failed', message: error.message } });
        } finally {
          dispatchDb({ type: 'SET_LOADING', payload: false });
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
        dispatchCompile({ type: 'RESET' });
        setInputFiles(initialInputFiles);
        setOutputFiles(initialOutputFiles);
        dispatchDb({ type: 'RESET' });
        setActiveView(initialInputFiles[0].file);

        if (dbState.session) {
          dispatchDb({ type: 'SET_LOADING', payload: true });
          try {
            await dbState.session.reset();
            await fetchTables(dbState.session);
            notifications.show({
              title: 'Playground Reset',
              message: 'All state has been cleared.',
              color: 'gray',
            });
          } catch (e) {
            console.error(e);
          } finally {
            dispatchDb({ type: 'SET_LOADING', payload: false });
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
          tables={dbState.tables}
          selectedTable={dbState.selectedTable}
          tableSchema={dbState.tableSchema}
          onSelectTable={handleSelectTable}
          query={dbState.queryText}
          setQuery={(text) => dispatchDb({ type: 'SET_QUERY_TEXT', payload: text })}
          onRun={() => handleRunDbQuery()}
          loading={dbState.loading}
          result={dbState.queryResult}
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
            <Button onClick={handleRunWesley} loading={compileState.isCompiling}>
              Run Wesley
            </Button>
          </ExplanationPopover>

          <ExplanationPopover
            title="Apply Migrations"
            description="Executes the generated SQL migrations against the in-memory PGLite database to create tables."
          >
            <Button
              onClick={handleApplyToDatabase}
              disabled={dbState.loading || !compileState.lastSuccess}
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
              disabled={dbState.loading}
              color="orange"
              variant="subtle"
            >
              Reset DB
            </Button>
          </ExplanationPopover>
          {dbState.loading && <Loader size="sm" />}
        </Group>
      </Box>

      {/* Centralized error panel for compile and DB errors */}
      {(compileState.errors.length > 0 || dbState.errors.length > 0) && (
        <Box className={classes.alert}>
          {compileState.errors.map((err) => (
            <Alert key={`compile-${err.id}`} title="Compilation Error" color="red" withCloseButton onClose={() => dispatchCompile({ type: 'REMOVE_ERROR', payload: err.id })} mb="xs">
              {err.message}
            </Alert>
          ))}
          {dbState.errors.map((err) => (
            <Alert key={`db-${err.id}`} title={err.title} color="red" withCloseButton onClose={() => dispatchDb({ type: 'REMOVE_ERROR', payload: err.id })} mb="xs">
              {err.message}
            </Alert>
          ))}
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
