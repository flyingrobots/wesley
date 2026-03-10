/**
 * TranslateEnv — Schema introspection layer for the GraphQL→QIR translator.
 * Wraps the Wesley IR and provides query-time lookups for tables, columns,
 * relationships, directives, and alias generation.
 * Pure module (no Node built-ins).
 */

import { AliasAllocator } from './Nodes.mjs';
import { fieldTypeToPg } from '../typeMapping.mjs';

export class TranslateEnv {
  /**
   * @param {import('../WesleyIR.schema').WesleyIR} ir
   */
  constructor(ir) {
    /** @type {Map<string, object>} type name → table definition */
    this._tables = new Map();

    /** @type {Map<string, Map<string, object>>} type name → (field name → field def) */
    this._fields = new Map();

    /** @type {import('../WesleyIR.schema').Relationship[]} */
    this._relationships = ir.relationships || [];

    /** @type {Map<string, AliasAllocator>} prefix → allocator */
    this._allocators = new Map();

    for (const table of ir.tables) {
      this._tables.set(table.name, table);
      const fieldMap = new Map();
      for (const field of table.fields) {
        fieldMap.set(field.name, field);
      }
      this._fields.set(table.name, fieldMap);
    }
  }

  /**
   * Resolve a GraphQL type name to a PostgreSQL table name (lowercase).
   * @param {string} typeName — e.g., 'User', 'OrderItem'
   * @returns {string} — e.g., 'user', 'orderitem'
   */
  resolveTable(typeName) {
    if (!this._tables.has(typeName)) {
      throw new Error(`Unknown type '${typeName}': not found in IR tables`);
    }
    return typeName.toLowerCase();
  }

  /**
   * Resolve a field on a type to its column name and PostgreSQL type.
   * @param {string} typeName — e.g., 'User'
   * @param {string} fieldName — e.g., 'email'
   * @returns {{ column: string, pgType: string, field: object }}
   */
  resolveColumn(typeName, fieldName) {
    const fieldMap = this._fields.get(typeName);
    if (!fieldMap) throw new Error(`Unknown type '${typeName}': not found in IR tables`);
    const field = fieldMap.get(fieldName);
    if (!field) throw new Error(`Unknown field '${fieldName}' on type '${typeName}'`);
    return {
      column: field.name,
      pgType: fieldTypeToPg(field.type),
      field
    };
  }

  /**
   * Check whether a field on a type is a scalar (data column in the DB).
   * @param {string} typeName
   * @param {string} fieldName
   * @returns {boolean}
   */
  isScalar(typeName, fieldName) {
    const fieldMap = this._fields.get(typeName);
    if (!fieldMap) return false;
    return fieldMap.has(fieldName);
  }

  /**
   * Resolve a relation field (e.g., "user" on Order, "items" on Order).
   * Returns relation metadata or null if the field is scalar.
   *
   * Detection strategy:
   * - many-to-one (belongsTo): the current type has an FK field named `<fieldName>_id`
   *   pointing at another table.
   * - one-to-many (hasMany): another table has an FK pointing at this type.
   *   The field name (plural) is matched against the child table name heuristically.
   *
   * @param {string} typeName — the parent type, e.g., 'Order'
   * @param {string} fieldName — the relation field, e.g., 'user' or 'items'
   * @returns {{ kind: string, targetTable: string, fkField: string, targetPkField: string } | null}
   */
  resolveRelation(typeName, fieldName) {
    const fieldMap = this._fields.get(typeName);
    if (!fieldMap) return null;

    // 0. If the field name is a known scalar column, it's not a relation.
    if (fieldMap.has(fieldName)) return null;

    // 1. Check for belongsTo: does this type have a field named `<fieldName>_id` with an FK?
    const fkFieldName = `${fieldName}_id`;
    const fkField = fieldMap.get(fkFieldName);
    if (fkField && fkField.directives.fk) {
      return {
        kind: 'many-to-one',
        targetTable: fkField.directives.fk.targetTable,
        fkField: fkFieldName,
        targetPkField: fkField.directives.fk.targetField
      };
    }

    // 2. Check for hasMany: find a relationship where this type is the "from" side
    //    and the child table name matches the field name heuristically.
    for (const rel of this._relationships) {
      if (rel.from.table !== typeName) continue;
      if (rel.type !== 'one-to-many') continue;

      const childTable = rel.to.table;
      const childTableLower = childTable.toLowerCase();
      const fieldLower = fieldName.toLowerCase();
      const fieldSingular = fieldLower.replace(/s$/, '');

      // Heuristics for matching field name → child table:
      // 1. Exact: "orders" === "order" (table name)
      // 2. Singular: "orders" → "order" matches "order"
      // 3. Prefix: "items" → "item" is prefix of "orderitem"
      // 4. Reverse prefix: "orderitems" → "orderitem" starts with child table
      // 5. FK-assisted: if the child FK is `<parentType>_id` AND the field name
      //    is a plausible plural of the child table (child table contains the
      //    singular field, or field singular is a suffix of the child table name)
      const fkMatchesParent = rel.to.field === `${typeName.toLowerCase()}_id`;
      const nameMatch =
        childTableLower === fieldLower ||
        childTableLower === fieldSingular ||
        childTableLower.startsWith(fieldSingular) ||
        fieldLower.startsWith(childTableLower);

      // FK-assisted match: tighter — field singular must appear in child table name
      const fkAssistedMatch = fkMatchesParent && (
        childTableLower.includes(fieldSingular) ||
        fieldSingular.includes(childTableLower)
      );

      if (nameMatch || fkAssistedMatch) {
        return {
          kind: 'one-to-many',
          targetTable: childTable,
          fkField: rel.to.field,
          targetPkField: rel.from.field
        };
      }
    }

    return null;
  }

  /**
   * Get the primary key field name for a type.
   * @param {string} typeName
   * @returns {string | null}
   */
  pkField(typeName) {
    const fieldMap = this._fields.get(typeName);
    if (!fieldMap) return null;
    for (const [name, field] of fieldMap) {
      if (field.directives.pk) return name;
    }
    return null;
  }

  /**
   * Check if RLS is enabled on a type.
   * @param {string} typeName
   * @returns {boolean}
   */
  rlsEnabled(typeName) {
    const table = this._tables.get(typeName);
    if (!table) return false;
    return !!(table.directives.rls && table.directives.rls.enabled);
  }

  /**
   * Get the tenant isolation field for a type.
   * @param {string} typeName
   * @returns {string | null}
   */
  tenantField(typeName) {
    const table = this._tables.get(typeName);
    if (!table || !table.directives.tenant) return null;
    return table.directives.tenant.by || null;
  }

  /**
   * Get all field definitions for a type.
   * @param {string} typeName
   * @returns {Map<string, object>}
   */
  getFields(typeName) {
    return this._fields.get(typeName) || new Map();
  }

  /**
   * Get a table definition by type name.
   * @param {string} typeName
   * @returns {object | undefined}
   */
  getTable(typeName) {
    return this._tables.get(typeName);
  }

  /**
   * Generate a deterministic alias.
   * @param {string} [prefix='t'] — alias prefix
   * @returns {string} — e.g., 't0', 't1', 'j0'
   */
  nextAlias(prefix = 't') {
    if (!this._allocators.has(prefix)) {
      this._allocators.set(prefix, new AliasAllocator(prefix));
    }
    return this._allocators.get(prefix).next();
  }
}
