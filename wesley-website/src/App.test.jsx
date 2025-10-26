import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { theme } from './theme'
import App from './App'

describe('App', () => {
  it('renders a single Wesley button in the nav', () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <App />
      </MantineProvider>
    )

    const btn = screen.getByRole('button', { name: /wesley/i })
    expect(btn).toBeInTheDocument()
  })
})

