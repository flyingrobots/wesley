#!/usr/bin/env bun
import { runInBun } from '../packages/wesley-host-bun/src/index.mjs';

const result = await runInBun(/* GraphQL */ `
  type Widget @wes_table {
    id: ID! @wes_pk
  }
`);

console.log(result.token);
