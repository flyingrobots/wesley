import { existsSync, readFileSync } from 'node:fs';

import {
  classifyEvidenceLocation as classifyEvidenceLocationWithResolver,
  pickBestEvidenceLocation as pickBestEvidenceLocationWithResolver,
  summarizeEvidenceKinds as summarizeEvidenceKindsWithResolver,
  summarizeEvidenceQuality as summarizeEvidenceQualityWithResolver
} from './support/evidence-quality.mjs';

export function summarizeEvidenceQuality(payload, resolver = readLocalEvidenceContent) {
  return summarizeEvidenceQualityWithResolver(payload, resolver);
}

export function summarizeEvidenceKinds(evidence, resolver = readLocalEvidenceContent) {
  return summarizeEvidenceKindsWithResolver(evidence, resolver);
}

export function pickBestEvidenceLocation(evidence, resolver = readLocalEvidenceContent) {
  return pickBestEvidenceLocationWithResolver(evidence, resolver);
}

export function classifyEvidenceLocation(location, resolver = readLocalEvidenceContent) {
  return classifyEvidenceLocationWithResolver(location, resolver);
}

export function summarizeEvidenceQualityFromLocalFiles(payload) {
  return summarizeEvidenceQualityWithResolver(payload, readLocalEvidenceContent);
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
