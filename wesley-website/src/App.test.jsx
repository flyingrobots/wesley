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

    const heading = screen.getByRole('heading', { name: /wesley/i })
    expect(heading).toBeInTheDocument()
  })
})
