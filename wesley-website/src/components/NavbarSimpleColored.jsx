import { useState } from 'react'
import { Code, Group, Text } from '@mantine/core'
import classes from './NavbarSimpleColored.module.css'

const data = [
  { link: '#', label: 'Notifications', icon: '🔔' },
  { link: '#', label: 'Billing', icon: '💳' },
  { link: '#', label: 'Security', icon: '🔐' },
  { link: '#', label: 'SSH Keys', icon: '🗝️' },
  { link: '#', label: 'Databases', icon: '🗄️' },
  { link: '#', label: 'Authentication', icon: '🛡️' },
  { link: '#', label: 'Other Settings', icon: '⚙️' },
]

export default function NavbarSimpleColored() {
  const [active, setActive] = useState('Billing')

  const links = data.map((item) => (
    <a
      className={classes.link}
      data-active={item.label === active || undefined}
      href={item.link}
      key={item.label}
      onClick={(event) => {
        event.preventDefault()
        setActive(item.label)
      }}
    >
      <span className={classes.linkIcon} aria-hidden>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </a>
  ))

  return (
    <nav className={classes.navbar} aria-label="Primary">
      <div className={classes.navbarMain}>
        <Group className={classes.header} justify="space-between">
          <img src="/wesley-logo.jpg" alt="Wesley logo" style={{ display: 'block', width: 140, height: 'auto' }} />
          <Code fw={700} className={classes.version}>v0.1.0</Code>
        </Group>
        {links}
      </div>

      <div className={classes.footer}>
        <a href="#" className={classes.link} onClick={(event) => event.preventDefault()}>
          <span className={classes.linkIcon} aria-hidden>⇄</span>
          <span>Change account</span>
        </a>

        <a href="#" className={classes.link} onClick={(event) => event.preventDefault()}>
          <span className={classes.linkIcon} aria-hidden>⎋</span>
          <span>Logout</span>
        </a>
      </div>
    </nav>
  )
}
