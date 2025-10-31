import { Card, Code, Container, Stack, Text, Title } from '@mantine/core'

const snippet = `# Install Wesley
pnpm add -g @wesley/cli

# Create your schema
cat > schema.graphql << 'EOF'
type User @table {
  id: ID! @primaryKey @default(expr: "gen_random_uuid()")
  email: String! @unique @index
  posts: [Post!]! @hasMany
}

type Post @table {
  id: ID! @primaryKey @default(expr: "gen_random_uuid()")
  user_id: ID! @foreignKey(ref: "User.id")
  title: String!
  published: Boolean! @default(expr: "false")
}
EOF

# Generate everything
wesley generate --schema schema.graphql

# Watch for changes
wesley watch --schema schema.graphql`

export default function GettingStarted() {
  return (
    <Container size="lg" py="xl" id="getting-started">
      <Title order={2} mb="sm">Getting Started</Title>
      <Text c="dimmed" mb="md">
        Install the CLI, declare a schema, and generate your entire data layer.
      </Text>
      <Card withBorder padding="md" radius="md">
        <Code block>{snippet}</Code>
      </Card>
    </Container>
  )
}

