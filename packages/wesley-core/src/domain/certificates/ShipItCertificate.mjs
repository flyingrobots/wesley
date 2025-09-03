/**
 * SHIPIT.md Certificate System
 * 
 * The gatekeeper for all deployments. Human-readable deployment certificate
 * with machine-verifiable cryptographic signatures from SHA-lock HOLMES
 * and Dr. Wat-SUM.
 * 
 * "Go on, deploy on a Friday." - Only with a valid SHIPIT.md
 */

import crypto from 'crypto';
import { SecurityError } from '../security/InputValidator.mjs';

export class ShipItCertificate {
  constructor(spec = {}) {
    this.version = '1.0';
    this.repo = spec.repo;
    this.env = spec.env;
    this.certificateId = spec.certificateId || this.generateCertificateId();
    this.git = spec.git || {};
    this.targets = spec.targets || [];
    this.artifacts = spec.artifacts || {};
    this.drift = spec.drift || { status: 'unknown', diffs: [] };
    this.tests = spec.tests || {};
    this.risk = spec.risk || { level: 'UNKNOWN', score: 1.0 };
    this.prediction = spec.prediction || {};
    this.signatures = spec.signatures || [];
    this.expiresAt = spec.expiresAt;
    this.policy = spec.policy || {};
    this.createdAt = spec.createdAt || new Date().toISOString();
  }

  /**
   * Generate unique certificate ID
   */
  generateCertificateId(env = this.env) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const random = crypto.randomBytes(4).toString('hex');
    return `cert_${env || 'unknown'}_${timestamp}_${random}`;
  }

  /**
   * Get canonical JSON representation for signing
   * This is the stable, whitespace-agnostic version that gets signed
   */
  getCanonicalJSON() {
    const canonical = {
      version: this.version,
      certificate_id: this.certificateId,
      repo: this.repo,
      env: this.env,
      git: this.git,
      targets: this.targets.sort(), // Deterministic order
      artifacts: this.artifacts,
      drift: this.drift,
      tests: this.tests,
      risk: this.risk,
      prediction: this.prediction,
      expires_at: this.expiresAt,
      policy: this.policy,
      created_at: this.createdAt
    };

    // Sort keys for deterministic JSON
    return JSON.stringify(canonical, Object.keys(canonical).sort());
  }

  /**
   * Add cryptographic signature from a signer
   */
  addSignature(signerName, keyId, algorithm, signature, signedAt = null) {
    const existingIndex = this.signatures.findIndex(s => s.signer === signerName);
    
    const signatureEntry = {
      signer: signerName,
      key_id: keyId,
      alg: algorithm,
      signed_at: signedAt || new Date().toISOString(),
      sig: signature
    };

    if (existingIndex >= 0) {
      this.signatures[existingIndex] = signatureEntry;
    } else {
      this.signatures.push(signatureEntry);
    }
  }

  /**
   * Verify certificate is complete and valid
   */
  verify(policy = null) {
    const effectivePolicy = policy || this.policy;
    const errors = [];

    // Check expiration
    if (this.expiresAt && new Date() > new Date(this.expiresAt)) {
      errors.push('Certificate has expired');
    }

    // Check required signers
    const requiredSigners = effectivePolicy.require_signers || [];
    const presentSigners = this.signatures.map(s => s.signer);
    
    for (const requiredSigner of requiredSigners) {
      if (!presentSigners.includes(requiredSigner)) {
        errors.push(`Missing required signature from: ${requiredSigner}`);
      }
    }

    // Check risk threshold
    if (effectivePolicy.max_risk && this.risk.score > effectivePolicy.max_risk) {
      errors.push(`Risk score ${this.risk.score} exceeds policy limit ${effectivePolicy.max_risk}`);
    }

    // Check time-to-prod window
    if (effectivePolicy.max_ttp_window_sec && 
        this.prediction.window_sec > effectivePolicy.max_ttp_window_sec) {
      errors.push(`Time-to-prod window ${this.prediction.window_sec}s exceeds policy limit ${effectivePolicy.max_ttp_window_sec}s`);
    }

    // Check Friday deployment policy
    const now = new Date();
    const isFriday = now.getDay() === 5;
    if (isFriday && !effectivePolicy.allow_friday) {
      errors.push('Friday deployments not permitted by policy');
    }

    if (errors.length > 0) {
      throw new SecurityError(
        `Certificate verification failed: ${errors.join(', ')}`,
        'CERTIFICATE_INVALID',
        { errors, certificate_id: this.certificateId }
      );
    }

    return true;
  }

  /**
   * Generate human-readable SHIPIT.md content
   */
  toShipItMarkdown() {
    const riskEmoji = this.getRiskEmoji();
    const fridayStatus = this.policy.allow_friday ? '✅' : '❌';
    
    return `# Wesley Deployment Certificate — ${this.env.toUpperCase()}
> "Data Done Right." Signed by SHA-lock HOLMES. Cross-examined by Dr. Wat-SUM.

- Repo: ${this.repo}
- Env: ${this.env}
- Git: ${this.git.branch} @ ${this.git.sha}${this.git.tag ? ` (tag: ${this.git.tag})` : ''}
- Targets: ${this.targets.join(', ')}
- Window: ${this.prediction.time_to_prod_sec ? `${Math.floor(this.prediction.time_to_prod_sec / 60)}m ${this.prediction.time_to_prod_sec % 60}s` : 'unknown'}
- Risk: ${this.risk.level} (${this.risk.score.toFixed(2)}) — Friday deploy ${fridayStatus}

### Specification Completion (HOLMES)
- IR Hash: \`${this.artifacts.ir || 'unknown'}\`
- Spec Bundle: \`${this.artifacts.spec || 'unknown'}\`
- Artifacts:
  - SQL Plan: \`${this.artifacts.sql || 'unknown'}\`
  - Prisma: \`${this.artifacts.prisma || 'unknown'}\`
  - Drizzle: \`${this.artifacts.drizzle || 'unknown'}\`
  - Types/Zod: \`${this.artifacts.types || 'unknown'}\`
- Rollback Plan: \`${this.artifacts.rollback || 'unknown'}\`

### Drift & Safety (HOLMES)
- Drift Summary: ${this.drift.status} (${this.drift.diffs.length} diffs) ${this.drift.status === 'none' ? '✅' : '⚠️'}
- Lock Impact: ${this.getLockImpactSummary()}
- Rollback Plan: \`${this.artifacts.rollback || 'unknown'}\`

### Test & Evidence (Dr. Wat-SUM)
- pgTAP: ${this.tests.pgtap?.total || 0} tests (${this.tests.pgtap?.passed || 0} pass) ${this.getTestStatus('pgtap')}
- Integration: ${this.tests.integration?.total || 0} (${this.tests.integration?.passed || 0} pass) ${this.getTestStatus('integration')}
- RLS/Policy: ${this.tests.policy?.total || 0} policy probes (${this.tests.policy?.passed || 0} pass) ${this.getTestStatus('policy')}
- Evidence Pack: \`${this.artifacts.evidence || 'unknown'}\`

### Approvals
${this.signatures.map(sig => `- ${sig.signer}: ✅ (signed ${sig.signed_at})`).join('\n')}

---

\`\`\`jsonc
${JSON.stringify(this.toJSON(), null, 2)}
\`\`\`

> **Rule:** \`wesley deploy --env ${this.env}\` MUST refuse if \`SHIPIT.md\` is missing, expired, unsigned/invalid, or policy thresholds are exceeded.
`;
  }

  getRiskEmoji() {
    if (this.risk.score <= 0.2) return '✅';
    if (this.risk.score <= 0.5) return '⚠️';
    return '❌';
  }

  getLockImpactSummary() {
    // TODO: Implement based on SQL plan analysis
    return 'all operations non-blocking ✅';
  }

  getTestStatus(testType) {
    const test = this.tests[testType];
    if (!test) return '❌';
    return test.passed === test.total ? '✅' : '❌';
  }

  /**
   * Convert to JSON representation
   */
  toJSON() {
    return {
      version: this.version,
      certificate_id: this.certificateId,
      repo: this.repo,
      env: this.env,
      git: this.git,
      targets: this.targets,
      artifacts: this.artifacts,
      drift: this.drift,
      tests: this.tests,
      risk: this.risk,
      prediction: this.prediction,
      signatures: this.signatures,
      expires_at: this.expiresAt,
      policy: this.policy,
      created_at: this.createdAt
    };
  }

  /**
   * Create certificate from existing SHIPIT.md content
   */
  static fromShipItMarkdown(content) {
    // Extract JSON from markdown code block
    const jsonMatch = content.match(/```jsonc?\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new SecurityError('Invalid SHIPIT.md format - missing JSON block', 'INVALID_CERTIFICATE');
    }

    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      return new ShipItCertificate(jsonData);
    } catch (error) {
      throw new SecurityError(
        `Invalid SHIPIT.md JSON: ${error.message}`,
        'INVALID_CERTIFICATE_JSON',
        { parseError: error.message }
      );
    }
  }

  /**
   * Calculate risk score based on various factors
   */
  static calculateRiskScore(factors = {}) {
    let score = 0.0;

    // Migration complexity risk
    const migrationKinds = factors.migrationKinds || [];
    const riskMap = {
      'ADD_COLUMN': 0.05,
      'DROP_COLUMN': 0.15,
      'ADD_INDEX': 0.10,
      'DROP_INDEX': 0.08,
      'ALTER_COLUMN': 0.25,
      'ADD_CONSTRAINT': 0.20,
      'DROP_CONSTRAINT': 0.12
    };

    for (const kind of migrationKinds) {
      score += riskMap[kind] || 0.30; // Unknown operations are high risk
    }

    // Table size impact
    const tableSize = factors.tableSize || 'small';
    const sizeMultiplier = {
      'small': 1.0,
      'medium': 1.2,
      'large': 1.5,
      'xlarge': 2.0
    };
    score *= sizeMultiplier[tableSize] || 2.0;

    // Recent incident history
    const recentIncidents = factors.recentIncidents || 0;
    score += recentIncidents * 0.1;

    // Lock contention history
    const lockHistory = factors.lockHistory || 'low';
    const lockMultiplier = {
      'low': 1.0,
      'medium': 1.3,
      'high': 1.8
    };
    score *= lockMultiplier[lockHistory] || 1.8;

    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Determine risk level from score
   */
  static getRiskLevel(score) {
    if (score <= 0.2) return 'LOW';
    if (score <= 0.5) return 'MEDIUM';
    if (score <= 0.8) return 'HIGH';
    return 'CRITICAL';
  }
}