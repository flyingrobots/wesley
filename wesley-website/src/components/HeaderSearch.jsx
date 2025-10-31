import { Autocomplete, Burger, Button, Group, ThemeIcon } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import classes from './HeaderSearch.module.css'

const links = [
  { link: '#what', label: 'What' },
  { link: '#why', label: 'Why' },
  { link: '#how', label: 'How' },
  { link: '/docs', label: 'Docs' },
]

export default function HeaderSearch({ onNavigate }) {
  const [opened, { toggle }] = useDisclosure(false)

  const items = links.map((link) => (
    <a
      key={link.label}
      href={link.link}
      className={classes.link}
      onClick={(event) => {
        if (link.link.startsWith('/')) {
          event.preventDefault()
          onNavigate?.(link.link)
        }
        // hash links fall through to default behavior
      }}
    >
      {link.label}
    </a>
  ))

  return (
    <header className={classes.header}>
      <div className={classes.inner}>
        <Group>
          <Burger opened={opened} onClick={toggle} size="sm" hiddenFrom="sm" />
          <a href="/" onClick={(e) => { e.preventDefault(); onNavigate?.('/') }} className={classes.link}>
            Wesley
          </a>
        </Group>

        <Group>
          <Group ml={50} gap={5} className={classes.links} visibleFrom="sm">
            {items}
          </Group>
          <Autocomplete
            className={classes.search}
            placeholder="Search"
            leftSection={<ThemeIcon size={18} radius="xl">🔎</ThemeIcon>}
            data={[
              'GraphQL schema',
              'Migrations',
              'Type generation',
              'Zod schemas',
              'OpenAPI',
              'Hexagonal architecture',
            ]}
            visibleFrom="xs"
          />
          <Button
            component="a"
            href="https://github.com/flyingrobots/wesley"
            target="_blank"
            rel="noreferrer"
            radius="xl"
            className={classes.githubButton}
          >
            GitHub
          </Button>
        </Group>
      </div>
    </header>
  )
}
