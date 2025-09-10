#!/usr/bin/env node

/**
 * Wesley Scaffold Command
 * Generate starter schemas for common patterns
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCAFFOLDS = {
  'multi-tenant': {
    name: 'Multi-Tenant SaaS',
    description: 'Production-ready multi-tenant schema with organizations, users, and RLS',
    file: 'multi-tenant.graphql'
  },
  'blog': {
    name: 'Blog Platform',
    description: 'Blog with posts, authors, comments, and categories',
    file: 'blog.graphql'
  },
  'ecommerce': {
    name: 'E-Commerce',
    description: 'Online store with products, orders, and inventory',
    file: 'ecommerce.graphql'
  },
  'social': {
    name: 'Social Network',
    description: 'Social platform with users, posts, follows, and likes',
    file: 'social.graphql'
  }
};

export class ScaffoldCommand {
  constructor(options = {}) {
    this.options = options;
  }
  
  /**
   * List available scaffolds
   */
  list() {
    console.log('\nAvailable Wesley Scaffolds:\n');
    
    for (const [key, scaffold] of Object.entries(SCAFFOLDS)) {
      console.log(`  ${key.padEnd(15)} - ${scaffold.name}`);
      console.log(`  ${' '.repeat(15)}   ${scaffold.description}\n`);
    }
    
    console.log('Usage: wesley scaffold <type> [--output <file>]\n');
  }
  
  /**
   * Generate a scaffold
   */
  generate(type, outputPath) {
    const scaffold = SCAFFOLDS[type];
    
    if (!scaffold) {
      console.error(`Unknown scaffold type: ${type}`);
      console.log('\nAvailable types:');
      for (const key of Object.keys(SCAFFOLDS)) {
        console.log(`  - ${key}`);
      }
      process.exit(1);
    }
    
    // Check if output file exists
    if (existsSync(outputPath) && !this.options.force) {
      console.error(`File already exists: ${outputPath}`);
      console.log('Use --force to overwrite');
      process.exit(1);
    }
    
    // Read scaffold file
    const scaffoldPath = join(__dirname, '..', 'scaffolds', scaffold.file);
    
    if (!existsSync(scaffoldPath)) {
      // If scaffold doesn't exist yet, create a placeholder
      console.log(`Scaffold '${type}' is coming soon!`);
      console.log(`For now, using multi-tenant as template...`);
      
      const multiTenantPath = join(__dirname, '..', 'scaffolds', 'multi-tenant.graphql');
      if (existsSync(multiTenantPath)) {
        const content = readFileSync(multiTenantPath, 'utf-8');
        writeFileSync(outputPath, content);
      } else {
        console.error('Scaffold files not found. Please reinstall wesley.');
        process.exit(1);
      }
      return;
    }
    
    const content = readFileSync(scaffoldPath, 'utf-8');
    
    // Customize content based on options
    let customized = content;
    
    if (this.options.projectName) {
      customized = customized.replace(
        /# Wesley .* Starter Schema/,
        `# ${this.options.projectName} Schema`
      );
    }
    
    if (this.options.minimal) {
      // Remove optional sections for minimal setup
      customized = customized.replace(
        /# =+\n# RPC Functions \(Optional\)\n# =+[\s\S]*$/,
        ''
      );
    }
    
    // Write output file
    writeFileSync(outputPath, customized);
    
    console.log(`✨ Created ${scaffold.name} schema at: ${outputPath}`);
    console.log('\nNext steps:');
    console.log(`  1. Review and customize the schema`);
    console.log(`  2. Generate SQL: wesley generate --schema ${outputPath}`);
    console.log(`  3. Run migrations: wesley migrate up`);
    console.log(`  4. Generate TypeScript types: wesley generate --types`);
    
    if (type === 'multi-tenant') {
      console.log('\n💡 Multi-tenant tips:');
      console.log('  - The Membership table is automatically detected');
      console.log('  - @tenant directive enables org-scoped RLS policies');
      console.log('  - @owner directive adds user-level access control');
      console.log('  - Helper functions are generated in wesley schema');
    }
  }
  
  /**
   * Run the scaffold command
   */
  run(type, options = {}) {
    this.options = options;
    
    if (!type || type === 'list') {
      this.list();
      return;
    }
    
    const outputPath = options.output || `${type}.graphql`;
    this.generate(type, outputPath);
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const type = process.argv[2];
  const options = {
    output: process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1],
    force: process.argv.includes('--force'),
    minimal: process.argv.includes('--minimal'),
    projectName: process.argv.find(arg => arg.startsWith('--name='))?.split('=')[1]
  };
  
  const command = new ScaffoldCommand();
  command.run(type, options);
}