# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

D.A.T.A. (Database Automation, Testing, and Alignment) is a CLI tool for managing Supabase/PostgreSQL database migrations, Edge Functions, and pgTAP testing. Built with Node.js, it provides a comprehensive workflow for database development with production safety features. Like its namesake android from Star Trek: The Next Generation, D.A.T.A. prioritizes logical operations and preventing harm to production systems.

## Key Technologies

- **Runtime**: Node.js >= 18.0.0
- **Database**: PostgreSQL via Supabase (local and production)
- **Testing**: Vitest for unit tests, pgTAP for database tests
- **CLI Framework**: Commander.js
- **Architecture**: Event-driven command pattern with dependency injection

## Common Development Commands

### Running Tests
```bash
# Run all Vitest tests
npm test

# Watch mode for development
npm run test:watch

# Generate test coverage
npm run test:coverage
```

### Database Migration Workflow
```bash
# 1. Generate migration from SQL changes
npm run migrate:generate   # or: data db migrate generate --name <name>

# 2. Test migration in isolated schema
npm run migrate:test       # or: data db migrate test

# 3. Promote to production (requires confirmation)
npm run migrate:promote    # or: data db migrate promote --prod

# 4. Check migration status
npm run migrate:status     # or: data db migrate status

# 5. Rollback if needed
npm run migrate:rollback   # or: data db migrate rollback --prod
```

### Building and Compiling
```bash
# Compile SQL sources into migration
data db compile

# Compile with Edge Functions deployment
data db compile --deploy-functions
```

## Architecture

### Code Organization Rules
- **One Class Per File**: Each file must contain exactly one class. The filename must match the class name.
- **Self-Documenting Names**: Each artifact should describe its contents based on its filename.
- **No Multi-Class Files**: If a file contains multiple classes, it must be refactored immediately.

### Command Class Hierarchy
- **Command** (src/lib/Command.js): Base class with event emission and logging
- **SupabaseCommand**: Commands using Supabase API
- **DatabaseCommand**: Direct database access commands
- **TestCommand**: Testing-related commands

All commands follow an event-driven pattern:
```javascript
command.emit('progress', { message: 'Processing...' });
command.emit('success', { message: 'Complete!' });
command.emit('error', { message: 'Failed', error });
```

### Directory Structure
- **src/commands/**: Command implementations organized by domain (db/, functions/, test/)
- **src/lib/**: Core libraries and base classes
- **src/reporters/**: Output formatters (CliReporter)
- **migrations/**: Generated database migrations
- **sql/**: SQL source files (input)
- **tests/**: pgTAP test files
- **functions/**: Supabase Edge Functions

### Path Configuration
Paths can be configured via:
1. Command-line options: `--sql-dir`, `--tests-dir`, `--migrations-dir`
2. Environment variables: `data_SQL_DIR`, `data_TESTS_DIR`, `data_MIGRATIONS_DIR`
3. Configuration file: `.datarc.json`

### Configuration System
Configuration is loaded from `.datarc.json` with the following structure:
```json
{
  "test": {
    "minimum_coverage": 80,
    "test_timeout": 300,
    "output_formats": ["console", "junit", "json"]
  },
  "environments": {
    "local": {
      "db": "postgresql://..."
    }
  }
}
```

## Important Patterns

### Production Safety
- All production commands require explicit `--prod` flag
- Destructive operations require typed confirmation
- Commands wrap operations in transactions where supported
- Process management includes zombie prevention and cleanup

### Error Handling
- Custom error types in `src/lib/dataError/`
- Commands should emit error events before throwing
- Process exit codes are handled by CliReporter

### Testing Strategy
- Unit tests use Vitest (test/*.test.js)
- Database tests use pgTAP (tests/*.sql)
- Test commands support multiple output formats (console, JUnit, JSON)
- Coverage enforcement configurable via .datarc.json

## Environment Variables

```bash
# Database connections
DATABASE_URL=postgresql://...
data_DATABASE_URL=postgresql://...

# Supabase credentials
data_SERVICE_ROLE_KEY=...
data_ANON_KEY=...

# Production credentials (for --prod flag)
PROD_SUPABASE_URL=...
PROD_SUPABASE_SERVICE_ROLE_KEY=...
PROD_SUPABASE_ANON_KEY=...

# Path overrides
data_SQL_DIR=./sql
data_TESTS_DIR=./tests
data_MIGRATIONS_DIR=./migrations
```

## Development Notes

### Adding New Commands
1. Extend appropriate base class (Command, DatabaseCommand, etc.)
2. Implement `performExecute()` method
3. Emit appropriate events for progress tracking
4. Register in src/index.js with commander

### Working with Migrations
- Migrations include metadata.json with tracking info
- Use MigrationMetadata class for parsing/validation
- Test migrations run in isolated schemas (@data.tests.*)
- Production migrations require double confirmation

### Edge Functions Integration
- Functions can be deployed with migrations via `--deploy-functions`
- Validation happens before deployment
- Production deployments require import maps unless `--skip-import-map`

## Troubleshooting

### Compile Command Issues
If `data db compile` exits with no error output:
- Ensure SQL source directory exists (default: ./sql)
- Use `--sql-dir` and `--migrations-dir` to specify custom paths
- The compile command now properly displays errors for missing directories
- Example: `data db compile --sql-dir /path/to/sql --migrations-dir /path/to/migrations`

### Static Analysis for Async/Await

The project includes ESLint configuration and git pre-commit hooks to catch common async/await issues:

```bash
# Run linting to check for async/await problems
npm run lint

# Auto-fix issues where possible
npm run lint:fix

# Hooks are automatically installed via npm install
npm run postinstall  # Manually re-install git hooks if needed
```

#### Git Pre-commit Hook
- Automatically runs ESLint on staged JavaScript files
- Prevents commits with linting errors
- Checks for floating promises and async issues
- Bypass with `git commit --no-verify` (use sparingly!)

#### ESLint Rules Enforced
- `require-await`: Async functions must use await
- `promise/catch-or-return`: Promises must be handled
- `promise/always-return`: Promise chains must return values
- `no-async-promise-executor`: No async functions in Promise constructor

For TypeScript projects, use `@typescript-eslint/no-floating-promises` to catch unawaited async calls.

### Recent Fixes
- Fixed error handling in CompileCommand constructor to properly display errors
- Added `isProd` property to start event emissions
- Fixed MigrationCompiler config property naming (sqlDir vs rootDir)
- CRITICAL: ABSOLUTELY ZERO TYPESCRIPT ALLOWED, CLAUDE. Very slim exceptions to this rule (Edge Function generation nonsense). For information, see @import @docs/decisions/000-javascript-not-typescript.md