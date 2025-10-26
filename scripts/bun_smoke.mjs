#!/usr/bin/env bun
import { SystemClock } from '../packages/wesley-core/src/index.mjs';

const clock = new SystemClock();
const token = `BUN_SMOKE_OK:${clock.now().slice(0, 10)}`;
console.log(token);

