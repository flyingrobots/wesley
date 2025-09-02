/**
 * Wesley Configuration
 * Configurable thresholds and settings
 */

export default {
  // Scoring thresholds (0-100)
  thresholds: {
    // Schema Coverage Score thresholds
    scs: {
      excellent: 90,  // >= 90 is excellent coverage
      good: 75,       // >= 75 is good
      acceptable: 60, // >= 60 is acceptable
      poor: 40        // < 40 is poor
    },
    
    // Migration Risk Index thresholds
    mri: {
      low: 20,        // <= 20 is low risk
      medium: 50,     // <= 50 is medium risk
      high: 75,       // <= 75 is high risk
      critical: 100   // > 75 is critical risk
    },
    
    // Test Confidence Index thresholds
    tci: {
      excellent: 85,  // >= 85 is excellent test coverage
      good: 70,       // >= 70 is good
      acceptable: 50, // >= 50 is acceptable
      poor: 30        // < 30 is poor
    }
  },
  
  // Scoring weights for different aspects
  weights: {
    // SCS component weights
    scs: {
      sql: 0.3,       // SQL generation weight
      typescript: 0.25, // TypeScript generation weight
      zod: 0.2,       // Zod schema weight
      tests: 0.15,    // Test generation weight
      docs: 0.1       // Documentation weight
    },
    
    // MRI risk factor weights
    mri: {
      dropTable: 100,    // Dropping a table
      dropColumn: 80,    // Dropping a column
      alterType: 60,     // Altering column type
      addNotNull: 40,    // Adding NOT NULL without default
      renameTable: 30,   // Renaming table
      renameColumn: 25,  // Renaming column
      createIndex: 10,   // Creating index (blocking)
      addColumn: 5       // Adding nullable column
    },
    
    // TCI test type weights
    tci: {
      unitTests: 0.3,      // Unit test coverage
      integrationTests: 0.4, // Integration test coverage
      pgTAPTests: 0.2,     // pgTAP database tests
      e2eTests: 0.1        // End-to-end tests
    }
  },
  
  // Generation options
  generation: {
    // SQL generation
    sql: {
      generateSQL: true,
      enableRLS: true,
      forceRLS: true,
      generateComments: true,
      useTransactions: true
    },
    
    // TypeScript generation
    typescript: {
      generateTypes: true,
      generateZod: true,
      generateClient: true,
      strictNullChecks: true
    },
    
    // Test generation
    tests: {
      generatePgTAP: true,
      generateUnit: true,
      includeNegativeTests: true,
      includeSensitiveTests: true,
      testTimeout: 30000
    },
    
    // RPC generation
    rpc: {
      paramStrategy: 'jsonb', // 'jsonb' | 'discrete' | 'composite'
      generateCRUD: true,
      securityDefiner: true,
      volatility: 'VOLATILE'
    }
  },
  
  // Naming strategies
  naming: {
    strategy: 'snake_case', // 'preserve' | 'snake_case' | 'lower' | 'upper'
    tablePrefix: '',
    indexPrefix: 'idx_',
    constraintPrefix: '',
    policyPrefix: 'policy_'
  },
  
  // Validation rules
  validation: {
    requirePrimaryKey: true,
    requireTimestamps: false,
    requireOwnership: false,
    requireRLS: false,
    allowEmptyTables: false,
    maxTableNameLength: 63,
    maxColumnNameLength: 63
  },
  
  // Feature flags
  features: {
    enableHolmes: true,      // Enable Holmes evidence tracking
    enableWatson: true,      // Enable Watson analytics
    enableDeduplication: true, // Enable index deduplication
    enableAutoMigration: false, // Auto-generate migrations
    enableDryRun: true       // Enable dry-run mode by default
  },
  
  // Output paths
  paths: {
    output: './generated',
    sql: './generated/sql',
    typescript: './generated/typescript',
    tests: './generated/tests',
    migrations: './migrations',
    evidence: './evidence'
  }
};