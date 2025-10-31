import { Button, Container, Group, Image, List, Text, ThemeIcon, Title } from '@mantine/core'
import heroImg from '../assets/react.svg'
import classes from './HeroBullets.module.css'

export default function HeroBullets({ onNavigate }) {
  return (
    <Container size="md" id="what">
      <div className={classes.inner}>
        <div className={classes.content}>
          <Title className={classes.title}>
            Wesley — <span className={classes.highlight}>Just add schema</span>
          </Title>
          <Text c="dimmed" mt="md">
            Build your entire data layer from one source of truth. Declare a GraphQL schema, and
            generate SQL, TypeScript, validation, and docs.
          </Text>

          <List
            mt={30}
            spacing="sm"
            size="sm"
            icon={<ThemeIcon size={20} radius="xl">✓</ThemeIcon>}
          >
            <List.Item>
              <b>Write once</b> – generate everywhere (DB, API, types, docs)
            </List.Item>
            <List.Item>
              <b>Schema first</b> – migrations are just diffs
            </List.Item>
            <List.Item>
              <b>Understandable</b> – review GraphQL, grasp the system
            </List.Item>
          </List>

          <Group mt={30}>
            <Button radius="xl" size="md" className={classes.control} component="a" href="#getting-started">
              Get started
            </Button>
            <Button
              variant="default"
              radius="xl"
              size="md"
              className={classes.control}
              component="a"
              href="/docs"
              onClick={(e) => { e.preventDefault(); onNavigate?.('/docs') }}
            >
              Docs
            </Button>
          </Group>
        </div>

        <Image src={heroImg} className={classes.image} alt="Illustration" />
      </div>
    </Container>
  )
}
