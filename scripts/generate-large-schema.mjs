#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const types = [];
for (let i = 0; i < 100; i++) {
  const fields = [];
  for (let j = 0; j < 10; j++) {
    fields.push(`  field${j}: String @wes_index`);
  }
  types.push(`type Type${i} @wes_table(name: "type_${i}") {
  id: ID! @wes_pk
${fields.join('\n')}
}`);
}

writeFileSync('test/fixtures/ir-parity/large-schema.graphql', types.join('\n\n'));
