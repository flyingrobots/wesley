/**
 * TTD Invariant Expression Parser
 *
 * Recursive descent parser for the TTD expression language.
 *
 * Grammar:
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

import { tokenize, TokenType } from './lexer.mjs';
import {
  literal,
  identifier,
  binary,
  unary,
  comparison,
  logical,
  propertyAccess,
  methodCall,
  forall
} from './ast.mjs';

/**
 * Parser class
 */
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(offset = 0) {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // EOF
    }
    return this.tokens[idx];
  }

  current() {
    return this.peek(0);
  }

  advance() {
    const tok = this.current();
    if (tok.type !== TokenType.EOF) {
      this.pos++;
    }
    return tok;
  }

  check(type) {
    return this.current().type === type;
  }

  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  expect(type, message) {
    if (this.check(type)) {
      return this.advance();
    }
    const tok = this.current();
    throw new Error(`${message} at line ${tok.line}, column ${tok.column}. Got ${tok.type}`);
  }

  /**
   * Check if current token can be used as a property/method name
   * Includes identifiers and method keywords that can appear after a dot
   */
  isPropertyName() {
    const type = this.current().type;
    return type === TokenType.IDENTIFIER ||
           type === TokenType.MUST_EMIT ||
           type === TokenType.PRODUCES ||
           type === TokenType.EMITS_TO ||
           type === TokenType.WITHIN;
  }

  /**
   * Consume current token if it's a valid property name
   */
  expectPropertyName(message) {
    if (this.isPropertyName()) {
      return this.advance();
    }
    const tok = this.current();
    throw new Error(`${message} at line ${tok.line}, column ${tok.column}. Got ${tok.type}`);
  }

  /**
   * Parse expression
   */
  parseExpr() {
    return this.parseLogicalOr();
  }

  /**
   * Parse logical OR (||)
   */
  parseLogicalOr() {
    let left = this.parseLogicalAnd();

    while (this.match(TokenType.OR)) {
      const right = this.parseLogicalAnd();
      left = logical('||', left, right);
    }

    return left;
  }

  /**
   * Parse logical AND (&&)
   */
  parseLogicalAnd() {
    let left = this.parseComparison();

    while (this.match(TokenType.AND)) {
      const right = this.parseComparison();
      left = logical('&&', left, right);
    }

    return left;
  }

  /**
   * Parse comparison (==, !=, <, <=, >, >=)
   */
  parseComparison() {
    const left = this.parseAdditive();

    if (this.match(TokenType.EQ)) {
      const right = this.parseAdditive();
      return comparison('==', left, right);
    }
    if (this.match(TokenType.NEQ)) {
      const right = this.parseAdditive();
      return comparison('!=', left, right);
    }
    if (this.match(TokenType.LT)) {
      const right = this.parseAdditive();
      return comparison('<', left, right);
    }
    if (this.match(TokenType.LTE)) {
      const right = this.parseAdditive();
      return comparison('<=', left, right);
    }
    if (this.match(TokenType.GT)) {
      const right = this.parseAdditive();
      return comparison('>', left, right);
    }
    if (this.match(TokenType.GTE)) {
      const right = this.parseAdditive();
      return comparison('>=', left, right);
    }

    return left;
  }

  /**
   * Parse additive (+, -)
   */
  parseAdditive() {
    let left = this.parseMultiplicative();

    while (true) {
      if (this.match(TokenType.PLUS)) {
        const right = this.parseMultiplicative();
        left = binary('+', left, right);
      } else if (this.match(TokenType.MINUS)) {
        const right = this.parseMultiplicative();
        left = binary('-', left, right);
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * Parse multiplicative (*, /)
   */
  parseMultiplicative() {
    let left = this.parseUnary();

    while (true) {
      if (this.match(TokenType.STAR)) {
        const right = this.parseUnary();
        left = binary('*', left, right);
      } else if (this.match(TokenType.SLASH)) {
        const right = this.parseUnary();
        left = binary('/', left, right);
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * Parse unary (!, -)
   */
  parseUnary() {
    if (this.match(TokenType.BANG)) {
      const operand = this.parseUnary();
      return unary('!', operand);
    }
    if (this.match(TokenType.MINUS)) {
      const operand = this.parseUnary();
      return unary('-', operand);
    }

    return this.parsePostfix();
  }

  /**
   * Parse postfix (property access, method calls)
   */
  parsePostfix() {
    let expr = this.parsePrimary();

    while (this.match(TokenType.DOT)) {
      const nameTok = this.expectPropertyName('Expected property name after "."');
      const name = nameTok.value;

      // Check for method call
      if (this.match(TokenType.LPAREN)) {
        const args = this.parseArgs();
        this.expect(TokenType.RPAREN, 'Expected ")" after method arguments');
        expr = methodCall(expr, name, args);
      } else {
        expr = propertyAccess(expr, name);
      }
    }

    return expr;
  }

  /**
   * Parse method arguments
   */
  parseArgs() {
    const args = [];

    if (!this.check(TokenType.RPAREN)) {
      args.push(this.parseExpr());

      while (this.match(TokenType.COMMA)) {
        args.push(this.parseExpr());
      }
    }

    return args;
  }

  /**
   * Parse primary (literals, identifiers, grouping, quantified)
   */
  parsePrimary() {
    // Quantified expression
    if (this.match(TokenType.FORALL)) {
      return this.parseQuantified();
    }

    // Boolean literals
    if (this.match(TokenType.TRUE)) {
      return literal(true, 'boolean');
    }
    if (this.match(TokenType.FALSE)) {
      return literal(false, 'boolean');
    }

    // Number literal
    if (this.check(TokenType.NUMBER)) {
      const tok = this.advance();
      const value = tok.value.includes('.') ? parseFloat(tok.value) : parseInt(tok.value, 10);
      return literal(value, 'number');
    }

    // String literal
    if (this.check(TokenType.STRING)) {
      const tok = this.advance();
      return literal(tok.value, 'string');
    }

    // Subject keywords (tick, op, channel, rule)
    if (this.match(TokenType.TICK)) {
      return identifier('tick');
    }
    if (this.match(TokenType.OP)) {
      return identifier('op');
    }
    if (this.match(TokenType.CHANNEL)) {
      return identifier('channel');
    }
    if (this.match(TokenType.RULE)) {
      return identifier('rule');
    }

    // Identifier
    if (this.check(TokenType.IDENTIFIER)) {
      const tok = this.advance();
      return identifier(tok.value);
    }

    // Grouping
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpr();
      this.expect(TokenType.RPAREN, 'Expected ")" after expression');
      return expr;
    }

    const tok = this.current();
    throw new Error(`Unexpected token "${tok.value}" (${tok.type}) at line ${tok.line}, column ${tok.column}`);
  }

  /**
   * Parse quantified expression (forall x in Collection: expr)
   */
  parseQuantified() {
    const varTok = this.expect(TokenType.IDENTIFIER, 'Expected identifier after "forall"');
    const variable = varTok.value;

    this.expect(TokenType.IN, 'Expected "in" after variable name in forall');

    const collTok = this.expect(TokenType.IDENTIFIER, 'Expected collection name after "in"');
    const collection = collTok.value;

    this.expect(TokenType.COLON, 'Expected ":" after collection name in forall');

    const body = this.parseExpr();

    return forall(variable, collection, body);
  }
}

/**
 * Parse an invariant expression string into an AST
 *
 * @param {string} source - Expression source
 * @returns {Object} AST node
 */
export function parseExpr(source) {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  const ast = parser.parseExpr();

  // Ensure we consumed all tokens
  if (!parser.check(TokenType.EOF)) {
    const tok = parser.current();
    throw new Error(`Unexpected token "${tok.value}" at line ${tok.line}, column ${tok.column}`);
  }

  return ast;
}
