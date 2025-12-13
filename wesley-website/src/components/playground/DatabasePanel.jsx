import React from 'react';
import { Box, Button, Group, Textarea, Text, NavLink } from '@mantine/core';
import classes from './Playground.module.css';

export default function DatabasePanel({ 
  tables, 
  query, 
  setQuery, 
  onRun, 
  loading, 
  result, 
  error 
}) {
  return (
    <div className={classes.panel}>
      {/* Sidebar: Tables */}
      <div className={classes.sidebar}>
        <div className={classes.sidebarHeader}>Tables</div>
        <div className={classes.fileList}>
          {tables.length === 0 && (
            <Text size="xs" c="dimmed" p="xs">No tables found</Text>
          )}
          {tables.map(table => (
            <NavLink
              key={table}
              label={table}
              onClick={() => setQuery(`SELECT * FROM "${table}" LIMIT 100;`)}
              variant="subtle"
            />
          ))}
        </div>
      </div>

      {/* Main: Query & Results */}
      <div className={classes.editorContainer}>
        <div className={classes.queryControls}>
          <Group align="flex-start">
            <Textarea
              placeholder="Enter SQL query"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={4}
              style={{ flex: 1 }}
            />
            <Button onClick={onRun} disabled={loading}>Run</Button>
          </Group>
        </div>

        <div className={classes.resultsArea}>
          {/* Errors handled by parent via Alert, but can show inline too if desired */}
          
          {result && result.rows && result.rows.length > 0 ? (
            <table className={classes.tableWrapper}>
              <thead>
                <tr>
                  {result.fields.map(field => (
                    <th key={field}>{field}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {result.fields.map(field => (
                      <td key={field}>{String(row[field])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : result ? (
            <Text c="dimmed" size="sm">No results found.</Text>
          ) : null}
        </div>
      </div>
    </div>
  );
}
