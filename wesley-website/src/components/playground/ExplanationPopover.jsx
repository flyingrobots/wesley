import { Popover, Text, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

export default function ExplanationPopover({ children, title, description, width = 260 }) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Popover 
      opened={opened} 
      width={width} 
      position="bottom" 
      withArrow 
      shadow="md"
      zIndex={100} // Ensure it's above other things
    >
      <Popover.Target>
        <Box 
          onMouseEnter={open} 
          onMouseLeave={close}
          style={{ display: 'inline-block' }} // Ensure box wraps button properly
        >
          {children}
        </Box>
      </Popover.Target>
      <Popover.Dropdown style={{ pointerEvents: 'none' }}> {/* Prevent interaction with tooltip itself */}
        <Text size="sm" fw={700} mb={5}>
          {title}
        </Text>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </Popover.Dropdown>
    </Popover>
  );
}
