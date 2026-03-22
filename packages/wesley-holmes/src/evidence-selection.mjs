import { existsSync, readFileSync } from 'node:fs';

import {
  classifyEvidenceLocation as classifyEvidenceLocationCore,
  pickBestEvidenceLocation as pickBestEvidenceLocationCore,
  summarizeEvidenceKinds as summarizeEvidenceKindsCore,
  summarizeEvidenceQuality as summarizeEvidenceQualityCore
} from '@wesley/core';

export function summarizeEvidenceQuality(payload, resolver = readLocalEvidenceContent) {
  return summarizeEvidenceQualityCore(payload, resolver);
}

export function summarizeEvidenceKinds(evidence, resolver = readLocalEvidenceContent) {
  return summarizeEvidenceKindsCore(evidence, resolver);
}

export function pickBestEvidenceLocation(evidence, resolver = readLocalEvidenceContent) {
  return pickBestEvidenceLocationCore(evidence, resolver);
}

export function classifyEvidenceLocation(location, resolver = readLocalEvidenceContent) {
  return classifyEvidenceLocationCore(location, resolver);
}

export function readLocalEvidenceContent(file) {
  if (typeof file !== 'string' || file.length === 0) return null;
  if (!existsSync(file)) return null;
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
