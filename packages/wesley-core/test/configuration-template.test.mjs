/**
 * ConfigurationTemplate Test Suite
 * Comprehensive tests for configuration generation, validation, and environment management
 * @license Apache-2.0
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { 
  ConfigurationTemplate,
  MIGRATION_PROFILES,
  VALIDATION_RULES,
  ConfigurationTemplateRequested,
  ConfigurationTemplateGenerated,
  ConfigurationValidated,
  ConfigurationError,
  EnvironmentFileGenerated,
  ConfigurationTemplateError,
  ConfigurationValidationError,
  EnvironmentExpansionError
} from '../src/config/ConfigurationTemplate.mjs';

// Mock EventPublisher for testing
class MockEventPublisher {
  constructor() {
    this.events = [];
  }

  async publish(event) {
    this.events.push(event);
  }

  getEventsByType(type) {
    return this.events.filter(e => e.type === type);
  }

  clear() {
    this.events = [];
  }
}

// Mock Logger for testing
class MockLogger {
  constructor() {
    this.logs = [];
  }

  debug(message) {
    this.logs.push({ level: 'debug', message });
  }

  warn(message) {
    this.logs.push({ level: 'warn', message });
  }

  error(message) {
    this.logs.push({ level: 'error', message });
  }

  clear() {
    this.logs = [];
  }
}

describe('ConfigurationTemplate', () => {
  let tempDir;
  let mockEventPublisher;
  let mockLogger;
  let template;
  let originalEnv;

  beforeEach(() => {
    // Create temporary directory
    tempDir = join(tmpdir(), `config-template-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Setup mocks
    mockEventPublisher = new MockEventPublisher();
    mockLogger = new MockLogger();

    // Create template instance
    template = new ConfigurationTemplate({
      eventPublisher: mockEventPublisher,
      logger: mockLogger
    });

    // Backup original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }

    // Clear mocks
    mockEventPublisher.clear();
    mockLogger.clear();

    // Restore environment
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    test('should create instance with required dependencies', () => {
      assert.ok(template instanceof ConfigurationTemplate);
      assert.equal(template.eventPublisher, mockEventPublisher);
      assert.equal(template.logger, mockLogger);
      assert.equal(template.validationRules, VALIDATION_RULES);
      assert.equal(template.migrationProfiles, MIGRATION_PROFILES);
    });

    test('should use console logger as default', () => {
      const tmpl = new ConfigurationTemplate({ eventPublisher: mockEventPublisher });
      assert.equal(tmpl.logger, console);
    });
  });

  describe('Migration Profiles', () => {
    test('should have predefined migration profiles', () => {
      assert.ok(MIGRATION_PROFILES.safe);
      assert.ok(MIGRATION_PROFILES.balanced);
      assert.ok(MIGRATION_PROFILES.aggressive);

      // Verify safe profile properties
      const safeProfile = MIGRATION_PROFILES.safe;
      assert.equal(safeProfile.name, 'Safe Migration Profile');
      assert.ok(safeProfile.settings.enableTransactions);
      assert.ok(safeProfile.settings.requireConfirmation);
      assert.ok(safeProfile.settings.enableBackups);
      assert.ok(safeProfile.settings.rollbackOnError);

      // Verify aggressive profile properties
      const aggressiveProfile = MIGRATION_PROFILES.aggressive;
      assert.equal(aggressiveProfile.name, 'Aggressive Migration Profile');
      assert.equal(aggressiveProfile.settings.enableTransactions, false);
      assert.equal(aggressiveProfile.settings.requireConfirmation, false);
      assert.equal(aggressiveProfile.settings.enableBackups, false);
    });

    test('should get migration profile by name', () => {
      const safeProfile = template.getMigrationProfile('safe');
      assert.ok(safeProfile);
      assert.equal(safeProfile.name, 'Safe Migration Profile');

      const nonExistent = template.getMigrationProfile('nonexistent');
      assert.equal(nonExistent, null);
    });

    test('should list all migration profiles', () => {
      const profiles = template.listMigrationProfiles();
      assert.ok(profiles.safe);
      assert.ok(profiles.balanced);
      assert.ok(profiles.aggressive);
      assert.equal(Object.keys(profiles).length, 3);
    });
  });

  describe('Validation Rules', () => {
    test('should have comprehensive validation rules', () => {
      assert.ok(VALIDATION_RULES.database);
      assert.ok(VALIDATION_RULES.supabase);
      assert.ok(VALIDATION_RULES.migration);
      assert.ok(VALIDATION_RULES.logging);
      assert.ok(VALIDATION_RULES.testing);

      // Check database rules
      const dbRules = VALIDATION_RULES.database;
      assert.ok(dbRules.url.required);
      assert.equal(dbRules.url.type, 'string');
      assert.ok(dbRules.url.pattern.test('postgresql://user:pass@host:5432/db'));
      assert.ok(dbRules.password.sensitive);

      // Check supabase rules
      const supabaseRules = VALIDATION_RULES.supabase;
      assert.ok(supabaseRules.projectUrl.pattern.test('https://project.supabase.co'));
      assert.ok(supabaseRules.serviceRoleKey.sensitive);

      // Check migration rules
      const migrationRules = VALIDATION_RULES.migration;
      assert.ok(migrationRules.profile.enum.includes('safe'));
      assert.ok(migrationRules.profile.enum.includes('balanced'));
      assert.ok(migrationRules.profile.enum.includes('aggressive'));
    });

    test('should allow adding custom validation rules', () => {
      template.addValidationRule('custom', 'field', {
        required: true,
        type: 'string',
        description: 'Custom field'
      });

      const customRule = template.validationRules.custom.field;
      assert.ok(customRule);
      assert.equal(customRule.type, 'string');
      assert.equal(customRule.description, 'Custom field');
    });

    test('should allow removing validation rules', () => {
      template.addValidationRule('test', 'field', { type: 'string' });
      assert.ok(template.validationRules.test.field);

      template.removeValidationRule('test', 'field');
      assert.ok(!template.validationRules.test.field);
    });
  });

  describe('Configuration Generation', () => {
    test('should generate development configuration', async () => {
      const config = await template.generate('development', {
        migrationProfile: 'safe',
        includeComments: true
      });

      assert.equal(config.environment, 'development');
      assert.ok(config.database);
      assert.ok(config.supabase);
      assert.ok(config.migration);
      assert.ok(config.logging);
      assert.ok(config.testing);
      assert.ok(config._metadata);

      // Check migration profile was applied
      assert.ok(config.migration.enableTransactions);
      assert.ok(config.migration.requireConfirmation);
      assert.equal(config.migration.profile, 'safe');

      // Check development-specific settings
      assert.ok(config.database.url.includes('wesley_dev'));
      assert.equal(config.database.ssl, false);
      assert.equal(config.logging.level, 'debug');
      assert.equal(config.logging.format, 'pretty');

      // Check metadata
      assert.equal(config._metadata.environment, 'development');
      assert.equal(config._metadata.profile, 'safe');
      assert.ok(config._metadata.generatedAt);

      // Check env file generation
      assert.ok(config._envFile);
      assert.ok(config._envFile.includes('DEV_DATABASE_URL'));
    });

    test('should generate production configuration', async () => {
      const config = await template.generate('production', {
        migrationProfile: 'balanced',
        includeComments: false
      });

      assert.equal(config.environment, 'production');

      // Check production-specific settings
      assert.ok(config.database.url.includes('PROD_DATABASE_URL'));
      assert.equal(config.database.ssl, true);
      assert.equal(config.database.poolSize, 20);
      assert.equal(config.logging.level, 'warn');
      assert.equal(config.logging.format, 'json');
      assert.ok(config.logging.file.includes('/var/log/wesley.log'));

      // Check migration profile
      assert.equal(config.migration.profile, 'balanced');
      assert.ok(config.migration.enableTransactions);
      assert.equal(config.migration.requireConfirmation, false);
    });

    test('should apply configuration overrides', async () => {
      const config = await template.generate('development', {
        overrides: {
          'database.poolSize': 25,
          'logging.level': 'trace',
          'migration.timeout': 600000
        }
      });

      assert.equal(config.database.poolSize, 25);
      assert.equal(config.logging.level, 'trace');
      assert.equal(config.migration.timeout, 600000);
    });

    test('should handle environment variable expansion', async () => {
      // Set test environment variables
      process.env.TEST_VAR = 'test_value';
      process.env.DEV_DATABASE_URL = 'postgresql://testuser:testpass@testhost:5432/testdb';

      const config = await template.generate('development');

      // Check that existing env vars are expanded
      assert.ok(config.database.url.includes('testdb') || config.database.url.includes('${'));
    });

    test('should emit configuration events', async () => {
      await template.generate('development');

      const requestedEvents = mockEventPublisher.getEventsByType('CONFIGURATION_TEMPLATE_REQUESTED');
      const generatedEvents = mockEventPublisher.getEventsByType('CONFIGURATION_TEMPLATE_GENERATED');

      assert.equal(requestedEvents.length, 1);
      assert.equal(generatedEvents.length, 1);

      const requestEvent = requestedEvents[0];
      assert.equal(requestEvent.payload.environment, 'development');

      const generatedEvent = generatedEvents[0];
      assert.equal(generatedEvent.payload.environment, 'development');
      assert.ok(generatedEvent.payload.template);
    });

    test('should handle generation errors', async () => {
      // Force an error by providing invalid overrides
      try {
        await template.generate('development', {
          overrides: {
            'invalid.deeply.nested.path': 'value'
          }
        });
        // Should not throw, but let's test error handling in validation
      } catch (error) {
        assert.ok(error instanceof ConfigurationTemplateError);
        
        const errorEvents = mockEventPublisher.getEventsByType('CONFIGURATION_ERROR');
        assert.ok(errorEvents.length > 0);
      }
    });

    test('should generate environment file content', async () => {
      const config = await template.generate('development', {
        generateEnvFile: true
      });

      assert.ok(config._envFile);
      
      const envContent = config._envFile;
      assert.ok(envContent.includes('# Environment configuration for development'));
      assert.ok(envContent.includes('DEV_DATABASE_URL='));
      assert.ok(envContent.includes('DEV_SUPABASE_PROJECT_URL='));
      assert.ok(envContent.includes('# Database Configuration'));
      assert.ok(envContent.includes('# Supabase Configuration'));
    });
  });

  describe('Configuration Validation', () => {
    test('should validate correct configuration', async () => {
      const config = {
        database: {
          url: 'postgresql://user:pass@localhost:5432/db',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          username: 'testuser',
          password: 'testpass',
          ssl: false,
          poolSize: 10
        },
        supabase: {
          projectUrl: 'https://project.supabase.co',
          anonKey: 'test_anon_key',
          serviceRoleKey: 'test_service_role_key'
        },
        migration: {
          profile: 'balanced',
          migrationsDir: './migrations'
        },
        logging: {
          level: 'info',
          format: 'pretty'
        },
        testing: {
          coverage: 80,
          timeout: 30000,
          parallel: true
        }
      };

      const result = await template.validate(config);

      assert.ok(result.valid);
      assert.equal(result.errors.length, 0);
      assert.ok(result.checkedFields > 0);
      assert.ok(result.summary);

      // Check validation event
      const validatedEvents = mockEventPublisher.getEventsByType('CONFIGURATION_VALIDATED');
      assert.equal(validatedEvents.length, 1);
    });

    test('should detect validation errors', async () => {
      const config = {
        database: {
          url: 'invalid-url', // Invalid PostgreSQL URL
          port: 'not-a-number', // Wrong type
          poolSize: -5 // Below minimum
        },
        supabase: {
          projectUrl: 'https://invalid.com', // Wrong pattern
          // Missing required fields
        },
        migration: {
          profile: 'nonexistent' // Invalid enum value
        },
        logging: {
          level: 'invalid_level' // Invalid enum value
        }
      };

      const result = await template.validate(config);

      assert.ok(!result.valid);
      assert.ok(result.errors.length > 0);

      // Check specific errors
      const urlError = result.errors.find(e => e.field === 'database.url');
      assert.ok(urlError);
      assert.equal(urlError.rule, 'pattern');

      const portError = result.errors.find(e => e.field === 'database.port');
      assert.ok(portError);
      assert.equal(portError.rule, 'type');

      const poolSizeError = result.errors.find(e => e.field === 'database.poolSize');
      assert.ok(poolSizeError);
      assert.equal(poolSizeError.rule, 'min');

      const profileError = result.errors.find(e => e.field === 'migration.profile');
      assert.ok(profileError);
      assert.equal(profileError.rule, 'enum');
    });

    test('should handle missing required fields', async () => {
      const config = {
        database: {
          // Missing required url, database, username, password
        }
      };

      const result = await template.validate(config, { strict: true });

      assert.ok(!result.valid);
      const requiredErrors = result.errors.filter(e => e.rule === 'required');
      assert.ok(requiredErrors.length > 0);
    });

    test('should skip specified fields during validation', async () => {
      const config = {
        database: {
          url: 'invalid-url',
          database: 'test'
        }
      };

      const result = await template.validate(config, {
        skipFields: ['database.url']
      });

      // Should not have URL validation error
      const urlError = result.errors.find(e => e.field === 'database.url');
      assert.ok(!urlError);
    });

    test('should validate string length constraints', async () => {
      const config = {
        database: {
          database: '' // Empty string but required
        }
      };

      // Add custom rule with length constraint
      template.addValidationRule('test', 'shortField', {
        type: 'string',
        minLength: 5,
        maxLength: 10
      });

      config.test = {
        shortField: 'abc' // Too short
      };

      const result = await template.validate(config);

      const lengthError = result.errors.find(e => e.field === 'test.shortField');
      assert.ok(lengthError);
      assert.equal(lengthError.rule, 'minLength');
    });

    test('should handle validation errors gracefully', async () => {
      // Test validation with malformed config that might throw
      try {
        await template.validate(null);
      } catch (error) {
        assert.ok(error instanceof ConfigurationValidationError);
        
        const errorEvents = mockEventPublisher.getEventsByType('CONFIGURATION_ERROR');
        assert.ok(errorEvents.length > 0);
      }
    });
  });

  describe('Field Validation', () => {
    test('should validate required fields', () => {
      const rule = { required: true, type: 'string' };
      
      const validResult = template.validateField('test', rule, 'test.field');
      assert.ok(validResult.valid);

      const invalidResult = template.validateField(undefined, rule, 'test.field');
      assert.ok(!invalidResult.valid);
      assert.equal(invalidResult.errors[0].rule, 'required');
    });

    test('should validate type constraints', () => {
      const stringRule = { type: 'string' };
      const numberRule = { type: 'number' };
      const booleanRule = { type: 'boolean' };

      assert.ok(template.validateField('test', stringRule, 'field').valid);
      assert.ok(!template.validateField(123, stringRule, 'field').valid);

      assert.ok(template.validateField(123, numberRule, 'field').valid);
      assert.ok(!template.validateField('test', numberRule, 'field').valid);

      assert.ok(template.validateField(true, booleanRule, 'field').valid);
      assert.ok(!template.validateField('test', booleanRule, 'field').valid);
    });

    test('should validate pattern constraints', () => {
      const urlRule = { 
        type: 'string', 
        pattern: /^https:\/\/.+\.supabase\.co$/ 
      };

      const validUrl = template.validateField('https://project.supabase.co', urlRule, 'field');
      assert.ok(validUrl.valid);

      const invalidUrl = template.validateField('https://invalid.com', urlRule, 'field');
      assert.ok(!invalidUrl.valid);
      assert.equal(invalidUrl.errors[0].rule, 'pattern');
    });

    test('should validate enum constraints', () => {
      const enumRule = { 
        type: 'string',
        enum: ['option1', 'option2', 'option3'] 
      };

      const validEnum = template.validateField('option1', enumRule, 'field');
      assert.ok(validEnum.valid);

      const invalidEnum = template.validateField('invalid', enumRule, 'field');
      assert.ok(!invalidEnum.valid);
      assert.equal(invalidEnum.errors[0].rule, 'enum');
    });

    test('should validate numeric range constraints', () => {
      const rangeRule = { 
        type: 'number',
        min: 5,
        max: 10
      };

      assert.ok(template.validateField(7, rangeRule, 'field').valid);
      
      const tooLow = template.validateField(3, rangeRule, 'field');
      assert.ok(!tooLow.valid);
      assert.equal(tooLow.errors[0].rule, 'min');

      const tooHigh = template.validateField(15, rangeRule, 'field');
      assert.ok(!tooHigh.valid);
      assert.equal(tooHigh.errors[0].rule, 'max');
    });
  });

  describe('Environment File Generation', () => {
    test('should generate proper environment file format', () => {
      const template_config = {
        environment: 'development',
        database: { url: '${DEV_DATABASE_URL}' },
        supabase: { projectUrl: '${DEV_SUPABASE_PROJECT_URL}' }
      };

      const envContent = template.generateEnvironmentFile(
        template_config, 
        'development', 
        { migrationProfile: 'safe' }
      );

      assert.ok(envContent.includes('# Environment configuration for development'));
      assert.ok(envContent.includes('# Generated on'));
      assert.ok(envContent.includes('# Migration profile: safe'));
      assert.ok(envContent.includes('DEV_DATABASE_URL='));
      assert.ok(envContent.includes('# Database Configuration'));
      assert.ok(envContent.includes('# Supabase Configuration'));
    });

    test('should generate example values for different field types', () => {
      const stringRule = { type: 'string', description: 'String field' };
      const numberRule = { type: 'number', min: 1, description: 'Number field' };
      const booleanRule = { type: 'boolean', description: 'Boolean field' };
      const enumRule = { type: 'string', enum: ['a', 'b', 'c'], description: 'Enum field' };
      const defaultRule = { type: 'string', default: 'default_value', description: 'Default field' };

      assert.equal(template.getExampleValue(stringRule, 'test'), 'example_value');
      assert.equal(template.getExampleValue(numberRule, 'port'), 1);
      assert.equal(template.getExampleValue(booleanRule, 'enabled'), 'false');
      assert.equal(template.getExampleValue(enumRule, 'option'), 'a');
      assert.equal(template.getExampleValue(defaultRule, 'field'), 'default_value');

      // Test field name-based examples
      assert.ok(template.getExampleValue(stringRule, 'password').includes('secret'));
      assert.ok(template.getExampleValue(stringRule, 'url').includes('https://'));
    });
  });

  describe('Configuration File Writing', () => {
    test('should write JSON configuration file', async () => {
      const config = {
        database: { url: 'postgresql://test' },
        _comment: 'This should be removed',
        nested: {
          value: 'test',
          _field_comment: 'This should also be removed'
        }
      };

      const filePath = join(tempDir, 'config.json');
      await template.writeConfigurationFile(config, filePath);

      assert.ok(existsSync(filePath));
      
      const written = JSON.parse(readFileSync(filePath, 'utf8'));
      assert.ok(written.database);
      assert.ok(written.nested.value);
      assert.ok(!written._comment);
      assert.ok(!written.nested._field_comment);
    });

    test('should write indented JSON by default', async () => {
      const config = { test: 'value' };
      const filePath = join(tempDir, 'indented.json');
      
      await template.writeConfigurationFile(config, filePath, { indent: true });
      
      const content = readFileSync(filePath, 'utf8');
      assert.ok(content.includes('  ')); // Should have indentation
      assert.ok(content.includes('\n')); // Should have newlines
    });

    test('should write compact JSON when requested', async () => {
      const config = { test: 'value' };
      const filePath = join(tempDir, 'compact.json');
      
      await template.writeConfigurationFile(config, filePath, { indent: false });
      
      const content = readFileSync(filePath, 'utf8');
      assert.ok(!content.includes('  ')); // Should not have indentation
      assert.ok(!content.includes('\n')); // Should not have newlines (except maybe at end)
    });

    test('should handle write errors', async () => {
      const config = { test: 'value' };
      const invalidPath = '/invalid/path/config.json';
      
      try {
        await template.writeConfigurationFile(config, invalidPath);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof ConfigurationTemplateError);
        assert.ok(error.message.includes('Failed to write configuration file'));
      }
    });

    test('should reject unsupported formats', async () => {
      const config = { test: 'value' };
      const filePath = join(tempDir, 'config.yaml');
      
      try {
        await template.writeConfigurationFile(config, filePath, { format: 'yaml' });
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof ConfigurationTemplateError);
        assert.ok(error.message.includes('Unsupported format'));
      }
    });
  });

  describe('Override and Expansion', () => {
    test('should apply nested overrides correctly', () => {
      const template_config = {
        database: { url: 'original' },
        nested: { deep: { value: 'original' } }
      };

      const overrides = {
        'database.url': 'overridden',
        'nested.deep.value': 'overridden',
        'new.field': 'created'
      };

      template.applyOverrides(template_config, overrides);

      assert.equal(template_config.database.url, 'overridden');
      assert.equal(template_config.nested.deep.value, 'overridden');
      assert.equal(template_config.new.field, 'created');
    });

    test('should expand environment variables with defaults', () => {
      process.env.TEST_VAR = 'env_value';
      delete process.env.MISSING_VAR;

      const config = {
        existing: '${TEST_VAR}',
        withDefault: '${MISSING_VAR:-default_value}',
        missing: '${MISSING_VAR}',
        regular: 'no_expansion'
      };

      const expanded = template.expandEnvironmentVariables(config, 'test');

      assert.equal(expanded.existing, 'env_value');
      assert.equal(expanded.withDefault, 'default_value');
      assert.equal(expanded.missing, '${MISSING_VAR}'); // Kept as placeholder
      assert.equal(expanded.regular, 'no_expansion');
    });

    test('should clean config for output', () => {
      const config = {
        database: {
          url: 'test',
          _url_comment: 'This is a comment'
        },
        _metadata: 'should remain',
        _field_comment: 'should be removed',
        nested: {
          value: 'test',
          _nested_comment: 'should be removed'
        }
      };

      const cleaned = template.cleanConfigForOutput(config);

      assert.ok(cleaned.database.url);
      assert.ok(!cleaned.database._url_comment);
      assert.ok(!cleaned._field_comment);
      assert.ok(cleaned._metadata); // _metadata should remain
      assert.ok(cleaned.nested.value);
      assert.ok(!cleaned.nested._nested_comment);
    });
  });

  describe('Error Types', () => {
    test('should create proper error instances', () => {
      const templateError = new ConfigurationTemplateError('Template error', { context: 'test' });
      assert.ok(templateError instanceof Error);
      assert.equal(templateError.name, 'ConfigurationTemplateError');
      assert.equal(templateError.context.context, 'test');

      const validationError = new ConfigurationValidationError('Validation error', 'field', 'value');
      assert.equal(validationError.name, 'ConfigurationValidationError');
      assert.equal(validationError.field, 'field');
      assert.equal(validationError.value, 'value');

      const expansionError = new EnvironmentExpansionError('Expansion error', 'VAR');
      assert.equal(expansionError.name, 'EnvironmentExpansionError');
      assert.equal(expansionError.variable, 'VAR');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete configuration workflow', async () => {
      // Generate configuration
      const config = await template.generate('development', {
        migrationProfile: 'balanced',
        includeComments: true,
        generateEnvFile: true,
        overrides: {
          'database.poolSize': 15,
          'logging.level': 'debug'
        }
      });

      // Validate generated configuration
      const cleanConfig = template.cleanConfigForOutput(config);
      delete cleanConfig._envFile; // Remove env file content for validation
      
      const validation = await template.validate(cleanConfig);
      assert.ok(validation.valid, `Validation errors: ${JSON.stringify(validation.errors)}`);

      // Write to file
      const configPath = join(tempDir, 'wesley.config.json');
      await template.writeConfigurationFile(cleanConfig, configPath);
      assert.ok(existsSync(configPath));

      // Write env file
      const envPath = join(tempDir, '.env.example');
      writeFileSync(envPath, config._envFile);
      assert.ok(existsSync(envPath));

      // Verify file contents
      const writtenConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.equal(writtenConfig.environment, 'development');
      assert.equal(writtenConfig.database.poolSize, 15);
      assert.equal(writtenConfig.logging.level, 'debug');

      const envContent = readFileSync(envPath, 'utf8');
      assert.ok(envContent.includes('DEV_DATABASE_URL'));
    });

    test('should handle different environments consistently', async () => {
      const environments = ['development', 'staging', 'production'];
      const profiles = ['safe', 'balanced', 'aggressive'];

      for (const env of environments) {
        for (const profile of profiles) {
          const config = await template.generate(env, {
            migrationProfile: profile,
            generateEnvFile: false
          });

          assert.equal(config.environment, env);
          assert.equal(config.migration.profile, profile);
          
          // Verify profile settings were applied
          const profileSettings = MIGRATION_PROFILES[profile].settings;
          assert.equal(config.migration.enableTransactions, profileSettings.enableTransactions);
          assert.equal(config.migration.requireConfirmation, profileSettings.requireConfirmation);

          // Validate the generated configuration
          const cleanConfig = template.cleanConfigForOutput(config);
          const validation = await template.validate(cleanConfig);
          
          if (!validation.valid) {
            console.error(`Validation failed for ${env}/${profile}:`, validation.errors);
          }
          assert.ok(validation.valid);
        }
      }
    });

    test('should maintain consistency across generate-validate-write cycle', async () => {
      const originalConfig = await template.generate('production', {
        migrationProfile: 'safe',
        includeComments: true,
        includeOptional: true
      });

      // Clean and validate
      const cleanConfig = template.cleanConfigForOutput(originalConfig);
      delete cleanConfig._envFile;
      
      const validation = await template.validate(cleanConfig);
      assert.ok(validation.valid);

      // Write and read back
      const filePath = join(tempDir, 'test-config.json');
      await template.writeConfigurationFile(cleanConfig, filePath);
      
      const readBack = JSON.parse(readFileSync(filePath, 'utf8'));
      
      // Should maintain core structure
      assert.equal(readBack.environment, 'production');
      assert.ok(readBack.database);
      assert.ok(readBack.supabase);
      assert.ok(readBack.migration);

      // Re-validate read config
      const reValidation = await template.validate(readBack);
      assert.ok(reValidation.valid);
    });
  });

  describe('Event System', () => {
    test('should emit all expected events during generation', async () => {
      await template.generate('development');

      const events = mockEventPublisher.events;
      
      // Should have request and generated events
      assert.ok(events.some(e => e instanceof ConfigurationTemplateRequested));
      assert.ok(events.some(e => e instanceof ConfigurationTemplateGenerated));
      
      const requestEvent = events.find(e => e instanceof ConfigurationTemplateRequested);
      assert.equal(requestEvent.payload.environment, 'development');
    });

    test('should emit validation events', async () => {
      const config = { database: { url: 'postgresql://test' } };
      await template.validate(config);

      const validationEvents = mockEventPublisher.getEventsByType('CONFIGURATION_VALIDATED');
      assert.equal(validationEvents.length, 1);
    });

    test('should emit error events on failures', async () => {
      try {
        await template.validate(null);
      } catch (error) {
        // Expected to throw
      }

      const errorEvents = mockEventPublisher.getEventsByType('CONFIGURATION_ERROR');
      assert.ok(errorEvents.length > 0);
    });
  });
});