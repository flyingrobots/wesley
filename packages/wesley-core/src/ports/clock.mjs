// wesley-core/src/ports/clock.js
export class ClockPort {
  /**
   * Get current timestamp (for deterministic testing)
   * @returns {string} ISO timestamp
   */
  now() { 
    throw new Error('ClockPort.now() must be implemented'); 
  }
}

// Default implementation
export class SystemClock extends ClockPort {
  now() {
    return new Date().toISOString();
  }
}