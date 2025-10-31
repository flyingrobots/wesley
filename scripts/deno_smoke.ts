// Deno smoke: import @wesley/core via import map and exercise a tiny bit
import { SystemClock } from "@wesley/core";

const clock = new SystemClock();
const now = clock.now();
// Simple token so CI can assert easily
const token = `DENO_SMOKE_OK:${now.substring(0, 10)}`;
console.log(token);
