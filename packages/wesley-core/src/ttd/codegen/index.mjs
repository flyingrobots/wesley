/**
 * TTD Codegen Module
 *
 * Exports TypeScript code generators. Rust code generation is handled by
 * external tools (e.g., echo-ttd-gen) that consume the TTD IR/manifest.
 *
 * Architecture:
 * - Wesley generates TTD IR (JSON manifest)
 * - TypeScript codegen happens here (TS can generate TS)
 * - Rust codegen is done by Rust tools using syn/quote/prettyplease
 */

export * from './ts-types.mjs';
export * from './ts-zod.mjs';
export * from './ts-registry.mjs';
export * from './orchestrator.mjs';
