// wesley-core/src/ports/clock.mjs

/**
 * Clock Port - Abstract interface for time operations
 * Enables deterministic testing via dependency injection
 */
export class ClockPort {
  /**
   * Get current timestamp
   * @returns {string} ISO timestamp
   */
  now() {
    throw new Error('ClockPort.now() must be implemented');
  }
}

/**
 * System Clock - Real implementation using system time
 */
export class SystemClock extends ClockPort {
  now() {
    return new Date().toISOString();
  }
}

/**
 * Fake Clock - Test double that returns a fixed timestamp
 */
export class FakeClock extends ClockPort {
  /**
   * @param {string} fixedTimestamp - ISO timestamp to return
   */
  constructor(fixedTimestamp) {
    super();
    this.fixedTimestamp = fixedTimestamp;
  }

  now() {
    return this.fixedTimestamp;
  }
}

/** Default clock instance */
export const systemClock = new SystemClock();