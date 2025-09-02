/**
 * Wesley Configuration
 * Default settings for schema generation and validation
 */

export default {
  // Version of this config format
  version: '1.0.0',
  
  // Scoring thresholds for production readiness
  thresholds: {
    scs: 0.8,  // Schema Coverage Score - 80% required
    tci: 0.7,  // Test Confidence Index - 70% required
    mri: 0.4   // Migration Risk Index - max 40% risk allowed
  },
  
  // Default weights for directives when not specified
  weights: {
    defaults: {
      '@primaryKey': 10,
      '@critical': 10,
      '@sensitive': 9,
      '@foreignKey': 8,
      '@unique': 8,
      '@pii': 8,
      '@index': 5,
      'default': 3  // Default field weight
    },
    
    // Infer weights from field names
    inference: {
      'password': 10,
      'password_hash': 10,
      'secret': 9,
      'token': 9,
      'api_key': 9,
      'email': 8,
      'phone': 8,
      'ssn': 10,
      'credit_card': 10,
      'id': 7,
      'created_at': 3,
      'updated_at': 3,
      'theme': 2,
      'preference': 2
    }
  },
  
  // Output paths
  paths: {
    output: 'out',
    migrations: 'db/migrations',
    tests: 'tests',
    bundle: '.wesley'
  },
  
  // Generator settings
  generators: {
    sql: {
      enabled: true,
      dialect: 'postgresql',
      version: '15'
    },
    typescript: {
      enabled: true,
      strict: true
    },
    zod: {
      enabled: true
    },
    tests: {
      enabled: true,
      framework: 'pgtap',
      includePerformance: true,
      includeRLS: true
    },
    rpc: {
      enabled: true,
      securityDefiner: true
    }
  },
  
  // Security settings
  security: {
    // Enforce constraints on sensitive fields
    enforcePasswordConstraints: true,
    passwordMinLength: 60, // bcrypt hash length
    
    // Require RLS for tables with PII
    requireRLSForPII: true,
    
    // Block generation if security issues found
    blockOnSecurityIssues: true
  },
  
  // Migration settings
  migrations: {
    // Safety checks
    requireBackup: true,
    allowDataLoss: false,
    maxRiskScore: 0.4,
    
    // Naming
    namePattern: 'YYYYMMDD_HHmmss',
    autoName: true
  },
  
  // CI/CD settings
  ci: {
    // Fail CI if thresholds not met
    failOnThresholds: true,
    
    // Output formats
    outputFormat: ['console', 'json', 'junit'],
    
    // Artifact validation
    validateBundles: true,
    schemasPath: './schemas'
  },
  
  // Supabase integration
  supabase: {
    enabled: true,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    
    // Feature flags
    features: {
      rls: true,
      realtime: true,
      storage: true,
      edge: true
    }
  },
  
  // Development settings
  development: {
    watch: true,
    verbose: true,
    prettify: true
  }
}