import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function normalizeSnapshotText(actual) {
  return actual
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/gm, '')
    .trim();
}

export function matchTextSnapshot({
  snapshotsDir,
  actual,
  testName,
  snapshotName = 'default',
  label = 'Snapshot'
}) {
  mkdirSync(snapshotsDir, { recursive: true });

  const fileName = `${testName}.${snapshotName}.snap`;
  const filePath = join(snapshotsDir, fileName);
  const normalizedActual = normalizeSnapshotText(actual);

  let expectedContent = null;
  try {
    expectedContent = readFileSync(filePath, 'utf-8').trim();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (expectedContent !== null) {
    if (normalizedActual !== expectedContent) {
      if (process.env.UPDATE_SNAPSHOTS) {
        writeFileSync(filePath, `${normalizedActual}\n`);
        console.log(`Updated snapshot: ${fileName}`);
        return;
      }

      console.log(`\n${label} mismatch:`);
      console.log('Expected:');
      console.log(expectedContent);
      console.log('\nActual:');
      console.log(normalizedActual);

      throw new Error(`Snapshot mismatch for ${fileName}. Set UPDATE_SNAPSHOTS=1 to update.`);
    }
    return;
  }

  try {
    writeFileSync(filePath, `${normalizedActual}\n`, { flag: 'wx' });
    console.log(`Created new snapshot: ${fileName}`);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const concurrentContent = readFileSync(filePath, 'utf-8').trim();
    if (normalizedActual !== concurrentContent) {
      throw new Error(`Snapshot mismatch for ${fileName}. Set UPDATE_SNAPSHOTS=1 to update.`);
    }
  }
}
