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
  parseJsonl,
  readJson
} from './continuum-witness-support.mjs';
import { joinPath } from './path-utils.mjs';

export async function inspectReceiptFamilySurface({
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
  const separationFixture = await readJson(fs, joinPath(fixtureDir, 'receipt-vs-witness.json'));

  const schemaJson = await readJson(fs, joinPath(ttdDir, 'manifest/schema.json'));
  const contractsJson = await readJson(fs, joinPath(ttdDir, 'manifest/contracts.json'));
  const irJson = await readJson(fs, joinPath(echoDir, 'ir.json'));
  const deliveryRows = parseJsonl(await fs.read(joinPath(echoDir, 'mock/deliveries.jsonl')));

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
    'receipt-family.cross-leg-schema-hash',
    ttdSurface.schemaHash === echoSurface.schemaHash,
    ttdSurface.schemaHash === echoSurface.schemaHash
      ? 'TTD and Echo legs agree on the authored receipt-family schema hash.'
      : 'TTD and Echo legs disagree on the authored receipt-family schema hash.',
    {
      ttdSchemaHash: ttdSurface.schemaHash,
      echoSchemaHash: echoSurface.schemaHash
    }
  ));

  checks.push(createCheck(
    'receipt-family.ttd-fixture-shape',
    deepEqual(ttdShape, expectedTtdShape),
    deepEqual(ttdShape, expectedTtdShape)
      ? 'TTD outputs match the receipt-family fixture for nouns, operations, invariants, and footprints.'
      : 'TTD outputs drift from the receipt-family fixture.',
    {
      fixtureDir,
      expected: expectedTtdShape,
      actual: ttdShape
    }
  ));

  checks.push(createCheck(
    'receipt-family.echo-fixture-shape',
    deepEqual(echoShape, expectedEchoShape),
    deepEqual(echoShape, expectedEchoShape)
      ? 'Echo IR matches the receipt-family fixture for object types, enums, and operations.'
      : 'Echo IR drifts from the receipt-family fixture.',
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
    'receipt-family.boundary-fixture',
    boundaryMatches,
    boundaryMatches
      ? 'TTD and Echo legs agree with the receipt-family boundary fixture.'
      : 'TTD or Echo drifted from the receipt-family boundary fixture.',
    {
      fixtureDir,
      expected: expectedBoundary,
      ttd: ttdBoundary,
      echo: echoBoundary
    }
  ));

  const receiptFields = new Set(ttdBoundary.Receipt ?? []);
  const witnessFields = new Set(ttdBoundary.Witness ?? []);
  const deliveryFields = new Set(ttdBoundary.DeliveryObservation ?? []);
  const forbiddenDeliveryFields = new Set([
    ...(separationFixture.deliveryObservationForbiddenFields ?? []),
    ...(separationFixture.receiptOnlyFields ?? []),
    ...(separationFixture.witnessOnlyFields ?? [])
  ]);
  const separationHolds =
    fieldsPresent(receiptFields, separationFixture.receiptOnlyFields ?? []) &&
    fieldsAbsent(receiptFields, separationFixture.witnessOnlyFields ?? []) &&
    fieldsPresent(witnessFields, separationFixture.witnessOnlyFields ?? []) &&
    fieldsAbsent(witnessFields, separationFixture.receiptOnlyFields ?? []) &&
    fieldsAbsent(deliveryFields, [...forbiddenDeliveryFields]) &&
    deliveryRows.every((row) => fieldsAbsent(new Set(Object.keys(row.data ?? {})), [...forbiddenDeliveryFields]));

  checks.push(createCheck(
    'receipt-family.receipt-vs-witness-separation',
    separationHolds,
    separationHolds
      ? 'Receipt, Witness, and delivery-observation surfaces stay on their authored boundaries.'
      : 'Receipt, Witness, or delivery-observation surfaces blur authored family boundaries.',
    {
      fixtureDir,
      receiptOnlyFields: separationFixture.receiptOnlyFields ?? [],
      witnessOnlyFields: separationFixture.witnessOnlyFields ?? [],
      deliveryObservationForbiddenFields: [...forbiddenDeliveryFields],
      ttd: {
        receipt: [...receiptFields].sort(),
        witness: [...witnessFields].sort(),
        deliveryObservation: [...deliveryFields].sort()
      },
      deliveryRows: deliveryRows.map((row, index) => ({
        index,
        fields: Object.keys(row.data ?? {}).sort()
      }))
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
