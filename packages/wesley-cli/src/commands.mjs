/**
 * Command Auto-Registration Module
 *
 * Importing this module triggers auto-registration of all CLI commands
 * with the AutomaticallyRegisteredProgram registry.
 *
 * NOTE: The primary entry point is program.mjs which uses WesleyCommand
 * auto-discovery. This file exists for the legacy main.mjs entry point
 * that uses AutomaticallyRegisteredProgram.
 */

// Import all command files to trigger side-effect registration
import './commands/generate.mjs';
import './commands/models.mjs';
import './commands/typescript.mjs';
import './commands/zod.mjs';
import './commands/validate-bundle.mjs';
import './commands/bundle-echo.mjs';

// Export nothing - this is just for side effects (registration)
export {};
