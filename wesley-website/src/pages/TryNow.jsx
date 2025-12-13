// wesley-website/src/pages/TryNow.jsx
import React, { useState, useEffect } from 'react';
import { Button, Group, Loader, Alert, Tabs, Title, Text, Box } from '@mantine/core';
import { createDbSession } from '../db/pglite';
import { compileSchemaInBrowser } from '@wesley/host-browser';
import classes from '../components/playground/Playground.module.css';

import FileExplorer from '../components/playground/FileExplorer';
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
  const [activeTab, setActiveTab] = useState('input-schema');
  
  // Files
  const [inputFiles, setInputFiles] = useState(initialInputFiles);
  const [outputFiles, setOutputFiles] = useState(initialOutputFiles);
  const [activeInputFile, setActiveInputFile] = useState(initialInputFiles[0].file);
  const [activeOutputFile, setActiveOutputFile] = useState(initialOutputFiles[0].file);

  // Compilation
  const [compileStatus, setCompileStatus] = useState('idle'); // idle | running | success | error
  const [compileErrors, setCompileErrors] = useState([]);

  // Database
  const [dbSession, setDbSession] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbTables, setDbTables] = useState([]);
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

  // --- Effects ---

  useEffect(() => {
    let cancelled = false;
    let session;

    async function initDb() {
      try {
        const s = await createDbSession();
        if (cancelled) return; // session singleton persists, no close needed here really
        
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
      // Note: we don't close the singleton session here to support hot-reload/nav
    };
  }, []);

  // --- Handlers ---

  const handleInputFileChange = (body) => {
    setInputFiles(prev => prev.map(f => 
      f.file === activeInputFile ? { ...f, body } : f
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
        setActiveTab('wesley-output');
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
      setActiveTab('database-explorer');
    } catch (error) {
      setDbQueryError(error.message);
    } finally {
      setDbLoading(false);
    }
  };

  const handleRunDbQuery = async () => {
    if (!dbSession || !dbQueryText.trim()) return;
    setDbLoading(true);
    setDbQueryResult(null);
    setDbQueryError(null);
    try {
      const result = await dbSession.query(dbQueryText);
      setDbQueryResult(result);
      if (dbQueryText.match(/create|drop|alter/i)) {
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
    } catch (error) {
      setDbQueryError(error.message);
    } finally {
      setDbLoading(false);
    }
  };

  const handleResetPlayground = async () => {
    if (!confirm('Reset everything? This clears your schema and database.')) return;
    
    setCompileStatus('idle');
    setCompileErrors([]);
    setInputFiles(initialInputFiles);
    setOutputFiles(initialOutputFiles);
    setDbQueryText("SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'public';");
    setDbQueryResult(null);
    setDbQueryError(null);
    setActiveTab('input-schema');
    
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

  const activeInputContent = inputFiles.find(f => f.file === activeInputFile)?.body || '';
  const activeOutputContent = outputFiles.find(f => f.file === activeOutputFile)?.body || '';

  return (
    <div className={classes.container}>
      {/* Header */}
      <div className={classes.header}>
        <Group justify="space-between">
          <div>
            <Title className={classes.title}>Wesley Playground (Alpha)</Title>
            <Text className={classes.subtitle}>
              Edit GraphQL schemas, compile to Postgres, and query live.
            </Text>
          </div>
          <Button onClick={handleResetPlayground} variant="subtle" color="gray" size="xs">
            Reset Playground
          </Button>
        </Group>
      </div>

      {/* Controls */}
      <div className={classes.controls}>
        <Group>
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
      </div>

      {/* Errors */}
      {(compileErrors.length > 0 || dbQueryError) && (
        <div className={classes.alert}>
          {compileErrors.map((err, idx) => (
            <Alert key={idx} title="Compilation Error" color="red" withCloseButton onClose={() => setCompileErrors([])}>
              {err.message}
            </Alert>
          ))}
          {dbQueryError && (
            <Alert title="Database Error" color="red" withCloseButton onClose={() => setDbQueryError(null)}>
              {dbQueryError}
            </Alert>
          )}
        </div>
      )}

      {/* Success Message */}
      {compileStatus === 'success' && !dbQueryError && activeTab !== 'database-explorer' && (
        <Alert title="Success" color="green" className={classes.alert} withCloseButton onClose={() => setCompileStatus('idle')}>
          Schema compiled! {outputFiles.find(f => f.file === 'migrations.sql')?.body ? 'Migrations generated.' : 'No migrations needed.'}
        </Alert>
      )}

      {/* Workspace Tabs */}
      <div className={classes.workspace}>
        <Tabs value={activeTab} onChange={setActiveTab} variant="outline" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="input-schema">GraphQL Input</Tabs.Tab>
            <Tabs.Tab value="wesley-output">Wesley Output</Tabs.Tab>
            <Tabs.Tab value="database-explorer" disabled={dbLoading}>Database Explorer</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="input-schema">
            <div className={classes.panel}>
              <FileExplorer 
                files={inputFiles} 
                activeFile={activeInputFile} 
                onSelect={setActiveInputFile} 
              />
              <CodeEditor 
                value={activeInputContent} 
                onChange={handleInputFileChange} 
              />
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="wesley-output">
            <div className={classes.panel}>
              <FileExplorer 
                files={outputFiles} 
                activeFile={activeOutputFile} 
                onSelect={setActiveOutputFile} 
              />
              <CodeEditor 
                value={activeOutputContent} 
                readOnly 
              />
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="database-explorer">
            <DatabasePanel 
              tables={dbTables}
              query={dbQueryText}
              setQuery={setDbQueryText}
              onRun={handleRunDbQuery}
              loading={dbLoading}
              result={dbQueryResult}
              error={dbQueryError}
            />
          </Tabs.Panel>
        </Tabs>
      </div>
    </div>
  );
}
