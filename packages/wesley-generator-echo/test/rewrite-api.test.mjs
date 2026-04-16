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

const structuredSDL = directivesSDL + '\n' + /* GraphQL */ `
  type BufferWorldline {
    worldlineId: ID!
    canonicalHeadId: ID!
  }

  type RopeHead {
    headId: ID!
    worldlineId: ID!
  }

  type RopeBranch {
    branchId: ID!
  }

  type RopeLeaf {
    leafId: ID!
  }

  type TextBlob {
    blobId: ID!
  }

  type Anchor {
    anchorId: ID!
  }

  type Tick {
    tickId: ID!
  }

  type TickReceipt {
    receiptId: ID!
  }

  input ReplaceRangeAsTickInput {
    worldlineId: ID!
    baseHeadId: ID!
    startByte: Int!
    endByte: Int!
    insertText: String!
  }

  type ReplaceRangeAsTickResult {
    worldlineId: ID!
    nextHeadId: ID!
    tickId: ID!
    receiptId: ID!
  }

  type Mutation {
    replaceRangeAsTick(input: ReplaceRangeAsTickInput!): ReplaceRangeAsTickResult!
      @wes_op(name: "replaceRangeAsTick")
      @wes_footprint(
        reads: ["BufferWorldline", "RopeHead", "RopeBranch", "RopeLeaf", "TextBlob", "Anchor"]
        writes: ["BufferWorldline"]
        creates: ["TextBlob", "RopeLeaf", "RopeBranch", "RopeHead", "Tick", "TickReceipt"]
        slots: [
          { slot: "worldline", kind: "BufferWorldline", bindFromArg: "input.worldlineId", access: [READ, WRITE] }
          { slot: "baseHead", kind: "RopeHead", bindFromArg: "input.baseHeadId", access: [READ] }
        ]
        closures: [
          {
            slot: "touchedRope"
            fromSlot: "baseHead"
            operator: "ropeRangeClosure"
            argBindings: ["input.startByte", "input.endByte"]
            reads: ["RopeBranch", "RopeLeaf", "TextBlob"]
            cardinality: MANY
          }
          {
            slot: "affectedAnchors"
            fromSlot: "worldline"
            operator: "anchorsIntersectingEditWindow"
            argBindings: ["baseHead", "input.startByte", "input.endByte"]
            reads: ["Anchor"]
            cardinality: MANY
          }
        ]
        createSlots: [
          { slot: "newBlob", kind: "TextBlob", cardinality: OPTIONAL }
          { slot: "newLeaves", kind: "RopeLeaf", cardinality: MANY }
          { slot: "newBranches", kind: "RopeBranch", cardinality: MANY }
          { slot: "nextHead", kind: "RopeHead" }
          { slot: "tick", kind: "Tick" }
          { slot: "receipt", kind: "TickReceipt" }
        ]
        updates: [{ slot: "worldline", fields: ["canonicalHead"] }]
        forbids: ["AstState", "Diagnostics", "GitWitness", "UiState"]
      )
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
      deletes: [],
      slots: [],
      closures: [],
      createSlots: [],
      updates: [],
      forbids: []
    });
    expect(counter.footprint).toEqual({
      reads: ['Counter'],
      writes: [],
      creates: [],
      deletes: [],
      slots: [],
      closures: [],
      createSlots: [],
      updates: [],
      forbids: []
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

  it('records structured footprint data in echo ir ops', async () => {
    const result = await generateEcho({ sdl: structuredSDL });
    const ir = JSON.parse(result.files.find((entry) => entry.path === 'ir.json').content);
    const replaceRange = ir.ops.find((op) => op.name === 'replaceRangeAsTick');

    expect(replaceRange.footprint).toEqual({
      reads: ['BufferWorldline', 'RopeHead', 'RopeBranch', 'RopeLeaf', 'TextBlob', 'Anchor'],
      writes: ['BufferWorldline'],
      creates: ['TextBlob', 'RopeLeaf', 'RopeBranch', 'RopeHead', 'Tick', 'TickReceipt'],
      deletes: [],
      slots: [
        {
          slot: 'worldline',
          kind: 'BufferWorldline',
          bindFromArg: 'input.worldlineId',
          access: ['READ', 'WRITE']
        },
        {
          slot: 'baseHead',
          kind: 'RopeHead',
          bindFromArg: 'input.baseHeadId',
          access: ['READ']
        }
      ],
      closures: [
        {
          slot: 'touchedRope',
          fromSlot: 'baseHead',
          operator: 'ropeRangeClosure',
          argBindings: ['input.startByte', 'input.endByte'],
          reads: ['RopeBranch', 'RopeLeaf', 'TextBlob'],
          cardinality: 'MANY'
        },
        {
          slot: 'affectedAnchors',
          fromSlot: 'worldline',
          operator: 'anchorsIntersectingEditWindow',
          argBindings: ['baseHead', 'input.startByte', 'input.endByte'],
          reads: ['Anchor'],
          cardinality: 'MANY'
        }
      ],
      createSlots: [
        { slot: 'newBlob', kind: 'TextBlob', cardinality: 'OPTIONAL' },
        { slot: 'newLeaves', kind: 'RopeLeaf', cardinality: 'MANY' },
        { slot: 'newBranches', kind: 'RopeBranch', cardinality: 'MANY' },
        { slot: 'nextHead', kind: 'RopeHead' },
        { slot: 'tick', kind: 'Tick' },
        { slot: 'receipt', kind: 'TickReceipt' }
      ],
      updates: [
        { slot: 'worldline', fields: ['canonicalHead'] }
      ],
      forbids: ['AstState', 'Diagnostics', 'GitWitness', 'UiState']
    });
  });

  it('emits slot-aware Rust traits for structured footprints', async () => {
    const result = await generateEcho({ sdl: structuredSDL });
    const file = result.files.find((entry) => entry.path === 'rewrite_api.generated.rs');

    expect(file).toBeDefined();
    expect(file.content).toContain('pub trait ReplaceRangeAsTickReadWorldlineSlot');
    expect(file.content).toContain('pub trait ReplaceRangeAsTickWriteWorldlineSlot');
    expect(file.content).toContain('pub trait ReplaceRangeAsTickReadBaseHeadSlot');
    expect(file.content).toContain("pub enum ReplaceRangeAsTickTouchedRopeClosureItemRef<'a>");
    expect(file.content).toContain('pub trait ReplaceRangeAsTickReadTouchedRopeClosure');
    expect(file.content).toContain('pub trait ReplaceRangeAsTickReadAffectedAnchorsClosure');
    expect(file.content).toContain('pub trait ReplaceRangeAsTickCreateNextHeadSlot');
    expect(file.content).toContain('pub trait ReplaceRangeAsTickUpdateWorldlineCanonicalHead');
    expect(file.content).toContain(
      '// ReplaceRangeAsTick forbidden surfaces: AstState, Diagnostics, GitWitness, UiState'
    );
    expect(file.content).not.toContain('pub trait ReadBufferWorldline');
  });

  it('allows a valid structured implementation to compile', async () => {
    const result = await generateEcho({ sdl: structuredSDL });
    const generated = result.files.find((entry) => entry.path === 'rewrite_api.generated.rs').content;

    const compile = compileRust(`
${generated}

#[derive(Debug, Clone, PartialEq)]
pub struct BufferWorldline {
    pub worldline_id: String,
    pub canonical_head_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RopeHead {
    pub head_id: String,
    pub worldline_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RopeBranch {
    pub branch_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RopeLeaf {
    pub leaf_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TextBlob {
    pub blob_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Anchor {
    pub anchor_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Tick {
    pub tick_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TickReceipt {
    pub receipt_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReplaceRangeAsTickInput {
    pub worldline_id: String,
    pub base_head_id: String,
    pub start_byte: i64,
    pub end_byte: i64,
    pub insert_text: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReplaceRangeAsTickResult {
    pub worldline_id: String,
    pub next_head_id: String,
    pub tick_id: String,
    pub receipt_id: String,
}

pub struct RewriteStore {
    pub worldline: BufferWorldline,
    pub base_head: RopeHead,
    pub branch: RopeBranch,
    pub leaf: RopeLeaf,
    pub blob: TextBlob,
    pub anchor: Anchor,
    pub next_head: RopeHead,
    pub tick: Tick,
    pub receipt: TickReceipt,
}

impl ReplaceRangeAsTickReadWorldlineSlot for RewriteStore {
    fn read_worldline_slot(&self) -> &BufferWorldline {
        &self.worldline
    }
}

impl ReplaceRangeAsTickWriteWorldlineSlot for RewriteStore {
    fn write_worldline_slot(&mut self, value: BufferWorldline) {
        self.worldline = value;
    }
}

impl ReplaceRangeAsTickReadBaseHeadSlot for RewriteStore {
    fn read_base_head_slot(&self) -> &RopeHead {
        &self.base_head
    }
}

impl ReplaceRangeAsTickReadTouchedRopeClosure for RewriteStore {
    fn read_touched_rope_closure(&self) -> Vec<ReplaceRangeAsTickTouchedRopeClosureItemRef<'_>> {
        vec![
            ReplaceRangeAsTickTouchedRopeClosureItemRef::RopeBranch(&self.branch),
            ReplaceRangeAsTickTouchedRopeClosureItemRef::RopeLeaf(&self.leaf),
            ReplaceRangeAsTickTouchedRopeClosureItemRef::TextBlob(&self.blob),
        ]
    }
}

impl ReplaceRangeAsTickReadAffectedAnchorsClosure for RewriteStore {
    fn read_affected_anchors_closure(&self) -> Vec<ReplaceRangeAsTickAffectedAnchorsClosureItemRef<'_>> {
        vec![ReplaceRangeAsTickAffectedAnchorsClosureItemRef::Anchor(&self.anchor)]
    }
}

impl ReplaceRangeAsTickCreateNewBlobSlot for RewriteStore {
    fn create_new_blob_slot(&mut self, value: TextBlob) -> TextBlob {
        self.blob = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateNewLeavesSlot for RewriteStore {
    fn create_new_leaves_slot(&mut self, value: RopeLeaf) -> RopeLeaf {
        self.leaf = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateNewBranchesSlot for RewriteStore {
    fn create_new_branches_slot(&mut self, value: RopeBranch) -> RopeBranch {
        self.branch = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateNextHeadSlot for RewriteStore {
    fn create_next_head_slot(&mut self, value: RopeHead) -> RopeHead {
        self.next_head = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateTickSlot for RewriteStore {
    fn create_tick_slot(&mut self, value: Tick) -> Tick {
        self.tick = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateReceiptSlot for RewriteStore {
    fn create_receipt_slot(&mut self, value: TickReceipt) -> TickReceipt {
        self.receipt = value.clone();
        value
    }
}

impl ReplaceRangeAsTickUpdateWorldlineCanonicalHead for RewriteStore {
    fn update_worldline_canonical_head(&mut self, value: String) {
        self.worldline.canonical_head_id = value;
    }
}

pub struct ReplaceRange;

impl ReplaceRangeAsTickRewrite for ReplaceRange {
    type Error = ();

    fn apply<C>(&self, ctx: &mut C, args: ReplaceRangeAsTickArgs) -> Result<ReplaceRangeAsTickResult, Self::Error>
    where
        C: ReplaceRangeAsTickContext,
    {
        let _ = args.input.start_byte;
        let _ = ctx.read_touched_rope_closure();
        let _ = ctx.read_affected_anchors_closure();
        let next_head = ctx.create_next_head_slot(RopeHead {
            head_id: "head-2".to_owned(),
            worldline_id: ctx.read_worldline_slot().worldline_id.clone(),
        });
        let tick = ctx.create_tick_slot(Tick {
            tick_id: "tick-1".to_owned(),
        });
        let receipt = ctx.create_receipt_slot(TickReceipt {
            receipt_id: "receipt-1".to_owned(),
        });
        ctx.update_worldline_canonical_head(next_head.head_id.clone());
        Ok(ReplaceRangeAsTickResult {
            worldline_id: ctx.read_worldline_slot().worldline_id.clone(),
            next_head_id: next_head.head_id,
            tick_id: tick.tick_id,
            receipt_id: receipt.receipt_id,
        })
    }
}
`);

    expect(compile.status).toBe(0);
    expect(compile.stderr).toBe('');
  });

  it('rejects a structured implementation that reaches a forbidden surface', async () => {
    const result = await generateEcho({ sdl: structuredSDL });
    const generated = result.files.find((entry) => entry.path === 'rewrite_api.generated.rs').content;

    const compile = compileRust(`
${generated}

#[derive(Debug, Clone, PartialEq)]
pub struct BufferWorldline {
    pub worldline_id: String,
    pub canonical_head_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RopeHead {
    pub head_id: String,
    pub worldline_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RopeBranch {
    pub branch_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RopeLeaf {
    pub leaf_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TextBlob {
    pub blob_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Anchor {
    pub anchor_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Tick {
    pub tick_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TickReceipt {
    pub receipt_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReplaceRangeAsTickInput {
    pub worldline_id: String,
    pub base_head_id: String,
    pub start_byte: i64,
    pub end_byte: i64,
    pub insert_text: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReplaceRangeAsTickResult {
    pub worldline_id: String,
    pub next_head_id: String,
    pub tick_id: String,
    pub receipt_id: String,
}

pub struct RewriteStore {
    pub worldline: BufferWorldline,
    pub base_head: RopeHead,
    pub branch: RopeBranch,
    pub leaf: RopeLeaf,
    pub blob: TextBlob,
    pub anchor: Anchor,
    pub next_head: RopeHead,
    pub tick: Tick,
    pub receipt: TickReceipt,
}

impl ReplaceRangeAsTickReadWorldlineSlot for RewriteStore {
    fn read_worldline_slot(&self) -> &BufferWorldline {
        &self.worldline
    }
}

impl ReplaceRangeAsTickWriteWorldlineSlot for RewriteStore {
    fn write_worldline_slot(&mut self, value: BufferWorldline) {
        self.worldline = value;
    }
}

impl ReplaceRangeAsTickReadBaseHeadSlot for RewriteStore {
    fn read_base_head_slot(&self) -> &RopeHead {
        &self.base_head
    }
}

impl ReplaceRangeAsTickReadTouchedRopeClosure for RewriteStore {
    fn read_touched_rope_closure(&self) -> Vec<ReplaceRangeAsTickTouchedRopeClosureItemRef<'_>> {
        vec![
            ReplaceRangeAsTickTouchedRopeClosureItemRef::RopeBranch(&self.branch),
            ReplaceRangeAsTickTouchedRopeClosureItemRef::RopeLeaf(&self.leaf),
            ReplaceRangeAsTickTouchedRopeClosureItemRef::TextBlob(&self.blob),
        ]
    }
}

impl ReplaceRangeAsTickReadAffectedAnchorsClosure for RewriteStore {
    fn read_affected_anchors_closure(&self) -> Vec<ReplaceRangeAsTickAffectedAnchorsClosureItemRef<'_>> {
        vec![ReplaceRangeAsTickAffectedAnchorsClosureItemRef::Anchor(&self.anchor)]
    }
}

impl ReplaceRangeAsTickCreateNewBlobSlot for RewriteStore {
    fn create_new_blob_slot(&mut self, value: TextBlob) -> TextBlob {
        self.blob = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateNewLeavesSlot for RewriteStore {
    fn create_new_leaves_slot(&mut self, value: RopeLeaf) -> RopeLeaf {
        self.leaf = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateNewBranchesSlot for RewriteStore {
    fn create_new_branches_slot(&mut self, value: RopeBranch) -> RopeBranch {
        self.branch = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateNextHeadSlot for RewriteStore {
    fn create_next_head_slot(&mut self, value: RopeHead) -> RopeHead {
        self.next_head = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateTickSlot for RewriteStore {
    fn create_tick_slot(&mut self, value: Tick) -> Tick {
        self.tick = value.clone();
        value
    }
}

impl ReplaceRangeAsTickCreateReceiptSlot for RewriteStore {
    fn create_receipt_slot(&mut self, value: TickReceipt) -> TickReceipt {
        self.receipt = value.clone();
        value
    }
}

impl ReplaceRangeAsTickUpdateWorldlineCanonicalHead for RewriteStore {
    fn update_worldline_canonical_head(&mut self, value: String) {
        self.worldline.canonical_head_id = value;
    }
}

pub struct ReplaceRange;

impl ReplaceRangeAsTickRewrite for ReplaceRange {
    type Error = ();

    fn apply<C>(&self, ctx: &mut C, _args: ReplaceRangeAsTickArgs) -> Result<ReplaceRangeAsTickResult, Self::Error>
    where
        C: ReplaceRangeAsTickContext,
    {
        ctx.read_ast_state_slot();
        Ok(ReplaceRangeAsTickResult {
            worldline_id: ctx.read_worldline_slot().worldline_id.clone(),
            next_head_id: String::new(),
            tick_id: String::new(),
            receipt_id: String::new(),
        })
    }
}
`);

    expect(compile.status).not.toBe(0);
    expect(compile.stderr).toContain('read_ast_state_slot');
  });
});
