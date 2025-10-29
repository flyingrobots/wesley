/**
 * Pipeline Map — SDL → Schema → QIR → SQL
 *
 * Convenience helper that demonstrates the end-to-end flow used by Wesley:
 * - Parse GraphQL SDL into a domain Schema (AST-ish data model)
 * - Build a minimal QIR plan from an op JSON (MVP planner)
 * - Lower QIR to a SQL string using the built-in emitter
 *
 * This module is intentionally tiny and side-effect free so tests can import it
 * to validate the full journey without touching the larger orchestrators.
 */

import { parse as parseSDL } from 'graphql';
import { GraphQLSchemaBuilder } from '../domain/GraphQLSchemaBuilder.mjs';
import { buildPlanFromJson } from '../domain/qir/OpPlanBuilder.mjs';
import { lowerToSQL } from '../domain/qir/lowerToSQL.mjs';

/**
 * Compile a tiny pipeline from SDL and an op spec.
 *
 * @param {object} options
 * @param {string|object} options.sdl - GraphQL SDL string or parsed AST
 * @param {object} options.op - Minimal op JSON for the MVP planner
 * @returns {{ schema: import('../domain/Schema.mjs').Schema,
 *            plan: any,
 *            sql: string }}
 */
export function compilePipeline({ sdl, op }) {
  if (!sdl) throw new Error('compilePipeline: sdl is required');
  if (!op) throw new Error('compilePipeline: op is required');

  // 1) SDL → Schema (domain model)
  const ast = typeof sdl === 'string' ? parseSDL(sdl) : sdl;
  const schema = new GraphQLSchemaBuilder().buildFromAST(ast);

  // 2) Op JSON → QIR plan
  const plan = buildPlanFromJson(op);

  // 3) QIR → SQL text (string emitter)
  const sql = lowerToSQL(plan);

  return { schema, plan, sql };
}

