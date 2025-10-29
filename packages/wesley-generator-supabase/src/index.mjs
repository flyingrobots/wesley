/**
 * Supabase Generator Exports
 * Side-effect free - only export functions
 * NO imports of files with broken dependencies!
 */

// Export emit functions for lazy loading
export { 
  emitDDL, 
  emitRLS, 
  emitMigrations, 
  emitPgTap 
} from './emit.mjs';

// The SQLDeparser is available if needed directly
export { SQLDeparser } from './SQLDeparser.mjs';