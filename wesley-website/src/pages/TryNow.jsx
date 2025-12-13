// wesley-website/src/pages/TryNow.jsx
import React, { useState, useEffect } from 'react';
import { Button, Group, Loader, Alert, Title, Text, Box, Flex } from '@mantine/core';
import { createDbSession } from '../db/pglite';
import { compileSchemaInBrowser } from '@wesley/host-browser';
import classes from '../components/playground/Playground.module.css';

import PlaygroundNavbar from '../components/playground/PlaygroundNavbar';
import CodeEditor from '../components/playground/CodeEditor';
import DatabasePanel from '../components/playground/DatabasePanel';

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

const initialOutputFiles = [
  { file: 'migrations.sql', body: '' },
  { file: 'schema.sql', body: '' }
];

export default function TryNow() {
  // --- State ---
  const [activeView, setActiveView] = useState(initialInputFiles[0].file); // 'database' or filename
  
  // Files
  const [inputFiles, setInputFiles] = useState(initialInputFiles);
  const [outputFiles, setOutputFiles] = useState(initialOutputFiles);

  // Compilation
  const [compileStatus, setCompileStatus] = useState('idle');
  const [compileErrors, setCompileErrors] = useState([]);

  // Database
  const [dbSession, setDbSession] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbTables, setDbTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableSchema, setTableSchema] = useState([]);
  const [dbQueryText, setDbQueryText] = useState("SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'public';");
  const [dbQueryResult, setDbQueryResult] = useState(null);
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
    
    // Fetch Schema
    if (dbSession) {
        try {
            const schemaRes = await dbSession.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = '${tableName}'
                ORDER BY ordinal_position;
            `);
            setTableSchema(schemaRes.rows);
            
            // Auto-run data query
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
          setCompileErrors([{ message: `Failed to initialize database: ${error.message}` }]);
          setCompileStatus('error');
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
    setCompileStatus('running');
    setOutputFiles(initialOutputFiles);
    setCompileErrors([]);

    try {
      const result = await compileSchemaInBrowser(inputFiles);

      if (result.ok) {
        setOutputFiles(result.outputFiles);
        setCompileStatus('success');
      } else {
        setCompileErrors(result.errors || [{ message: 'Unknown compilation error' }]);
        setCompileStatus('error');
      }
    } catch (error) {
      setCompileErrors([{ message: `Unexpected error: ${error.message}` }]);
      setCompileStatus('error');
    }
  };

  const handleApplyToDatabase = async () => {
    if (!dbSession || compileStatus !== 'success') return;
    try {
      setDbLoading(true);
      setDbQueryError(null);
      const migrationsSql = outputFiles.find(f => f.file === 'migrations.sql')?.body;
      if (migrationsSql) {
        const statements = migrationsSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        await dbSession.applyMigrations(statements);
      }
      setDbQueryResult({ rows: [{ status: 'Migrations applied successfully!' }], fields: ['status'] });
      await fetchTables(dbSession);
      setActiveView('database'); 
    } catch (error) {
      setDbQueryError(error.message);
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
    } finally {
      setDbLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!dbSession) return;
    setDbLoading(true);
    setDbQueryResult(null);
    setDbQueryError(null);
    try {
      await dbSession.reset();
      setDbQueryResult({ rows: [{ status: 'Database reset successfully!' }], fields: ['status'] });
      await fetchTables(dbSession);
      setSelectedTable(null);
      setTableSchema([]);
    } catch (error) {
      setDbQueryError(error.message);
    } finally {
      setDbLoading(false);
    }
  };

  const handleResetPlayground = async () => {
    if (!confirm('Reset everything?')) return;
    
    setCompileStatus('idle');
    setCompileErrors([]);
    setInputFiles(initialInputFiles);
    setOutputFiles(initialOutputFiles);
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
        } catch (e) {
            console.error(e);
        } finally {
            setDbLoading(false);
        }
    }
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
          error={dbQueryError}
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
          <Button onClick={handleRunWesley} loading={compileStatus === 'running'}>
            Run Wesley
          </Button>
          <Button 
            onClick={handleApplyToDatabase} 
            disabled={dbLoading || compileStatus !== 'success'}
            variant="light"
          >
            Apply to Database
          </Button>
          <Button 
            onClick={handleResetDatabase} 
            disabled={dbLoading} 
            color="orange" 
            variant="subtle"
          >
            Reset DB
          </Button>
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

      {/* Success Message */}
      {compileStatus === 'success' && !dbQueryError && activeView !== 'database' && (
        <Alert title="Success" color="green" className={classes.alert} withCloseButton onClose={() => setCompileStatus('idle')}>
          Schema compiled! {outputFiles.find(f => f.file === 'migrations.sql')?.body ? 'Migrations generated.' : 'No migrations needed.'}
        </Alert>
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