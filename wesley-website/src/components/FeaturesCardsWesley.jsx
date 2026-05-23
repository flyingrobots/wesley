import { Badge, Card, Container, Group, SimpleGrid, Text, Title } from '@mantine/core';
import classes from './FeaturesCardsWesley.module.css';

const tech = [
  {
    title: 'Directive‑Driven Design',
    description:
      'GraphQL directives encode database semantics (indexes, FKs, defaults). The compiler turns intent into concrete DDL.',
    icon: '📑'
  },
  {
    title: 'Event‑Sourced Generation',
    description:
      'Every transformation emits events you can observe, extend, or replay for custom outputs.',
    icon: '📡'
  },
  {
    title: 'Hexagonal Architecture',
    description:
      'A dependency‑free core with adapters for platforms and outputs keeps it portable and testable.',
    icon: '⬡'
  },
  {
    title: 'Command Pattern',
    description:
      'All operations are replayable commands — perfect for time‑travel, audits, and determinism.',
    icon: '⌁'
  },
  {
    title: 'Platform Abstraction',
    description: 'Run anywhere: Node, Deno, Browser, Edge. Outputs are decoupled from execution.',
    icon: '🧭'
  }
];

export default function FeaturesCardsWesley() {
  const features = tech.map((feature) => (
    <Card key={feature.title} shadow="md" radius="md" className={classes.card} padding="xl">
      <div style={{ fontSize: 40 }} aria-hidden>
        {feature.icon}
      </div>
      <Text fz="lg" fw={600} className={classes.cardTitle} mt="md">
        {feature.title}
      </Text>
      <Text fz="sm" c="dimmed" mt="sm">
        {feature.description}
      </Text>
    </Card>
  ));

  return (
    <Container size="lg" py="xl" id="how">
      <Group justify="center">
        <Badge variant="filled" size="lg">
          HOW IT WORKS
        </Badge>
      </Group>

      <Title order={2} className={classes.title} ta="center" mt="sm">
        Under the hood — the Wesley engine
      </Title>

      <Text c="dimmed" className={classes.description} ta="center" mt="md">
        Not just a generator — a rethinking of the data layer. Encode intent with directives, then
        project that intent into concrete systems.
      </Text>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl" mt={50}>
        {features}
      </SimpleGrid>
    </Container>
  );
}
