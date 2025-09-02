/**
 * Directive Definitions for Wesley + SHA-lock HOLMES
 * These directives travel with the schema and enable intelligent analysis
 */

// Stable identity directive - survives renames
export const UID_DIRECTIVE = '@uid';

// Weight and criticality directives
export const WEIGHT_DIRECTIVE = '@weight';
export const CRITICAL_DIRECTIVE = '@critical';
export const SENSITIVE_DIRECTIVE = '@sensitive';
export const PII_DIRECTIVE = '@pii';

// Analysis hints
export const SKIP_DIRECTIVE = '@skip';
export const DEPRECATED_DIRECTIVE = '@deprecated';

/**
 * Directive value extractors
 */
export class DirectiveProcessor {
  static getUid(directives) {
    return directives?.[UID_DIRECTIVE]?.value || null;
  }

  static getWeight(directives) {
    // Check explicit weight
    if (directives?.[WEIGHT_DIRECTIVE]) {
      return parseInt(directives[WEIGHT_DIRECTIVE].value || 5);
    }
    
    // Critical fields get high weight
    if (directives?.[CRITICAL_DIRECTIVE]) {
      return 10;
    }
    
    // Infer from other directives
    if (directives?.['@primaryKey']) return 10;
    if (directives?.['@foreignKey']) return 8;
    if (directives?.['@unique']) return 8;
    if (directives?.[SENSITIVE_DIRECTIVE]) return 9;
    if (directives?.[PII_DIRECTIVE]) return 8;
    if (directives?.['@index']) return 5;
    
    // Default weight
    return 3;
  }

  static isSensitive(directives) {
    return !!(directives?.[SENSITIVE_DIRECTIVE] || directives?.[PII_DIRECTIVE]);
  }

  static isCritical(directives) {
    return !!(directives?.[CRITICAL_DIRECTIVE] || 
              directives?.['@primaryKey'] ||
              this.isSensitive(directives));
  }

  static shouldSkip(directives) {
    return !!(directives?.[SKIP_DIRECTIVE] || directives?.[DEPRECATED_DIRECTIVE]);
  }
}