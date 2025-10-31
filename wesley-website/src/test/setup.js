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

// Minimal ResizeObserver stub for Mantine components in JSDOM
if (typeof window.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    constructor(callback) {
      this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // Attach to both window and globalThis to satisfy various imports
  // eslint-disable-next-line no-undef
  globalThis.ResizeObserver = ResizeObserverStub
  window.ResizeObserver = ResizeObserverStub
}
