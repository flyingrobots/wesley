// wesley-core/src/ports/logger.js
export class LoggerPort {
  info(o, m) { throw new Error("LoggerPort.info() must be implemented"); }
  warn(o, m) { throw new Error("LoggerPort.warn() must be implemented"); }
  error(o, m) { throw new Error("LoggerPort.error() must be implemented"); }
  debug(o, m) { throw new Error("LoggerPort.debug() must be implemented"); }
  child(b) { throw new Error("LoggerPort.child() must be implemented"); }
  setLevel(l) { throw new Error("LoggerPort.setLevel() must be implemented"); }
  async flush() { throw new Error("LoggerPort.flush() must be implemented"); }
}
