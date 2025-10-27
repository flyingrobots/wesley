#!/usr/bin/env node
import { runAll } from '../test/contracts/host-contracts.mjs';

const res = await runAll();
console.log(JSON.stringify(res));

