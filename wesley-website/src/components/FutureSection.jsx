import { Container, List, Text, ThemeIcon, Title } from '@mantine/core'

const future = [
  'Visual Schema Editor: design your schema visually',
  'Time‑Travel Debugging: replay schema evolution',
  'Multi‑Database Support: PostgreSQL, MySQL, SQLite, more',
  'Framework Integration: Next.js, Remix, SvelteKit plugins',
  'AI‑Powered Suggestions: let AI optimize your schema',
]

export default function FutureSection() {
  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="sm">The Future</Title>
      <Text c="dimmed" mb="md">
        Wesley is just the beginning. Imagine what happens when schema is truly the product.
      </Text>
      <List spacing="sm" icon={<ThemeIcon size={24} radius="xl">★</ThemeIcon>}>
        {future.map((line) => (
          <List.Item key={line}>{line}</List.Item>
        ))}
      </List>
      <Text mt="lg" fw={600}>Join the revolution. Make it so, schema.</Text>
    </Container>
  )
}
