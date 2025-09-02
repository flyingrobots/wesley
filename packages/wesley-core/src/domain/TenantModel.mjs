/**
 * Tenant Model Support
 * Implements multi-tenancy patterns for Wesley
 */

export class TenantModel {
  constructor(schema) {
    this.schema = schema;
    this.tenantTables = new Map();
    this.ownerTables = new Map();
    this.membershipTable = null;
    this.orgTable = null;
  }
  
  /**
   * Analyze schema for tenant/owner patterns
   */
  analyze() {
    for (const table of this.schema.getTables()) {
      const tenantDirective = table.directives?.['@tenant'];
      const ownerDirective = table.directives?.['@owner'];
      
      if (tenantDirective) {
        this.tenantTables.set(table.name, {
          table,
          tenantColumn: tenantDirective.by || tenantDirective.column || 'org_id',
          policies: this.determinePolicies(table, tenantDirective)
        });
      }
      
      if (ownerDirective) {
        this.ownerTables.set(table.name, {
          table,
          ownerColumn: ownerDirective.column || ownerDirective.by || 'created_by',
          policies: this.determineOwnerPolicies(table, ownerDirective)
        });
      }
      
      // Detect membership table pattern
      if (this.isMembershipTable(table)) {
        this.membershipTable = table;
      }
      
      // Detect org table pattern
      if (this.isOrgTable(table)) {
        this.orgTable = table;
      }
    }
    
    return {
      hasTenancy: this.tenantTables.size > 0,
      hasOwnership: this.ownerTables.size > 0,
      hasMembership: this.membershipTable !== null,
      tenantTables: this.tenantTables,
      ownerTables: this.ownerTables
    };
  }
  
  /**
   * Check if table matches membership pattern
   */
  isMembershipTable(table) {
    const name = table.name.toLowerCase();
    if (!name.includes('member')) return false;
    
    const fields = table.getFields();
    const hasUserId = fields.some(f => 
      f.name === 'user_id' || f.name === 'userId'
    );
    const hasOrgId = fields.some(f => 
      f.name === 'org_id' || f.name === 'orgId' || 
      f.name === 'tenant_id' || f.name === 'tenantId'
    );
    const hasRole = fields.some(f => 
      f.name === 'role' || f.name === 'permission'
    );
    
    return hasUserId && hasOrgId && hasRole;
  }
  
  /**
   * Check if table is the org/tenant table
   */
  isOrgTable(table) {
    const name = table.name.toLowerCase();
    return name === 'org' || name === 'orgs' || 
           name === 'organization' || name === 'organizations' ||
           name === 'tenant' || name === 'tenants';
  }
  
  /**
   * Determine tenant policies needed
   */
  determinePolicies(table, directive) {
    const policies = {
      select: true,
      insert: true,
      update: true,
      delete: false
    };
    
    // Override with directive settings
    if (directive.policies) {
      Object.assign(policies, directive.policies);
    }
    
    // Check for role-based delete
    if (directive.allowDelete) {
      policies.delete = directive.allowDelete; // Could be role array
    }
    
    return policies;
  }
  
  /**
   * Determine owner policies needed
   */
  determineOwnerPolicies(table, directive) {
    return {
      select: directive.select ?? 'owner_or_shared',
      insert: directive.insert ?? 'owner_must_match',
      update: directive.update ?? 'owner_only',
      delete: directive.delete ?? 'owner_only'
    };
  }
  
  /**
   * Generate helper view for membership lookups
   */
  generateMembershipView() {
    if (!this.membershipTable) return null;
    
    const viewName = 'wesley_user_orgs';
    const table = this.membershipTable.name;
    
    return `-- Fast membership lookup view
CREATE OR REPLACE VIEW ${viewName} AS
  SELECT 
    m.user_id,
    m.org_id,
    m.role
  FROM ${table} m
  WHERE m.deleted_at IS NULL;  -- Assuming soft deletes

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_${table}_user_org 
  ON ${table}(user_id, org_id) 
  WHERE deleted_at IS NULL;`;
  }
  
  /**
   * Generate tenant RLS policies
   */
  generateTenantPolicies(tableName, config) {
    const policies = [];
    const table = config.table;
    const tenantColumn = config.tenantColumn;
    const uid = table.uid || tableName.toLowerCase();
    
    // SELECT: User can read docs in their tenant
    if (config.policies.select) {
      policies.push(`
-- SELECT: User can read ${tableName} in their tenant
DROP POLICY IF EXISTS "policy_${tableName}_tenant_select_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_tenant_select_${uid}" ON "${tableName}"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wesley_user_orgs uo
      WHERE uo.user_id = auth.uid() 
        AND uo.org_id = "${tableName}".${tenantColumn}
    )
  );`);
    }
    
    // INSERT: User can insert into their tenant
    if (config.policies.insert) {
      const ownerCheck = this.getOwnerColumnCheck(table);
      policies.push(`
-- INSERT: User can insert ${tableName} into their tenant
DROP POLICY IF EXISTS "policy_${tableName}_tenant_insert_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_tenant_insert_${uid}" ON "${tableName}"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wesley_user_orgs uo
      WHERE uo.user_id = auth.uid() 
        AND uo.org_id = "${tableName}".${tenantColumn}
    )${ownerCheck ? `
    AND ${ownerCheck}` : ''}
  );`);
    }
    
    // UPDATE: User can update within their tenant
    if (config.policies.update) {
      policies.push(`
-- UPDATE: User can update ${tableName} in their tenant
DROP POLICY IF EXISTS "policy_${tableName}_tenant_update_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_tenant_update_${uid}" ON "${tableName}"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM wesley_user_orgs uo
      WHERE uo.user_id = auth.uid() 
        AND uo.org_id = "${tableName}".${tenantColumn}
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wesley_user_orgs uo
      WHERE uo.user_id = auth.uid() 
        AND uo.org_id = "${tableName}".${tenantColumn}
    )
  );`);
    }
    
    // DELETE: Role-based (owners/admins only by default)
    if (config.policies.delete) {
      const allowedRoles = Array.isArray(config.policies.delete) 
        ? config.policies.delete 
        : ['owner', 'admin'];
        
      policies.push(`
-- DELETE: Only ${allowedRoles.join('/')} can delete ${tableName}
DROP POLICY IF EXISTS "policy_${tableName}_tenant_delete_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_tenant_delete_${uid}" ON "${tableName}"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM wesley_user_orgs uo
      WHERE uo.user_id = auth.uid() 
        AND uo.org_id = "${tableName}".${tenantColumn}
        AND uo.role = ANY(ARRAY[${allowedRoles.map(r => `'${r}'`).join(',')}])
    )
  );`);
    }
    
    return policies.join('\n');
  }
  
  /**
   * Get owner column check for INSERT
   */
  getOwnerColumnCheck(table) {
    // Check for created_by or owner field
    const ownerField = table.getFields().find(f => 
      f.name === 'created_by' || 
      f.name === 'createdBy' || 
      f.name === 'owner_id' ||
      f.name === 'ownerId'
    );
    
    if (ownerField) {
      return `"${table.name}".${ownerField.name} = auth.uid()`;
    }
    
    return null;
  }
  
  /**
   * Generate SECURITY DEFINER helper functions
   */
  generateHelperFunctions() {
    const functions = [];
    
    // Membership check function
    functions.push(`
-- Check if user is member of org
CREATE OR REPLACE FUNCTION wesley.is_member_of(p_org_id UUID)
RETURNS BOOLEAN 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM wesley_user_orgs
    WHERE user_id = auth.uid() AND org_id = p_org_id
  )
$$;`);
    
    // Role check function
    functions.push(`
-- Check if user has role in org
CREATE OR REPLACE FUNCTION wesley.has_role_in(p_org_id UUID, p_roles TEXT[])
RETURNS BOOLEAN 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM wesley_user_orgs
    WHERE user_id = auth.uid() 
      AND org_id = p_org_id
      AND role = ANY(p_roles)
  )
$$;`);
    
    // Owner check function
    functions.push(`
-- Check if user owns resource
CREATE OR REPLACE FUNCTION wesley.is_owner(p_created_by UUID)
RETURNS BOOLEAN 
LANGUAGE sql 
IMMUTABLE
AS $$
  SELECT p_created_by = auth.uid()
$$;`);
    
    return functions.join('\n\n');
  }
  
  /**
   * Generate complete tenant model SQL
   */
  generateSQL() {
    const parts = [];
    
    // Generate membership view
    const membershipView = this.generateMembershipView();
    if (membershipView) {
      parts.push(membershipView);
    }
    
    // Generate helper functions
    parts.push(this.generateHelperFunctions());
    
    // Generate policies for each tenant table
    for (const [tableName, config] of this.tenantTables) {
      parts.push(this.generateTenantPolicies(tableName, config));
      
      // Enable RLS
      parts.push(`
-- Enable RLS for ${tableName}
ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;`);
    }
    
    // Generate required indexes
    parts.push(this.generateRequiredIndexes());
    
    return parts.join('\n\n');
  }
  
  /**
   * Generate indexes needed for policy performance
   */
  generateRequiredIndexes() {
    const indexes = [];
    
    // Index membership table if exists
    if (this.membershipTable) {
      const table = this.membershipTable.name;
      indexes.push(`
-- Indexes for membership lookups
CREATE INDEX IF NOT EXISTS idx_${table}_user_id ON ${table}(user_id);
CREATE INDEX IF NOT EXISTS idx_${table}_org_id ON ${table}(org_id);
CREATE INDEX IF NOT EXISTS idx_${table}_user_org ON ${table}(user_id, org_id);`);
    }
    
    // Index tenant columns
    for (const [tableName, config] of this.tenantTables) {
      const col = config.tenantColumn;
      indexes.push(`
-- Index for ${tableName} tenant column
CREATE INDEX IF NOT EXISTS idx_${tableName}_${col} ON "${tableName}"(${col});`);
      
      // If there's an owner column, index that too
      const ownerCol = this.findOwnerColumn(config.table);
      if (ownerCol) {
        indexes.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${ownerCol} ON "${tableName}"(${ownerCol});`);
      }
    }
    
    return indexes.join('\n');
  }
  
  /**
   * Find owner column in table
   */
  findOwnerColumn(table) {
    const field = table.getFields().find(f => 
      f.name === 'created_by' || 
      f.name === 'createdBy' || 
      f.name === 'owner_id' ||
      f.name === 'ownerId'
    );
    
    return field?.name;
  }
}