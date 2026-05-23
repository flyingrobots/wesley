// wesley-core/src/ports/logger.js
export class LoggerPort {
  info(_o, _m) {
    throw new Error('LoggerPort.info() must be implemented');
  }
  warn(_o, _m) {
    throw new Error('LoggerPort.warn() must be implemented');
  }
  error(_o, _m) {
    throw new Error('LoggerPort.error() must be implemented');
  }
  debug(_o, _m) {
    throw new Error('LoggerPort.debug() must be implemented');
  }
  child(_b) {
    throw new Error('LoggerPort.child() must be implemented');
  }
  setLevel(_l) {
    throw new Error('LoggerPort.setLevel() must be implemented');
  }
  async flush() {
    throw new Error('LoggerPort.flush() must be implemented');
  }
}
