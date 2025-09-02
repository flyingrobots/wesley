# CLI Reference

## Overview

Wesley provides a comprehensive command-line interface for database migration management, schema compilation, and development workflows.

## Installation

```bash
# Global installation
npm install -g @wesley/cli

# Local installation
npm install --save-dev @wesley/cli

# Verify installation
wesley --version
```

## Global Options

Options available for all commands:

```
--config, -c <path>     Path to config file (default: wesley.config.js)
--env, -e <name>         Environment name (default: development)
--verbose, -v            Verbose output
--quiet, -q              Suppress output
--json                   JSON output format
--no-color               Disable colored output
--help, -h               Show help
--version                Show version
```

## Commands

### wesley init

Initialize a new Wesley project.

```bash
wesley init [options]
```

**Options:**
```
--template <name>        Project template (basic|advanced|enterprise)
--database <url>         Database connection URL
--skip-install           Skip dependency installation
--force                  Overwrite existing files
```

**Examples:**
```bash
# Interactive initialization
wesley init

# With template
wesley init --template enterprise

# With database URL
wesley init --database postgresql://localhost/mydb
```

---

### wesley compile

Compile GraphQL schema to SQL and TypeScript.

```bash
wesley compile [options]
```

**Options:**
```
--input, -i <path>       Input schema path (default: schema/)
--output, -o <path>      Output directory (default: generated/)
--sql-only               Generate only SQL
--types-only             Generate only TypeScript
--watch, -w              Watch mode
--clean                  Clean output directory first
```

**Examples:**
```bash
# Basic compilation
wesley compile

# Watch mode
wesley compile --watch

# SQL only
wesley compile --sql-only

# Custom paths
wesley compile -i src/schema -o dist/generated
```

---

### wesley migrate

Database migration commands.

#### wesley migrate generate

Generate a new migration from schema changes.

```bash
wesley migrate generate [name] [options]
```

**Options:**
```
--from <version>         Base version for diff
--to <version>           Target version for diff
--auto-name              Generate name from changes
--sql-only               Skip TypeScript generation
```

**Examples:**
```bash
# Generate with name
wesley migrate generate add-user-table

# Auto-name from changes
wesley migrate generate --auto-name

# Between versions
wesley migrate generate --from v1.0 --to v2.0
```

#### wesley migrate execute

Execute pending migrations.

```bash
wesley migrate execute [options]
```

**Options:**
```
--target <version>       Migrate to specific version
--dry-run                Show SQL without executing
--unsafe                 Allow unsafe operations
--force                  Skip confirmation prompts
--checkpoint             Create checkpoints
--timeout <seconds>      Operation timeout
```

**Examples:**
```bash
# Execute all pending
wesley migrate execute

# Dry run
wesley migrate execute --dry-run

# With unsafe operations
wesley migrate execute --unsafe

# To specific version
wesley migrate execute --target 20240101120000
```

#### wesley migrate rollback

Rollback migrations.

```bash
wesley migrate rollback [options]
```

**Options:**
```
--steps <n>              Number of migrations to rollback
--to <version>           Rollback to specific version
--force                  Skip confirmation
--dry-run                Show rollback SQL
```

**Examples:**
```bash
# Rollback last migration
wesley migrate rollback --steps 1

# Rollback to version
wesley migrate rollback --to 20240101000000

# Dry run
wesley migrate rollback --steps 2 --dry-run
```

#### wesley migrate status

Show migration status.

```bash
wesley migrate status [options]
```

**Options:**
```
--pending                Show only pending migrations
--applied                Show only applied migrations
--detailed               Show detailed information
```

**Examples:**
```bash
# Basic status
wesley migrate status

# Pending only
wesley migrate status --pending

# Detailed view
wesley migrate status --detailed
```

---

### wesley drift

Schema drift detection and repair.

#### wesley drift detect

Detect schema drift between compiled and runtime schemas.

```bash
wesley drift detect [options]
```

**Options:**
```
--fail-on-drift          Exit with error if drift detected
--ignore-extra           Ignore extra database objects
--format <type>          Output format (text|json|markdown)
```

**Examples:**
```bash
# Basic detection
wesley drift detect

# CI/CD mode
wesley drift detect --fail-on-drift

# JSON output
wesley drift detect --format json
```

#### wesley drift repair

Generate repair plan for schema drift.

```bash
wesley drift repair [options]
```

**Options:**
```
--execute                Execute repair immediately
--safe-only              Only safe operations
--output <path>          Save repair script
--force                  Skip confirmation
```

**Examples:**
```bash
# Generate repair plan
wesley drift repair

# Execute repairs
wesley drift repair --execute

# Save to file
wesley drift repair --output repair.sql
```

---

### wesley analyze

Analyze database and schema.

#### wesley analyze locks

Analyze lock impact of operations.

```bash
wesley analyze locks [options]
```

**Options:**
```
--migration <id>         Analyze specific migration
--schema <path>          Analyze schema file
--format <type>          Output format (table|json|csv)
```

**Examples:**
```bash
# Analyze current schema
wesley analyze locks

# Specific migration
wesley analyze locks --migration 20240101120000

# JSON output
wesley analyze locks --format json
```

#### wesley analyze dead-columns

Detect potentially unused columns.

```bash
wesley analyze dead-columns [options]
```

**Options:**
```
--confidence <level>     Minimum confidence (LOW|MEDIUM|HIGH)
--sample-size <n>        Query sample size
--output <path>          Save report to file
```

**Examples:**
```bash
# Basic analysis
wesley analyze dead-columns

# High confidence only
wesley analyze dead-columns --confidence HIGH

# Large sample
wesley analyze dead-columns --sample-size 10000
```

---

### wesley test

Testing commands.

#### wesley test generate

Generate pgTAP tests from schema.

```bash
wesley test generate [options]
```

**Options:**
```
--output <path>          Output directory
--coverage <type>        Coverage level (basic|full|custom)
--include <pattern>      Include pattern
--exclude <pattern>      Exclude pattern
```

**Examples:**
```bash
# Generate all tests
wesley test generate

# Full coverage
wesley test generate --coverage full

# Specific tables
wesley test generate --include "user_*"
```

#### wesley test run

Run pgTAP tests.

```bash
wesley test run [options]
```

**Options:**
```
--pattern <glob>         Test file pattern
--reporter <type>        Reporter (tap|spec|json)
--bail                   Stop on first failure
--coverage               Generate coverage report
```

**Examples:**
```bash
# Run all tests
wesley test run

# Specific pattern
wesley test run --pattern "**/user*.sql"

# With coverage
wesley test run --coverage
```

---

### wesley watch

Start watch mode for development.

```bash
wesley watch [options]
```

**Options:**
```
--debounce <ms>          Debounce delay (default: 200)
--ignore <pattern>       Ignore pattern
--exec <command>         Execute command on change
--notify                 Desktop notifications
```

**Examples:**
```bash
# Basic watch
wesley watch

# With custom command
wesley watch --exec "npm test"

# With notifications
wesley watch --notify

# Custom debounce
wesley watch --debounce 500
```

---

### wesley validate

Validate schema and configuration.

```bash
wesley validate [options]
```

**Options:**
```
--schema                 Validate schema only
--config                 Validate config only
--strict                 Strict validation mode
--fix                    Auto-fix issues
```

**Examples:**
```bash
# Validate everything
wesley validate

# Schema only
wesley validate --schema

# With auto-fix
wesley validate --fix
```

---

### wesley explain

Explain migration plan without execution.

```bash
wesley explain [migration] [options]
```

**Options:**
```
--verbose                Include all details
--format <type>          Output format (text|json|markdown)
--estimate               Include time estimates
```

**Examples:**
```bash
# Explain next migration
wesley explain

# Specific migration
wesley explain 20240101120000

# With estimates
wesley explain --estimate

# Markdown format
wesley explain --format markdown
```

---

### wesley config

Configuration management.

#### wesley config show

Show current configuration.

```bash
wesley config show [key] [options]
```

**Examples:**
```bash
# Show all config
wesley config show

# Specific key
wesley config show database.url

# JSON format
wesley config show --json
```

#### wesley config set

Set configuration value.

```bash
wesley config set <key> <value> [options]
```

**Options:**
```
--global                 Set globally
--local                  Set locally
```

**Examples:**
```bash
# Set database URL
wesley config set database.url postgresql://localhost/mydb

# Set globally
wesley config set --global safety.requireUnsafe true
```

---

## Configuration File

### wesley.config.js

```javascript
module.exports = {
  // Database configuration
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production',
    poolSize: 10
  },
  
  // Schema configuration
  schema: {
    input: './schema',
    output: './generated',
    watch: {
      enabled: true,
      debounce: 200,
      ignore: ['*.test.graphql']
    }
  },
  
  // Migration configuration
  migration: {
    directory: './migrations',
    tableName: 'schema_migrations',
    checkpoints: true,
    timeout: 30000
  },
  
  // Safety configuration
  safety: {
    requireUnsafe: true,
    blockingOpsAllowed: false,
    dryRunDefault: false,
    confirmations: true
  },
  
  // Type generation
  types: {
    typescript: {
      enabled: true,
      output: './generated/types.ts'
    },
    zod: {
      enabled: true,
      output: './generated/validators.ts'
    }
  },
  
  // Testing
  testing: {
    framework: 'pgtap',
    directory: './tests',
    coverage: true
  },
  
  // Logging
  logging: {
    level: 'info',
    format: 'pretty',
    file: './wesley.log'
  }
};
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/db
WESLEY_DATABASE_URL=postgresql://user:pass@localhost/db

# Environment
NODE_ENV=development
WESLEY_ENV=development

# Paths
WESLEY_CONFIG=./wesley.config.js
WESLEY_SCHEMA_DIR=./schema
WESLEY_OUTPUT_DIR=./generated
WESLEY_MIGRATIONS_DIR=./migrations

# Safety
WESLEY_ALLOW_UNSAFE=false
WESLEY_DRY_RUN=false
WESLEY_SKIP_CONFIRM=false

# Logging
WESLEY_LOG_LEVEL=info
WESLEY_LOG_FORMAT=json
WESLEY_LOG_FILE=./wesley.log

# Features
WESLEY_WATCH=true
WESLEY_TYPES=true
WESLEY_CHECKPOINTS=true
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Misuse of shell command |
| 3 | Configuration error |
| 4 | Database connection error |
| 5 | Schema validation error |
| 6 | Migration error |
| 7 | Drift detected |
| 8 | Unsafe operation blocked |
| 9 | User cancelled |
| 10 | Checkpoint recovery needed |

## Examples

### Common Workflows

#### Initial Setup
```bash
# Initialize project
wesley init --template basic

# Configure database
wesley config set database.url $DATABASE_URL

# Compile schema
wesley compile

# Generate initial migration
wesley migrate generate initial

# Execute migration
wesley migrate execute
```

#### Development Workflow
```bash
# Start watch mode
wesley watch

# In another terminal, check status
wesley migrate status

# Detect drift
wesley drift detect

# Run tests
wesley test run
```

#### Production Deployment
```bash
# Validate everything
wesley validate --strict

# Explain migration
wesley explain --estimate

# Dry run
wesley migrate execute --dry-run

# Execute with checkpoints
wesley migrate execute --checkpoint --timeout 60

# Verify no drift
wesley drift detect --fail-on-drift
```

#### Rollback Procedure
```bash
# Check current status
wesley migrate status

# Generate rollback plan
wesley migrate rollback --dry-run --steps 1

# Execute rollback
wesley migrate rollback --steps 1 --force

# Verify state
wesley drift detect
```

---

**[← Back to Testing Strategy](./05-testing-strategy.md)** | **[↑ Back to README](./README.md)**