import { Grid, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import classes from './FeaturesTitleWesley.module.css'

const items = [
  {
    icon: '🚨',
    title: 'The Problem',
    description:
      'Every developer writes the same data shape 5+ times: SQL DDL, GraphQL, TypeScript, Zod, JSON Schema. It’s error‑prone and wasteful.',
  },
  {
    icon: '✅',
    title: 'The Solution',
    description:
      'GraphQL is the single source of truth. Everything else is generated — types, migrations, APIs, and docs.',
  },
  {
    icon: '📐',
    title: 'The Philosophy',
    description:
      'Schema first. Migrations are diffs, not a task. Evolve your schema and get migrations for free.',
  },
  {
    icon: '🎯',
    title: 'Why This Matters',
    description:
      'Write once, generate everywhere. Teams review the schema (the contract) and ship with fewer sync bugs.',
  },
]

export default function FeaturesTitleWesley() {
  const features = items.map((feature) => (
    <div key={feature.title}>
      <ThemeIcon size={44} radius="md" variant="gradient" gradient={{ deg: 133, from: 'blue', to: 'cyan' }}>
        <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>{feature.icon}</span>
      </ThemeIcon>
      <Text fz="lg" mt="sm" fw={600}>
        {feature.title}
      </Text>
      <Text c="dimmed" fz="sm">
        {feature.description}
      </Text>
    </div>
  ))

  return (
    <div className={classes.wrapper} id="why">
      <Grid gutter={80}>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Title className={classes.title} order={2}>
            Why Wesley?
          </Title>
          <Text c="dimmed">
            Stop duplicating your data layer. Use GraphQL as the canonical schema and let Wesley
            generate the rest. Faster iteration, fewer bugs, happier teams.
          </Text>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={30}>
            {features}
          </SimpleGrid>
        </Grid.Col>
      </Grid>
    </div>
  )
}
