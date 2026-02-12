import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { FakeDbSession } from '../test/FakeDbSession'

// Fresh session per test — the vi.mock factory reads this at call-time
let mockSession
vi.mock('../db/pglite', () => ({
  createDbSession: vi.fn(() => Promise.resolve(mockSession)),
}))

// Mock compileSchemaInBrowser
const mockCompile = vi.fn()
vi.mock('@wesley/host-browser', () => ({
  compileSchemaInBrowser: (...args) => mockCompile(...args),
}))

// Mock RichEditor (Tiptap doesn't work in jsdom)
vi.mock('../components/playground/RichEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="rich-editor" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}))

// Mock CodeHighlight (lowlight doesn't work in jsdom)
vi.mock('@mantine/code-highlight', () => ({
  CodeHighlight: ({ code }) => <pre data-testid="code-highlight">{code}</pre>,
}))

// Must import after mocks
const { default: TryNow } = await import('./TryNow.jsx')

function renderTryNow() {
  return render(
    <MantineProvider defaultColorScheme="light">
      <ModalsProvider>
        <Notifications />
        <TryNow />
      </ModalsProvider>
    </MantineProvider>
  )
}

describe('TryNow', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    mockSession = new FakeDbSession()
    mockCompile.mockReset()
  })

  // --- A2.1c: Workspace file switching ---

  it('renders the playground title', async () => {
    renderTryNow()
    expect(await screen.findByText('Wesley Playground (Alpha)')).toBeInTheDocument()
  })

  it('shows default input files in the navbar', async () => {
    renderTryNow()
    expect(await screen.findByText('schema.graphql')).toBeInTheDocument()
    expect(screen.getByText('another.graphql')).toBeInTheDocument()
  })

  it('switches active file when clicking a different file', async () => {
    const user = userEvent.setup()
    renderTryNow()
    await screen.findByText('schema.graphql')
    await user.click(screen.getByText('another.graphql'))
    // Verify the editor content changed — the mock editor shows the file body
    const editor = screen.getByTestId('rich-editor')
    expect(editor.value).toContain('Order')
  })

  it('shows database panel when selecting database view', async () => {
    const user = userEvent.setup()
    renderTryNow()
    await screen.findByText('Wesley Playground (Alpha)')
    await user.click(screen.getByText('Database Explorer'))
    expect(screen.getByLabelText('SQL query input')).toBeInTheDocument()
  })

  // --- B1.3b: Compile success/failure UI ---

  it('calls compileSchemaInBrowser on Run Wesley click', async () => {
    const user = userEvent.setup()
    mockCompile.mockResolvedValue({
      ok: true,
      outputFiles: [{ file: 'migrations.sql', body: 'CREATE TABLE users (id uuid);' }],
      tables: 1,
      warnings: [],
      errors: [],
    })

    renderTryNow()
    await screen.findByText('Wesley Playground (Alpha)')

    await user.click(screen.getByRole('button', { name: /run wesley/i }))

    expect(mockCompile).toHaveBeenCalledTimes(1)
    expect(mockCompile).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ file: 'schema.graphql' }),
        expect.objectContaining({ file: 'another.graphql' }),
      ])
    )
  })

  it('shows compile errors in the error panel', async () => {
    const user = userEvent.setup()
    mockCompile.mockResolvedValue({
      ok: false,
      outputFiles: [],
      tables: 0,
      warnings: [],
      errors: [{ message: 'Unknown type "Foo"' }],
    })

    renderTryNow()
    await screen.findByText('Wesley Playground (Alpha)')

    await user.click(screen.getByRole('button', { name: /run wesley/i }))

    expect(await screen.findByText('Unknown type "Foo"')).toBeInTheDocument()
    expect(screen.getByText('Compilation Error')).toBeInTheDocument()
  })

  it('shows output files after successful compile', async () => {
    const user = userEvent.setup()
    mockCompile.mockResolvedValue({
      ok: true,
      outputFiles: [
        { file: 'migrations.sql', body: 'CREATE TABLE t (id int);' },
        { file: 'schema.json', body: '{}' },
      ],
      tables: 1,
      warnings: [],
      errors: [],
    })

    renderTryNow()
    await screen.findByText('Wesley Playground (Alpha)')

    await user.click(screen.getByRole('button', { name: /run wesley/i }))

    expect(await screen.findByText('migrations.sql')).toBeInTheDocument()
    expect(screen.getByText('schema.json')).toBeInTheDocument()
  })

  it('shows DB errors in the centralized error panel', async () => {
    const user = userEvent.setup()

    mockCompile.mockResolvedValue({
      ok: true,
      outputFiles: [{ file: 'migrations.sql', body: 'INVALID SQL' }],
      tables: 0,
      warnings: [],
      errors: [],
    })

    // Use vi.spyOn for safe mock restoration
    vi.spyOn(mockSession, 'applyMigrations').mockRejectedValue(new Error('syntax error at position 1'))

    renderTryNow()
    await screen.findByText('Wesley Playground (Alpha)')

    // Compile first
    await user.click(screen.getByRole('button', { name: /run wesley/i }))
    // Wait for "Apply to Database" to enable
    const applyButton = await screen.findByRole('button', { name: /apply to database/i })
    expect(applyButton).not.toBeDisabled()

    // Apply (should fail)
    await user.click(applyButton)

    // Error should appear in the centralized panel (not just a toast)
    expect(await screen.findByText('syntax error at position 1')).toBeInTheDocument()
    expect(screen.getByText('Migration Failed')).toBeInTheDocument()
  })

  it('clears compile errors on new compile attempt', async () => {
    const user = userEvent.setup()

    // First compile fails
    mockCompile.mockResolvedValueOnce({
      ok: false,
      outputFiles: [],
      tables: 0,
      warnings: [],
      errors: [{ message: 'first error' }],
    })

    renderTryNow()
    await screen.findByText('Wesley Playground (Alpha)')

    await user.click(screen.getByRole('button', { name: /run wesley/i }))
    expect(await screen.findByText('first error')).toBeInTheDocument()

    // Second compile succeeds
    mockCompile.mockResolvedValueOnce({
      ok: true,
      outputFiles: [],
      tables: 0,
      warnings: [],
      errors: [],
    })

    await user.click(screen.getByRole('button', { name: /run wesley/i }))

    await vi.waitFor(() => {
      expect(screen.queryByText('first error')).not.toBeInTheDocument()
    })
  })
})
