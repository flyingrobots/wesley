/**
 * Command Pattern - Encapsulate requests as objects
 * Each command represents an intention
 */

export class Command {
  constructor(type, payload = {}) {
    this.type = type;
    this.payload = payload;
    this.timestamp = new Date().toISOString();
  }
}

// Schema Commands
export class ParseSchemaCommand extends Command {
  constructor(sdl) {
    super('PARSE_SCHEMA', { sdl });
  }
}

// Generation Commands
export class GenerateSQLCommand extends Command {
  constructor(schema) {
    super('GENERATE_SQL', { schema });
  }
}

export class GenerateTypeScriptCommand extends Command {
  constructor(schema) {
    super('GENERATE_TYPESCRIPT', { schema });
  }
}

export class GenerateZodCommand extends Command {
  constructor(schema) {
    super('GENERATE_ZOD', { schema });
  }
}

export class GenerateAllCommand extends Command {
  constructor(schema) {
    super('GENERATE_ALL', { schema });
  }
}

// Migration Commands
export class CalculateMigrationCommand extends Command {
  constructor(previousSchema, currentSchema) {
    super('CALCULATE_MIGRATION', { previousSchema, currentSchema });
  }
}

export class GenerateMigrationSQLCommand extends Command {
  constructor(diff) {
    super('GENERATE_MIGRATION_SQL', { diff });
  }
}

// File Commands
export class WriteFileCommand extends Command {
  constructor(path, content) {
    super('WRITE_FILE', { path, content });
  }
}

export class ReadFileCommand extends Command {
  constructor(path) {
    super('READ_FILE', { path });
  }
}

// Workflow Commands
export class GenerateProjectCommand extends Command {
  constructor(schemaPath, outputPath) {
    super('GENERATE_PROJECT', { schemaPath, outputPath });
  }
}

export class WatchSchemaCommand extends Command {
  constructor(schemaPath, interval = 1000) {
    super('WATCH_SCHEMA', { schemaPath, interval });
  }
}