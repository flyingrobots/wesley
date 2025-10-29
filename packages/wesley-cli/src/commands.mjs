/**
 * Command Auto-Registration Module
 * 
 * Importing this module triggers auto-registration of all CLI commands
 * with the AutomaticallyRegisteredProgram registry.
 */

// Import all command classes to trigger auto-registration
import './commands/generate.mjs';
import './commands/models.mjs';
import './commands/typescript.mjs';
import './commands/zod.mjs';
import './commands/validate-bundle.mjs';

// Export nothing - this is just for side effects (registration)
export {};