/**
 * Dr. WATSON - The Medical Examiner
 * Independent verification of Holmes's evidence
 */

import { existsSync, readFileSync } from 'node:fs';

export class Watson {
  constructor(bundle) {
    this.bundle = bundle;
    this.sha = bundle.sha;
    this.evidence = bundle.evidence;
  }

  /**
   * Verify Holmes's evidence independently
   */
  verify() {
    const report = [];
    
    report.push('════════════════════════════════════════════════════════════════════');
    report.push('         DR. WATSON\'S INDEPENDENT VERIFICATION REPORT');
    report.push('         Medical Examination of Evidence');
    report.push('════════════════════════════════════════════════════════════════════');
    report.push(`Examination Date: ${new Date().toISOString()}`);
    report.push(`Patient SHA: ${this.sha}`);
    report.push('════════════════════════════════════════════════════════════════════');
    report.push('');
    
    report.push('## 🔬 Citation Verification');
    report.push('');
    report.push('"Let me examine each piece of evidence independently..."');
    report.push('');
    
    const results = this.verifyCitations();
    
    report.push(`- **Citations Examined**: ${results.total}`);
    report.push(`- **Verified**: ${results.verified} ✅`);
    report.push(`- **Failed**: ${results.failed} ❌`);
    report.push(`- **Unable to Verify**: ${results.unverified}`);
    report.push('');
    
    const verificationRate = results.total > 0 
      ? (results.verified / results.total * 100).toFixed(1)
      : 0;
    
    report.push(`**Verification Rate**: ${verificationRate}%`);
    report.push('');
    
    // Mathematical verification
    report.push('## 📊 Mathematical Verification');
    report.push('');
    report.push('"I shall recalculate Holmes\'s arithmetic..."');
    report.push('');
    
    const mathCheck = this.verifyMath();
    report.push(`Holmes claimed SCS: ${(this.bundle.scores.scores.scs * 100).toFixed(1)}%`);
    report.push(`Watson calculates: ${(mathCheck.scs * 100).toFixed(1)}%`);
    report.push(`Difference: ${Math.abs(this.bundle.scores.scores.scs - mathCheck.scs) < 0.01 ? '✅ Negligible' : '⚠️ Significant'}`);
    report.push('');
    
    // Consistency checks
    report.push('## 🔍 Consistency Analysis');
    report.push('');
    report.push('"Checking for contradictions in Holmes\'s deductions..."');
    report.push('');
    
    const inconsistencies = this.checkInconsistencies();
    if (inconsistencies.length === 0) {
      report.push('✅ No logical inconsistencies detected');
    } else {
      for (const issue of inconsistencies) {
        report.push(`⚠️ ${issue}`);
      }
    }
    
    report.push('');
    
    // Medical opinion
    report.push('## 🩺 Dr. Watson\'s Medical Opinion');
    report.push('');
    
    if (verificationRate >= 80 && inconsistencies.length === 0) {
      report.push('**VERIFICATION: PASSED** ✅');
      report.push('');
      report.push('"I have examined Holmes\'s evidence independently and concur with his"');
      report.push('"deductions. The investigation is thorough and the conclusions sound."');
    } else {
      report.push('**VERIFICATION: CONCERNS NOTED** ⚠️');
      report.push('');
      report.push('"While Holmes\'s methods are generally sound, I have noted some"');
      report.push('"discrepancies that warrant further investigation."');
    }
    
    report.push('');
    report.push('Respectfully submitted,');
    report.push('- Dr. J. Watson, M.D.');
    report.push('  Medical Examiner & Verification Specialist');
    
    return report.join('\n');
  }

  verifyCitations() {
    let total = 0;
    let verified = 0;
    let failed = 0;
    let unverified = 0;
    
    for (const [uid, evidence] of Object.entries(this.evidence.evidence || {})) {
      for (const [kind, locations] of Object.entries(evidence)) {
        for (const loc of locations) {
          total++;
          
          // Verify SHA matches
          if (loc.sha !== this.sha) {
            failed++;
            continue;
          }
          
          // Verify file exists (if local)
          if (existsSync(loc.file)) {
            verified++;
          } else {
            // Can't verify but SHA is correct
            unverified++;
          }
        }
      }
    }
    
    return { total, verified, failed, unverified };
  }

  verifyMath() {
    // Recalculate SCS independently
    let totalWeight = 0;
    let earnedWeight = 0;
    
    for (const [uid, evidence] of Object.entries(this.evidence.evidence || {})) {
      const weight = this.inferWeight(uid);
      totalWeight += weight;
      
      // Check if has required artifacts
      if (evidence.sql && evidence.tests) {
        earnedWeight += weight;
      }
    }
    
    const scs = totalWeight > 0 ? earnedWeight / totalWeight : 0;
    
    return { scs };
  }

  checkInconsistencies() {
    const issues = [];
    
    const scs = this.bundle.scores.scores.scs;
    const tci = this.bundle.scores.scores.tci;
    const mri = this.bundle.scores.scores.mri;
    
    // High completion but low tests
    if (scs > 0.8 && tci < 0.5) {
      issues.push('High schema coverage (SCS) but low test confidence (TCI)');
    }
    
    // Low risk but low completion
    if (mri < 0.2 && scs < 0.5) {
      issues.push('Low migration risk claimed but schema incomplete');
    }
    
    // Check for sensitive fields without tests
    for (const [uid, evidence] of Object.entries(this.evidence.evidence || {})) {
      if ((uid.includes('password') || uid.includes('sensitive')) && !evidence.tests) {
        issues.push(`Sensitive field ${uid} lacks test coverage`);
      }
    }
    
    return issues;
  }

  inferWeight(uid) {
    // Same logic as Holmes for consistency
    if (uid.includes('password')) return 10;
    if (uid.includes('email')) return 8;
    if (uid.includes('id')) return 7;
    if (uid.includes('user')) return 6;
    if (uid.includes('created')) return 5;
    if (uid.includes('theme')) return 2;
    return 5;
  }
}