import { Box, Container, Stack, Text, Title } from '@mantine/core'
import NavbarSimpleColored from '../components/NavbarSimpleColored.jsx'
import ThemeLab from './ThemeLab.jsx'

export default function Documentation() {
  return (
    <Box style={{ height: '100%', display: 'grid', gridTemplateColumns: '300px 1fr' }}>
      <NavbarSimpleColored />
      <Box style={{ minWidth: 0, overflow: 'auto' }}>
        <Container size="lg" py="xl">
          <Stack gap="xs">
            <Title order={1}>Documentation</Title>
            <Text c="dimmed">Skeleton docs layout with a left sidebar. Replace this with real docs content.</Text>
          </Stack>
        </Container>
        <ThemeLab />
      </Box>
    </Box>
  )
}

