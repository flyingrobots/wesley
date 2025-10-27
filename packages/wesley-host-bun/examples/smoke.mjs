import { runInBun } from '../src/index.mjs';

const schema = `type Org @wes_table { id: ID! @wes_pk }\n`+
  `type User @wes_table { id: ID! @wes_pk, org_id: ID! @wes_fk(ref: "Org.id") }`;
const res = await runInBun(schema);
console.log(res.token);

