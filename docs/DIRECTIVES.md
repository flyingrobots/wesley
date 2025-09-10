# Wesley GraphQL Directives Specification

Wesley extends GraphQL with custom directives that control how schemas are compiled to database DDL, TypeScript types, and other outputs.

## Canonical Directive Set

**Namespace**: `@wes_*` (canonical, preferred)

```graphql
# Core table directives
directive @wes_table(name: String) on OBJECT
directive @wes_pk on FIELD_DEFINITION
directive @wes_fk(ref: String!) on FIELD_DEFINITION        # "Table.column"
directive @wes_unique on FIELD_DEFINITION
directive @wes_index(name: String, using: String) on FIELD_DEFINITION | OBJECT
directive @wes_tenant(by: String!) on OBJECT
directive @wes_default(value: String) on FIELD_DEFINITION
```

## Alias Support (Temporary)

For migration convenience, Wesley accepts these aliases with deprecation warnings:

**Long aliases**:
```graphql
directive @wesley_table(name: String) on OBJECT
directive @wesley_pk on FIELD_DEFINITION
# ... etc (full @wesley_* variants)
```

**Legacy short names**:
```graphql
directive @table on OBJECT
directive @pk on FIELD_DEFINITION
# ... etc (bare names)
```

**Deprecation Policy**: Aliases will be removed in v0.3. Use `@wes_*` in new schemas.

## Directive Reference

### `@wes_table`
**Location**: OBJECT  
**Purpose**: Marks a GraphQL type as a database table

```graphql
type User @wes_table {
  id: ID! @wes_pk
  email: String!
}

# Custom table name
type UserProfile @wes_table(name: "user_profiles") {
  id: ID! @wes_pk
}
```

### `@wes_pk`
**Location**: FIELD_DEFINITION  
**Purpose**: Designates the primary key field

**Rules**:
- At most one `@wes_pk` per table
- Primary key field must be `NonNull` (end with `!`)

```graphql
type User @wes_table {
  id: ID! @wes_pk        # ✓ Valid
  uuid: String @wes_pk   # ✗ Not NonNull
}
```

### `@wes_fk`
**Location**: FIELD_DEFINITION  
**Purpose**: Creates foreign key relationship

**Format**: `@wes_fk(ref: "Table.column")`

```graphql
type Account @wes_table {
  id: ID! @wes_pk
  org_id: ID! @wes_fk(ref: "Org.id")
  owner_id: ID! @wes_fk(ref: "User.id")
}
```

**Rules**:
- Referenced table and column must exist
- Field types should be compatible (same base scalar)

### `@wes_unique`
**Location**: FIELD_DEFINITION  
**Purpose**: Creates unique constraint on field

```graphql
type User @wes_table {
  id: ID! @wes_pk
  email: String! @wes_unique    # UNIQUE INDEX on email
  username: String! @wes_unique # UNIQUE INDEX on username
}
```

### `@wes_index`
**Location**: FIELD_DEFINITION | OBJECT  
**Purpose**: Creates database index

```graphql
# Field-level index
type User @wes_table {
  id: ID! @wes_pk
  email: String! @wes_index            # Simple index
  status: String! @wes_index(using: "hash")  # Hash index
}

# Table-level index (future: multi-column)
type Account @wes_table @wes_index(name: "idx_composite") {
  # Will support composite indexes in future versions
}
```

### `@wes_tenant`
**Location**: OBJECT  
**Purpose**: Multi-tenant table configuration

```graphql
type Account @wes_table @wes_tenant(by: "org_id") {
  id: ID! @wes_pk
  org_id: ID! @wes_fk(ref: "Org.id")    # Must exist as field
  name: String!
}
```

**Rules**:
- `by` field must exist on the same type
- Enables automatic tenant-aware RLS policy generation

### `@wes_default`
**Location**: FIELD_DEFINITION  
**Purpose**: Sets default value for column

```graphql
type User @wes_table {
  id: ID! @wes_pk
  created_at: DateTime! @wes_default(value: "now()")
  active: Boolean! @wes_default(value: "true")
  status: String! @wes_default(value: "pending")
}
```

## Type Mapping

Wesley maps GraphQL scalars to PostgreSQL types:

| GraphQL Type | PostgreSQL Type |
|--------------|-----------------|
| `ID`         | `uuid`          |
| `String`     | `text`          |
| `Int`        | `integer`       |
| `Float`      | `double precision` |
| `Boolean`    | `boolean`       |
| `DateTime`   | `timestamptz`   |
| `[T]`        | `<T>[]`         |

**Nullability**: `!` suffix makes column `NOT NULL`

## Generated IR Format

Wesley parses GraphQL schemas into this intermediate representation:

```typescript
type IR = {
  tables: Array<{
    name: string
    columns: Array<{
      name: string
      type: string              // PostgreSQL type
      nullable: boolean
      default?: string
      unique?: boolean
      directives: Record<string, any>
    }>
    primaryKey?: string
    foreignKeys: Array<{ 
      column: string
      refTable: string
      refColumn: string 
    }>
    indexes: Array<{ 
      columns: string[]
      name?: string
      using?: string 
    }>
    tenantBy?: string           // from @wes_tenant(by:"...")
    directives: Record<string, any>
  }>
}
```

## Validation Rules

Wesley validates directive usage and throws `PARSE_FAILED` errors on:

**Table-level**:
- Must have at least one field
- Table names must be unique
- `@wes_tenant(by: "field")` must reference existing column

**Primary Keys**:
- At most one `@wes_pk` per table
- Primary key field must be `NonNull` (end with `!`)

**Foreign Keys**:
- `@wes_fk(ref: "Table.column")` must point to existing table/column
- Field types should be compatible (same base scalar)

**General**:
- Directive arguments must match expected format
- No duplicate unique/index constraints on same column

## Example Schema

```graphql
type Organization @wes_table {
  id: ID! @wes_pk
  name: String! @wes_unique
  slug: String! @wes_unique @wes_index
  created_at: DateTime! @wes_default(value: "now()")
}

type Account @wes_table @wes_tenant(by: "org_id") {
  id: ID! @wes_pk
  org_id: ID! @wes_fk(ref: "Organization.id") @wes_index
  email: String! @wes_unique
  name: String!
  active: Boolean! @wes_default(value: "true")
  created_at: DateTime! @wes_default(value: "now()")
  updated_at: DateTime! @wes_default(value: "now()")
}

type Project @wes_table @wes_tenant(by: "org_id") {
  id: ID! @wes_pk
  org_id: ID! @wes_fk(ref: "Organization.id")
  account_id: ID! @wes_fk(ref: "Account.id") @wes_index
  name: String!
  status: String! @wes_default(value: "active") @wes_index
  created_at: DateTime! @wes_default(value: "now()")
}
```

## Migration Guide

### From Legacy Directives

```bash
# Automated migration (crude but effective)
sed -E -i '' \
  -e 's/@wesley_/@wes_/g' \
  -e 's/@table/@wes_table/g' \
  -e 's/@pk/@wes_pk/g' \
  -e 's/@fk\(/@wes_fk(/g' \
  -e 's/@unique/@wes_unique/g' \
  -e 's/@index/@wes_index/g' \
  -e 's/@tenant/@wes_tenant/g' \
  -e 's/@default/@wes_default/g' \
  $(git ls-files '*.graphql')
```

### Strict Mode

Enable `strictDirectives: true` in compiler options to reject all non-canonical directives:

```javascript
await compiler.compile(
  { sdl: schemaContent, flags: { strictDirectives: true } },
  { outDir: 'generated' }
);
```

## Implementation Notes

- **Namespace choice**: `@wes_` chosen for ergonomics (short, readable, low collision risk)
- **Backwards compatibility**: Aliases supported with deprecation warnings
- **Validation**: Strict validation prevents common configuration errors
- **Extensibility**: Directive registry allows easy addition of new directives

Future directives may include: `@wes_check`, `@wes_enum`, `@wes_json`, `@wes_generated`, etc.