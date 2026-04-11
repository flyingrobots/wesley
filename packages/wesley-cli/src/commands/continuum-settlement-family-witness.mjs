import {
  canonicalFieldMap,
  canonicalObjectList,
  canonicalStringList,
  createCheck,
  deepEqual,
  extractIrFieldMap,
  extractSchemaFieldMap,
  fieldsAbsent,
  fieldsPresent,
  readJson
} from './continuum-witness-support.mjs';
import { joinPath } from './path-utils.mjs';

export async function inspectSettlementFamilySurface({
  fs,
  ttdDir,
  echoDir,
  fixtureDir,
  ttdSurface,
  echoSurface,
  checks
}) {
  const minimalFixture = await readJson(fs, joinPath(fixtureDir, 'minimal.json'));
  const boundaryFixture = await readJson(fs, joinPath(fixtureDir, 'boundary.json'));
  const separationFixture = await readJson(fs, joinPath(fixtureDir, 'decision-separation.json'));

  const schemaJson = await readJson(fs, joinPath(ttdDir, 'manifest/schema.json'));
  const contractsJson = await readJson(fs, joinPath(ttdDir, 'manifest/contracts.json'));
  const irJson = await readJson(fs, joinPath(echoDir, 'ir.json'));

  const ttdShape = {
    objectTypes: canonicalStringList(schemaJson.types?.map((type) => type.name) ?? []),
    enumTypes: canonicalStringList(schemaJson.enums?.map((type) => type.name) ?? []),
    ops: canonicalObjectList((schemaJson.ops ?? []).map((op) => ({
      name: op.name,
      resultType: op.resultType
    }))),
    invariants: canonicalStringList((contractsJson.invariants ?? []).map((invariant) => invariant.name)),
    footprints: canonicalObjectList((contractsJson.footprints ?? []).map((footprint) => ({
      opName: footprint.opName,
      reads: canonicalStringList(footprint.reads ?? []),
      writes: canonicalStringList(footprint.writes ?? []),
      creates: canonicalStringList(footprint.creates ?? []),
      deletes: canonicalStringList(footprint.deletes ?? [])
    })))
  };
  const echoShape = {
    objectTypes: canonicalStringList(
      (irJson.types ?? [])
        .filter((type) => type.kind === 'OBJECT')
        .map((type) => type.name)
    ),
    enumTypes: canonicalStringList(
      (irJson.types ?? [])
        .filter((type) => type.kind === 'ENUM')
        .map((type) => type.name)
    ),
    ops: canonicalStringList((irJson.ops ?? []).map((op) => op.name))
  };
  const expectedTtdShape = {
    objectTypes: canonicalStringList(minimalFixture.objectTypes ?? []),
    enumTypes: canonicalStringList(minimalFixture.enumTypes ?? []),
    ops: canonicalObjectList(minimalFixture.ops ?? []),
    invariants: canonicalStringList(minimalFixture.invariants ?? []),
    footprints: canonicalObjectList((minimalFixture.footprints ?? []).map((footprint) => ({
      opName: footprint.opName,
      reads: canonicalStringList(footprint.reads ?? []),
      writes: canonicalStringList(footprint.writes ?? []),
      creates: canonicalStringList(footprint.creates ?? []),
      deletes: canonicalStringList(footprint.deletes ?? [])
    })))
  };
  const expectedEchoShape = {
    objectTypes: expectedTtdShape.objectTypes,
    enumTypes: expectedTtdShape.enumTypes,
    ops: canonicalStringList((minimalFixture.ops ?? []).map((op) => op.name))
  };

  checks.push(createCheck(
    'settlement-family.cross-leg-schema-hash',
    ttdSurface.schemaHash === echoSurface.schemaHash,
    ttdSurface.schemaHash === echoSurface.schemaHash
      ? 'TTD and Echo legs agree on the authored settlement-family schema hash.'
      : 'TTD and Echo legs disagree on the authored settlement-family schema hash.',
    {
      ttdSchemaHash: ttdSurface.schemaHash,
      echoSchemaHash: echoSurface.schemaHash
    }
  ));

  checks.push(createCheck(
    'settlement-family.ttd-fixture-shape',
    deepEqual(ttdShape, expectedTtdShape),
    deepEqual(ttdShape, expectedTtdShape)
      ? 'TTD outputs match the settlement-family fixture for nouns, operations, invariants, and footprints.'
      : 'TTD outputs drift from the settlement-family fixture.',
    {
      fixtureDir,
      expected: expectedTtdShape,
      actual: ttdShape
    }
  ));

  checks.push(createCheck(
    'settlement-family.echo-fixture-shape',
    deepEqual(echoShape, expectedEchoShape),
    deepEqual(echoShape, expectedEchoShape)
      ? 'Echo IR matches the settlement-family fixture for object types, enums, and operations.'
      : 'Echo IR drifts from the settlement-family fixture.',
    {
      fixtureDir,
      expected: expectedEchoShape,
      actual: echoShape
    }
  ));

  const expectedBoundary = canonicalFieldMap(boundaryFixture.types ?? {});
  const ttdBoundary = canonicalFieldMap(extractSchemaFieldMap(schemaJson.types ?? []));
  const echoBoundary = canonicalFieldMap(extractIrFieldMap(irJson.types ?? []));
  const boundaryMatches = deepEqual(ttdBoundary, expectedBoundary) && deepEqual(echoBoundary, expectedBoundary);
  checks.push(createCheck(
    'settlement-family.boundary-fixture',
    boundaryMatches,
    boundaryMatches
      ? 'TTD and Echo legs agree with the settlement-family boundary fixture.'
      : 'TTD or Echo drifted from the settlement-family boundary fixture.',
    {
      fixtureDir,
      expected: expectedBoundary,
      ttd: ttdBoundary,
      echo: echoBoundary
    }
  ));

  const importFields = new Set(ttdBoundary.ImportCandidate ?? []);
  const conflictFields = new Set(ttdBoundary.ConflictArtifact ?? []);
  const separationHolds =
    fieldsPresent(importFields, separationFixture.importOnlyFields ?? []) &&
    fieldsAbsent(importFields, separationFixture.conflictOnlyFields ?? []) &&
    fieldsPresent(conflictFields, separationFixture.conflictOnlyFields ?? []) &&
    fieldsAbsent(conflictFields, separationFixture.importOnlyFields ?? []);

  checks.push(createCheck(
    'settlement-family.decision-separation',
    separationHolds,
    separationHolds
      ? 'ImportCandidate and ConflictArtifact stay on distinct authored family boundaries.'
      : 'ImportCandidate and ConflictArtifact blur authored family boundaries.',
    {
      fixtureDir,
      importOnlyFields: separationFixture.importOnlyFields ?? [],
      conflictOnlyFields: separationFixture.conflictOnlyFields ?? [],
      ttd: {
        importCandidate: [...importFields].sort(),
        conflictArtifact: [...conflictFields].sort()
      }
    }
  ));

  return {
    fixtureDir,
    objectTypes: ttdShape.objectTypes,
    enumTypes: ttdShape.enumTypes,
    opCount: ttdShape.ops.length,
    invariantCount: ttdShape.invariants.length
  };
}
