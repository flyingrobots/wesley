import { describe, test, expect } from 'vitest';
import { buildDDL, DDL_TEMPLATES } from '../../src/domain/security/StandardSanitizer.mjs';

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

  test('builds CREATE POLICY with roles and expression', () => {
    const sql = buildDDL(DDL_TEMPLATES.CREATE_POLICY, {
      policy: 'p_users_owner_or_admin',
      table: 'users',
      operation: 'select',
      roles: ['PUBLIC'],
      expression: "auth.uid() = user_id OR role = 'admin'"
    });
    expect(sql).toBe('CREATE POLICY "p_users_owner_or_admin" ON "users" FOR SELECT TO PUBLIC USING (auth.uid() = user_id OR role = \'admin\')');
  });
});

