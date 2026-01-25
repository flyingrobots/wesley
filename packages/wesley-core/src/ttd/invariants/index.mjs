/**
 * TTD Invariants Module
 *
 * Provides lexer, parser, and AST for the TTD expression language
 * used in invariants.
 *
 * Expression Grammar (EBNF):
 *
 * expr       = logical_or ;
 * logical_or = logical_and ( "||" logical_and )* ;
 * logical_and = comparison ( "&&" comparison )* ;
 * comparison = additive ( ( "==" | "!=" | "<" | "<=" | ">" | ">=" ) additive )? ;
 * additive   = multiplicative ( ( "+" | "-" ) multiplicative )* ;
 * multiplicative = unary ( ( "*" | "/" ) unary )* ;
 * unary      = ( "!" | "-" ) unary | postfix ;
 * postfix    = primary ( "." IDENT ( "(" args? ")" )? )* ;
 * primary    = NUMBER | STRING | BOOL | IDENT | "(" expr ")" | quantified ;
 * quantified = "forall" IDENT "in" IDENT ":" expr ;
 * args       = expr ( "," expr )* ;
 */

export * from './lexer.mjs';
export * from './parser.mjs';
export * from './ast.mjs';
export * from './golden.mjs';
export * from './vm.mjs';
export * from './obligations.mjs';
export * from './verifier.mjs';
