/**
 * Evidence Map - Track where schema elements land in generated artifacts
 * This is the key to SHA-lock HOLMES's citation system
 */

export class EvidenceMap {
  constructor() {
    this.map = new Map();
    this.errors = new Map(); // uid -> error details
    this.warnings = new Map(); // uid -> warning details
    this.sha = null;
    this.timestamp = new Date().toISOString();
    this.version = '1.0.0'; // Evidence bundle version
  }

  setSha(sha) {
    this.sha = sha;
  }

  /**
   * Record where a schema element was generated
   * @param {string} uid - Stable identifier (@uid directive value or generated)
   * @param {string} kind - Type of artifact (sql, ts, zod, test, etc.)
   * @param {object} location - Where it was generated
   */
  record(uid, kind, location) {
    if (!this.map.has(uid)) {
      this.map.set(uid, {});
    }
    
    const element = this.map.get(uid);
    if (!element[kind]) {
      element[kind] = [];
    }
    
    element[kind].push({
      file: location.file,
      lines: location.lines,
      sha: this.sha || 'uncommitted',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get all evidence for a schema element
   */
  getEvidence(uid) {
    return this.map.get(uid) || {};
  }

  /**
   * Get citation for specific artifact
   */
  getCitation(uid, kind) {
    const evidence = this.getEvidence(uid);
    const locations = evidence[kind] || [];
    
    return locations.map(loc => 
      `${loc.file}:${loc.lines}@${loc.sha.substring(0, 7)}`
    );
  }

  /**
   * Check if element has all required artifacts
   */
  hasCompleteArtifacts(uid, required = ['sql', 'ts', 'zod']) {
    const evidence = this.getEvidence(uid);
    return required.every(kind => evidence[kind]?.length > 0);
  }
  
  /**
   * Record an error for a schema element
   */
  recordError(uid, error) {
    if (!this.errors.has(uid)) {
      this.errors.set(uid, []);
    }
    
    this.errors.get(uid).push({
      message: error.message,
      type: error.type || 'validation',
      severity: error.severity || 'error',
      context: error.context || {},
      timestamp: new Date().toISOString(),
      stack: error.stack
    });
  }
  
  /**
   * Record a warning for a schema element
   */
  recordWarning(uid, warning) {
    if (!this.warnings.has(uid)) {
      this.warnings.set(uid, []);
    }
    
    this.warnings.get(uid).push({
      message: warning.message,
      type: warning.type || 'validation',
      severity: warning.severity || 'warning',
      context: warning.context || {},
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get all errors for a schema element
   */
  getErrors(uid) {
    return this.errors.get(uid) || [];
  }
  
  /**
   * Get all warnings for a schema element
   */
  getWarnings(uid) {
    return this.warnings.get(uid) || [];
  }
  
  /**
   * Check if any errors exist
   */
  hasErrors() {
    return this.errors.size > 0;
  }
  
  /**
   * Get all errors as an array
   */
  getAllErrors() {
    const allErrors = [];
    for (const [uid, errors] of this.errors) {
      for (const error of errors) {
        allErrors.push({ uid, ...error });
      }
    }
    return allErrors;
  }
  
  /**
   * Get all warnings as an array
   */
  getAllWarnings() {
    const allWarnings = [];
    for (const [uid, warnings] of this.warnings) {
      for (const warning of warnings) {
        allWarnings.push({ uid, ...warning });
      }
    }
    return allWarnings;
  }

  /**
   * Export to JSON
   */
  toJSON() {
    const result = {};
    const errors = {};
    const warnings = {};
    
    for (const [uid, evidence] of this.map) {
      result[uid] = evidence;
    }
    
    for (const [uid, errorList] of this.errors) {
      errors[uid] = errorList;
    }
    
    for (const [uid, warningList] of this.warnings) {
      warnings[uid] = warningList;
    }
    
    return {
      version: this.version,
      sha: this.sha,
      timestamp: this.timestamp,
      evidence: result,
      errors,
      warnings
    };
  }

  /**
   * Import from JSON
   */
  static fromJSON(json) {
    const map = new EvidenceMap();
    map.version = json.version || '1.0.0';
    map.sha = json.sha;
    map.timestamp = json.timestamp;
    
    for (const [uid, evidence] of Object.entries(json.evidence || {})) {
      map.map.set(uid, evidence);
    }
    
    return map;
  }
}