import React from 'react';
import { Box, Button, Group, Textarea, Text, NavLink, ScrollArea, Table, Flex } from '@mantine/core';

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
    <Flex h="100%">
      {/* Sidebar: Tables */}
      <Box w={220} bg="gray.0" bd="1px solid gray.3" style={{ borderRight: '1px solid var(--mantine-color-gray-3)', display: 'flex', flexDirection: 'column' }}>
        <Text p="xs" size="sm" fw={600} bd="1px solid gray.3" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          Tables
        </Text>
        <ScrollArea flex={1} p={5}>
          {tables.length === 0 && (
            <Text size="xs" c="dimmed" p="xs">No tables found</Text>
          )}
          {tables.map(table => (
            <NavLink
              key={table}
              label={table}
              onClick={() => setQuery(`SELECT * FROM "${table}" LIMIT 100;`)}
              variant="subtle"
              style={{ borderRadius: 4, fontSize: 14 }}
            />
          ))}
        </ScrollArea>
      </Box>

      {/* Main: Query & Results */}
      <Box flex={1} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box p="sm" bd="1px solid gray.3" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
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

        <ScrollArea flex={1} p="md">
          {result && result.rows && result.rows.length > 0 ? (
            <Table striped highlightOnHover withColumnBorders withTableBorder>
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