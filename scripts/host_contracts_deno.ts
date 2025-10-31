// deno run --config deno.json -A scripts/host_contracts_deno.ts
// Note: we import a JS module; this file remains .ts for runtime selection ergonomics.
import { runAndReport } from "./host_contracts_runner.mjs";

await runAndReport();
