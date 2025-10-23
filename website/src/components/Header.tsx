import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Burger,
  Group,
  ThemeIcon,
  Text,
} from '@mantine/core';
import { IconBrandGithub, IconBook2, IconSchema } from '@tabler/icons-react';

interface HeaderProps {
  navOpened?: boolean;
  onToggleNav?: () => void;
}

export default function Header({ navOpened = false, onToggleNav }: HeaderProps = {}) {
  return (
    <Box px="lg" py="xs" style={{ height: '100%' }}>
      <Group justify="space-between" align="center" h="100%">
        <Group gap="sm" align="center">
          <Burger
            opened={navOpened}
            onClick={onToggleNav}
            hiddenFrom="lg"
            size="sm"
            aria-label="Toggle navigation"
          />
          <Group gap="xs" align="center" wrap="nowrap">
            <ThemeIcon
              size={34}
              radius="lg"
              gradient={{ from: 'blue.5', to: 'cyan.4', deg: 135 }}
              variant="gradient"
            >
              <IconSchema size={18} stroke={1.6} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Wesley Docs</Text>
              <Text size="xs" c="dimmed">
                Schema-first data layer for Postgres
              </Text>
            </div>
          </Group>
          <Badge size="sm" variant="light" color="blue">
            Pre-alpha
          </Badge>
        </Group>

        <Group gap="xs" align="center">
          <Button
            component="a"
            href="/docs/quick-start"
            variant="light"
            size="sm"
            leftSection={<IconBook2 size={16} />}
          >
            Quick start
          </Button>
          <ActionIcon
            component="a"
            href="https://github.com/flyingrobots/wesley"
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            size="lg"
            aria-label="Open GitHub repository"
          >
            <IconBrandGithub size={18} />
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  );
}
