import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { generateEcho } from '../src/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const directivesSDL = readFileSync(
  resolve(__dirname, '../../../schemas/directives.graphql'),
  'utf-8'
);

const proofSDL = directivesSDL + '\n' + /* GraphQL */ `
  type Counter {
    id: ID!
    value: Int!
  }

  type Mutation {
    incrementCounter(counterId: ID!): Counter!
      @wes_op(name: "incrementCounter")
      @wes_footprint(reads: ["Counter"], writes: ["Counter"])
  }

  type Query {
    counter(counterId: ID!): Counter
      @wes_op(name: "counter", readonly: true)
      @wes_footprint(reads: ["Counter"])
  }
`;

function compileRust(source) {
  const dir = mkdtempSync(join(tmpdir(), 'wesley-rewrite-api-'));
  const srcPath = join(dir, 'proof.rs');
  const outPath = join(dir, 'proof.rlib');
  writeFileSync(srcPath, source);
  const result = spawnSync(
    'rustc',
    ['--edition', '2021', '--crate-type', 'lib', srcPath, '-o', outPath],
    { encoding: 'utf8' }
  );
  rmSync(dir, { recursive: true, force: true });
  return result;
}

describe('rewrite_api.generated.rs', () => {
  it('emits bounded Rust traits for footprinted mutations', async () => {
    const result = await generateEcho({ sdl: proofSDL });
    const file = result.files.find((entry) => entry.path === 'rewrite_api.generated.rs');

    expect(file).toBeDefined();
    expect(file.content).toContain('pub trait ReadCounter');
    expect(file.content).toContain('pub trait WriteCounter');
    expect(file.content).toContain('pub trait IncrementCounterContext');
    expect(file.content).toContain('pub trait IncrementCounterRewrite');
    expect(file.content).toContain('pub struct IncrementCounterArgs');
    expect(file.content).not.toContain('DeleteCounter');
  });

  it('records footprint data in echo ir ops', async () => {
    const result = await generateEcho({ sdl: proofSDL });
    const ir = JSON.parse(result.files.find((entry) => entry.path === 'ir.json').content);
    const increment = ir.ops.find((op) => op.name === 'incrementCounter');
    const counter = ir.ops.find((op) => op.name === 'counter');

    expect(increment.footprint).toEqual({
      reads: ['Counter'],
      writes: ['Counter'],
      creates: [],
      deletes: []
    });
    expect(counter.footprint).toEqual({
      reads: ['Counter'],
      writes: [],
      creates: [],
      deletes: []
    });
  });

  it('allows a valid bounded implementation to compile', async () => {
    const result = await generateEcho({ sdl: proofSDL });
    const generated = result.files.find((entry) => entry.path === 'rewrite_api.generated.rs').content;

    const compile = compileRust(`
${generated}

#[derive(Debug, Clone, PartialEq)]
pub struct Counter {
    pub id: String,
    pub value: i64,
}

pub struct CounterStore {
    pub counter: Counter,
}

impl ReadCounter for CounterStore {
    fn read_counter(&self) -> &Counter {
        &self.counter
    }
}

impl WriteCounter for CounterStore {
    fn write_counter(&mut self, value: Counter) {
        self.counter = value;
    }
}

pub struct Increment;

impl IncrementCounterRewrite for Increment {
    type Error = ();

    fn apply<C>(&self, ctx: &mut C, _args: IncrementCounterArgs) -> Result<Counter, Self::Error>
    where
        C: IncrementCounterContext,
    {
        let mut next = ctx.read_counter().clone();
        next.value += 1;
        ctx.write_counter(next.clone());
        Ok(next)
    }
}
`);

    expect(compile.status).toBe(0);
    expect(compile.stderr).toBe('');
  });

  it('rejects an implementation that exceeds its declared footprint', async () => {
    const result = await generateEcho({ sdl: proofSDL });
    const generated = result.files.find((entry) => entry.path === 'rewrite_api.generated.rs').content;

    const compile = compileRust(`
${generated}

#[derive(Debug, Clone, PartialEq)]
pub struct Counter {
    pub id: String,
    pub value: i64,
}

pub struct CounterStore {
    pub counter: Counter,
}

impl ReadCounter for CounterStore {
    fn read_counter(&self) -> &Counter {
        &self.counter
    }
}

impl WriteCounter for CounterStore {
    fn write_counter(&mut self, value: Counter) {
        self.counter = value;
    }
}

pub struct Increment;

impl IncrementCounterRewrite for Increment {
    type Error = ();

    fn apply<C>(&self, ctx: &mut C, _args: IncrementCounterArgs) -> Result<Counter, Self::Error>
    where
        C: IncrementCounterContext,
    {
        ctx.delete_counter();
        Ok(ctx.read_counter().clone())
    }
}
`);

    expect(compile.status).not.toBe(0);
    expect(compile.stderr).toContain('delete_counter');
  });
});
