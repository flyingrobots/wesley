// wesley-website/src/pages/TryNow.jsx
import React, { useState, useEffect } from 'react';
import { Box, Tabs, Text, Code, Button, Group, Loader, ScrollArea, Alert, Textarea } from '@mantine/core';
import { createDbSession } from '../db/pglite';

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
  const [compileErrors, setCompileErrors] = useState([]);
  const [dbTables, setDbTables] = useState([]);

  // Helper to fetch tables
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

  // Initialize DbSession
  useEffect(() => {
    async function initDb() {
      try {
        const session = await createDbSession();
        setDbSession(session);
        await fetchTables(session);
      } catch (error) {
        console.error('Failed to initialize DbSession:', error);
        setCompileErrors([{ message: `Failed to initialize database: ${error.message}` }]);
        setCompileStatus('error');
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
// ... (rest of component)
      if (migrationsSql) {
        // Split migrations by semicolon, filter out empty strings, and trim
        const statements = migrationsSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        await dbSession.applyMigrations(statements);
      }
      setDbQueryResult({ rows: [{ status: 'Migrations applied successfully!' }], fields: ['status'] });
      await fetchTables(dbSession); // Refresh tables
      setActiveTab('database-explorer');
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
      // Refresh tables if the query might have changed schema (simple heuristic or just always)
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
      await fetchTables(dbSession); // Refresh tables (should be empty)
    } catch (error) {
      console.error('Failed to reset database:', error);
      setDbQueryError(error.message);
    } finally {
      setDbLoading(false);
    }
  };

  const handleResetPlayground = async () => {
    if (!confirm('Are you sure you want to reset everything? This will clear your schema and database.')) return;
    
    setCompileStatus('idle');
    setCompileErrors([]);
    setInputFiles(initialInputFiles);
    setOutputFiles(initialOutputFiles);
    setDbQueryText('SELECT * FROM pg_catalog.pg_tables WHERE schemaname = \'public\';'); // Safe default
    setDbQueryResult(null);
    setDbQueryError(null);
    setActiveTab('input-schema');
    
    if (dbSession) {
        setDbLoading(true);
        try {
            await dbSession.reset();
            await fetchTables(dbSession);
        } catch (e) {
            console.error('Error resetting DB during playground reset:', e);
        } finally {
            setDbLoading(false);
        }
    }
  };
// ... (render)
        <Tabs.Panel value="database-explorer" pt="xs" sx={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
          {/* Tables Sidebar */}
          <Box sx={{ width: '200px', borderRight: '1px solid #eee', paddingRight: '10px', display: 'flex', flexDirection: 'column' }}>
            <Text size="md" weight={500} mb="sm">Tables</Text>
            {dbTables.length === 0 && <Text size="xs" color="dimmed">No tables found</Text>}
            <ScrollArea sx={{ flex: 1 }}>
                {dbTables.map(tableName => (
                <Box
                    key={tableName}
                    sx={{
                    cursor: 'pointer',
                    padding: '5px',
                    '&:hover': { backgroundColor: '#f9f9f9' }
                    }}
                    onClick={() => {
                        setDbQueryText(`SELECT * FROM "${tableName}" LIMIT 100;`);
                        // Optional: auto-run? Maybe better to let user click run.
                    }}
                >
                    {tableName}
                </Box>
                ))}
            </ScrollArea>
          </Box>

          {/* Query Area */}
          <Box sx={{ flex: 1, marginLeft: '10px', display: 'flex', flexDirection: 'column' }}>
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
                {/* ... existing results display ... */}
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
    </Box>
  );
}
