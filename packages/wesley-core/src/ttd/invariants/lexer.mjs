/**
 * TTD Invariant Expression Lexer
 *
 * Tokenizes invariant expressions into a stream of tokens.
 */

/**
 * Token types
 */
export const TokenType = {
  // Literals
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  IDENTIFIER: 'IDENTIFIER',

  // Keywords
  FORALL: 'FORALL',
  IN: 'IN',

  // Subject keywords
  TICK: 'TICK',
  OP: 'OP',
  CHANNEL: 'CHANNEL',
  RULE: 'RULE',

  // Method keywords
  MUST_EMIT: 'MUST_EMIT',
  PRODUCES: 'PRODUCES',
  EMITS_TO: 'EMITS_TO',
  WITHIN: 'WITHIN',

  // Operators
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  STAR: 'STAR',
  SLASH: 'SLASH',
  BANG: 'BANG',

  // Comparison
  EQ: 'EQ',
  NEQ: 'NEQ',
  LT: 'LT',
  LTE: 'LTE',
  GT: 'GT',
  GTE: 'GTE',

  // Logical
  AND: 'AND',
  OR: 'OR',

  // Punctuation
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  LBRACKET: 'LBRACKET',
  RBRACKET: 'RBRACKET',
  DOT: 'DOT',
  COMMA: 'COMMA',
  COLON: 'COLON',
  SEMICOLON: 'SEMICOLON',

  // End of file
  EOF: 'EOF'
};

/**
 * Keywords map
 */
const KEYWORDS = {
  forall: TokenType.FORALL,
  in: TokenType.IN,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  tick: TokenType.TICK,
  op: TokenType.OP,
  channel: TokenType.CHANNEL,
  rule: TokenType.RULE,
  mustEmit: TokenType.MUST_EMIT,
  produces: TokenType.PRODUCES,
  emitsTo: TokenType.EMITS_TO,
  within: TokenType.WITHIN
};

/**
 * Create a token
 */
function token(type, value, line, column) {
  return { type, value, line, column };
}

/**
 * Tokenize an invariant expression
 *
 * @param {string} source - Expression source
 * @returns {Array} Array of tokens
 */
export function tokenize(source) {
  const tokens = [];
  let pos = 0;
  let line = 1;
  let column = 1;

  function peek(offset = 0) {
    return source[pos + offset];
  }

  function advance() {
    const char = source[pos];
    pos++;
    if (char === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    return char;
  }

  function _match(expected) {
    if (peek() === expected) {
      advance();
      return true;
    }
    return false;
  }

  function skipWhitespace() {
    while (pos < source.length) {
      const c = peek();
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
        advance();
      } else if (c === '/' && peek(1) === '/') {
        // Line comment
        while (pos < source.length && peek() !== '\n') {
          advance();
        }
      } else {
        break;
      }
    }
  }

  function readString(quote) {
    const startLine = line;
    const startColumn = column;
    advance(); // consume opening quote

    let value = '';
    while (pos < source.length && peek() !== quote) {
      if (peek() === '\\') {
        advance();
        const escaped = advance();
        switch (escaped) {
        case 'n': value += '\n'; break;
        case 't': value += '\t'; break;
        case 'r': value += '\r'; break;
        case '\\': value += '\\'; break;
        case '"': value += '"'; break;
        case "'": value += "'"; break;
        default: value += escaped;
        }
      } else {
        value += advance();
      }
    }

    if (pos >= source.length) {
      throw new Error(`Unterminated string at line ${startLine}, column ${startColumn}`);
    }

    advance(); // consume closing quote
    return token(TokenType.STRING, value, startLine, startColumn);
  }

  function readNumber() {
    const startLine = line;
    const startColumn = column;
    let value = '';

    while (pos < source.length && /[0-9]/.test(peek())) {
      value += advance();
    }

    // Decimal part
    if (peek() === '.' && /[0-9]/.test(peek(1))) {
      value += advance(); // consume '.'
      while (pos < source.length && /[0-9]/.test(peek())) {
        value += advance();
      }
    }

    return token(TokenType.NUMBER, value, startLine, startColumn);
  }

  function readIdentifier() {
    const startLine = line;
    const startColumn = column;
    let value = '';

    while (pos < source.length && /[a-zA-Z0-9_]/.test(peek())) {
      value += advance();
    }

    const type = KEYWORDS[value] || TokenType.IDENTIFIER;
    return token(type, value, startLine, startColumn);
  }

  while (pos < source.length) {
    skipWhitespace();
    if (pos >= source.length) break;

    const startLine = line;
    const startColumn = column;
    const c = peek();

    // String literals
    if (c === '"' || c === "'") {
      tokens.push(readString(c));
      continue;
    }

    // Numbers
    if (/[0-9]/.test(c)) {
      tokens.push(readNumber());
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(c)) {
      tokens.push(readIdentifier());
      continue;
    }

    // Two-character operators
    if (c === '=' && peek(1) === '=') {
      advance(); advance();
      tokens.push(token(TokenType.EQ, '==', startLine, startColumn));
      continue;
    }
    if (c === '!' && peek(1) === '=') {
      advance(); advance();
      tokens.push(token(TokenType.NEQ, '!=', startLine, startColumn));
      continue;
    }
    if (c === '<' && peek(1) === '=') {
      advance(); advance();
      tokens.push(token(TokenType.LTE, '<=', startLine, startColumn));
      continue;
    }
    if (c === '>' && peek(1) === '=') {
      advance(); advance();
      tokens.push(token(TokenType.GTE, '>=', startLine, startColumn));
      continue;
    }
    if (c === '&' && peek(1) === '&') {
      advance(); advance();
      tokens.push(token(TokenType.AND, '&&', startLine, startColumn));
      continue;
    }
    if (c === '|' && peek(1) === '|') {
      advance(); advance();
      tokens.push(token(TokenType.OR, '||', startLine, startColumn));
      continue;
    }

    // Single-character tokens
    advance();
    switch (c) {
    case '+': tokens.push(token(TokenType.PLUS, '+', startLine, startColumn)); break;
    case '-': tokens.push(token(TokenType.MINUS, '-', startLine, startColumn)); break;
    case '*': tokens.push(token(TokenType.STAR, '*', startLine, startColumn)); break;
    case '/': tokens.push(token(TokenType.SLASH, '/', startLine, startColumn)); break;
    case '!': tokens.push(token(TokenType.BANG, '!', startLine, startColumn)); break;
    case '<': tokens.push(token(TokenType.LT, '<', startLine, startColumn)); break;
    case '>': tokens.push(token(TokenType.GT, '>', startLine, startColumn)); break;
    case '(': tokens.push(token(TokenType.LPAREN, '(', startLine, startColumn)); break;
    case ')': tokens.push(token(TokenType.RPAREN, ')', startLine, startColumn)); break;
    case '[': tokens.push(token(TokenType.LBRACKET, '[', startLine, startColumn)); break;
    case ']': tokens.push(token(TokenType.RBRACKET, ']', startLine, startColumn)); break;
    case '.': tokens.push(token(TokenType.DOT, '.', startLine, startColumn)); break;
    case ',': tokens.push(token(TokenType.COMMA, ',', startLine, startColumn)); break;
    case ':': tokens.push(token(TokenType.COLON, ':', startLine, startColumn)); break;
    case ';': tokens.push(token(TokenType.SEMICOLON, ';', startLine, startColumn)); break;
    default:
      throw new Error(`Unexpected character '${c}' at line ${startLine}, column ${startColumn}`);
    }
  }

  tokens.push(token(TokenType.EOF, '', line, column));
  return tokens;
}
