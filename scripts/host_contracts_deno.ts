// deno run --config deno.json -A scripts/host_contracts_deno.ts
import { runAll } from "../test/contracts/host-contracts.mjs";

const res = await runAll();
console.log(JSON.stringify(res));

