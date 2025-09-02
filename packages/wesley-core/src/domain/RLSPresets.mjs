/**
 * RLS Policy Presets
 * Common security patterns as reusable presets
 */

export class RLSPresets {
  constructor() {
    this.presets = new Map();
    this.initializePresets();
  }
  
  /**
   * Initialize built-in presets
   */
  initializePresets() {
    // Owner-only access pattern
    this.register('owner', {
      description: 'Owner-only access to resources',
      requires: ['owner_column'],
      policies: {
        select: 'auth.uid() = {owner_column}',
        insert: 'auth.uid() = {owner_column}',
        update: 'auth.uid() = {owner_column}',
        delete: 'auth.uid() = {owner_column}'
      },
      helperFunctions: [],
      indexes: ['{owner_column}']
    });
    
    // Tenant isolation pattern
    this.register('tenant', {
      description: 'Tenant-scoped access with membership check',
      requires: ['tenant_column', 'membership_table'],
      policies: {
        select: 'wesley.is_member_of({tenant_column})',
        insert: 'wesley.is_member_of({tenant_column})',
        update: 'wesley.is_member_of({tenant_column})',
        delete: 'wesley.has_role_in({tenant_column}, ARRAY[\'owner\', \'admin\'])'
      },
      helperFunctions: [
        {
          name: 'is_member_of',
          sql: `CREATE OR REPLACE FUNCTION wesley.is_member_of(p_org_id UUID)
                RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
                  SELECT EXISTS (
                    SELECT 1 FROM {membership_table}
                    WHERE user_id = auth.uid() AND org_id = p_org_id
                  )
                $$;`
        },
        {
          name: 'has_role_in',
          sql: `CREATE OR REPLACE FUNCTION wesley.has_role_in(p_org_id UUID, p_roles TEXT[])
                RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
                  SELECT EXISTS (
                    SELECT 1 FROM {membership_table}
                    WHERE user_id = auth.uid() 
                      AND org_id = p_org_id
                      AND role = ANY(p_roles)
                  )
                $$;`
        }
      ],
      indexes: ['{tenant_column}'],
      views: [
        {
          name: 'wesley_user_orgs',
          sql: `CREATE OR REPLACE VIEW wesley_user_orgs AS
                SELECT user_id, org_id, role 
                FROM {membership_table}
                WHERE deleted_at IS NULL;`
        }
      ]
    });
    
    // Public read, owner write pattern
    this.register('public-read', {
      description: 'Public read access, owner-only write',
      requires: ['owner_column'],
      policies: {
        select: 'true',
        insert: 'auth.uid() = {owner_column}',
        update: 'auth.uid() = {owner_column}',
        delete: 'auth.uid() = {owner_column}'
      },
      helperFunctions: [],
      indexes: ['{owner_column}']
    });
    
    // Authenticated-only pattern
    this.register('authenticated', {
      description: 'Authenticated users only',
      requires: [],
      policies: {
        select: 'auth.uid() IS NOT NULL',
        insert: 'auth.uid() IS NOT NULL',
        update: 'auth.uid() IS NOT NULL',
        delete: 'auth.uid() IS NOT NULL'
      },
      helperFunctions: [],
      indexes: []
    });
    
    // Admin-only pattern
    this.register('admin-only', {
      description: 'Admin role required for all operations',
      requires: ['membership_table'],
      policies: {
        select: 'wesley.is_admin()',
        insert: 'wesley.is_admin()',
        update: 'wesley.is_admin()',
        delete: 'wesley.is_admin()'
      },
      helperFunctions: [
        {
          name: 'is_admin',
          sql: `CREATE OR REPLACE FUNCTION wesley.is_admin()
                RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
                  SELECT EXISTS (
                    SELECT 1 FROM {membership_table}
                    WHERE user_id = auth.uid() 
                      AND role IN ('admin', 'owner')
                  )
                $$;`
        }
      ],
      indexes: []
    });
    
    // Soft delete aware pattern
    this.register('soft-delete', {
      description: 'Respects soft deletes in all queries',
      requires: ['deleted_at_column'],
      policies: {
        select: '{deleted_at_column} IS NULL',
        insert: 'true',
        update: '{deleted_at_column} IS NULL',
        delete: 'false' // Prevent hard deletes
      },
      helperFunctions: [],
      indexes: [
        {
          columns: ['{deleted_at_column}'],
          where: '{deleted_at_column} IS NULL'
        }
      ]
    });
    
    // Time-based access pattern
    this.register('time-window', {
      description: 'Access limited to time window',
      requires: ['start_column', 'end_column'],
      policies: {
        select: 'NOW() BETWEEN {start_column} AND {end_column}',
        insert: 'NOW() BETWEEN {start_column} AND {end_column}',
        update: 'NOW() BETWEEN {start_column} AND {end_column}',
        delete: 'false'
      },
      helperFunctions: [],
      indexes: ['{start_column}', '{end_column}']
    });
    
    // Hierarchical organization pattern
    this.register('hierarchical', {
      description: 'Access to org and all child orgs',
      requires: ['org_column', 'org_hierarchy_table'],
      policies: {
        select: 'wesley.in_org_tree({org_column})',
        insert: 'wesley.in_org_tree({org_column})',
        update: 'wesley.in_org_tree({org_column})',
        delete: 'wesley.is_org_admin({org_column})'
      },
      helperFunctions: [
        {
          name: 'in_org_tree',
          sql: `CREATE OR REPLACE FUNCTION wesley.in_org_tree(p_org_id UUID)
                RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
                  WITH RECURSIVE org_tree AS (
                    SELECT org_id FROM {membership_table}
                    WHERE user_id = auth.uid()
                    UNION ALL
                    SELECT c.id FROM {org_hierarchy_table} c
                    JOIN org_tree p ON c.parent_id = p.org_id
                  )
                  SELECT p_org_id IN (SELECT org_id FROM org_tree)
                $$;`
        },
        {
          name: 'is_org_admin',
          sql: `CREATE OR REPLACE FUNCTION wesley.is_org_admin(p_org_id UUID)
                RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
                  SELECT EXISTS (
                    SELECT 1 FROM {membership_table}
                    WHERE user_id = auth.uid() 
                      AND org_id = p_org_id
                      AND role IN ('admin', 'owner')
                  )
                $$;`
        }
      ],
      indexes: ['{org_column}']
    });
  }
  
  /**
   * Register a custom preset
   */
  register(name, definition) {
    this.presets.set(name, definition);
  }
  
  /**
   * Get a preset by name
   */
  get(name) {
    return this.presets.get(name);
  }
  
  /**
   * Check if preset exists
   */
  has(name) {
    return this.presets.has(name);
  }
  
  /**
   * Apply a preset to a table
   */
  apply(presetName, table, options = {}) {
    const preset = this.get(presetName);
    if (!preset) {
      throw new Error(`Unknown RLS preset: ${presetName}`);
    }
    
    // Validate required fields
    for (const required of preset.requires) {
      if (!options[required]) {
        throw new Error(`Preset '${presetName}' requires option: ${required}`);
      }
    }
    
    // Replace placeholders in policies
    const policies = {};
    for (const [operation, expression] of Object.entries(preset.policies)) {
      policies[operation] = this.replacePlaceholders(expression, options);
    }
    
    // Replace placeholders in helper functions
    const helperFunctions = preset.helperFunctions.map(func => ({
      ...func,
      sql: this.replacePlaceholders(func.sql, options)
    }));
    
    // Replace placeholders in views
    const views = (preset.views || []).map(view => ({
      ...view,
      sql: this.replacePlaceholders(view.sql, options)
    }));
    
    // Generate indexes with placeholders replaced
    const indexes = preset.indexes.map(index => {
      if (typeof index === 'string') {
        return this.replacePlaceholders(index, options);
      }
      return {
        columns: index.columns.map(col => this.replacePlaceholders(col, options)),
        where: index.where ? this.replacePlaceholders(index.where, options) : null
      };
    });
    
    return {
      policies,
      helperFunctions,
      views,
      indexes,
      description: preset.description
    };
  }
  
  /**
   * Replace placeholders in template strings
   */
  replacePlaceholders(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      if (key in values) {
        return values[key];
      }
      throw new Error(`Missing value for placeholder: ${key}`);
    });
  }
  
  /**
   * Generate SQL for a preset application
   */
  generateSQL(presetName, tableName, options = {}) {
    const applied = this.apply(presetName, tableName, options);
    const statements = [];
    
    // Generate helper functions first
    for (const func of applied.helperFunctions) {
      statements.push(func.sql);
    }
    
    // Generate views
    for (const view of applied.views) {
      statements.push(view.sql);
    }
    
    // Enable RLS
    statements.push(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`);
    statements.push(`ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;`);
    
    // Generate policies
    for (const [operation, expression] of Object.entries(applied.policies)) {
      const policyName = `policy_${tableName}_${presetName}_${operation}`;
      
      statements.push(`DROP POLICY IF EXISTS "${policyName}" ON "${tableName}";`);
      
      let policySQL = `CREATE POLICY "${policyName}" ON "${tableName}"\n  FOR ${operation.toUpperCase()}`;
      
      if (operation === 'select' || operation === 'delete') {
        policySQL += `\n  USING (${expression});`;
      } else if (operation === 'insert') {
        policySQL += `\n  WITH CHECK (${expression});`;
      } else if (operation === 'update') {
        policySQL += `\n  USING (${expression})\n  WITH CHECK (${expression});`;
      }
      
      statements.push(policySQL);
    }
    
    // Generate indexes
    for (const index of applied.indexes) {
      if (typeof index === 'string') {
        statements.push(
          `CREATE INDEX IF NOT EXISTS "idx_${tableName}_${index}" ON "${tableName}" ("${index}");`
        );
      } else {
        const indexName = `idx_${tableName}_${index.columns.join('_')}`;
        let indexSQL = `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${tableName}" (${index.columns.map(c => `"${c}"`).join(', ')})`;
        if (index.where) {
          indexSQL += ` WHERE ${index.where}`;
        }
        indexSQL += ';';
        statements.push(indexSQL);
      }
    }
    
    return statements.join('\n\n');
  }
  
  /**
   * Generate tests for a preset application
   */
  generateTests(presetName, tableName, options = {}) {
    const applied = this.apply(presetName, tableName, options);
    const tests = [];
    
    // Test policy existence
    tests.push(`
-- Test: ${presetName} policies exist for ${tableName}
SELECT has_table_privilege('${tableName}', 'SELECT');
SELECT has_table_privilege('${tableName}', 'INSERT');
SELECT has_table_privilege('${tableName}', 'UPDATE');
SELECT has_table_privilege('${tableName}', 'DELETE');
`);
    
    // Test specific preset behaviors
    switch (presetName) {
      case 'owner':
        tests.push(`
-- Test: Owner can access their records
SET LOCAL request.jwt.claim.sub TO 'owner_user_id';
SELECT lives_ok(
  $$SELECT * FROM ${tableName} WHERE ${options.owner_column} = 'owner_user_id'$$,
  'Owner can select their records'
);

-- Test: Non-owner cannot access
SET LOCAL request.jwt.claim.sub TO 'other_user_id';
SELECT is_empty(
  $$SELECT * FROM ${tableName} WHERE ${options.owner_column} = 'owner_user_id'$$,
  'Non-owner cannot see other records'
);`);
        break;
        
      case 'tenant':
        tests.push(`
-- Test: Member can access tenant resources
SET LOCAL request.jwt.claim.sub TO 'member_user_id';
SELECT lives_ok(
  $$SELECT * FROM ${tableName} WHERE ${options.tenant_column} = 'test_org_id'$$,
  'Member can access tenant resources'
);

-- Test: Non-member cannot access
SET LOCAL request.jwt.claim.sub TO 'non_member_user_id';
SELECT is_empty(
  $$SELECT * FROM ${tableName} WHERE ${options.tenant_column} = 'test_org_id'$$,
  'Non-member cannot access tenant resources'
);`);
        break;
        
      case 'public-read':
        tests.push(`
-- Test: Anonymous can read
SET LOCAL request.jwt.claim.sub TO NULL;
SELECT lives_ok(
  $$SELECT * FROM ${tableName}$$,
  'Anonymous users can read'
);

-- Test: Anonymous cannot write
SELECT throws_ok(
  $$INSERT INTO ${tableName} DEFAULT VALUES$$,
  'new row violates row-level security policy',
  'Anonymous cannot insert'
);`);
        break;
    }
    
    return tests.join('\n');
  }
  
  /**
   * List all available presets
   */
  list() {
    return Array.from(this.presets.entries()).map(([name, preset]) => ({
      name,
      description: preset.description,
      requires: preset.requires
    }));
  }
}