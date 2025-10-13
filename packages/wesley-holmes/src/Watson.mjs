/**
 * Dr. WATSON - The Medical Examiner
 * Independent verification of Holmes's evidence
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

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
    return this.renderVerification(this.verificationData());
  }

  verificationData() {
    const examinedAt = new Date().toISOString();
    const citations = this.verifyCitations();
    const verificationRate = citations.total > 0 ? citations.verified / citations.total : 0;
    const mathCheck = this.verifyMath();
    const inconsistencies = this.checkInconsistencies();
    const opinion = this.buildOpinion(verificationRate, inconsistencies.length === 0);
    return {
      metadata: {
        examinedAt,
        sha: this.sha
      },
      citations: {
        total: citations.total,
        verified: citations.verified,
        failed: citations.failed,
        unverified: citations.unverified,
        rate: verificationRate
      },
      math: {
        claimedScs: this.bundle.scores.scores.scs,
        recalculatedScs: mathCheck.scs,
        difference: this.bundle.scores.scores.scs - mathCheck.scs,
        acceptable: Math.abs(this.bundle.scores.scores.scs - mathCheck.scs) < 0.01
      },
      inconsistencies,
      opinion
    };
  }

  renderVerification(data) {
    const report = [];
    report.push('### 🩺 Dr. Watson\'s Independent Verification Report');
    report.push('');
    report.push('_Medical Examination of Evidence_');
    report.push('');
    report.push(`- Examination Date: ${data.metadata.examinedAt}`);
    report.push(`- Patient SHA: ${data.metadata.sha}`);
    report.push('');
    report.push('## 🔬 Citation Verification');
    report.push('');
    report.push('"Let me examine each piece of evidence independently..."');
    report.push('');
    report.push(`- **Citations Examined**: ${data.citations.total}`);
    report.push(`- **Verified**: ${data.citations.verified} ✅`);
    report.push(`- **Failed**: ${data.citations.failed} ❌`);
    report.push(`- **Unable to Verify**: ${data.citations.unverified}`);
    report.push('');
    report.push(`**Verification Rate**: ${(data.citations.rate * 100).toFixed(1)}%`);
    report.push('');
    report.push('## 📊 Mathematical Verification');
    report.push('');
    report.push('"I shall recalculate Holmes\'s arithmetic..."');
    report.push('');
    report.push(`Holmes claimed SCS: ${(data.math.claimedScs * 100).toFixed(1)}%`);
    report.push(`Watson calculates: ${(data.math.recalculatedScs * 100).toFixed(1)}%`);
    report.push(`Difference: ${data.math.acceptable ? '✅ Negligible' : '⚠️ Significant'}`);
    report.push('');
    report.push('## 🔍 Consistency Analysis');
    report.push('');
    report.push('"Checking for contradictions in Holmes\'s deductions..."');
    report.push('');
    if (data.inconsistencies.length === 0) {
      report.push('✅ No logical inconsistencies detected');
    } else {
      for (const issue of data.inconsistencies) {
        report.push(`⚠️ ${issue}`);
      }
    }
    report.push('');
    report.push('## 🩺 Dr. Watson\'s Medical Opinion');
    report.push('');
    report.push(data.opinion.markdown);
    report.push('');
    report.push('Respectfully submitted,');
    report.push('- Dr. J. Watson, M.D.');
    report.push('  Medical Examiner & Verification Specialist');
    return report.join('\n');
  }

  buildOpinion(rate, noIssues) {
    const passed = rate >= 0.8 && noIssues;
    if (passed) {
      return {
        verdict: 'PASSED',
        message: 'Evidence independently verified; conclusions concur.',
        markdown: '**VERIFICATION: PASSED** ✅\n\n"I have examined Holmes\'s evidence independently and concur with his"\n"deductions. The investigation is thorough and the conclusions sound."'
      };
    }
    return {
      verdict: 'CONCERNS',
      message: 'Discrepancies detected; further investigation recommended.',
      markdown: '**VERIFICATION: CONCERNS NOTED** ⚠️\n\n"While Holmes\'s methods are generally sound, I have noted some"\n"discrepancies that warrant further investigation."'
    };
  }

  verifyCitations() {
    let total = 0;
    let verified = 0;
    let failed = 0;
    let unverified = 0;
    
    for (const evidence of Object.values(this.evidence.evidence || {})) {
      for (const locations of Object.values(evidence)) {
        for (const loc of locations) {
          total++;

          if (loc.sha !== this.sha) {
            failed++;
            continue;
          }

          let gitContent = null;
          try {
            gitContent = execSync(`git show ${loc.sha}:${loc.file}`, { encoding: 'utf8' });
          } catch (err) {
            console.warn('[Watson] git show failed:', err?.message);
            failed++;
            continue;
          }

          let localContent = null;
          if (existsSync(loc.file)) {
            try {
              localContent = readFileSync(loc.file, 'utf8');
            } catch (err) {
              console.warn('[Watson] Unable to read local file:', err?.message);
            }
          }

          if (localContent !== null && localContent === gitContent) {
            verified++;
          } else if (localContent === null) {
            // We trust the git snapshot even if workspace lacks the file
            unverified++;
          } else {
            failed++;
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
