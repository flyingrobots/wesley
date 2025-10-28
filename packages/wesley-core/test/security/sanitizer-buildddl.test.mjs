import { describe, test, expect } from 'vitest';
import { buildDDL, DDL_TEMPLATES, formatColumnDefs } from '../../src/domain/security/StandardSanitizer.mjs';

describe('🔧 StandardSanitizer.buildDDL', () => {
  test('builds ADD COLUMN with identifiers and validated type', () => {
    const sql = buildDDL(DDL_TEMPLATES.ADD_COLUMN, {
      table: 'users',
      column: 'is_active',
      type: 'boolean'
    });
    expect(sql).toBe('ALTER TABLE "users" ADD COLUMN "is_active" boolean');
  });

  test('builds CREATE INDEX with identifier list (array)', () => {
    const sql = buildDDL(DDL_TEMPLATES.CREATE_INDEX, {
      index: 'users_email_idx',
      table: 'users',
      columns: ['email', 'id']
    });
    expect(sql).toBe('CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email", "id")');
  });

  test('builds CREATE POLICY (USING) with roles and expression', () => {
    const sql = buildDDL(DDL_TEMPLATES.CREATE_POLICY_USING, {
      policy: 'p_users_owner_or_admin',
      table: 'users',
      operation: 'select',
      roles: ['PUBLIC'],
      using: "auth.uid() = user_id OR role = 'admin'"
    });
    expect(sql).toBe('CREATE POLICY "p_users_owner_or_admin" ON "users" FOR SELECT TO PUBLIC USING (auth.uid() = user_id OR role = \'admin\')');
  });

  test('builds CREATE TABLE with column_defs array (formatter helper)', () => {
    const defs = formatColumnDefs([
      '"id" uuid PRIMARY KEY',
      '"email" text NOT NULL'
    ]);
    const sql = buildDDL(DDL_TEMPLATES.CREATE_TABLE, {
      table: 'users',
      column_defs: defs
    });
    expect(sql).toBe('CREATE TABLE IF NOT EXISTS "users" ("id" uuid PRIMARY KEY, "email" text NOT NULL)');
  });

  test('builds INSERT policy WITH CHECK only', () => {
    const sql = buildDDL(DDL_TEMPLATES.CREATE_POLICY_WITH_CHECK, {
      policy: 'p_users_insert_owner',
      table: 'users',
      operation: 'insert',
      roles: ['authenticated'],
      check: 'auth.uid() = user_id'
    });
    expect(sql).toBe('CREATE POLICY "p_users_insert_owner" ON "users" FOR INSERT TO AUTHENTICATED WITH CHECK (auth.uid() = user_id)');
  });

  test('builds UPDATE policy USING + WITH CHECK', () => {
    const sql = buildDDL(DDL_TEMPLATES.CREATE_POLICY_USING_WITH_CHECK, {
      policy: 'p_users_update_owner',
      table: 'users',
      operation: 'update',
      roles: ['PUBLIC'],
      using: 'auth.uid() = user_id',
      check: 'auth.uid() = user_id'
    });
    expect(sql).toBe('CREATE POLICY "p_users_update_owner" ON "users" FOR UPDATE TO PUBLIC USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)');
  });

  test('roles normalization: special names case-insensitive + quote custom', () => {
    const sql1 = buildDDL(DDL_TEMPLATES.CREATE_POLICY_USING, {
      policy: 'p_mixed_roles',
      table: 'docs',
      operation: 'select',
      roles: ['Public', 'authenticated', 'custom_role'],
      using: 'auth.uid() = owner_id'
    });
    expect(sql1).toBe('CREATE POLICY "p_mixed_roles" ON "docs" FOR SELECT TO PUBLIC, AUTHENTICATED, "custom_role" USING (auth.uid() = owner_id)');

    const sql2 = buildDDL(DDL_TEMPLATES.CREATE_POLICY_USING, {
      policy: 'p_more_roles',
      table: 'docs',
      operation: 'select',
      roles: ['ANONYMOUS', 'Admin', 'role_x'],
      using: 'auth.uid() = owner_id'
    });
    expect(sql2).toBe('CREATE POLICY "p_more_roles" ON "docs" FOR SELECT TO ANONYMOUS, "Admin", "role_x" USING (auth.uid() = owner_id)');
  });

  test('throws on unresolved placeholders', () => {
    expect(() => buildDDL(DDL_TEMPLATES.CREATE_TABLE, { table: 'users' }))
      .toThrow(/Unresolved DDL placeholders: \{column_defs\}/);
  });
});
