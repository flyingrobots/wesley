#!/usr/bin/env bats

@test "QIR schema validates representative plans (Ajv)" {
  run node - <<'NODE'
    import Ajv from 'ajv';
    import addFormats from 'ajv-formats';
    import { readFileSync } from 'node:fs';
    import { resolve } from 'node:path';

    const schemaPath = resolve(process.cwd(), '../../schemas/qir.schema.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const flat = {
      root: { kind: 'Filter', input: { kind: 'Table', table: 'organization', alias: 't0' }, predicate: { kind: 'Compare', left: { kind: 'ColumnRef', table: 't0', column: 'deleted_at' }, op: 'isNull' } },
      projection: { items: [ { alias: 'id', expr: { kind: 'ColumnRef', table: 't0', column: 'id' } } ] }
    };
    if (!validate(flat)) { console.error(validate.errors); process.exit(1); }

    const child = {
      root: { kind: 'Table', table: 'membership', alias: 'm' },
      projection: { items: [ { alias: 'member', expr: { kind: 'JsonBuildObject', fields: [ { key: 'user_id', value: { kind: 'ColumnRef', table: 'm', column: 'user_id' } } ] } } ] }
    };
    const nested = {
      root: {
        kind: 'Join',
        left: { kind: 'Table', table: 'organization', alias: 'o' },
        right: { kind: 'Lateral', plan: child, alias: 'l0' },
        joinType: 'LEFT',
        on: { kind: 'Compare', op: 'eq', left: { kind: 'Literal', value: true }, right: { kind: 'Literal', value: true } }
      },
      projection: { items: [ { alias: 'id', expr: { kind: 'ColumnRef', table: 'o', column: 'id' } }, { alias: 'members', expr: { kind: 'JsonAgg', value: { kind: 'ScalarSubquery', plan: child } } } ] }
    };
    if (!validate(nested)) { console.error(validate.errors); process.exit(1); }
    console.log('ok');
NODE
  [ "$status" -eq 0 ]
  [[ "$output" == *ok* ]]
}
