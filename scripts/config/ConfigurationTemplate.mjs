/**
 * ConfigurationTemplate - Generates configuration templates for environments
 * NOTE: Lives under scripts to avoid polluting core with fs/path usage.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DomainEvent } from '../../packages/wesley-core/src/domain/Events.mjs';

export class ConfigurationTemplateRequested extends DomainEvent {
  constructor(environment, config) {
    super('CONFIG_TEMPLATE_REQUESTED', { environment, config });
  }
}

export class ConfigurationTemplateGenerated extends DomainEvent {
  constructor(template, environment) {
    super('CONFIG_TEMPLATE_GENERATED', { template, environment });
  }
}

export class ConfigurationTemplateError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ConfigurationTemplateError';
    this.context = context;
  }
}

export class ConfigurationTemplate {
  constructor({ eventPublisher, logger = console } = {}) {
    this.eventPublisher = eventPublisher;
    this.logger = logger;
  }

  async generate(environment = 'development', config = {}) {
    try {
      await this.eventPublisher?.publish(new ConfigurationTemplateRequested(environment, config));
      const template = {
        environment,
        database: {
          url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/test'
        },
        supabase: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'example'
        },
        logging: {
          level: 'info'
        },
        ...config
      };
      await this.eventPublisher?.publish(new ConfigurationTemplateGenerated(template, environment));
      return template;
    } catch (e) {
      throw new ConfigurationTemplateError(e.message);
    }
  }
}

