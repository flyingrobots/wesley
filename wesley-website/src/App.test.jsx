import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import App from './App'

describe('App', () => {
  it('renders the Wesley hero title', () => {
    render(
      <MantineProvider defaultColorScheme="light">
        <App />
      </MantineProvider>
    )

    // Pick the hero H1 specifically to avoid matching other "Wesley" headings
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent(/wesley/i)
  })
})
