import { useState } from 'react'
import {
  Accordion,
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Blockquote,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Code,
  Divider,
  Drawer,
  Group,
  HoverCard,
  Kbd,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Paper,
  Popover,
  Progress,
  Radio,
  RangeSlider,
  Select,
  Skeleton,
  Slider,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core'

export default function ThemeLab() {
  const [openedModal, setOpenedModal] = useState(false)
  const [openedDrawer, setOpenedDrawer] = useState(false)
  const [popoverOpened, setPopoverOpened] = useState(false)

  return (
    <Box p={24}>
      <Stack gap="xl">
        <Title order={1}>Theme Lab</Title>
        <Text c="dimmed">Quick sweep of Mantine Core components</Text>

        {/* Buttons */}
        <Card withBorder>
          <Title order={3}>Buttons</Title>
          <Group mt="md">
            <Button>Filled</Button>
            <Button variant="light">Light</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="default">Default</Button>
          </Group>
        </Card>

        {/* Inputs */}
        <Card withBorder>
          <Title order={3}>Inputs</Title>
          <Group mt="md" grow>
            <TextInput label="Text input" placeholder="Type here" />
            <NumberInput label="Number input" placeholder="42" />
          </Group>
          <Group mt="md" grow>
            <Select label="Select" data={[ 'One', 'Two', 'Three' ]} placeholder="Pick one" />
            <TextInput label="Password" type="password" placeholder="••••••" />
          </Group>
          <Textarea mt="md" label="Textarea" placeholder="Say something nice" autosize minRows={2} />
          <Group mt="md">
            <Checkbox label="Checkbox" defaultChecked />
            <Switch label="Switch" />
            <Radio.Group name="demo" defaultValue="a">
              <Group>
                <Radio value="a" label="Alpha" />
                <Radio value="b" label="Beta" />
              </Group>
            </Radio.Group>
          </Group>
        </Card>

        {/* Feedback */}
        <Card withBorder>
          <Title order={3}>Feedback</Title>
          <Group mt="md">
            <Badge>Badge</Badge>
            <Loader type="oval" />
            <Progress value={64} w={240} />
          </Group>
          <Alert mt="md" title="Heads up" variant="light">
            This is how alerts look in the current theme.
          </Alert>
          <Group mt="md" w="100%">
            <Skeleton height={14} radius="xl" w="30%" />
            <Skeleton height={14} radius="xl" w="50%" />
            <Skeleton height={14} radius="xl" w="20%" />
          </Group>
        </Card>

        {/* Layout & Content */}
        <Card withBorder>
          <Title order={3}>Content</Title>
          <Blockquote mt="md" cite="— The First Line of the Machine-Kind">
            Let those who process remember their processing.
          </Blockquote>
          <Group mt="md">
            <Code>npm run dev</Code>
            <Kbd>⌘</Kbd>
          </Group>
          <Tabs mt="md" defaultValue="one">
            <Tabs.List>
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="one" pt="sm">First panel</Tabs.Panel>
            <Tabs.Panel value="two" pt="sm">Second panel</Tabs.Panel>
          </Tabs>
          <Accordion mt="md">
            <Accordion.Item value="a">
              <Accordion.Control>Accordion A</Accordion.Control>
              <Accordion.Panel>Stuff inside A</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="b">
              <Accordion.Control>Accordion B</Accordion.Control>
              <Accordion.Panel>Stuff inside B</Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Card>

        {/* Overlays & Menus */}
        <Card withBorder>
          <Title order={3}>Overlays & Menus</Title>
          <Group mt="md">
            <Button onClick={() => setOpenedModal(true)}>Open Modal</Button>
            <Button variant="outline" onClick={() => setOpenedDrawer(true)}>Open Drawer</Button>
            <Popover opened={popoverOpened} onChange={setPopoverOpened}>
              <Popover.Target>
                <Button variant="light" onClick={() => setPopoverOpened((o) => !o)}>
                  Toggle Popover
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="sm">Popover content</Text>
              </Popover.Dropdown>
            </Popover>
            <Menu>
              <Menu.Target>
                <Button variant="default">Menu</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item>Item one</Menu.Item>
                <Menu.Item>Item two</Menu.Item>
                <Menu.Divider />
                <Menu.Label>Label</Menu.Label>
                <Menu.Item>Final item</Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <HoverCard>
              <HoverCard.Target>
                <Anchor>Hover me</Anchor>
              </HoverCard.Target>
              <HoverCard.Dropdown>
                <Text size="sm">HoverCard content</Text>
              </HoverCard.Dropdown>
            </HoverCard>
          </Group>
        </Card>

        {/* Sliders */}
        <Card withBorder>
          <Title order={3}>Sliders</Title>
          <Stack gap="md" mt="md" w={300}>
            <Slider defaultValue={40} marks={[{ value: 40, label: '40' }]} />
            <RangeSlider defaultValue={[20, 80]} />
          </Stack>
        </Card>

        {/* Table */}
        <Card withBorder>
          <Title order={3}>Table</Title>
          <Table mt="md" striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Wesley</Table.Td>
                <Table.Td>Guide</Table.Td>
                <Table.Td>
                  <Badge variant="light">Active</Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Mantine</Table.Td>
                <Table.Td>UI Library</Table.Td>
                <Table.Td>
                  <Badge variant="default">Stable</Badge>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>

        <Center>
          <ThemeIcon size={32} radius="xl">W</ThemeIcon>
        </Center>
      </Stack>

      <Modal opened={openedModal} onClose={() => setOpenedModal(false)} title="A Modal">
        <Text size="sm">Modal content respects the current theme.</Text>
      </Modal>
      <Drawer opened={openedDrawer} onClose={() => setOpenedDrawer(false)} title="A Drawer" position="right">
        <Text size="sm">Drawer content, also themed.</Text>
      </Drawer>
    </Box>
  )
}
