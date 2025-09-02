/**
 * Configuration Loader
 * Loads and validates Wesley configuration
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ConfigLoader {
  constructor() {
    this.defaultConfig = null;
    this.userConfig = null;
    this.mergedConfig = null;
  }
  
  /**
   * Load configuration from default and user files
   */
  async load(configPath = null) {
    // Load default config
    const defaultPath = resolve(__dirname, '../../wesley.config.mjs');
    if (existsSync(defaultPath)) {
      this.defaultConfig = (await import(defaultPath)).default;
    } else {
      this.defaultConfig = this.getBuiltInDefaults();
    }
    
    // Load user config if provided
    if (configPath && existsSync(configPath)) {
      this.userConfig = (await import(configPath)).default;
    } else {
      // Try to find wesley.config.mjs in current directory
      const cwdConfig = resolve(process.cwd(), 'wesley.config.mjs');
      if (existsSync(cwdConfig)) {
        this.userConfig = (await import(cwdConfig)).default;
      }
    }
    
    // Merge configs
    this.mergedConfig = this.mergeConfigs(this.defaultConfig, this.userConfig);
    
    // Validate config
    this.validateConfig(this.mergedConfig);
    
    return this.mergedConfig;
  }
  
  /**
   * Get built-in default configuration
   */
  getBuiltInDefaults() {
    return {
      thresholds: {
        scs: { excellent: 90, good: 75, acceptable: 60, poor: 40 },
        mri: { low: 20, medium: 50, high: 75, critical: 100 },
        tci: { excellent: 85, good: 70, acceptable: 50, poor: 30 }
      },
      weights: {
        scs: { sql: 0.3, typescript: 0.25, zod: 0.2, tests: 0.15, docs: 0.1 },
        mri: {
          dropTable: 100, dropColumn: 80, alterType: 60,
          addNotNull: 40, renameTable: 30, renameColumn: 25,
          createIndex: 10, addColumn: 5
        },
        tci: {
          unitTests: 0.3, integrationTests: 0.4,
          pgTAPTests: 0.2, e2eTests: 0.1
        }
      },
      generation: {
        sql: {
          generateSQL: true, enableRLS: true, forceRLS: true,
          generateComments: true, useTransactions: true
        },
        typescript: {
          generateTypes: true, generateZod: true,
          generateClient: true, strictNullChecks: true
        },
        tests: {
          generatePgTAP: true, generateUnit: true,
          includeNegativeTests: true, includeSensitiveTests: true,
          testTimeout: 30000
        },
        rpc: {
          paramStrategy: 'jsonb', generateCRUD: true,
          securityDefiner: true, volatility: 'VOLATILE'
        }
      },
      naming: {
        strategy: 'snake_case', tablePrefix: '',
        indexPrefix: 'idx_', constraintPrefix: '', policyPrefix: 'policy_'
      },
      validation: {
        requirePrimaryKey: true, requireTimestamps: false,
        requireOwnership: false, requireRLS: false,
        allowEmptyTables: false, maxTableNameLength: 63,
        maxColumnNameLength: 63
      },
      features: {
        enableHolmes: true, enableWatson: true,
        enableDeduplication: true, enableAutoMigration: false,
        enableDryRun: true
      },
      paths: {
        output: './generated', sql: './generated/sql',
        typescript: './generated/typescript', tests: './generated/tests',
        migrations: './migrations', evidence: './evidence'
      }
    };
  }
  
  /**
   * Deep merge two config objects
   */
  mergeConfigs(base, override) {
    if (!override) return base;
    
    const merged = { ...base };
    
    for (const key in override) {
      if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
        merged[key] = this.mergeConfigs(base[key] || {}, override[key]);
      } else {
        merged[key] = override[key];
      }
    }
    
    return merged;
  }
  
  /**
   * Validate configuration
   */
  validateConfig(config) {
    // Validate thresholds are between 0 and 100
    for (const metric of ['scs', 'mri', 'tci']) {
      if (!config.thresholds[metric]) {
        throw new Error(`Missing thresholds for ${metric}`);
      }
      
      for (const [level, value] of Object.entries(config.thresholds[metric])) {
        if (value < 0 || value > 100) {
          throw new Error(`Invalid threshold ${metric}.${level}: ${value}. Must be 0-100`);
        }
      }
    }
    
    // Validate weights sum to 1
    for (const metric of ['scs', 'tci']) {
      const weights = Object.values(config.weights[metric]);
      const sum = weights.reduce((a, b) => a + b, 0);
      
      if (Math.abs(sum - 1.0) > 0.01) {
        throw new Error(`Weights for ${metric} must sum to 1.0, got ${sum}`);
      }
    }
    
    // Validate naming strategy
    const validStrategies = ['preserve', 'snake_case', 'lower', 'upper'];
    if (!validStrategies.includes(config.naming.strategy)) {
      throw new Error(`Invalid naming strategy: ${config.naming.strategy}`);
    }
    
    // Validate RPC param strategy
    const validParamStrategies = ['jsonb', 'discrete', 'composite'];
    if (!validParamStrategies.includes(config.generation.rpc.paramStrategy)) {
      throw new Error(`Invalid RPC param strategy: ${config.generation.rpc.paramStrategy}`);
    }
  }
  
  /**
   * Get a specific configuration value
   */
  get(path) {
    if (!this.mergedConfig) {
      throw new Error('Configuration not loaded. Call load() first');
    }
    
    const parts = path.split('.');
    let value = this.mergedConfig;
    
    for (const part of parts) {
      value = value[part];
      if (value === undefined) return undefined;
    }
    
    return value;
  }
  
  /**
   * Get scoring interpretation for a value
   */
  getScoreInterpretation(metric, value) {
    const thresholds = this.get(`thresholds.${metric}`);
    if (!thresholds) return 'unknown';
    
    // For MRI, lower is better
    if (metric === 'mri') {
      if (value <= thresholds.low) return 'low';
      if (value <= thresholds.medium) return 'medium';
      if (value <= thresholds.high) return 'high';
      return 'critical';
    }
    
    // For SCS and TCI, higher is better
    if (value >= thresholds.excellent) return 'excellent';
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.acceptable) return 'acceptable';
    return 'poor';
  }
  
  /**
   * Get explanation for why a score failed
   */
  getScoreExplanation(metric, value) {
    const interpretation = this.getScoreInterpretation(metric, value);
    const thresholds = this.get(`thresholds.${metric}`);
    
    switch (metric) {
      case 'scs':
        if (interpretation === 'poor') {
          return `Schema Coverage Score (${value}) is below acceptable threshold (${thresholds.acceptable}). ` +
                 `More schema elements need to be generated.`;
        }
        break;
        
      case 'mri':
        if (interpretation === 'critical' || interpretation === 'high') {
          return `Migration Risk Index (${value}) exceeds safe threshold (${thresholds.medium}). ` +
                 `Consider breaking into smaller, safer migrations.`;
        }
        break;
        
      case 'tci':
        if (interpretation === 'poor') {
          return `Test Confidence Index (${value}) is below acceptable threshold (${thresholds.acceptable}). ` +
                 `More test coverage is needed for production readiness.`;
        }
        break;
    }
    
    return null;
  }
}

// Export singleton
export const configLoader = new ConfigLoader();