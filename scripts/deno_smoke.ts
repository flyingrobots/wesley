// Deno smoke: exercise the Deno host adapter without the retired JS core.
import { runInDeno } from '../packages/wesley-host-deno/mod.ts';

const result = await runInDeno(/* GraphQL */ `
  type Widget @wes_table {
    id: ID! @wes_pk
  }
`);

console.log(result.token);
