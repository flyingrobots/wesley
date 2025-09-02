/**
 * Evidence Map - Track where schema elements land in generated artifacts
 * This is the key to SHA-lock HOLMES's citation system
 */

export class EvidenceMap {
  constructor() {
    this.map = new Map();
    this.sha = null;
    this.timestamp = new Date().toISOString();
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
   * Export to JSON
   */
  toJSON() {
    const result = {};
    
    for (const [uid, evidence] of this.map) {
      result[uid] = evidence;
    }
    
    return {
      sha: this.sha,
      timestamp: this.timestamp,
      evidence: result
    };
  }

  /**
   * Import from JSON
   */
  static fromJSON(json) {
    const map = new EvidenceMap();
    map.sha = json.sha;
    map.timestamp = json.timestamp;
    
    for (const [uid, evidence] of Object.entries(json.evidence || {})) {
      map.map.set(uid, evidence);
    }
    
    return map;
  }
}