/**
 * Wesley IR (Intermediate Representation) Schema
 * This defines the structure of the JSON that represents a parsed GraphQL schema
 * with Wesley directives processed and resolved.
 */

export interface WesleyIR {
  version: "1.0.0";
  metadata: {
    sourceHash: string;      // SHA of original GraphQL schema
    generatedAt: string;     // ISO timestamp
    schemaName?: string;     // Optional schema name
  };
  tables: Table[];
  enums?: Enum[];
  scalars?: CustomScalar[];
  relationships: Relationship[];
}

export interface Table {
  name: string;              // Table name (from GraphQL type name)
  description?: string;      // GraphQL description comment
  directives: TableDirectives;
  fields: Field[];
  indexes: Index[];          // Computed from fields + directives
  constraints: Constraint[]; // Computed from relationships + directives
}

export interface TableDirectives {
  table: boolean;           // Has @table directive
  rls?: RLSConfig;          // @rls(enable: true, policies: [...])
  tenant?: TenantConfig;    // @tenant(by: "org_id")
  audit?: boolean;          // @audit - adds created_at, updated_at, etc.
  softDelete?: boolean;     // @softDelete - adds deleted_at
}

export interface Field {
  name: string;
  type: FieldType;
  nullable: boolean;        // Can the field be null?
  directives: FieldDirectives;
  description?: string;
}

export interface FieldType {
  base: ScalarType | string; // Either built-in scalar or custom type reference
  isList: boolean;           // Is it an array? [Type]
  listItemNullable?: boolean;// Can list items be null? [Type!] vs [Type]
}

export type ScalarType = 
  | "ID"
  | "String" 
  | "Int" 
  | "Float" 
  | "Boolean"
  | "DateTime"
  | "Date"
  | "Time"
  | "JSON"
  | "UUID"
  | "Decimal"
  | "BigInt";

export interface FieldDirectives {
  pk?: boolean;              // @pk - primary key
  unique?: boolean;          // @unique
  index?: boolean;           // @index
  default?: DefaultValue;    // @default(value: "...", sql: true)
  check?: string;            // @check(expr: "price > 0")
  fk?: ForeignKey;           // @fk(ref: "Table.field", onDelete: CASCADE)
  computed?: ComputedField;  // @computed(expr: "...", stored: true)
}

export interface DefaultValue {
  value: any;                // The default value
  isSQL?: boolean;           // Is it a SQL expression like "now()" vs a literal?
}

export interface ForeignKey {
  targetTable: string;
  targetField: string;
  onDelete?: "CASCADE" | "RESTRICT" | "SET NULL" | "SET DEFAULT";
  onUpdate?: "CASCADE" | "RESTRICT" | "SET NULL" | "SET DEFAULT";
}

export interface ComputedField {
  expression: string;        // SQL expression
  stored: boolean;           // STORED vs VIRTUAL
}

export interface Relationship {
  type: "one-to-one" | "one-to-many" | "many-to-many";
  from: {
    table: string;
    field: string;
  };
  to: {
    table: string;
    field: string;
  };
  through?: {               // For many-to-many
    table: string;
    fromField: string;
    toField: string;
  };
}

export interface Index {
  name: string;
  table: string;
  fields: string[];
  unique: boolean;
  where?: string;           // Partial index condition
  using?: "btree" | "hash" | "gin" | "gist";
}

export interface Constraint {
  name: string;
  type: "unique" | "check" | "foreign_key" | "primary_key";
  table: string;
  definition: string;       // SQL definition
}

export interface RLSConfig {
  enable: boolean;
  policies?: RLSPolicy[];
  defaultPolicy?: "permissive" | "restrictive";
}

export interface RLSPolicy {
  name: string;
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
  check?: string;           // CHECK expression for INSERT/UPDATE
  using?: string;           // USING expression for SELECT/UPDATE/DELETE
  role?: string;            // Target role (default: public)
}

export interface TenantConfig {
  field: string;            // Field used for tenant isolation (e.g., "org_id")
  global?: boolean;         // Allow global/shared records
}

export interface Enum {
  name: string;
  values: string[];
  description?: string;
}

export interface CustomScalar {
  name: string;
  sqlType: string;          // PostgreSQL type to use
  description?: string;
}