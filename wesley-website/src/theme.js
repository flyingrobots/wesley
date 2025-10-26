import { createTheme } from '@mantine/core'

// Custom "Wesley" theme
export const theme = createTheme({
  primaryColor: 'wesley',
  colors: {
    // Simple flat palette centered on the requested hex
    // Mantine expects 10 shades; using same color for all keeps it consistent
    wesley: [
      '#c32f27', '#c32f27', '#c32f27', '#c32f27', '#c32f27',
      '#c32f27', '#c32f27', '#c32f27', '#c32f27', '#c32f27',
    ],
  },
  fontFamily:
    "Dongle, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
  headings: {
    fontFamily:
      "Margarine, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
  },
  defaultRadius: 'md',
})

