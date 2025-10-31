import { Anchor, Button, Container, Group, Stack, Text, Title } from '@mantine/core'

export default function HeroWesley({ onNavigate }) {
  return (
    <Container size="lg" py="xl">
      <Stack gap="sm" align="flex-start">
        <Title order={1} style={{ lineHeight: 1 }}>Wesley Data Layer Compiler</Title>
        <Text c="dimmed" size="lg">
          WHAT: Declare your GraphQL schema once. Generate SQL, TypeScript, Zod, JSON Schema, and docs from a single source of truth.
        </Text>
        <Group mt="sm">
          <Button size="md" component={Anchor} href="#getting-started">
            Get Started
          </Button>
          <Button variant="light" size="md" onClick={() => onNavigate?.('/theme-lab')}>
            Try it out
          </Button>
        </Group>
      </Stack>
    </Container>
  )
}
