import { runInDeno } from "../mod.ts";

const schema = `type Org @wes_table { id: ID! @wes_pk }\n`+
  `type User @wes_table { id: ID! @wes_pk, org_id: ID! @wes_fk(ref: "Org.id") }`;
const res = await runInDeno(schema);
console.log(res.token);

