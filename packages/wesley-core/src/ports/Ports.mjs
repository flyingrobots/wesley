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

export class MigrationDiffEngine {
  async diff(previousSchema, currentSchema) {
    throw new Error('MigrationDiffEngine.diff() must be implemented');
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

export class Logger {
  log(message, level = 'info') {
    throw new Error('Logger.log() must be implemented');
  }

  error(message, error) {
    throw new Error('Logger.error() must be implemented');
  }

  warn(message) {
    throw new Error('Logger.warn() must be implemented');
  }

  debug(message) {
    throw new Error('Logger.debug() must be implemented');
  }
}