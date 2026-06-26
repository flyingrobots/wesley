import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  buildHolmesSuiteComment,
  HOLMES_SUITE_COMMENT_MARKER,
  loadHolmesSuiteReports
} from '../src/pr-comment.mjs';
import {
  sampleHolmesReport,
  sampleMoriartyReport,
  sampleWatsonReport
} from './fixtures/sample-reports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prCommentCliPath = path.join(__dirname, '..', 'src', 'pr-comment-cli.mjs');

test('buildHolmesSuiteComment adds a plain-English summary, next actions, and glossary', () => {
  const comment = buildHolmesSuiteComment({
    pullRequestNumber: 466,
    headSha: 'feedface1234567890',
    statuses: {
      holmes: 'success',
      watson: 'success',
      moriarty: 'success'
    },
    holmesReport: sampleHolmesReport(),
    watsonReport: sampleWatsonReport(),
    moriartyReport: sampleMoriartyReport(),
    holmesMarkdown: '### raw holmes',
    watsonMarkdown: '### raw watson',
    moriartyMarkdown: '### raw moriarty'
  });

  assert.ok(comment.includes(HOLMES_SUITE_COMMENT_MARKER));
  assert.ok(comment.includes('<!-- HOLMES_SUITE_SHA:feedface1234567890 -->'));
  assert.ok(comment.includes('## Plain-English Readout'));
  assert.ok(comment.includes('Holmes says this change needs investigation before shipping.'));
  assert.ok(comment.includes('## Suggested next actions'));
  assert.ok(
    comment.includes(
      'Tighten citations so the report points to exact lines instead of whole files or coarse references.'
    )
  );
  assert.ok(
    comment.includes('<details><summary>📚 Glossary (what the Holmes terms mean)</summary>')
  );

  const beforeGlossary = comment.split('<details><summary>📚 Glossary')[0];
  const unexplainedAcronyms = beforeGlossary.match(/\b(SCS|TCI|MRI)\b/gi);
  assert.equal(
    unexplainedAcronyms,
    null,
    `visible summary should avoid unexplained score acronyms: ${unexplainedAcronyms}`
  );
});

test('buildHolmesSuiteComment explains unavailable reports without crashing the comment', () => {
  const comment = buildHolmesSuiteComment({
    pullRequestNumber: 466,
    headSha: 'deadbeef1234567890',
    statuses: {
      holmes: 'failure',
      watson: 'success',
      moriarty: 'cancelled'
    },
    holmesReport: null,
    watsonReport: sampleWatsonReport({
      opinion: { verdict: 'PASSED', message: 'ok', markdown: 'ok' },
      inconsistencies: []
    }),
    moriartyReport: null,
    holmesMarkdown: '',
    watsonMarkdown: '### raw watson',
    moriartyMarkdown: ''
  });

  assert.ok(
    comment.includes('The Holmes report is unavailable because the workflow status is failure.')
  );
  assert.ok(comment.includes('<!-- HOLMES_SUITE_SHA:deadbeef1234567890 -->'));
  assert.ok(
    comment.includes(
      'The Moriarty forecast is unavailable because the workflow status is cancelled.'
    )
  );
  assert.ok(
    comment.includes(
      'Fix the HOLMES workflow job first so the PR has a real evidence investigation again.'
    )
  );
});

test(
  'buildHolmesSuiteComment distinguishes missing and invalid report artifacts from successful workflow status',
  { timeout: 5000 },
  () => {
    const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-load-'));
    try {
      writeFileSync(path.join(reportsDir, 'holmes-report.md'), '### holmes raw\n');
      writeFileSync(path.join(reportsDir, 'watson-report.json'), '{"not":"valid"');

      const comment = buildHolmesSuiteComment({
        pullRequestNumber: 466,
        headSha: 'beadfeed1234567890',
        ...loadHolmesSuiteReports(reportsDir, {
          holmes: 'success',
          watson: 'success',
          moriarty: 'success'
        })
      });

      assert.ok(
        comment.includes(
          'The Holmes report is unavailable because the workflow finished without a readable holmes-report.json artifact.'
        )
      );
      assert.ok(
        comment.includes(
          'The Watson report is unavailable because the watson-report.json artifact could not be parsed as JSON.'
        )
      );
      assert.ok(
        comment.includes(
          'The Moriarty forecast is unavailable because the workflow finished without a readable moriarty-report.json artifact.'
        )
      );
      assert.ok(
        comment.includes(
          'Regenerate the HOLMES artifacts and make sure holmes-report.json is uploaded before trusting this PR summary.'
        )
      );
      assert.ok(
        comment.includes(
          'Fix the WATSON report generation so watson-report.json contains valid JSON before trusting this PR summary.'
        )
      );
      assert.ok(
        comment.includes(
          'Regenerate the MORIARTY artifacts and make sure moriarty-report.json is uploaded before trusting this PR summary.'
        )
      );
      assert.ok(
        comment.includes(
          '_Report unavailable for watson: readable watson-report.md artifact not found._'
        )
      );
      assert.ok(
        comment.includes(
          '_Report unavailable for moriarty: readable moriarty-report.md artifact not found._'
        )
      );
    } finally {
      rmSync(reportsDir, { recursive: true, force: true });
    }
  }
);

test('buildHolmesSuiteComment keeps raw report sections honest when markdown artifacts are missing', () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-markdown-'));
  try {
    writeFileSync(
      path.join(reportsDir, 'holmes-report.json'),
      JSON.stringify(sampleHolmesReport())
    );

    const comment = buildHolmesSuiteComment({
      pullRequestNumber: 466,
      headSha: '0011223344556677',
      ...loadHolmesSuiteReports(reportsDir, {
        holmes: 'success',
        watson: 'failure',
        moriarty: 'failure'
      })
    });

    assert.ok(comment.includes('Holmes says this change needs investigation before shipping.'));
    assert.ok(
      comment.includes(
        '_Report unavailable for holmes: readable holmes-report.md artifact not found._'
      )
    );
    assert.equal(
      comment.includes('job status: success'),
      false,
      'raw section should not blame a success status for a missing markdown artifact'
    );
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
});

test('buildHolmesSuiteComment normalizes repeated whitespace and trailing periods in summaries', () => {
  const comment = buildHolmesSuiteComment({
    pullRequestNumber: 466,
    headSha: 'cafebabe1234567890',
    statuses: {
      holmes: 'success',
      watson: 'success',
      moriarty: 'success'
    },
    holmesReport: sampleHolmesReport({
      gates: [
        { gate: 'Migration Risk', status: '⛔', evidence: 'MRI: 46.0%', ruling: 'HIGH   RISK!....' }
      ]
    }),
    watsonReport: sampleWatsonReport({
      inconsistencies: ['One   cited span no longer matches the current file contents....']
    }),
    moriartyReport: sampleMoriartyReport(),
    holmesMarkdown: '### raw holmes',
    watsonMarkdown: '### raw watson',
    moriartyMarkdown: '### raw moriarty'
  });

  assert.equal(
    comment.includes('One   cited span'),
    false,
    'summary should collapse repeated whitespace'
  );
  assert.equal(
    comment.includes('current file contents....'),
    false,
    'summary should trim trailing periods from source phrases'
  );
  assert.ok(
    comment.includes(
      'Most important concern: One cited span no longer matches the current file contents.'
    ),
    'Watson concern should collapse internal whitespace and trim trailing periods'
  );
});

test('buildHolmesSuiteComment preserves at least one next action per suite before truncating to four items', () => {
  const comment = buildHolmesSuiteComment({
    pullRequestNumber: 466,
    headSha: '0123abc456def789',
    statuses: {
      holmes: 'success',
      watson: 'success',
      moriarty: 'success'
    },
    holmesReport: sampleHolmesReport(),
    watsonReport: sampleWatsonReport(),
    moriartyReport: sampleMoriartyReport({
      plateauDetected: true,
      warnings: []
    }),
    holmesMarkdown: '### raw holmes',
    watsonMarkdown: '### raw watson',
    moriartyMarkdown: '### raw moriarty'
  });

  const actionSection = comment
    .split('## Suggested next actions\n\n')[1]
    .split('\n\n<details><summary>📚 Glossary')[0]
    .trim()
    .split('\n');

  assert.deepEqual(actionSection, [
    '1. Tighten citations so the report points to exact lines instead of whole files or coarse references.',
    '2. Resolve Watson’s verification concerns before trusting the Holmes verdict as final.',
    '3. Treat the readiness forecast as stalled until new evidence or real progress moves the trend again.',
    '4. Add or strengthen tests for the schema elements and operations HOLMES flagged as weakly proven.'
  ]);
});

test('buildHolmesSuiteComment keeps loaded reports visible when workflow statuses are omitted', () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-implicit-status-'));
  try {
    writeFileSync(
      path.join(reportsDir, 'holmes-report.json'),
      JSON.stringify(sampleHolmesReport())
    );
    writeFileSync(
      path.join(reportsDir, 'watson-report.json'),
      JSON.stringify(sampleWatsonReport())
    );
    writeFileSync(
      path.join(reportsDir, 'moriarty-report.json'),
      JSON.stringify(sampleMoriartyReport())
    );
    writeFileSync(path.join(reportsDir, 'holmes-report.md'), '### raw holmes\n');
    writeFileSync(path.join(reportsDir, 'watson-report.md'), '### raw watson\n');
    writeFileSync(path.join(reportsDir, 'moriarty-report.md'), '### raw moriarty\n');

    const comment = buildHolmesSuiteComment({
      pullRequestNumber: 466,
      headSha: 'statusless1234567890',
      ...loadHolmesSuiteReports(reportsDir)
    });

    assert.equal(
      comment.includes('workflow status is unknown'),
      false,
      'omitted statuses should not hide loaded reports'
    );
    assert.equal(
      comment.includes('Fix the HOLMES workflow job first'),
      false,
      'omitted statuses should not trigger workflow-failure actions'
    );
    assert.ok(comment.includes('Holmes says this change needs investigation before shipping.'));
    assert.ok(comment.includes('### raw holmes'));
    assert.ok(comment.includes('### raw watson'));
    assert.ok(comment.includes('### raw moriarty'));
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
});

test('pr-comment CLI builds comment output without external argument parser dependencies', () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-'));
  try {
    writeFileSync(path.join(reportsDir, 'holmes-report.md'), '### holmes raw\n');
    const result = spawnSync(
      process.execPath,
      [
        prCommentCliPath,
        '--reports-dir',
        reportsDir,
        '--pr-number',
        '467',
        '--head-sha',
        '0123456789abcdef',
        '--holmes-status',
        'failure',
        '--watson-status',
        'failure',
        '--moriarty-status',
        'failure'
      ],
      {
        encoding: 'utf8'
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(HOLMES_SUITE_COMMENT_MARKER));
    assert.ok(result.stdout.includes('<!-- HOLMES_SUITE_SHA:0123456789abcdef -->'));
    assert.ok(
      result.stdout.includes(
        'The Holmes report is unavailable because the workflow status is failure.'
      )
    );
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
});

test('pr-comment CLI aggregates schema-scoped HOLMES report directories', () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-schema-sets-'));
  try {
    for (const schemaId of ['ecommerce', 'reference']) {
      for (const reportName of ['holmes', 'watson', 'moriarty']) {
        mkdirSync(path.join(reportsDir, schemaId, reportName), { recursive: true });
      }
      writeFileSync(
        path.join(reportsDir, schemaId, 'holmes', 'holmes-report.json'),
        JSON.stringify(sampleHolmesReport())
      );
      writeFileSync(
        path.join(reportsDir, schemaId, 'watson', 'watson-report.json'),
        JSON.stringify(sampleWatsonReport())
      );
      writeFileSync(
        path.join(reportsDir, schemaId, 'moriarty', 'moriarty-report.json'),
        JSON.stringify(sampleMoriartyReport())
      );
      writeFileSync(
        path.join(reportsDir, schemaId, 'holmes', 'holmes-report.md'),
        `### holmes ${schemaId}\n`
      );
      writeFileSync(
        path.join(reportsDir, schemaId, 'watson', 'watson-report.md'),
        `### watson ${schemaId}\n`
      );
      writeFileSync(
        path.join(reportsDir, schemaId, 'moriarty', 'moriarty-report.md'),
        `### moriarty ${schemaId}\n`
      );
    }

    const result = spawnSync(
      process.execPath,
      [
        prCommentCliPath,
        '--reports-dir',
        reportsDir,
        '--pr-number',
        '467',
        '--head-sha',
        'feedfacedeadbeef',
        '--holmes-status',
        'success',
        '--watson-status',
        'success',
        '--moriarty-status',
        'success'
      ],
      {
        encoding: 'utf8'
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('## Schema Sets'));
    assert.ok(result.stdout.includes('## Schema Set `ecommerce`'));
    assert.ok(result.stdout.includes('## Schema Set `reference`'));
    assert.ok(result.stdout.includes('### holmes ecommerce'));
    assert.ok(result.stdout.includes('### holmes reference'));
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
});

test('pr-comment CLI can be imported without executing the entrypoint', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(pathToFileURL(prCommentCliPath).href)});`
    ],
    {
      encoding: 'utf8'
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('pr-comment CLI accepts equals-form options', () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-equals-'));
  try {
    writeFileSync(path.join(reportsDir, 'holmes-report.md'), '### raw holmes\n');
    const result = spawnSync(
      process.execPath,
      [
        prCommentCliPath,
        `--reports-dir=${reportsDir}`,
        '--pr-number=467',
        '--head-sha=abcdef0123456789',
        '--holmes-status=failure',
        '--watson-status=failure',
        '--moriarty-status=failure'
      ],
      {
        encoding: 'utf8'
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(HOLMES_SUITE_COMMENT_MARKER));
    assert.ok(result.stdout.includes('<!-- HOLMES_SUITE_SHA:abcdef0123456789 -->'));
    assert.ok(
      result.stdout.includes(
        'The Holmes report is unavailable because the workflow status is failure.'
      )
    );
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
});

test('loadHolmesSuiteReports preserves report and markdown diagnostics without throwing', () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-errors-'));
  const unreadableMarkdownPath = path.join(reportsDir, 'holmes-report.md');
  try {
    writeFileSync(
      path.join(reportsDir, 'holmes-report.json'),
      JSON.stringify(sampleHolmesReport())
    );
    writeFileSync(path.join(reportsDir, 'watson-report.json'), '{"not":"valid"');
    writeFileSync(
      path.join(reportsDir, 'moriarty-report.json'),
      JSON.stringify(sampleMoriartyReport())
    );
    writeFileSync(unreadableMarkdownPath, '### raw holmes\n');
    chmodSync(unreadableMarkdownPath, 0o000);

    const reports = loadHolmesSuiteReports(reportsDir, {
      holmes: 'success',
      watson: 'success',
      moriarty: 'success'
    });

    assert.equal(reports.reportStates.watson, 'invalid');
    assert.ok(reports.reportErrors.watson.length > 0, 'invalid JSON should preserve a parse error');
    assert.equal(reports.markdownStates.holmes, 'invalid');
    assert.ok(
      reports.markdownErrors.holmes.length > 0,
      'unreadable markdown should preserve a read error'
    );
  } finally {
    chmodSync(unreadableMarkdownPath, 0o644);
    rmSync(reportsDir, { recursive: true, force: true });
  }
});
