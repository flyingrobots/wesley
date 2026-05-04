/**
 * Domain Events - Pure data structures
 * Event-driven architecture foundation
 */

export class DomainEvent {
  constructor(type, payload, metadata = {}) {
    this.type = type;
    this.payload = payload;
    this.metadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      id: metadata.id || crypto.randomUUID?.() || Math.random().toString(36)
    };
  }
}

// Schema Events
export class SchemaParseRequested extends DomainEvent {
  constructor(sdl) {
    super('SCHEMA_PARSE_REQUESTED', { sdl });
  }
}

export class SchemaParsed extends DomainEvent {
  constructor(schema) {
    super('SCHEMA_PARSED', { schema });
  }
}

export class SchemaParseError extends DomainEvent {
  constructor(error, sdl) {
    super('SCHEMA_PARSE_ERROR', { error: error.message, sdl });
  }
}

export class TypeScriptGenerationRequested extends DomainEvent {
  constructor(schema) {
    super('TYPESCRIPT_GENERATION_REQUESTED', { schema });
  }
}

export class TypeScriptGenerated extends DomainEvent {
  constructor(typescript, schema) {
    super('TYPESCRIPT_GENERATED', { typescript, schema });
  }
}

// File Events
export class FileWriteRequested extends DomainEvent {
  constructor(path, content) {
    super('FILE_WRITE_REQUESTED', { path, content });
  }
}

export class FileWritten extends DomainEvent {
  constructor(path) {
    super('FILE_WRITTEN', { path });
  }
}

export class FileReadRequested extends DomainEvent {
  constructor(path) {
    super('FILE_READ_REQUESTED', { path });
  }
}

export class FileRead extends DomainEvent {
  constructor(path, content) {
    super('FILE_READ', { path, content });
  }
}
