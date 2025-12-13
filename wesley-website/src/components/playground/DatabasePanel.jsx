import React from 'react';
import { Box, Button, Group, Textarea, Text, NavLink, ScrollArea, Table, Flex } from '@mantine/core';
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
  const ths = (
    <tr>
      {result && result.fields.map(field => (
        <Table.Th key={field}>{field}</Table.Th>
      ))}
    </tr>
  );

  const rows = result && result.rows.map((row, rowIndex) => (
    <Table.Tr key={rowIndex}>
      {result.fields.map(field => (
        <Table.Td key={field}>{String(row[field])}</Table.Td>
      ))}
    </Table.Tr>
  ));

  return (
    <Flex className={classes.panel}>
      {/* Sidebar: Tables */}
      <Box className={classes.sidebar}>
        <Text className={classes.sidebarHeader}>Tables</Text>
        <ScrollArea className={classes.fileList}>
          {tables.length === 0 && (
            <Text size="xs" c="dimmed" p="xs">No tables found</Text>
          )}
          {tables.map(table => (
            <NavLink
              key={table}
              label={table}
              onClick={() => setQuery(`SELECT * FROM "${table}" LIMIT 100;`)}
              variant="subtle"
              className={classes.fileItem}
            />
          ))}
        </ScrollArea>
      </Box>

      {/* Main: Query & Results */}
      <Box className={classes.editorContainer}>
        <Box className={classes.queryControls}>
          <Group align="flex-start">
            <Textarea
              placeholder="Enter SQL query"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={4}
              flex={1}
            />
            <Button onClick={onRun} disabled={loading}>Run</Button>
          </Group>
        </Box>

        <ScrollArea className={classes.resultsArea}>
          {result && result.rows && result.rows.length > 0 ? (
            <Table striped highlightOnHover withColumnBorders withTableBorder className={classes.mantineTable}>
              <Table.Thead>{ths}</Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          ) : result ? (
            <Text c="dimmed" size="sm">No results found.</Text>
          ) : null}
        </ScrollArea>
      </Box>
    </Flex>
  );
}
