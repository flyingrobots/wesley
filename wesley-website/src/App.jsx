import { Button, Container, Stack, Title, Text } from '@mantine/core'

function App() {
  return (
    <>
      <nav style={{ position: 'fixed', top: 16, right: 16 }}>
        <Button color="wesley" variant="filled" size="md" radius="md">
          Wesley
        </Button>
      </nav>

      <Container size="sm" p="xl">
        <Stack gap="md" align="center">
          <Title order={1}>Wesley</Title>
          <Text c="dimmed">Minimal Mantine Lite™ starter</Text>
        </Stack>
      </Container>
    </>
  )
}

export default App
