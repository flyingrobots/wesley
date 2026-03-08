/**
 * Shared GraphQL ↔ PostgreSQL type mapping.
 *
 * The canonical IR uses GraphQL scalar names (ID, String, Int, etc.).
 * Generators that emit SQL need to map these back to PostgreSQL types.
 * This module is the single source of truth for that mapping.
 */

export const GQL_TO_PG = {
  'ID': 'uuid',
  'UUID': 'uuid',
  'String': 'text',
  'Int': 'integer',
  'Float': 'double precision',
  'Boolean': 'boolean',
  'DateTime': 'timestamptz',
  'Date': 'date',
  'Time': 'time with time zone',
  'JSON': 'jsonb',
  'Decimal': 'numeric',
  'BigInt': 'bigint'
};

export const PG_TO_GQL = {
  'uuid': 'ID',
  'text': 'String',
  'integer': 'Int',
  'double precision': 'Float',
  'boolean': 'Boolean',
  'timestamptz': 'DateTime',
  'date': 'Date',
  'time with time zone': 'Time',
  'jsonb': 'JSON',
  'numeric': 'Decimal',
  'bigint': 'BigInt'
};

/**
 * Convert a structured FieldType to a PostgreSQL type string.
 * @param {{ base: string, isList: boolean }} fieldType
 * @returns {string} e.g. "uuid", "text[]"
 */
export function fieldTypeToPg(fieldType) {
  const pgBase = GQL_TO_PG[fieldType.base] || 'text';
  return fieldType.isList ? `${pgBase}[]` : pgBase;
}

/**
 * Convert a GraphQL scalar name to a PostgreSQL type string.
 * @param {string} gqlScalar
 * @returns {string}
 */
export function gqlScalarToPg(gqlScalar) {
  return GQL_TO_PG[gqlScalar] || 'text';
}
