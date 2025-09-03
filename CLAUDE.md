# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wesley is a production-grade database migration and code generation platform that uses GraphQL SDL as the single source of truth. It compiles GraphQL schemas into PostgreSQL DDL with zero-downtime migration strategies, TypeScript types, RLS policies, and pgTAP tests. The system prioritizes production safety with advisory locks, drift detection, checkpoint recovery, and lock-aware DDL operations. Core philosophy: "GraphQL is the schema. Postgres & Supabase are generated."

**Mission:** Be the "adult in the room" for database operations - no surprises, no 3am pages, just boring reliability.

## Key Technologies

- **Runtime**: Node.js >= 18.0.0
- **Schema Language**: GraphQL with Wesley directives (@table, @rls, @fk, etc.)
- **Database**: PostgreSQL/Supabase (generated from GraphQL)
- **Testing**: Vitest for unit tests, pgTAP for database tests (generated)
- **Architecture**: Hexagonal architecture with ports and adapters pattern
- **Monorepo**: pnpm workspaces with three main packages (core, host-node, cli)

## Common Development Commands

### Running Wesley CLI
```bash
# Generate code from GraphQL schema
pnpm exec wesley generate ./example/schema.graphql

# Watch mode for development (not yet implemented)
pnpm exec wesley watch ./example/schema.graphql

# Run tests (not yet implemented) 
pnpm exec wesley test

# Deploy with zero-downtime plan (not yet implemented)
pnpm exec wesley deploy
```

### Testing
```bash
# Run all Vitest tests
pnpm test

# Watch mode for development
pnpm test:watch

# Generate test coverage
pnpm test:coverage
```

## Architecture

### Package Structure
- **@wesley/core**: Domain logic, generators, and IR (Intermediate Representation)
  - Pure domain models (Schema, Table, Field, etc.)
  - Generator ports (interfaces)
  - Event-driven command pattern
  
- **@wesley/host-node**: Node.js platform adapters
  - File system operations (WesleyFileWriter)
  - Console logging (WesleyConsoleLogger)
  - Parser implementations
  - Generator implementations
  
- **@wesley/cli**: Command-line interface
  - Generate command (transforms GraphQL to outputs)
  - Watch command (planned)
  - Test runner (planned)
  - Deploy command (planned)

### Hexagonal Architecture Principles
```
Core (Domain) → Ports (Interfaces) → Adapters (Platform-specific)
```
- Core package should have NO platform dependencies
- All I/O operations go through ports
- Adapters implement ports for specific platforms

### GraphQL Directives (Wesley Extensions)
- `@table`: Marks a type as a database table
- `@pk`: Primary key field
- `@fk(ref: "Table.field")`: Foreign key relationship
- `@rls(enable: true)`: Enable Row Level Security
- `@tenant(by: "field")`: Multi-tenancy configuration
- `@unique`: Unique constraint
- `@check(expr: "...")`: Check constraint
- `@default(value: "...")`: Default value

### Generated Outputs
From a single GraphQL schema, Wesley generates:
1. **PostgreSQL DDL**: Tables, constraints, indexes
2. **Migration Plans**: Phased zero-downtime migrations (expand/backfill/validate/switch/contract)
3. **TypeScript Types**: Zod schemas and TypeScript interfaces
4. **RLS Policies**: Row Level Security policies and helper functions
5. **pgTAP Tests**: Comprehensive test suites for structure, constraints, RLS, and migrations
6. **SHA-Locked Certificate**: Cryptographic proof of migration safety

## Important Patterns

### Event-Driven Architecture
Commands emit events for progress tracking:
```javascript
command.emit('progress', { message: 'Parsing schema...' });
command.emit('success', { message: 'Generation complete!' });
command.emit('error', { message: 'Failed', error });
```

### Dependency Injection
All components use constructor injection:
```javascript
class GenerateCommand {
  constructor({ parser, generator, writer }) {
    this.parser = parser;
    this.generator = generator;
    this.writer = writer;
  }
}
```

### Error Handling
- Custom error types with context
- Commands emit error events before throwing
- Graceful degradation where possible

## Production Safety Features (Planned)

### Zero-Downtime Migration Strategies
- **Online DDL** - All operations use CONCURRENTLY or NOT VALID patterns by default
- **Lock-Aware Planning** - DDL Planner rewrites operations to minimize lock impact
- **Wave Execution** - Batches compatible operations to reduce migration time
- **Advisory Locks** - Transaction-scoped locks prevent concurrent migrations
- **Checkpoint Recovery** - Resume failed migrations from last good state

### Safety Rails
- **Drift Detection** - Runtime schema hash validation catches mismatches
- **Dry-Run Mode** - Preview exact SQL and lock impact before execution
- **Resource Awareness** - Automatic mutex handling for exclusive resources (e.g., one CIC per table)
- **Dead Column Detection** - Uses pg_stat_statements to find unused columns
- **Explain Mode** - Shows precise lock levels for each operation

## Development Status

**⚠️ ACTIVE DEVELOPMENT - Foundation Phase**

Currently implemented (partially):
- Basic GraphQL parsing
- Partial SQL generation
- File writing adapter
- CLI structure
- Monorepo setup with pnpm workspaces

Priority work in progress:
- **Package exports** - Creating index.mjs for host-node (CRITICAL)
- **DDL Planner** - Safe operation rewriting
- **SQL Executor** - Streaming with transaction awareness
- **Watch Mode** - Incremental compilation with chokidar

Not yet implemented:
- Complete generator suite (TypeScript, Zod, RLS)
- Production CLI with all safety flags
- Schema linting via GraphQL ESLint
- Checkpoint/resume capability
- Rolling frontier execution
- Browser/Deno adapters

## Current Issues & Priorities

1. **Package Exports**: Host-node package needs index.mjs with proper exports
2. **CLI Imports**: Import paths need correction to use proper packages
3. **Generator Completion**: Most generators have stub implementations
4. **Testing**: Tests exist but may not run due to import issues

## Development Notes

### Adding New Features
1. Define domain models in @wesley/core
2. Create port interfaces in core
3. Implement adapters in @wesley/host-node
4. Wire up in CLI commands
5. Add comprehensive tests

### Working with Monorepo
```bash
# Install dependencies (creates pnpm-lock.yaml)
pnpm install

# Run from workspace root
pnpm -r build  # Build all packages
pnpm -r test   # Test all packages
```

### Troubleshooting

If CLI won't run:
- Check that host-node exports are properly defined in index.mjs
- Verify pnpm workspace links are established (`pnpm install`)
- Ensure all import paths reference correct packages

## Environment Variables

```bash
# Output directory for generated files
WESLEY_OUTPUT_DIR=./generated

# Enable debug logging
WESLEY_DEBUG=true

# Database connection (for deploy/test commands when implemented)
DATABASE_URL=postgresql://...
```

## Contributing

This project follows hexagonal architecture strictly. When contributing:
1. Keep domain logic in core package
2. Platform-specific code goes in adapters
3. Use ports for all boundaries
4. Write tests for both domain and adapters
5. Follow existing patterns and conventions

---
*This document reflects Wesley's actual implementation status. For the aspirational vision, see README.md*