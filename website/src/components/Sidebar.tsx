import type { ComponentType } from 'react';
import { Code, Group, ScrollArea, Text } from '@mantine/core';
import {
  IconBookmarks,
  IconBrandGithub,
  IconFileText,
  IconHome2,
  IconRocket,
  IconRoute,
  IconTerminal2,
} from '@tabler/icons-react';
import { MantineLogo } from '@mantinex/mantine-logo';
import classes from './Sidebar.module.css';

interface NavItem {
  slug: string;
  label: string;
}

interface SidebarProps {
  items: NavItem[];
  currentSlug?: string;
}

export default function Sidebar({ items, currentSlug }: SidebarProps) {
  const iconMap: Record<string, ComponentType<{ className?: string; size?: number; stroke?: number }>> = {
    index: IconHome2,
    'quick-start': IconRocket,
    roadmap: IconRoute,
    reference: IconBookmarks,
    scripts: IconTerminal2,
    default: IconFileText,
  };

  return (
    <nav className={classes.navbar}>
      <div className={classes.navbarMain}>
        <Group className={classes.header} justify="space-between" gap="sm" wrap="nowrap">
          <MantineLogo size={24} />
          <div className={classes.headerText}>
            <Text size="xs" c="dimmed" fw={600}>
              Wesley
            </Text>
            <Code fw={700} size="xs">
              docs
            </Code>
          </div>
        </Group>
        <ScrollArea type="hover" className={classes.navScroll} scrollbarSize={6}>
          <div className={classes.navLinks}>
            {items.length ? (
              items.map((item) => {
                const Icon = iconMap[item.slug] ?? iconMap.default;
                const href = item.slug === 'index' ? '/' : `/docs/${item.slug}`;
                const active = item.slug === currentSlug;
                return (
                  <a
                    key={item.slug}
                    className={classes.link}
                    data-active={active || undefined}
                    href={href}
                  >
                    <Icon className={classes.linkIcon} size={20} stroke={1.5} />
                    <span>{item.label}</span>
                  </a>
                );
              })
            ) : (
              <Text size="sm" c="dimmed">
                Documentation pages will appear here.
              </Text>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className={classes.footer}>
        <Text size="xs" c="dimmed" className={classes.footerLabel}>
          Resources
        </Text>
        <a
          href="https://github.com/flyingrobots/wesley"
          target="_blank"
          rel="noopener noreferrer"
          className={classes.link}
        >
          <IconBrandGithub className={classes.linkIcon} size={20} stroke={1.5} />
          <span>GitHub</span>
        </a>
        <a href="/docs/roadmap" className={classes.link}>
          <IconRoute className={classes.linkIcon} size={20} stroke={1.5} />
          <span>Roadmap</span>
        </a>
      </div>
    </nav>
  );
}
