import '@mantinex/mantine-logo/styles.css';

import { useMemo, type ReactNode } from 'react';
import { MantineProvider, AppShell, Container, Paper, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Header from './Header';
import Sidebar from './Sidebar';

interface NavItem {
  slug: string;
  label: string;
}

interface DocsShellProps {
  navItems: NavItem[];
  currentSlug?: string;
  children: ReactNode;
}

export default function DocsShell({ navItems, currentSlug, children }: DocsShellProps) {
  const [navbarOpened, { toggle: toggleNavbar }] = useDisclosure(false);

  const sidebarItems = useMemo(() => {
    const items = [{ slug: 'index', label: 'Overview' }, ...(navItems ?? [])];
    const unique = new Map<string, NavItem>();
    for (const item of items) {
      const label = item.slug === 'index' ? 'Overview' : item.label;
      if (!unique.has(item.slug)) {
        unique.set(item.slug, { slug: item.slug, label });
      }
    }
    return Array.from(unique.values());
  }, [navItems]);

  return (
    <MantineProvider
      withGlobalStyles
      withNormalizeCSS
      defaultColorScheme="dark"
      theme={{
        primaryColor: 'blue',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        headings: {
          fontFamily: 'Cal Sans, Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
        },
        defaultRadius: 'md',
      }}
    >
      <AppShell
        padding="lg"
        header={{ height: 72 }}
        navbar={{ width: 320, breakpoint: 'lg', collapsed: { mobile: !navbarOpened } }}
        styles={(theme) => ({
          main: {
            background:
              theme.colorScheme === 'dark'
                ? 'linear-gradient(155deg, #111826 0%, #05070f 45%, #020205 100%)'
                : theme.colors.gray[0],
          },
        })}
      >
        <AppShell.Header>
          <Header navOpened={navbarOpened} onToggleNav={toggleNavbar} />
        </AppShell.Header>
        <AppShell.Navbar p="md" style={{ background: 'transparent' }}>
          <Sidebar items={sidebarItems} currentSlug={currentSlug} />
        </AppShell.Navbar>
        <AppShell.Main>
          <ScrollArea type="hover" h="calc(100vh - 72px)" scrollbarSize={8}>
            <Container size="lg" py="xl">
              <Paper
                radius="lg"
                withBorder
                p="xl"
                shadow="xl"
                style={{
                  background: 'rgba(9, 13, 23, 0.92)',
                  borderColor: 'rgba(148, 163, 184, 0.18)',
                }}
              >
                {children}
              </Paper>
            </Container>
          </ScrollArea>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
