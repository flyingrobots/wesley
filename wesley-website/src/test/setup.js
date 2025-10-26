import '@testing-library/jest-dom/vitest'

// Polyfill matchMedia for Mantine color scheme logic in JSDOM
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {}, // deprecated, kept for compat
    removeListener: () => {}, // deprecated, kept for compat
    dispatchEvent: () => false,
  })
}
