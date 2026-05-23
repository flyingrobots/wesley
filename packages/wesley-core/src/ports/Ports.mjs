/**
 * Ports - Hexagonal Architecture interfaces
 * Define contracts that adapters must implement
 */

// Input Ports (Primary/Driving)
export class SchemaParser {
  async parse(_sdl) {
    throw new Error('SchemaParser.parse() must be implemented');
  }
}

export class CommandHandler {
  async handle(_command) {
    throw new Error('CommandHandler.handle() must be implemented');
  }
}

export class EventPublisher {
  async publish(_event) {
    throw new Error('EventPublisher.publish() must be implemented');
  }
}

export class TypeScriptGenerator {
  async generate(_schema) {
    throw new Error('TypeScriptGenerator.generate() must be implemented');
  }
}

export class ZodGenerator {
  async generate(_schema) {
    throw new Error('ZodGenerator.generate() must be implemented');
  }
}

export class FileSystem {
  async read(_path) {
    throw new Error('FileSystem.read() must be implemented');
  }

  async write(_path, _content) {
    throw new Error('FileSystem.write() must be implemented');
  }

  async exists(_path) {
    throw new Error('FileSystem.exists() must be implemented');
  }

  async mkdir(path, _options = {}) {
    throw new Error('FileSystem.mkdir() must be implemented');
  }
}

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

// Keep old Logger export for backward compatibility
export const Logger = LoggerPort;
