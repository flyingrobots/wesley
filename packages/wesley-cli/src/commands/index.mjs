/**
 * Command Index - Auto-import all commands for registration
 * 
 * This file imports all command classes, which triggers their
 * automatic registration with the AutomaticallyRegisteredProgram system.
 */

// Import all command classes to trigger auto-registration
import './generate.mjs';
import './models.mjs';
import './typescript.mjs';
import './zod.mjs';
import './validate-bundle.mjs';

// Export nothing - this is just for side effects (registration)
export {};