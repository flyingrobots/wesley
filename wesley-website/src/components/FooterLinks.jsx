import { ActionIcon, Box, Container, Group, Text, Title } from '@mantine/core'
import classes from './FooterLinks.module.css'

const data = [
  {
    title: 'About',
    links: [
      { label: 'Features', link: '#' },
      { label: 'Pricing', link: '#' },
      { label: 'Support', link: '#' },
      { label: 'Forums', link: '#' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'Contribute', link: '#' },
      { label: 'Media assets', link: '#' },
      { label: 'Changelog', link: '#' },
      { label: 'Releases', link: '#' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Join Discord', link: '#' },
      { label: 'Follow on Twitter', link: '#' },
      { label: 'Email newsletter', link: '#' },
      { label: 'GitHub discussions', link: '#' },
    ],
  },
]

export default function FooterLinks() {
  const groups = data.map((group) => {
    const links = group.links.map((link, index) => (
      <Text
        key={index}
        className={classes.link}
        component="a"
        href={link.link}
        onClick={(event) => event.preventDefault()}
      >
        {link.label}
      </Text>
    ))

    return (
      <div className={classes.wrapper} key={group.title}>
        <Text className={classes.title}>{group.title}</Text>
        {links}
      </div>
    )
  })

  return (
    <footer className={classes.footer}>
      <Container className={classes.inner}>
        <div className={classes.logo}>
          <img src="/wesley-logo.jpg" alt="Wesley logo" style={{ display: 'block', width: 160, height: 'auto' }} />
          <Text size="xs" c="dimmed" className={classes.description}>
            Build fully functional accessible web applications faster than ever
          </Text>
        </div>
        <div className={classes.groups}>{groups}</div>
      </Container>
      <Container className={classes.afterFooter}>
        <Text c="dimmed" size="sm">
          © {new Date().getFullYear()} wesley.dev. All rights reserved.
        </Text>

        <Group gap={0} className={classes.social} justify="flex-end" wrap="nowrap">
          {/* Social icons as placeholders to keep dependencies minimal */}
          <ActionIcon size="lg" color="gray" variant="subtle" aria-label="Twitter">
            <Box component="span" aria-hidden>𝕏</Box>
          </ActionIcon>
          <ActionIcon size="lg" color="gray" variant="subtle" aria-label="YouTube">
            <Box component="span" aria-hidden>▶︎</Box>
          </ActionIcon>
          <ActionIcon size="lg" color="gray" variant="subtle" aria-label="Instagram">
            <Box component="span" aria-hidden>◎</Box>
          </ActionIcon>
        </Group>
      </Container>
    </footer>
  )
}
