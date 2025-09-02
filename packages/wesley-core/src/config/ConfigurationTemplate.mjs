/**
 * ConfigurationTemplate - Generate configuration templates for different environments
 * Includes validation rules, environment variable expansion, and migration profiles
 * @license Apache-2.0
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { DomainEvent } from '../domain/Events.mjs';

/**
 * Custom events for configuration template generation
 */
export class ConfigurationTemplateRequested extends DomainEvent {
  constructor(environment, options = {}) {
    super('CONFIGURATION_TEMPLATE_REQUESTED', { environment, options });
  }
}

export class ConfigurationTemplateGenerated extends DomainEvent {
  constructor(template, environment) {
    super('CONFIGURATION_TEMPLATE_GENERATED', { template, environment });
  }
}

export class ConfigurationValidated extends DomainEvent {
  constructor(config, validationResult) {
    super('CONFIGURATION_VALIDATED', { config, validationResult });
  }
}

export class ConfigurationError extends DomainEvent {
  constructor(error, context) {
    super('CONFIGURATION_ERROR', { error: error.message, context });
  }
}

export class EnvironmentFileGenerated extends DomainEvent {
  constructor(filePath, environment) {
    super('ENVIRONMENT_FILE_GENERATED', { filePath, environment });
  }
}

/**
 * Custom error types for configuration management
 */
export class ConfigurationTemplateError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ConfigurationTemplateError';
    this.context = context;
  }
}

export class ConfigurationValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ConfigurationValidationError';
    this.field = field;
    this.value = value;
  }
}

export class EnvironmentExpansionError extends Error {
  constructor(message, variable) {
    super(message);
    this.name = 'EnvironmentExpansionError';
    this.variable = variable;
  }
}

/**
 * Migration profiles define different approaches to database migration
 */
export const MIGRATION_PROFILES = {
  safe: {
    name: 'Safe Migration Profile',
    description: 'Conservative approach with maximum safety checks',
    settings: {
      enableTransactions: true,
      requireConfirmation: true,
      enableBackups: true,
      parallelExecution: false,
      maxRetries: 1,
      rollbackOnError: true,
      validateSchema: true,
      enableRLS: true,
      lockTables: true,
      timeout: 300000, // 5 minutes
      checkConstraints: 'validate',
      foreignKeys: 'validate',
      indexes: 'concurrent'
    }
  },
  balanced: {
    name: 'Balanced Migration Profile',
    description: 'Good balance between safety and performance',
    settings: {
      enableTransactions: true,
      requireConfirmation: false,
      enableBackups: true,
      parallelExecution: true,
      maxRetries: 3,
      rollbackOnError: true,
      validateSchema: true,
      enableRLS: true,
      lockTables: false,
      timeout: 180000, // 3 minutes
      checkConstraints: 'defer',
      foreignKeys: 'defer',
      indexes: 'concurrent'
    }
  },
  aggressive: {
    name: 'Aggressive Migration Profile',
    description: 'Performance-focused with minimal safety checks',
    settings: {
      enableTransactions: false,
      requireConfirmation: false,
      enableBackups: false,
      parallelExecution: true,
      maxRetries: 5,
      rollbackOnError: false,
      validateSchema: false,
      enableRLS: false,
      lockTables: false,
      timeout: 60000, // 1 minute
      checkConstraints: 'skip',
      foreignKeys: 'skip',
      indexes: 'standard'
    }
  }
};

/**
 * Configuration validation rules
 */
export const VALIDATION_RULES = {
  database: {
    url: {
      required: true,
      type: 'string',
      pattern: /^postgresql:\/\/.+/,
      description: 'PostgreSQL connection URL'
    },
    host: {
      required: false,
      type: 'string',
      default: 'localhost',
      description: 'Database host'
    },
    port: {
      required: false,
      type: 'number',
      min: 1,
      max: 65535,
      default: 5432,
      description: 'Database port'
    },
    database: {
      required: true,
      type: 'string',
      minLength: 1,
      description: 'Database name'
    },
    username: {
      required: true,
      type: 'string',
      description: 'Database username'
    },
    password: {
      required: true,
      type: 'string',
      sensitive: true,
      description: 'Database password'
    },
    ssl: {
      required: false,
      type: 'boolean',
      default: false,
      description: 'Enable SSL connection'
    },
    poolSize: {
      required: false,
      type: 'number',
      min: 1,
      max: 100,
      default: 10,
      description: 'Connection pool size'
    }
  },
  supabase: {
    projectUrl: {
      required: true,
      type: 'string',
      pattern: /^https:\/\/.+\.supabase\.co$/,
      description: 'Supabase project URL'
    },
    anonKey: {
      required: true,
      type: 'string',
      sensitive: true,
      description: 'Supabase anonymous key'
    },
    serviceRoleKey: {
      required: true,
      type: 'string',
      sensitive: true,
      description: 'Supabase service role key'
    },
    apiUrl: {
      required: false,
      type: 'string',
      description: 'Custom API URL override'
    }
  },
  migration: {
    profile: {
      required: false,
      type: 'string',
      enum: Object.keys(MIGRATION_PROFILES),
      default: 'balanced',
      description: 'Migration profile to use'
    },
    migrationsDir: {
      required: false,
      type: 'string',
      default: './migrations',
      description: 'Directory for migration files'
    },
    schemaDir: {
      required: false,
      type: 'string',
      default: './schema',
      description: 'Directory for schema files'
    },
    seedsDir: {
      required: false,
      type: 'string',
      default: './seeds',
      description: 'Directory for seed files'
    },
    testsDir: {
      required: false,
      type: 'string',
      default: './tests',
      description: 'Directory for database tests'
    }
  },
  logging: {
    level: {
      required: false,
      type: 'string',
      enum: ['error', 'warn', 'info', 'debug', 'trace'],
      default: 'info',
      description: 'Logging level'
    },
    format: {
      required: false,
      type: 'string',
      enum: ['json', 'pretty', 'simple'],
      default: 'pretty',
      description: 'Log output format'
    },
    file: {
      required: false,
      type: 'string',
      description: 'Log file path'
    }
  },
  testing: {
    coverage: {
      required: false,
      type: 'number',
      min: 0,
      max: 100,
      default: 80,
      description: 'Minimum test coverage percentage'
    },
    timeout: {
      required: false,
      type: 'number',
      min: 1000,
      default: 30000,
      description: 'Test timeout in milliseconds'
    },
    parallel: {
      required: false,
      type: 'boolean',
      default: true,
      description: 'Enable parallel test execution'
    }
  }
};

/**
 * ConfigurationTemplate - Generates and validates configuration templates
 * 
 * Features:
 * - Generate environment-specific configuration files
 * - Validate configuration against defined rules
 * - Support environment variable expansion
 * - Create .env.example files with documentation
 * - Migration profile management
 * 
 * @example
 * ```javascript
 * const template = new ConfigurationTemplate({ eventPublisher });
 * const config = await template.generate('development', {
 *   includeComments: true,
 *   migrationProfile: 'safe'
 * });
 * ```
 */
export class ConfigurationTemplate {
  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {EventPublisher} dependencies.eventPublisher - Event publisher for notifications
   * @param {Logger} [dependencies.logger] - Optional logger instance
   */
  constructor({ eventPublisher, logger = console }) {
    this.eventPublisher = eventPublisher;
    this.logger = logger;
    this.validationRules = VALIDATION_RULES;
    this.migrationProfiles = MIGRATION_PROFILES;
  }

  /**
   * Generate configuration template for specified environment
   * 
   * @param {string} environment - Target environment (development, staging, production)
   * @param {Object} options - Generation options
   * @param {string} [options.migrationProfile='balanced'] - Migration profile to use
   * @param {boolean} [options.includeComments=true] - Include documentation comments
   * @param {boolean} [options.includeDefaults=true] - Include default values
   * @param {boolean} [options.includeOptional=false] - Include optional fields
   * @param {boolean} [options.generateEnvFile=true] - Generate .env.example file
   * @param {Object} [options.overrides={}] - Override specific values
   * @returns {Promise<Object>} Generated configuration object
   */
  async generate(environment, options = {}) {
    const config = {
      migrationProfile: 'balanced',
      includeComments: true,
      includeDefaults: true,
      includeOptional: false,
      generateEnvFile: true,
      overrides: {},
      ...options
    };

    try {
      await this.eventPublisher?.publish(new ConfigurationTemplateRequested(environment, config));

      this.logger.debug(`Generating configuration template for ${environment}`);

      // Generate base configuration
      const template = this.generateBaseTemplate(environment, config);

      // Apply migration profile
      if (config.migrationProfile && this.migrationProfiles[config.migrationProfile]) {
        template.migration = {
          ...template.migration,
          ...this.migrationProfiles[config.migrationProfile].settings
        };
      }

      // Apply overrides
      this.applyOverrides(template, config.overrides);

      // Expand environment variables
      const expandedTemplate = this.expandEnvironmentVariables(template, environment);

      // Generate .env.example file if requested
      if (config.generateEnvFile) {
        const envContent = this.generateEnvironmentFile(expandedTemplate, environment, config);
        expandedTemplate._envFile = envContent;
      }

      await this.eventPublisher?.publish(new ConfigurationTemplateGenerated(expandedTemplate, environment));

      return expandedTemplate;

    } catch (error) {
      const configError = new ConfigurationTemplateError(
        `Configuration generation failed: ${error.message}`,
        { environment, options: config }
      );
      await this.eventPublisher?.publish(new ConfigurationError(configError, { environment }));
      throw configError;
    }
  }

  /**
   * Validate configuration against defined rules
   * 
   * @param {Object} config - Configuration object to validate
   * @param {Object} options - Validation options
   * @param {boolean} [options.strict=false] - Strict validation mode
   * @param {string[]} [options.skipFields=[]] - Fields to skip validation
   * @returns {Promise<Object>} Validation result
   */
  async validate(config, options = {}) {
    const validationOptions = {
      strict: false,
      skipFields: [],
      ...options
    };

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      checkedFields: 0,
      summary: {}
    };

    try {
      for (const [section, fields] of Object.entries(this.validationRules)) {
        if (!config[section]) {
          // Check if any required fields are missing
          const requiredFields = Object.entries(fields).filter(([, rule]) => rule.required);
          if (requiredFields.length > 0 && validationOptions.strict) {
            result.errors.push({
              section,
              field: null,
              message: `Missing required section: ${section}`,
              rule: 'required_section'
            });
            result.valid = false;
          }
          continue;
        }

        for (const [fieldName, rule] of Object.entries(fields)) {
          if (validationOptions.skipFields.includes(`${section}.${fieldName}`)) {
            continue;
          }

          const fieldValue = config[section][fieldName];
          const validation = this.validateField(fieldValue, rule, `${section}.${fieldName}`);

          if (!validation.valid) {
            result.errors.push(...validation.errors);
            result.valid = false;
          }

          result.warnings.push(...validation.warnings);
          result.checkedFields++;
        }
      }

      // Generate summary
      result.summary = {
        totalSections: Object.keys(this.validationRules).length,
        validSections: Object.keys(config).length,
        totalErrors: result.errors.length,
        totalWarnings: result.warnings.length,
        checkedFields: result.checkedFields
      };

      await this.eventPublisher?.publish(new ConfigurationValidated(config, result));

      return result;

    } catch (error) {
      const validationError = new ConfigurationValidationError(
        `Configuration validation failed: ${error.message}`
      );
      await this.eventPublisher?.publish(new ConfigurationError(validationError, { config }));
      throw validationError;
    }
  }

  /**
   * Generate base configuration template
   * 
   * @private
   * @param {string} environment - Target environment
   * @param {Object} options - Generation options
   * @returns {Object} Base configuration template
   */
  generateBaseTemplate(environment, options) {
    const template = {
      environment,
      database: this.generateDatabaseConfig(environment, options),
      supabase: this.generateSupabaseConfig(environment, options),
      migration: this.generateMigrationConfig(environment, options),
      logging: this.generateLoggingConfig(environment, options),
      testing: this.generateTestingConfig(environment, options)
    };

    // Add metadata
    template._metadata = {
      generatedAt: new Date().toISOString(),
      environment,
      profile: options.migrationProfile,
      version: '1.0.0'
    };

    return template;
  }

  /**
   * Generate database configuration section
   * 
   * @private
   * @param {string} environment - Target environment
   * @param {Object} options - Generation options
   * @returns {Object} Database configuration
   */
  generateDatabaseConfig(environment, options) {
    const envPrefix = environment.toUpperCase();
    const config = {};

    for (const [field, rule] of Object.entries(this.validationRules.database)) {
      if (!options.includeOptional && !rule.required) {
        continue;
      }

      // Generate environment variable reference
      const envVar = `${envPrefix}_DATABASE_${field.toUpperCase()}`;
      
      if (rule.sensitive) {
        config[field] = `\${${envVar}}`;
      } else if (options.includeDefaults && rule.default !== undefined) {
        config[field] = `\${${envVar}:-${rule.default}}`;
      } else {
        config[field] = `\${${envVar}}`;
      }

      // Add comment if requested
      if (options.includeComments) {
        config[`_${field}_comment`] = rule.description;
      }
    }

    // Environment-specific defaults
    if (environment === 'development') {
      config.url = '${DEV_DATABASE_URL:-postgresql://localhost:5432/wesley_dev}';
      config.ssl = false;
    } else if (environment === 'production') {
      config.url = '${PROD_DATABASE_URL}';
      config.ssl = true;
      config.poolSize = 20;
    }

    return config;
  }

  /**
   * Generate Supabase configuration section
   * 
   * @private
   * @param {string} environment - Target environment
   * @param {Object} options - Generation options
   * @returns {Object} Supabase configuration
   */
  generateSupabaseConfig(environment, options) {
    const envPrefix = environment.toUpperCase();
    const config = {};

    for (const [field, rule] of Object.entries(this.validationRules.supabase)) {
      if (!options.includeOptional && !rule.required) {
        continue;
      }

      const envVar = `${envPrefix}_SUPABASE_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
      config[field] = `\${${envVar}}`;

      if (options.includeComments) {
        config[`_${field}_comment`] = rule.description;
      }
    }

    return config;
  }

  /**
   * Generate migration configuration section
   * 
   * @private
   * @param {string} environment - Target environment
   * @param {Object} options - Generation options
   * @returns {Object} Migration configuration
   */
  generateMigrationConfig(environment, options) {
    const config = {};

    for (const [field, rule] of Object.entries(this.validationRules.migration)) {
      if (!options.includeOptional && !rule.required) {
        continue;
      }

      if (options.includeDefaults && rule.default !== undefined) {
        config[field] = rule.default;
      } else {
        config[field] = null;
      }

      if (options.includeComments) {
        config[`_${field}_comment`] = rule.description;
      }
    }

    // Set migration profile
    config.profile = options.migrationProfile;

    return config;
  }

  /**
   * Generate logging configuration section
   * 
   * @private
   * @param {string} environment - Target environment
   * @param {Object} options - Generation options
   * @returns {Object} Logging configuration
   */
  generateLoggingConfig(environment, options) {
    const config = {};

    for (const [field, rule] of Object.entries(this.validationRules.logging)) {
      if (!options.includeOptional && !rule.required) {
        continue;
      }

      if (options.includeDefaults && rule.default !== undefined) {
        config[field] = rule.default;
      }

      if (options.includeComments) {
        config[`_${field}_comment`] = rule.description;
      }
    }

    // Environment-specific logging
    if (environment === 'development') {
      config.level = 'debug';
      config.format = 'pretty';
    } else if (environment === 'production') {
      config.level = 'warn';
      config.format = 'json';
      config.file = '/var/log/wesley.log';
    }

    return config;
  }

  /**
   * Generate testing configuration section
   * 
   * @private
   * @param {string} environment - Target environment
   * @param {Object} options - Generation options
   * @returns {Object} Testing configuration
   */
  generateTestingConfig(environment, options) {
    const config = {};

    for (const [field, rule] of Object.entries(this.validationRules.testing)) {
      if (options.includeDefaults && rule.default !== undefined) {
        config[field] = rule.default;
      }

      if (options.includeComments) {
        config[`_${field}_comment`] = rule.description;
      }
    }

    return config;
  }

  /**
   * Apply configuration overrides
   * 
   * @private
   * @param {Object} template - Configuration template
   * @param {Object} overrides - Override values
   */
  applyOverrides(template, overrides) {
    for (const [path, value] of Object.entries(overrides)) {
      const keys = path.split('.');
      let target = template;

      // Navigate to parent object
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) {
          target[keys[i]] = {};
        }
        target = target[keys[i]];
      }

      // Set the value
      target[keys[keys.length - 1]] = value;
    }
  }

  /**
   * Expand environment variables in configuration
   * 
   * @private
   * @param {Object} template - Configuration template
   * @param {string} environment - Target environment
   * @returns {Object} Template with expanded variables
   */
  expandEnvironmentVariables(template, environment) {
    const expanded = JSON.parse(JSON.stringify(template));

    const expandValue = (value) => {
      if (typeof value === 'string') {
        return value.replace(/\$\{([^}]+)\}/g, (match, varExpr) => {
          const [varName, defaultValue] = varExpr.split(':-');
          const envValue = process.env[varName];
          
          if (envValue !== undefined) {
            return envValue;
          } else if (defaultValue !== undefined) {
            return defaultValue;
          } else {
            // Keep placeholder for required variables
            return match;
          }
        });
      }
      return value;
    };

    const expandObject = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('_') && key.endsWith('_comment')) {
          continue; // Skip comment fields
        }

        if (typeof value === 'object' && value !== null) {
          expandObject(value);
        } else {
          obj[key] = expandValue(value);
        }
      }
    };

    expandObject(expanded);
    return expanded;
  }

  /**
   * Validate a single field against its rule
   * 
   * @private
   * @param {any} value - Field value to validate
   * @param {Object} rule - Validation rule
   * @param {string} fieldPath - Full field path for error reporting
   * @returns {Object} Validation result
   */
  validateField(value, rule, fieldPath) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check if field is required
    if (rule.required && (value === undefined || value === null || value === '')) {
      result.errors.push({
        field: fieldPath,
        message: `Required field is missing`,
        rule: 'required',
        value
      });
      result.valid = false;
      return result;
    }

    // Skip further validation if field is optional and missing
    if (!rule.required && (value === undefined || value === null)) {
      return result;
    }

    // Type validation
    if (rule.type && typeof value !== rule.type) {
      result.errors.push({
        field: fieldPath,
        message: `Expected type ${rule.type}, got ${typeof value}`,
        rule: 'type',
        value
      });
      result.valid = false;
    }

    // Pattern validation (for strings)
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      result.errors.push({
        field: fieldPath,
        message: `Value does not match required pattern`,
        rule: 'pattern',
        value
      });
      result.valid = false;
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      result.errors.push({
        field: fieldPath,
        message: `Value must be one of: ${rule.enum.join(', ')}`,
        rule: 'enum',
        value
      });
      result.valid = false;
    }

    // Numeric range validation
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        result.errors.push({
          field: fieldPath,
          message: `Value must be at least ${rule.min}`,
          rule: 'min',
          value
        });
        result.valid = false;
      }

      if (rule.max !== undefined && value > rule.max) {
        result.errors.push({
          field: fieldPath,
          message: `Value must be at most ${rule.max}`,
          rule: 'max',
          value
        });
        result.valid = false;
      }
    }

    // String length validation
    if (typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        result.errors.push({
          field: fieldPath,
          message: `String must be at least ${rule.minLength} characters`,
          rule: 'minLength',
          value
        });
        result.valid = false;
      }

      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        result.errors.push({
          field: fieldPath,
          message: `String must be at most ${rule.maxLength} characters`,
          rule: 'maxLength',
          value
        });
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * Generate .env.example file content
   * 
   * @private
   * @param {Object} template - Configuration template
   * @param {string} environment - Target environment
   * @param {Object} options - Generation options
   * @returns {string} Environment file content
   */
  generateEnvironmentFile(template, environment, options) {
    const lines = [];
    const envPrefix = environment.toUpperCase();

    lines.push(`# Environment configuration for ${environment}`);
    lines.push(`# Generated on ${new Date().toISOString()}`);
    lines.push(`# Migration profile: ${options.migrationProfile}`);
    lines.push('');

    // Database variables
    lines.push('# Database Configuration');
    lines.push(`${envPrefix}_DATABASE_URL=postgresql://username:password@localhost:5432/database`);
    
    for (const [field, rule] of Object.entries(this.validationRules.database)) {
      if (field === 'url') continue; // Already added above

      const envVar = `${envPrefix}_DATABASE_${field.toUpperCase()}`;
      const example = this.getExampleValue(rule, field);
      
      if (rule.sensitive) {
        lines.push(`${envVar}=${example} # ${rule.description} (sensitive)`);
      } else {
        lines.push(`# ${envVar}=${example} # ${rule.description}`);
      }
    }

    lines.push('');

    // Supabase variables
    lines.push('# Supabase Configuration');
    for (const [field, rule] of Object.entries(this.validationRules.supabase)) {
      const envVar = `${envPrefix}_SUPABASE_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
      const example = this.getExampleValue(rule, field);
      
      lines.push(`${envVar}=${example} # ${rule.description}`);
    }

    lines.push('');
    lines.push('# Additional configuration can be set via JSON files');
    lines.push('# See wesley.config.json for complete configuration options');

    return lines.join('\n');
  }

  /**
   * Get example value for field based on its rule
   * 
   * @private
   * @param {Object} rule - Validation rule
   * @param {string} fieldName - Field name
   * @returns {string} Example value
   */
  getExampleValue(rule, fieldName) {
    if (rule.default !== undefined) {
      return rule.default;
    }

    if (rule.enum) {
      return rule.enum[0];
    }

    if (fieldName.includes('url')) {
      if (fieldName.includes('supabase')) {
        return 'https://your-project.supabase.co';
      }
      return 'https://example.com';
    }

    if (fieldName.includes('key') || fieldName.includes('password') || fieldName.includes('secret')) {
      return 'your_secret_key_here';
    }

    if (rule.type === 'number') {
      return rule.min || 0;
    }

    if (rule.type === 'boolean') {
      return 'false';
    }

    return 'example_value';
  }

  /**
   * Write configuration to file
   * 
   * @param {Object} config - Configuration object
   * @param {string} filePath - Target file path
   * @param {Object} options - Write options
   * @param {string} [options.format='json'] - Output format (json, yaml)
   * @param {boolean} [options.indent=true] - Pretty-print output
   * @returns {Promise<void>}
   */
  async writeConfigurationFile(config, filePath, options = {}) {
    const writeOptions = {
      format: 'json',
      indent: true,
      ...options
    };

    try {
      let content;

      if (writeOptions.format === 'json') {
        // Clean up comment fields for JSON output
        const cleanConfig = this.cleanConfigForOutput(config);
        content = writeOptions.indent 
          ? JSON.stringify(cleanConfig, null, 2)
          : JSON.stringify(cleanConfig);
      } else {
        throw new ConfigurationTemplateError(`Unsupported format: ${writeOptions.format}`);
      }

      writeFileSync(filePath, content, 'utf8');
      this.logger.debug(`Configuration written to ${filePath}`);

    } catch (error) {
      throw new ConfigurationTemplateError(
        `Failed to write configuration file: ${error.message}`,
        { filePath, options: writeOptions }
      );
    }
  }

  /**
   * Clean configuration object for output (remove comment fields)
   * 
   * @private
   * @param {Object} config - Configuration object
   * @returns {Object} Cleaned configuration
   */
  cleanConfigForOutput(config) {
    const cleaned = {};

    for (const [key, value] of Object.entries(config)) {
      if (key.startsWith('_') && key.endsWith('_comment')) {
        continue; // Skip comment fields
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        cleaned[key] = this.cleanConfigForOutput(value);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Get migration profile by name
   * 
   * @param {string} profileName - Name of migration profile
   * @returns {Object|null} Migration profile or null if not found
   */
  getMigrationProfile(profileName) {
    return this.migrationProfiles[profileName] || null;
  }

  /**
   * List all available migration profiles
   * 
   * @returns {Object} Map of profile names to profile objects
   */
  listMigrationProfiles() {
    return { ...this.migrationProfiles };
  }

  /**
   * Add custom validation rule
   * 
   * @param {string} section - Configuration section
   * @param {string} field - Field name
   * @param {Object} rule - Validation rule
   */
  addValidationRule(section, field, rule) {
    if (!this.validationRules[section]) {
      this.validationRules[section] = {};
    }
    this.validationRules[section][field] = rule;
  }

  /**
   * Remove validation rule
   * 
   * @param {string} section - Configuration section
   * @param {string} field - Field name
   */
  removeValidationRule(section, field) {
    if (this.validationRules[section]) {
      delete this.validationRules[section][field];
    }
  }
}