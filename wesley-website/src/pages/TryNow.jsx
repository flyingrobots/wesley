// wesley-website/src/pages/TryNow.jsx
import React, { useState, useEffect } from 'react';
import { Box, Tabs, Text, Code, Button, Group, Loader, ScrollArea } from '@mantine/core';
import { createDbSession } from '../db/pglite';
import { compileSchemaInBrowser } from '@wesley/host-browser';

// Define the generic file structure
// eslint-disable-next-line no-unused-vars
import { z } from 'zod'; // Zod is imported but not used directly in this file; it's here to remind us of schema validation.

const fileSchema = z.object({
  file: z.string(),
  body: z.string(),
});

const filesArraySchema = z.array(fileSchema);

// Initial files for the GraphQL Input Schema Files tab
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

// Initial files for the Wesley Output Files tab (empty for now)
const initialOutputFiles = [
  { file: 'migrations.sql', body: '' },
  { file: 'schema.sql', body: '' }
];


export default function TryNow() {
  const [activeTab, setActiveTab] = useState('input-schema');
  const [inputFiles, setInputFiles] = useState(initialInputFiles);
  const [outputFiles, setOutputFiles] = useState(initialOutputFiles);
  const [dbSession, setDbSession] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbQueryText, setDbQueryText] = useState('SELECT * FROM User;');
  const [dbQueryResult, setDbQueryResult] = useState(null);
  const [dbQueryError, setDbQueryError] = useState(null);
  const [activeInputFile, setActiveInputFile] = useState(initialInputFiles[0].file);
  const [activeOutputFile, setActiveOutputFile] = useState(initialOutputFiles[0].file);
  const [compileStatus, setCompileStatus] = useState('idle'); // idle | running | success | error

  // Initialize DbSession
  useEffect(() => {
    async function initDb() {
      try {
        const session = await createDbSession();
        setDbSession(session);
      } catch (error) {
        console.error('Failed to initialize DbSession:', error);
        // Optionally set a global error state here
      } finally {
        setDbLoading(false);
      }
    }
    initDb();
  }, []);

  const handleInputFileChange = (fileName, newBody) => {
    setInputFiles(prev => prev.map(file =>
      file.file === fileName ? { ...file, body: newBody } : file
    ));
  };

  const handleRunWesley = async () => {
    setCompileStatus('running');
    setOutputFiles(initialOutputFiles); // Clear previous output

    // Use actual Wesley compilation
    try {
      const result = await compileSchemaInBrowser(inputFiles);

      if (result.ok) {
        setOutputFiles(result.outputFiles);
        setCompileStatus('success');
        setActiveTab('wesley-output'); // Switch to output tab on success
      } else {
        console.error('Wesley compilation failed:', result.errors);
        setOutputFiles([
          { file: 'error.log', body: result.errors.map(e => e.message).join('\n') }
        ]);
        setCompileStatus('error');
        setActiveTab('wesley-output'); // Show errors in output tab
      }
    } catch (error) {
      console.error('Wesley compilation failed unexpectedly:', error);
      setOutputFiles([
        { file: 'error.log', body: `Unexpected error: ${error.message}` }
      ]);
      setCompileStatus('error');
      setActiveTab('wesley-output'); // Show errors in output tab
    }
  };

  const handleApplyToDatabase = async () => {
    if (!dbSession || compileStatus !== 'success') return;
    try {
      setDbLoading(true);
      const migrationsSql = outputFiles.find(f => f.file === 'migrations.sql')?.body;
      if (migrationsSql) {
        // Split migrations by semicolon, filter out empty strings, and trim
        const statements = migrationsSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        await dbSession.applyMigrations(statements);
      }
      // Optionally run some post-application queries
      setDbQueryResult({ rows: [{ status: 'Migrations applied successfully!' }], fields: ['status'] });
      setDbQueryError(null);
    } catch (error) {
      console.error('Failed to apply migrations:', error);
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
    } catch (error) {
      console.error('Failed to reset database:', error);
      setDbQueryError(error.message);
    } finally {
      setDbLoading(false);
    }
  };


  const activeInputFileContent = inputFiles.find(f => f.file === activeInputFile)?.body || '';
  const activeOutputFileContent = outputFiles.find(f => f.file === activeOutputFile)?.body || '';

  return (
    <Box sx={{ padding: '20px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      <Text size="xl" weight={700} mb="md">Wesley Playground (Alpha)</Text>
      <Text size="sm" color="dimmed" mb="lg">
        Edit GraphQL schemas, compile to Postgres migrations, and see the resulting database live in your browser.
      </Text>

      <Group mb="md">
        <Button onClick={handleRunWesley} loading={compileStatus === 'running'}>Run Wesley</Button>
        <Button onClick={handleApplyToDatabase} disabled={dbLoading || compileStatus !== 'success'}>Apply to Database</Button>
        <Button onClick={handleResetDatabase} disabled={dbLoading} color="red">Reset Database</Button>
        {dbLoading && <Loader size="sm" />}
      </Group>

      <Tabs value={activeTab} onTabChange={setActiveTab} grow>
        <Tabs.List>
          <Tabs.Tab value="input-schema">GraphQL Input Schema Files</Tabs.Tab>
          <Tabs.Tab value="wesley-output">Wesley Output Files</Tabs.Tab>
          <Tabs.Tab value="database-explorer" disabled={dbLoading}>Database Explorer</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="input-schema" pt="xs" sx={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
          <Box sx={{ width: '200px', borderRight: '1px solid #eee', paddingRight: '10px' }}>
            <Text size="md" weight={500} mb="sm">Files</Text>
            {inputFiles.map(file => (
              <Box
                key={file.file}
                sx={{
                  cursor: 'pointer',
                  padding: '5px',
                  backgroundColor: activeInputFile === file.file ? '#f0f0f0' : 'transparent',
                  fontWeight: activeInputFile === file.file ? 600 : 400,
                  '&:hover': { backgroundColor: '#f9f9f9' }
                }}
                onClick={() => setActiveInputFile(file.file)}
              >
                {file.file}
              </Box>
            ))}
          </Box>
          <ScrollArea sx={{ flex: 1, marginLeft: '10px' }}>
            <Code block style={{ minHeight: 'calc(100% - 20px)' }}>
              <textarea
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '300px', // Ensure min height for editor
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  resize: 'vertical',
                  padding: '10px',
                  boxSizing: 'border-box'
                }}
                value={activeInputFileContent}
                onChange={(e) => handleInputFileChange(activeInputFile, e.target.value)}
              />
            </Code>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="wesley-output" pt="xs" sx={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
          <Box sx={{ width: '200px', borderRight: '1px solid #eee', paddingRight: '10px' }}>
            <Text size="md" weight={500} mb="sm">Output Files</Text>
            {outputFiles.map(file => (
              <Box
                key={file.file}
                sx={{
                  cursor: 'pointer',
                  padding: '5px',
                  backgroundColor: activeOutputFile === file.file ? '#f0f0f0' : 'transparent',
                  fontWeight: activeOutputFile === file.file ? 600 : 400,
                  '&:hover': { backgroundColor: '#f9f9f9' }
                }}
                onClick={() => setActiveOutputFile(file.file)}
              >
                {file.file}
              </Box>
            ))}
          </Box>
          <ScrollArea sx={{ flex: 1, marginLeft: '10px' }}>
            <Code block style={{ minHeight: 'calc(100% - 20px)' }}>
              <textarea
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '300px', // Ensure min height for editor
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  resize: 'vertical',
                  padding: '10px',
                  boxSizing: 'border-box'
                }}
                value={activeOutputFileContent}
                readOnly // Output files are read-only
              />
            </Code>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="database-explorer" pt="xs" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Group mb="md">
            <Textarea
              placeholder="Enter SQL query"
              value={dbQueryText}
              onChange={(event) => setDbQueryText(event.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={4}
              sx={{ flex: 1 }}
            />
            <Button onClick={handleRunDbQuery} disabled={dbLoading}>Run Query</Button>
          </Group>

          <ScrollArea sx={{ flex: 1 }}>
            {dbQueryError && (
              <Text color="red" mb="md">{dbQueryError}</Text>
            )}

            {dbQueryResult && dbQueryResult.rows && dbQueryResult.rows.length > 0 && (
              <Code block>
                {/* Simple table display for now */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {dbQueryResult.fields.map(field => (
                        <th key={field} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>{field}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbQueryResult.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {dbQueryResult.fields.map(field => (
                          <td key={field} style={{ border: '1px solid #ccc', padding: '8px' }}>{String(row[field])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Code>
            )}
            {dbQueryResult && dbQueryResult.rows && dbQueryResult.rows.length === 0 && (
              <Text color="dimmed">No results found.</Text>
            )}
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>

      {compileStatus === 'error' && (
        <Text color="red" mt="md">Wesley compilation failed. Check console for details.</Text>
      )}
    </Box>
  );
}
