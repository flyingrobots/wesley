import React, { useState } from 'react';
import { Box, Button, Group, Textarea, Text, NavLink, ScrollArea, Table, Flex, Tabs, Badge } from '@mantine/core';
import classes from './Playground.module.css';

export default function DatabasePanel({ 
  tables, 
  selectedTable,
  tableSchema,
  onSelectTable,
  query, 
  setQuery, 
  onRun, 
  loading, 
  result, 
  error 
}) {
  const [activeTab, setActiveTab] = useState('data');

  // --- Render Helpers ---

  const renderDataTab = () => {
    const ths = (
      <Table.Tr>
        {result && result.fields.map(field => (
          <Table.Th key={field}>{field}</Table.Th>
        ))}
      </Table.Tr>
    );

    const rows = result && result.rows.map((row, rowIndex) => (
      <Table.Tr key={rowIndex}>
        {result.fields.map(field => (
          <Table.Td key={field}>{String(row[field])}</Table.Td>
        ))}
      </Table.Tr>
    ));

    return (
      <Box flex={1} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box p="sm" bd="1px solid gray.3" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }} bg="gray.0">
          <Group align="flex-start">
            <Textarea
              placeholder="Enter SQL query"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={4}
              flex={1}
              styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
            />
            <Button onClick={onRun} disabled={loading}>Run</Button>
          </Group>
        </Box>

        <ScrollArea flex={1} p="md">
          {result && result.rows && result.rows.length > 0 ? (
            <Table striped highlightOnHover withColumnBorders withTableBorder className={classes.mantineTable}>
              <Table.Thead>{ths}</Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          ) : result ? (
            <Text c="dimmed" size="sm">No results found.</Text>
          ) : (
            <Text c="dimmed" size="sm">Run a query to see results.</Text>
          )}
        </ScrollArea>
      </Box>
    );
  };

  const renderStructureTab = () => {
    if (!tableSchema || tableSchema.length === 0) return <Text p="md" c="dimmed">No schema information available.</Text>;

    return (
      <ScrollArea flex={1} p="md">
        <Table striped highlightOnHover withColumnBorders withTableBorder className={classes.mantineTable}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Column</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Nullable</Table.Th>
              <Table.Th>Default</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tableSchema.map((col) => (
              <Table.Tr key={col.column_name}>
                <Table.Td fw={500}>{col.column_name}</Table.Td>
                <Table.Td><Badge variant="light" color="blue" size="sm">{col.data_type}</Badge></Table.Td>
                <Table.Td>{col.is_nullable === 'YES' ? 'Yes' : 'No'}</Table.Td>
                <Table.Td><Code>{col.column_default || '-'}</Code></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    );
  };

  // --- Main Render ---

  return (
    <Flex h="100%">
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
              active={selectedTable === table}
              onClick={() => onSelectTable(table)}
              variant="subtle"
              className={classes.fileItem}
            />
          ))}
        </ScrollArea>
      </Box>

      {/* Main Content */}
      <Box flex={1} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedTable ? (
          <Tabs value={activeTab} onChange={setActiveTab} variant="default" h="100%" display="flex" style={{ flexDirection: 'column' }}>
            <Box p="xs" px="md" bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                <Group justify="space-between">
                    <Text fw={700} size="lg">{selectedTable}</Text>
                    <Tabs.List>
                        <Tabs.Tab value="data">Data</Tabs.Tab>
                        <Tabs.Tab value="structure">Structure</Tabs.Tab>
                    </Tabs.List>
                </Group>
            </Box>

            <Tabs.Panel value="data" flex={1} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {renderDataTab()}
            </Tabs.Panel>

            <Tabs.Panel value="structure" flex={1} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {renderStructureTab()}
            </Tabs.Panel>
          </Tabs>
        ) : (
            // No table selected state (or just generic query runner)
            renderDataTab()
        )}
      </Box>
    </Flex>
  );
}

// Helper component just for this file if needed
function Code({ children }) {
    return <Box component="span" style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '0.9em' }}>{children}</Box>
}