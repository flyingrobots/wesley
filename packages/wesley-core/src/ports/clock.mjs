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

  /**
   * Get current timestamp in milliseconds
   * @returns {number}
   */
  nowMs() {
    throw new Error('ClockPort.nowMs() must be implemented');
  }

  /**
   * Sleep for a duration
   * @param {number} _ms
   * @returns {Promise<void>}
   */
  sleep(_ms) {
    throw new Error('ClockPort.sleep() must be implemented');
  }

  /**
   * Schedule a timeout
   * @param {Function} _callback
   * @param {number} _ms
   * @returns {*}
   */
  setTimeout(_callback, _ms) {
    throw new Error('ClockPort.setTimeout() must be implemented');
  }

  /**
   * Cancel a timeout
   * @param {*} _handle
   */
  clearTimeout(_handle) {
    throw new Error('ClockPort.clearTimeout() must be implemented');
  }

  /**
   * Schedule a repeating interval
   * @param {Function} _callback
   * @param {number} _ms
   * @returns {*}
   */
  setInterval(_callback, _ms) {
    throw new Error('ClockPort.setInterval() must be implemented');
  }

  /**
   * Cancel an interval
   * @param {*} _handle
   */
  clearInterval(_handle) {
    throw new Error('ClockPort.clearInterval() must be implemented');
  }
}

/**
 * System Clock - Real implementation using system time
 */
export class SystemClock extends ClockPort {
  now() {
    return new Date(this.nowMs()).toISOString();
  }

  nowMs() {
    return Date.now();
  }

  sleep(ms) {
    return new Promise((resolve) => {
      this.setTimeout(resolve, ms);
    });
  }

  setTimeout(callback, ms) {
    return globalThis.setTimeout(callback, ms);
  }

  clearTimeout(handle) {
    globalThis.clearTimeout(handle);
  }

  setInterval(callback, ms) {
    return globalThis.setInterval(callback, ms);
  }

  clearInterval(handle) {
    globalThis.clearInterval(handle);
  }
}

/**
 * Fake Clock - Test double with deterministic timers
 */
export class FakeClock extends ClockPort {
  /**
   * @param {string} fixedTimestamp - ISO timestamp to return
   */
  constructor(fixedTimestamp) {
    super();
    if (typeof fixedTimestamp !== 'string' || fixedTimestamp.trim().length === 0) {
      throw new TypeError('FakeClock requires a non-empty ISO timestamp string');
    }
    if (isNaN(Date.parse(fixedTimestamp))) {
      throw new TypeError(`FakeClock received invalid ISO timestamp: "${fixedTimestamp}"`);
    }
    this.fixedTimestamp = fixedTimestamp;
    this.currentTimeMs = Date.parse(fixedTimestamp);
    this.nextTimerId = 1;
    this.timers = new Map();
  }

  now() {
    return new Date(this.currentTimeMs).toISOString();
  }

  nowMs() {
    return this.currentTimeMs;
  }

  sleep(ms) {
    return new Promise((resolve) => {
      this.setTimeout(resolve, ms);
    });
  }

  setTimeout(callback, ms) {
    return this.#scheduleTimer(callback, ms, null);
  }

  clearTimeout(handle) {
    this.timers.delete(handle);
  }

  setInterval(callback, ms) {
    return this.#scheduleTimer(callback, ms, Math.max(1, ms));
  }

  clearInterval(handle) {
    this.timers.delete(handle);
  }

  async advanceBy(ms) {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new TypeError('FakeClock.advanceBy() requires a non-negative finite duration');
    }

    await this.advanceTo(this.currentTimeMs + ms);
  }

  async advanceTo(targetTimeMs) {
    if (!Number.isFinite(targetTimeMs)) {
      throw new TypeError('FakeClock.advanceTo() requires a finite target timestamp');
    }

    if (targetTimeMs < this.currentTimeMs) {
      this.currentTimeMs = targetTimeMs;
      return;
    }

    while (true) {
      const nextTimer = this.#nextDueTimer(targetTimeMs);
      if (!nextTimer) {
        this.currentTimeMs = targetTimeMs;
        return;
      }

      this.currentTimeMs = nextTimer.at;
      this.timers.delete(nextTimer.id);

      await nextTimer.callback();

      if (nextTimer.intervalMs !== null && !nextTimer.cancelled) {
        this.timers.set(nextTimer.id, {
          ...nextTimer,
          at: this.currentTimeMs + nextTimer.intervalMs
        });
      }
    }
  }

  #scheduleTimer(callback, ms, intervalMs) {
    const id = this.nextTimerId++;
    const duration = Math.max(0, ms);
    this.timers.set(id, {
      id,
      at: this.currentTimeMs + duration,
      callback,
      intervalMs,
      cancelled: false
    });
    return id;
  }

  #nextDueTimer(targetTimeMs) {
    let nextTimer = null;

    for (const timer of this.timers.values()) {
      if (timer.at > targetTimeMs) {
        continue;
      }

      if (!nextTimer || timer.at < nextTimer.at || (timer.at === nextTimer.at && timer.id < nextTimer.id)) {
        nextTimer = timer;
      }
    }

    return nextTimer;
  }
}

/** Default clock instance */
export const systemClock = new SystemClock();
