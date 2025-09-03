/**
 * Certificate Signing Infrastructure
 * 
 * SHA-lock HOLMES: Signs build integrity + plan safety
 * Dr. Wat-SUM: Signs evidence & statistics integrity
 * 
 * "The door is open, but only cryptographically verified certificates may pass."
 */

import crypto from 'crypto';
import { SecurityError } from '../security/InputValidator.mjs';

export class CertificateSigner {
  constructor(name, keyId, privateKey, algorithm = 'ed25519') {
    this.name = name;
    this.keyId = keyId;
    this.privateKey = privateKey;
    this.algorithm = algorithm;
  }

  /**
   * Sign the canonical JSON representation of a certificate
   */
  sign(certificate) {
    const canonical = certificate.getCanonicalJSON();
    
    let signature;
    try {
      if (this.algorithm === 'ed25519') {
        signature = crypto.sign(null, Buffer.from(canonical), this.privateKey).toString('base64');
      } else {
        throw new SecurityError(`Unsupported signing algorithm: ${this.algorithm}`, 'UNSUPPORTED_ALGORITHM');
      }
    } catch (error) {
      throw new SecurityError(
        `Failed to sign certificate: ${error.message}`,
        'SIGNING_FAILED',
        { signer: this.name, error: error.message }
      );
    }

    // Add signature to certificate
    certificate.addSignature(this.name, this.keyId, this.algorithm, signature);
    
    return signature;
  }

  /**
   * Verify a signature against a certificate
   */
  verify(certificate, publicKey) {
    const canonical = certificate.getCanonicalJSON();
    const signature = certificate.signatures.find(s => s.signer === this.name);
    
    if (!signature) {
      throw new SecurityError(
        `No signature found from signer: ${this.name}`,
        'SIGNATURE_NOT_FOUND'
      );
    }

    try {
      const isValid = crypto.verify(
        null, 
        Buffer.from(canonical), 
        publicKey, 
        Buffer.from(signature.sig, 'base64')
      );

      if (!isValid) {
        throw new SecurityError(
          `Invalid signature from ${this.name}`,
          'INVALID_SIGNATURE',
          { signer: this.name, key_id: signature.key_id }
        );
      }

      return true;
    } catch (error) {
      if (error instanceof SecurityError) throw error;
      
      throw new SecurityError(
        `Signature verification failed: ${error.message}`,
        'VERIFICATION_FAILED',
        { signer: this.name, error: error.message }
      );
    }
  }
}

/**
 * SHA-lock HOLMES - Build integrity and plan safety signer
 */
export class SHALockHolmes extends CertificateSigner {
  constructor(keyId, privateKey) {
    super('SHA-lock HOLMES', keyId, privateKey);
  }

  /**
   * Sign certificate after validating build integrity and plan safety
   */
  sign(certificate) {
    // HOLMES validates these aspects before signing:
    this.validateBuildIntegrity(certificate);
    this.validatePlanSafety(certificate);
    
    return super.sign(certificate);
  }

  validateBuildIntegrity(certificate) {
    const required = ['ir', 'spec', 'sql', 'rollback'];
    const missing = required.filter(artifact => !certificate.artifacts[artifact]);
    
    if (missing.length > 0) {
      throw new SecurityError(
        `HOLMES refuses to sign: missing build artifacts: ${missing.join(', ')}`,
        'INCOMPLETE_BUILD',
        { missing_artifacts: missing }
      );
    }

    // Validate reproducibility
    if (!certificate.artifacts.repro) {
      throw new SecurityError(
        'HOLMES refuses to sign: missing reproducibility hash',
        'NO_REPRODUCIBILITY_PROOF'
      );
    }

    // Validate git cleanliness
    if (certificate.git.dirty) {
      throw new SecurityError(
        'HOLMES refuses to sign: dirty git working directory',
        'DIRTY_GIT_STATE'
      );
    }
  }

  validatePlanSafety(certificate) {
    // Check for blocking operations
    if (certificate.drift.status === 'disallowed') {
      throw new SecurityError(
        'HOLMES refuses to sign: disallowed drift detected',
        'DISALLOWED_DRIFT'
      );
    }

    // Validate rollback plan exists
    if (!certificate.artifacts.rollback) {
      throw new SecurityError(
        'HOLMES refuses to sign: no rollback plan generated',
        'NO_ROLLBACK_PLAN'
      );
    }
  }
}

/**
 * Dr. Wat-SUM - Evidence and statistics integrity signer  
 */
export class DrWatSum extends CertificateSigner {
  constructor(keyId, privateKey) {
    super('Dr. Wat-SUM', keyId, privateKey);
  }

  /**
   * Sign certificate after validating evidence and test results
   */
  sign(certificate) {
    // WAT-SUM validates these aspects before signing:
    this.validateTestEvidence(certificate);
    this.validateStatistics(certificate);
    
    return super.sign(certificate);
  }

  validateTestEvidence(certificate) {
    const tests = certificate.tests;
    
    // Require pgTAP tests
    if (!tests.pgtap || tests.pgtap.passed !== tests.pgtap.total) {
      throw new SecurityError(
        'WAT-SUM refuses to sign: pgTAP tests not all passing',
        'FAILING_PGTAP_TESTS',
        { pgtap: tests.pgtap }
      );
    }

    // Require integration tests
    if (!tests.integration || tests.integration.passed !== tests.integration.total) {
      throw new SecurityError(
        'WAT-SUM refuses to sign: integration tests not all passing',
        'FAILING_INTEGRATION_TESTS',
        { integration: tests.integration }
      );
    }

    // Require RLS policy tests if RLS tables present
    if (tests.policy && tests.policy.passed !== tests.policy.total) {
      throw new SecurityError(
        'WAT-SUM refuses to sign: RLS policy tests not all passing',
        'FAILING_POLICY_TESTS',
        { policy: tests.policy }
      );
    }

    // Require evidence pack
    if (!certificate.artifacts.evidence) {
      throw new SecurityError(
        'WAT-SUM refuses to sign: missing evidence pack',
        'NO_EVIDENCE_PACK'
      );
    }
  }

  validateStatistics(certificate) {
    const perf = certificate.tests.perf;
    
    // Check performance impact within budget
    if (perf && perf.budget) {
      const writeImpact = Math.abs(perf.p95_write_delta || 0);
      const readImpact = Math.abs(perf.p95_read_delta || 0);
      
      if (writeImpact > perf.budget || readImpact > perf.budget) {
        throw new SecurityError(
          'WAT-SUM refuses to sign: performance impact exceeds budget',
          'PERFORMANCE_BUDGET_EXCEEDED',
          { 
            write_impact: writeImpact, 
            read_impact: readImpact, 
            budget: perf.budget 
          }
        );
      }
    }

    // Validate risk calculation
    if (!certificate.risk || typeof certificate.risk.score !== 'number') {
      throw new SecurityError(
        'WAT-SUM refuses to sign: invalid or missing risk assessment',
        'INVALID_RISK_ASSESSMENT'
      );
    }

    // Validate time-to-prod prediction
    if (!certificate.prediction || !certificate.prediction.time_to_prod_sec) {
      throw new SecurityError(
        'WAT-SUM refuses to sign: missing time-to-prod prediction',
        'NO_TTP_PREDICTION'
      );
    }
  }
}

/**
 * Key management utilities
 */
export class KeyManager {
  /**
   * Generate new ED25519 key pair for signers
   */
  static generateKeyPair() {
    return crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
  }

  /**
   * Load key from file or environment
   */
  static loadPrivateKey(keyData) {
    try {
      return crypto.createPrivateKey(keyData);
    } catch (error) {
      throw new SecurityError(
        `Failed to load private key: ${error.message}`,
        'INVALID_PRIVATE_KEY'
      );
    }
  }

  static loadPublicKey(keyData) {
    try {
      return crypto.createPublicKey(keyData);
    } catch (error) {
      throw new SecurityError(
        `Failed to load public key: ${error.message}`,
        'INVALID_PUBLIC_KEY'
      );
    }
  }

  /**
   * Generate key ID from public key
   */
  static generateKeyId(publicKeyData, prefix = '') {
    // Ensure we have a KeyObject
    const publicKey = typeof publicKeyData === 'string' 
      ? crypto.createPublicKey(publicKeyData)
      : publicKeyData;
    
    const der = publicKey.export({ type: 'spki', format: 'der' });
    const hash = crypto.createHash('sha256').update(der).digest('hex');
    return `${prefix}${hash.substring(0, 16)}`;
  }
}

/**
 * Certificate verification service
 */
export class CertificateVerifier {
  constructor(publicKeys = {}) {
    this.publicKeys = publicKeys; // { signer_name: publicKey }
  }

  /**
   * Verify all signatures on a certificate
   */
  verify(certificate) {
    for (const signature of certificate.signatures) {
      const publicKey = this.publicKeys[signature.signer];
      if (!publicKey) {
        throw new SecurityError(
          `No public key available for signer: ${signature.signer}`,
          'MISSING_PUBLIC_KEY'
        );
      }

      // Create temporary signer for verification
      const signer = new CertificateSigner(
        signature.signer, 
        signature.key_id, 
        null, 
        signature.alg
      );

      signer.verify(certificate, publicKey);
    }

    // Also run certificate's own validation
    certificate.verify();
    
    return true;
  }
}