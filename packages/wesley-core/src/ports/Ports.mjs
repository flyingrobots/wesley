/**
 * Ports - Hexagonal Architecture interfaces
 * Define contracts that adapters must implement
 */

// Input Ports (Primary/Driving)
export class SchemaParser {
  async parse(sdl) {
    throw new Error('SchemaParser.parse() must be implemented');
  }
}

export class CommandHandler {
  async handle(command) {
    throw new Error('CommandHandler.handle() must be implemented');
  }
}

export class EventPublisher {
  async publish(event) {
    throw new Error('EventPublisher.publish() must be implemented');
  }
}

// Output Ports (Secondary/Driven)
export class SQLGenerator {
  async generate(schema) {
    throw new Error('SQLGenerator.generate() must be implemented');
  }
}

export class TypeScriptGenerator {
  async generate(schema) {
    throw new Error('TypeScriptGenerator.generate() must be implemented');
  }
}

export class ZodGenerator {
  async generate(schema) {
    throw new Error('ZodGenerator.generate() must be implemented');
  }
}

export class MigrationDiffer {
  async diff(previousSchema, currentSchema) {
    throw new Error('MigrationDiffer.diff() must be implemented');
  }
}

export class MigrationSQLGenerator {
  async generate(diff) {
    throw new Error('MigrationSQLGenerator.generate() must be implemented');
  }
}

export class FileSystem {
  async read(path) {
    throw new Error('FileSystem.read() must be implemented');
  }

  async write(path, content) {
    throw new Error('FileSystem.write() must be implemented');
  }

  async exists(path) {
    throw new Error('FileSystem.exists() must be implemented');
  }

  async mkdir(path, options = {}) {
    throw new Error('FileSystem.mkdir() must be implemented');
  }
}

export class LoggerPort {
  info(o, m) { throw new Error('LoggerPort.info() must be implemented'); }
  warn(o, m) { throw new Error('LoggerPort.warn() must be implemented'); }
  error(o, m) { throw new Error('LoggerPort.error() must be implemented'); }
  debug(o, m) { throw new Error('LoggerPort.debug() must be implemented'); }
  child(b) { throw new Error('LoggerPort.child() must be implemented'); }
  setLevel(l) { throw new Error('LoggerPort.setLevel() must be implemented'); }
  async flush() { throw new Error('LoggerPort.flush() must be implemented'); }
}

// Keep old Logger export for backward compatibility
export const Logger = LoggerPort;