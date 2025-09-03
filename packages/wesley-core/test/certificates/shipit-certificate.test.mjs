/**
 * SHIPIT.md Certificate System Tests
 * 
 * Tests the complete certificate lifecycle:
 * Schema → Compile → Plan → Test → Certify → Sign → Verify → Deploy
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ShipItCertificate } from '../../src/domain/certificates/ShipItCertificate.mjs';
import { 
  SHALockHolmes, 
  DrWatSum, 
  KeyManager, 
  CertificateVerifier 
} from '../../src/domain/certificates/CertificateSigner.mjs';
import { SecurityError } from '../../src/domain/security/InputValidator.mjs';

describe('🛡️ SHIPIT.md Certificate System', () => {
  let holmesKeys, watsumKeys;
  let holmes, watsum;
  let sampleCertificate;

  beforeEach(() => {
    // Generate test key pairs
    holmesKeys = KeyManager.generateKeyPair();
    watsumKeys = KeyManager.generateKeyPair();
    
    // Create signers
    const holmesKeyId = KeyManager.generateKeyId(holmesKeys.publicKey, 'holmes-');
    const watsumKeyId = KeyManager.generateKeyId(watsumKeys.publicKey, 'wat-');
    
    holmes = new SHALockHolmes(holmesKeyId, holmesKeys.privateKey);
    watsum = new DrWatSum(watsumKeyId, watsumKeys.privateKey);
    
    // Create sample certificate with valid data
    sampleCertificate = new ShipItCertificate({
      repo: 'flyingrobots/wesley-demo',
      env: 'production',
      git: {
        sha: '9f1c2ab',
        tag: 'v1.3.0',
        branch: 'main',
        dirty: false
      },
      targets: ['postgres', 'prisma', 'drizzle', 'typescript', 'zod', 'pgtap'],
      artifacts: {
        ir: 'ir@f2107b4',
        spec: 'spec@b3eaa17',
        sql: 'sql@8af6d92',
        prisma: 'prisma@c91a4d0',
        drizzle: 'drizzle@4d8e9e2',
        types: 'types@3cc4f11',
        rollback: 'rollback@22b4e6f',
        evidence: 'evidence@90fbe21',
        repro: 'repro@8d2e6b1'
      },
      drift: {
        status: 'none',
        diffs: []
      },
      tests: {
        pgtap: { total: 184, passed: 184 },
        integration: { total: 62, passed: 62 },
        policy: { total: 41, passed: 41, coverage: 1.0 }
      },
      risk: {
        level: 'LOW',
        score: 0.18
      },
      prediction: {
        time_to_prod_sec: 400,
        window_sec: 480,
        method: 'EMA_by_migration_kind@2025-09-03',
        confidence: 0.86
      },
      policy: {
        require_signers: ['SHA-lock HOLMES', 'Dr. Wat-SUM'],
        max_risk: 0.34,
        max_ttp_window_sec: 900,
        allow_friday: true,
        expiry_hours: 24
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  });

  describe('Certificate Creation', () => {
    test('should create valid certificate with required fields', () => {
      expect(sampleCertificate.repo).toBe('flyingrobots/wesley-demo');
      expect(sampleCertificate.env).toBe('production');
      expect(sampleCertificate.certificateId).toMatch(/^cert_production_/);
      expect(sampleCertificate.version).toBe('1.0');
    });

    test('should generate deterministic canonical JSON', () => {
      const canonical1 = sampleCertificate.getCanonicalJSON();
      const canonical2 = sampleCertificate.getCanonicalJSON();
      
      expect(canonical1).toBe(canonical2);
      expect(canonical1).toContain('"env":"production"');
      expect(canonical1).toContain('"repo":"flyingrobots/wesley-demo"');
    });

    test('should calculate risk score based on factors', () => {
      const factors = {
        migrationKinds: ['ADD_COLUMN', 'ADD_INDEX'],
        tableSize: 'large',
        recentIncidents: 1,
        lockHistory: 'medium'
      };
      
      const riskScore = ShipItCertificate.calculateRiskScore(factors);
      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(1.0);
      
      const riskLevel = ShipItCertificate.getRiskLevel(riskScore);
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(riskLevel);
    });
  });

  describe('SHA-lock HOLMES Signing', () => {
    test('should sign valid certificate with complete build artifacts', () => {
      expect(() => {
        holmes.sign(sampleCertificate);
      }).not.toThrow();

      expect(sampleCertificate.signatures).toHaveLength(1);
      expect(sampleCertificate.signatures[0].signer).toBe('SHA-lock HOLMES');
      expect(sampleCertificate.signatures[0].alg).toBe('ed25519');
    });

    test('should refuse to sign certificate with missing artifacts', () => {
      const incompleteCert = new ShipItCertificate({
        ...sampleCertificate,
        artifacts: { ir: 'ir@123' } // Missing required artifacts
      });

      expect(() => {
        holmes.sign(incompleteCert);
      }).toThrow(SecurityError);
      expect(() => {
        holmes.sign(incompleteCert);
      }).toThrow(/missing build artifacts/);
    });

    test('should refuse to sign certificate with dirty git state', () => {
      const dirtyCert = new ShipItCertificate({
        ...sampleCertificate,
        git: { ...sampleCertificate.git, dirty: true }
      });

      expect(() => {
        holmes.sign(dirtyCert);
      }).toThrow(SecurityError);
      expect(() => {
        holmes.sign(dirtyCert);
      }).toThrow(/dirty git working directory/);
    });

    test('should refuse to sign certificate with disallowed drift', () => {
      const driftCert = new ShipItCertificate({
        ...sampleCertificate,
        drift: { status: 'disallowed', diffs: ['schema_change'] }
      });

      expect(() => {
        holmes.sign(driftCert);
      }).toThrow(SecurityError);
      expect(() => {
        holmes.sign(driftCert);
      }).toThrow(/disallowed drift detected/);
    });
  });

  describe('Dr. Wat-SUM Signing', () => {
    test('should sign valid certificate with passing tests', () => {
      expect(() => {
        watsum.sign(sampleCertificate);
      }).not.toThrow();

      expect(sampleCertificate.signatures).toHaveLength(1);
      expect(sampleCertificate.signatures[0].signer).toBe('Dr. Wat-SUM');
    });

    test('should refuse to sign certificate with failing pgTAP tests', () => {
      const failingTestsCert = new ShipItCertificate({
        ...sampleCertificate,
        tests: {
          pgtap: { total: 184, passed: 180 }, // 4 failures
          integration: { total: 62, passed: 62 },
          policy: { total: 41, passed: 41 }
        }
      });

      expect(() => {
        watsum.sign(failingTestsCert);
      }).toThrow(SecurityError);
      expect(() => {
        watsum.sign(failingTestsCert);
      }).toThrow(/pgTAP tests not all passing/);
    });

    test('should refuse to sign certificate with missing evidence pack', () => {
      const noEvidenceCert = new ShipItCertificate({
        ...sampleCertificate,
        artifacts: { ...sampleCertificate.artifacts, evidence: null }
      });

      expect(() => {
        watsum.sign(noEvidenceCert);
      }).toThrow(SecurityError);
      expect(() => {
        watsum.sign(noEvidenceCert);
      }).toThrow(/missing evidence pack/);
    });

    test('should refuse to sign certificate exceeding performance budget', () => {
      const perfImpactCert = new ShipItCertificate({
        ...sampleCertificate,
        tests: {
          ...sampleCertificate.tests,
          perf: {
            p95_write_delta: 0.05, // 5% impact
            p95_read_delta: 0.02,  // 2% impact
            budget: 0.03           // 3% budget - exceeded!
          }
        }
      });

      expect(() => {
        watsum.sign(perfImpactCert);
      }).toThrow(SecurityError);
      expect(() => {
        watsum.sign(perfImpactCert);
      }).toThrow(/performance impact exceeds budget/);
    });
  });

  describe('Certificate Verification', () => {
    test('should verify certificate with valid signatures', () => {
      // Sign with both signers
      holmes.sign(sampleCertificate);
      watsum.sign(sampleCertificate);

      const verifier = new CertificateVerifier({
        'SHA-lock HOLMES': holmesKeys.publicKey,
        'Dr. Wat-SUM': watsumKeys.publicKey
      });

      expect(() => {
        verifier.verify(sampleCertificate);
      }).not.toThrow();
    });

    test('should reject certificate missing required signatures', () => {
      // Only sign with HOLMES, not WAT-SUM
      holmes.sign(sampleCertificate);

      expect(() => {
        sampleCertificate.verify();
      }).toThrow(SecurityError);
      expect(() => {
        sampleCertificate.verify();
      }).toThrow(/Missing required signature from: Dr. Wat-SUM/);
    });

    test('should reject expired certificate', () => {
      const expiredCert = new ShipItCertificate({
        ...sampleCertificate,
        expiresAt: new Date(Date.now() - 1000).toISOString() // 1 second ago
      });

      expect(() => {
        expiredCert.verify();
      }).toThrow(SecurityError);
      expect(() => {
        expiredCert.verify();
      }).toThrow(/Certificate has expired/);
    });

    test('should reject certificate exceeding risk threshold', () => {
      const highRiskCert = new ShipItCertificate({
        ...sampleCertificate,
        risk: { level: 'HIGH', score: 0.9 }, // Above policy limit of 0.34
      });

      expect(() => {
        highRiskCert.verify();
      }).toThrow(SecurityError);
      expect(() => {
        highRiskCert.verify();
      }).toThrow(/Risk score 0.9 exceeds policy limit/);
    });

    test('should reject Friday deployment when policy disallows', () => {
      // Mock Date to be Friday
      const friday = new Date('2025-09-05T16:00:00Z'); // Friday 4 PM
      const originalDate = global.Date;
      global.Date = class extends Date {
        constructor() {
          return friday;
        }
        static now() {
          return friday.getTime();
        }
      };

      const noFridayCert = new ShipItCertificate({
        ...sampleCertificate,
        policy: { ...sampleCertificate.policy, allow_friday: false }
      });

      expect(() => {
        noFridayCert.verify();
      }).toThrow(SecurityError);
      expect(() => {
        noFridayCert.verify();
      }).toThrow(/Friday deployments not permitted/);

      // Restore original Date
      global.Date = originalDate;
    });
  });

  describe('SHIPIT.md Generation', () => {
    test('should generate human-readable SHIPIT.md content', () => {
      holmes.sign(sampleCertificate);
      watsum.sign(sampleCertificate);

      const markdown = sampleCertificate.toShipItMarkdown();

      expect(markdown).toContain('# Wesley Deployment Certificate — PRODUCTION');
      expect(markdown).toContain('Data Done Right');
      expect(markdown).toContain('flyingrobots/wesley-demo');
      expect(markdown).toContain('SHA-lock HOLMES: ✅');
      expect(markdown).toContain('Dr. Wat-SUM: ✅');
      expect(markdown).toContain('```jsonc');
      expect(markdown).toContain('wesley deploy --env production');
    });

    test('should parse SHIPIT.md back to certificate', () => {
      holmes.sign(sampleCertificate);
      watsum.sign(sampleCertificate);

      const markdown = sampleCertificate.toShipItMarkdown();
      const parsedCert = ShipItCertificate.fromShipItMarkdown(markdown);

      expect(parsedCert.repo).toBe(sampleCertificate.repo);
      expect(parsedCert.env).toBe(sampleCertificate.env);
      expect(parsedCert.signatures).toHaveLength(2);
    });

    test('should display appropriate risk and Friday deployment status', () => {
      const markdown = sampleCertificate.toShipItMarkdown();

      expect(markdown).toContain('Risk: LOW (0.18)');
      expect(markdown).toContain('Friday deploy ✅');
    });
  });

  describe('End-to-End Certificate Flow', () => {
    test('should complete full certification lifecycle', () => {
      // 1. Create certificate
      expect(sampleCertificate.certificateId).toMatch(/^cert_production_/);

      // 2. HOLMES signs after validation
      expect(() => holmes.sign(sampleCertificate)).not.toThrow();

      // 3. WAT-SUM signs after validation  
      expect(() => watsum.sign(sampleCertificate)).not.toThrow();

      // 4. Generate SHIPIT.md
      const markdown = sampleCertificate.toShipItMarkdown();
      expect(markdown).toContain('SHA-lock HOLMES: ✅');
      expect(markdown).toContain('Dr. Wat-SUM: ✅');

      // 5. Parse and verify certificate
      const parsedCert = ShipItCertificate.fromShipItMarkdown(markdown);
      const verifier = new CertificateVerifier({
        'SHA-lock HOLMES': holmesKeys.publicKey,
        'Dr. Wat-SUM': watsumKeys.publicKey
      });

      expect(() => verifier.verify(parsedCert)).not.toThrow();

      // 6. Ready for deployment!
      expect(parsedCert.signatures).toHaveLength(2);
      expect(parsedCert.risk.level).toBe('LOW');
    });

    test('should demonstrate "Go on, deploy on a Friday" confidence', () => {
      // Mock Friday deployment time
      const friday = new Date('2025-09-05T16:58:00Z'); // Friday 4:58 PM
      const originalDate = global.Date;
      global.Date = class extends Date {
        constructor() {
          return friday;
        }
        static now() {
          return friday.getTime();
        }
      };

      // Complete certification
      holmes.sign(sampleCertificate);
      watsum.sign(sampleCertificate);

      // Should allow Friday deployment with proper certification
      expect(() => sampleCertificate.verify()).not.toThrow();
      
      const markdown = sampleCertificate.toShipItMarkdown();
      expect(markdown).toContain('Friday deploy ✅');

      // Restore original Date
      global.Date = originalDate;
    });
  });
});