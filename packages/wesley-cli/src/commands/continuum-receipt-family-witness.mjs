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
  const roundtripFixture = await readJson(fs, joinPath(fixtureDir, 'roundtrip.json'));
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

  const roundtripReport = validateRoundtripFixtureVectors({
    roundtripFixture,
    schemaJson,
    irJson
  });
  checks.push(createCheck(
    'receipt-family.roundtrip-fixture-vectors',
    roundtripReport.ok,
    roundtripReport.ok
      ? 'Receipt-family operation vectors round-trip cleanly across the emitted TTD and Echo type surfaces.'
      : 'Receipt-family operation vectors drift from the emitted TTD or Echo type surfaces.',
    {
      fixtureDir,
      operations: roundtripReport.operations
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
    invariantCount: ttdShape.invariants.length,
    roundtripOperationCount: roundtripReport.operations.length
  };
}

function validateRoundtripFixtureVectors({ roundtripFixture, schemaJson, irJson }) {
  const ttdTypes = createTtdTypeMap(schemaJson);
  const echoTypes = createEchoTypeMap(irJson);
  const ttdOps = createTtdOperationMap(schemaJson);
  const echoOps = createEchoOperationMap(irJson);
  const ttdEnums = createTtdEnumMap(schemaJson);
  const echoEnums = createEchoEnumMap(irJson);

  const operations = (roundtripFixture.ops ?? []).map((fixtureOp) => {
    const problems = [];
    const ttdOp = ttdOps.get(fixtureOp.name);
    const echoOp = echoOps.get(fixtureOp.name);

    if (ttdOp == null) {
      problems.push(`TTD op missing: ${fixtureOp.name}`);
    }
    if (echoOp == null) {
      problems.push(`Echo op missing: ${fixtureOp.name}`);
    }

    if (ttdOp != null && ttdOp.resultType !== fixtureOp.resultType) {
      problems.push(`TTD result type mismatch: expected ${fixtureOp.resultType}, got ${ttdOp.resultType}`);
    }
    if (echoOp != null && echoOp.resultType !== fixtureOp.resultType) {
      problems.push(`Echo result type mismatch: expected ${fixtureOp.resultType}, got ${echoOp.resultType}`);
    }

    if (ttdOp != null && echoOp != null) {
      const ttdArgSignature = canonicalObjectList(ttdOp.args);
      const echoArgSignature = canonicalObjectList(echoOp.args);
      if (!deepEqual(ttdArgSignature, echoArgSignature)) {
        problems.push('TTD and Echo op arg signatures diverge.');
      }
    }

    const argValidation = validateArgObject({
      actualArgs: fixtureOp.args ?? {},
      definitions: ttdOp?.args ?? echoOp?.args ?? [],
      enums: mergeEnumMaps(ttdEnums, echoEnums)
    });
    problems.push(...argValidation.problems);

    const ttdType = ttdTypes.get(fixtureOp.resultType);
    const echoType = echoTypes.get(fixtureOp.resultType);
    if (ttdType == null) {
      problems.push(`TTD result type missing: ${fixtureOp.resultType}`);
    }
    if (echoType == null) {
      problems.push(`Echo result type missing: ${fixtureOp.resultType}`);
    }

    const canonicalRows = [];
    const rows = Array.isArray(fixtureOp.result) ? fixtureOp.result : [];
    if (!Array.isArray(fixtureOp.result)) {
      problems.push('Fixture result must be an array.');
    }

    for (const [index, row] of rows.entries()) {
      const ttdValidation = ttdType == null
        ? { ok: false, problems: [`TTD type unavailable for row ${index}`], canonical: null }
        : validateObjectAgainstType({
          value: row,
          typeName: fixtureOp.resultType,
          definition: ttdType,
          enums: ttdEnums
        });
      const echoValidation = echoType == null
        ? { ok: false, problems: [`Echo type unavailable for row ${index}`], canonical: null }
        : validateObjectAgainstType({
          value: row,
          typeName: fixtureOp.resultType,
          definition: echoType,
          enums: echoEnums
        });

      if (!ttdValidation.ok) {
        problems.push(...ttdValidation.problems.map((problem) => `row ${index}: ${problem}`));
      }
      if (!echoValidation.ok) {
        problems.push(...echoValidation.problems.map((problem) => `row ${index}: ${problem}`));
      }

      if (ttdValidation.ok && echoValidation.ok && !deepEqual(ttdValidation.canonical, echoValidation.canonical)) {
        problems.push(`row ${index}: TTD and Echo canonical structured values diverge.`);
      }

      canonicalRows.push({
        index,
        canonical: ttdValidation.ok ? ttdValidation.canonical : echoValidation.canonical
      });
    }

    return {
      name: fixtureOp.name,
      resultType: fixtureOp.resultType,
      status: problems.length === 0 ? 'pass' : 'fail',
      argKeys: Object.keys(fixtureOp.args ?? {}).sort(),
      rowCount: rows.length,
      problems,
      canonicalRows
    };
  });

  return {
    ok: operations.every((operation) => operation.status === 'pass'),
    operations
  };
}

function createTtdTypeMap(schemaJson) {
  return new Map(
    (schemaJson.types ?? []).map((type) => [
      type.name,
      (type.fields ?? []).map((field) => ({
        name: field.name,
        type: field.type,
        required: field.required === true,
        list: field.list === true
      }))
    ])
  );
}

function createEchoTypeMap(irJson) {
  return new Map(
    (irJson.types ?? [])
      .filter((type) => type.kind === 'OBJECT')
      .map((type) => [
        type.name,
        (type.fields ?? []).map((field) => ({
          name: field.name,
          type: field.type,
          required: field.required === true,
          list: field.list === true
        }))
      ])
  );
}

function createTtdOperationMap(schemaJson) {
  return new Map(
    (schemaJson.ops ?? []).map((op) => [
      op.name,
      {
        resultType: op.resultType,
        args: canonicalArgs(op.args ?? [])
      }
    ])
  );
}

function createEchoOperationMap(irJson) {
  return new Map(
    (irJson.ops ?? []).map((op) => [
      op.name,
      {
        resultType: op.result_type,
        args: canonicalArgs(op.args ?? [])
      }
    ])
  );
}

function createTtdEnumMap(schemaJson) {
  return new Map(
    (schemaJson.enums ?? []).map((enumType) => [
      enumType.name,
      new Set(enumType.values ?? [])
    ])
  );
}

function createEchoEnumMap(irJson) {
  return new Map(
    (irJson.types ?? [])
      .filter((type) => type.kind === 'ENUM')
      .map((enumType) => [
        enumType.name,
        new Set(enumType.values ?? [])
      ])
  );
}

function mergeEnumMaps(left, right) {
  const merged = new Map(left);
  for (const [name, values] of right.entries()) {
    if (!merged.has(name)) {
      merged.set(name, values);
    }
  }
  return merged;
}

function canonicalArgs(args) {
  return canonicalObjectList((args ?? []).map((arg) => ({
    name: arg.name,
    type: arg.type,
    required: arg.required === true,
    list: arg.list === true
  })));
}

function validateArgObject({ actualArgs, definitions, enums }) {
  const problems = [];
  const definitionMap = new Map(definitions.map((definition) => [definition.name, definition]));

  for (const key of Object.keys(actualArgs).sort()) {
    if (!definitionMap.has(key)) {
      problems.push(`unexpected arg ${key}`);
    }
  }

  for (const definition of definitions) {
    const hasValue = Object.hasOwn(actualArgs, definition.name);
    if (!hasValue) {
      if (definition.required) {
        problems.push(`missing required arg ${definition.name}`);
      }
      continue;
    }

    const validation = validateTypedValue({
      value: actualArgs[definition.name],
      fieldName: definition.name,
      type: definition.type,
      list: definition.list === true,
      enums
    });
    problems.push(...validation.problems.map((problem) => `arg ${definition.name}: ${problem}`));
  }

  return {
    ok: problems.length === 0,
    problems
  };
}

function validateObjectAgainstType({ value, typeName, definition, enums }) {
  const problems = [];
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      canonical: null,
      problems: [`${typeName} value must be an object.`]
    };
  }

  const fieldNames = new Set(definition.map((field) => field.name));
  for (const key of Object.keys(value).sort()) {
    if (!fieldNames.has(key)) {
      problems.push(`unexpected field ${key}`);
    }
  }

  const canonical = {};
  for (const field of definition) {
    const hasValue = Object.hasOwn(value, field.name);
    if (!hasValue) {
      if (field.required) {
        problems.push(`missing required field ${field.name}`);
      }
      continue;
    }

    const validation = validateTypedValue({
      value: value[field.name],
      fieldName: field.name,
      type: field.type,
      list: field.list === true,
      enums
    });
    if (validation.problems.length > 0) {
      problems.push(...validation.problems);
      continue;
    }
    canonical[field.name] = validation.canonical;
  }

  return {
    ok: problems.length === 0,
    canonical,
    problems
  };
}

function validateTypedValue({ value, fieldName, type, list, enums }) {
  if (list) {
    if (!Array.isArray(value)) {
      return {
        problems: [`${fieldName} must be an array.`],
        canonical: null
      };
    }
    const canonical = [];
    const problems = [];
    for (const [index, entry] of value.entries()) {
      const validation = validateScalarValue({
        value: entry,
        fieldName: `${fieldName}[${index}]`,
        type,
        enums
      });
      problems.push(...validation.problems);
      canonical.push(validation.canonical);
    }
    return { problems, canonical };
  }

  return validateScalarValue({ value, fieldName, type, enums });
}

function validateScalarValue({ value, fieldName, type, enums }) {
  if (enums.has(type)) {
    const validValues = enums.get(type);
    if (typeof value !== 'string' || !validValues.has(value)) {
      return {
        problems: [`${fieldName} must be one of ${[...validValues].sort().join(', ')}.`],
        canonical: null
      };
    }
    return { problems: [], canonical: value };
  }

  switch (type) {
    case 'Int':
      return Number.isInteger(value)
        ? { problems: [], canonical: value }
        : { problems: [`${fieldName} must be an integer.`], canonical: null };
    case 'Boolean':
      return typeof value === 'boolean'
        ? { problems: [], canonical: value }
        : { problems: [`${fieldName} must be a boolean.`], canonical: null };
    case 'Float':
      return typeof value === 'number' && Number.isFinite(value)
        ? { problems: [], canonical: value }
        : { problems: [`${fieldName} must be a finite number.`], canonical: null };
    default:
      return typeof value === 'string' && value.trim().length > 0
        ? { problems: [], canonical: value }
        : { problems: [`${fieldName} must be a non-empty string.`], canonical: null };
  }
}
