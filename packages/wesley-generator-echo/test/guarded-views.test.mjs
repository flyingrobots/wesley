import { describe, it, expect } from 'vitest';
import { generateEcho } from '../src/index.mjs';
import { emitGuardedViews } from '../src/emitGuardedViews.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const viewSDL = /* GraphQL */ `
  type Player {
    id: ID! @wes_view(rule: "owner", access: "READ") @wes_view(rule: "admin", access: "READ")
    name: String! @wes_view(rule: "owner", access: "READ") @wes_view(rule: "owner", access: "WRITE")
    secret: String! @wes_view(rule: "admin", access: "READ")
    score: Int! @wes_view(rule: "owner", access: "READ")
  }
  type Query { player: Player! }
`;

const noViewSDL = /* GraphQL */ `
  type Plain { name: String! }
  type Query { plain: Plain! }
`;

const multiRuleSDL = /* GraphQL */ `
  type Item {
    id: ID! @wes_view(rule: "buyer", access: "READ") @wes_view(rule: "seller", access: "READ")
    price: Float! @wes_view(rule: "seller", access: "WRITE") @wes_view(rule: "buyer", access: "READ")
    description: String! @wes_view(rule: "buyer", access: "READ") @wes_view(rule: "seller", access: "WRITE")
  }
  type Query { item: Item! }
`;

const allTypesSDL = /* GraphQL */ `
  type AllTypes {
    flag: Boolean! @wes_view(rule: "r", access: "READ")
    count: Int! @wes_view(rule: "r", access: "READ")
    ratio: Float! @wes_view(rule: "r", access: "READ")
    label: String! @wes_view(rule: "r", access: "READ")
    uid: ID! @wes_view(rule: "r", access: "READ")
  }
  type Query { at: AllTypes! }
`;

const optionalSDL = /* GraphQL */ `
  type WithOptional {
    name: String @wes_view(rule: "r", access: "READ")
    score: Int @wes_view(rule: "r", access: "READ")
  }
  type Query { wo: WithOptional }
`;

const listSDL = /* GraphQL */ `
  type WithList {
    tags: [String!]! @wes_view(rule: "r", access: "READ")
    scores: [Int!]! @wes_view(rule: "r", access: "READ")
  }
  type Query { wl: WithList! }
`;

// ---------------------------------------------------------------------------
// READ view tests
// ---------------------------------------------------------------------------

describe('GuardedView READ view', () => {
  it('READ view has only READ fields', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    // PlayerOwnerReadView should have id, name, score (READ fields for "owner")
    expect(rs).toContain('pub struct PlayerOwnerReadView {');
    expect(rs).toMatch(/pub struct PlayerOwnerReadView \{[^}]*pub id: String/s);
    expect(rs).toMatch(/pub struct PlayerOwnerReadView \{[^}]*pub name: String/s);
    expect(rs).toMatch(/pub struct PlayerOwnerReadView \{[^}]*pub score: i32/s);
    // secret is NOT in owner READ
    expect(rs).not.toMatch(/pub struct PlayerOwnerReadView \{[^}]*pub secret/s);
  });

  it('admin READ view includes admin-only fields', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    expect(rs).toContain('pub struct PlayerAdminReadView {');
    expect(rs).toMatch(/pub struct PlayerAdminReadView \{[^}]*pub id: String/s);
    expect(rs).toMatch(/pub struct PlayerAdminReadView \{[^}]*pub secret: String/s);
  });
});

// ---------------------------------------------------------------------------
// WRITE view tests
// ---------------------------------------------------------------------------

describe('GuardedView WRITE view', () => {
  it('WRITE view has only WRITE fields', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    // PlayerOwnerWriteView should have only name (WRITE for "owner")
    expect(rs).toContain('pub struct PlayerOwnerWriteView {');
    expect(rs).toMatch(/pub struct PlayerOwnerWriteView \{[^}]*pub name: String/s);
    // id and score are READ-only for owner
    expect(rs).not.toMatch(/pub struct PlayerOwnerWriteView \{[^}]*pub id/s);
    expect(rs).not.toMatch(/pub struct PlayerOwnerWriteView \{[^}]*pub score/s);
  });
});

// ---------------------------------------------------------------------------
// Field with both READ+WRITE
// ---------------------------------------------------------------------------

describe('GuardedView both READ+WRITE', () => {
  it('field with both READ and WRITE appears on both views', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    // "name" has both READ and WRITE for owner
    expect(rs).toMatch(/pub struct PlayerOwnerReadView \{[^}]*pub name: String/s);
    expect(rs).toMatch(/pub struct PlayerOwnerWriteView \{[^}]*pub name: String/s);
  });
});

// ---------------------------------------------------------------------------
// No @wes_view → no file
// ---------------------------------------------------------------------------

describe('GuardedView absent when no views', () => {
  it('type with no @wes_view returns null', async () => {
    const result = await generateEcho({ sdl: noViewSDL });
    const file = result.files.find((f) => f.path === 'guarded_views.generated.rs');
    expect(file).toBeUndefined();
  });

  it('emitGuardedViews returns null for IR with no views', () => {
    const result = emitGuardedViews({
      types: [{
        name: 'Plain',
        kind: 'OBJECT',
        fields: [{ name: 'x', type: 'String', required: true, list: false, views: null }],
      }],
    });
    expect(result).toBeNull();
  });

  it('emitGuardedViews returns null for empty types', () => {
    expect(emitGuardedViews({ types: [] })).toBeNull();
  });

  it('emitGuardedViews returns null for undefined types', () => {
    expect(emitGuardedViews({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Multiple rules → separate views per rule
// ---------------------------------------------------------------------------

describe('GuardedView multiple rules', () => {
  it('generates separate views per rule', async () => {
    const result = await generateEcho({ sdl: multiRuleSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    // Buyer views
    expect(rs).toContain('pub struct ItemBuyerReadView {');
    // Seller views
    expect(rs).toContain('pub struct ItemSellerReadView {');
    expect(rs).toContain('pub struct ItemSellerWriteView {');
  });

  it('buyer READ includes id, price, description', async () => {
    const result = await generateEcho({ sdl: multiRuleSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    expect(rs).toMatch(/pub struct ItemBuyerReadView \{[^}]*pub id: String/s);
    expect(rs).toMatch(/pub struct ItemBuyerReadView \{[^}]*pub price: f32/s);
    expect(rs).toMatch(/pub struct ItemBuyerReadView \{[^}]*pub description: String/s);
  });

  it('seller WRITE includes price, description', async () => {
    const result = await generateEcho({ sdl: multiRuleSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    expect(rs).toMatch(/pub struct ItemSellerWriteView \{[^}]*pub price: f32/s);
    expect(rs).toMatch(/pub struct ItemSellerWriteView \{[^}]*pub description: String/s);
  });
});

// ---------------------------------------------------------------------------
// from_full conversion method
// ---------------------------------------------------------------------------

describe('GuardedView from_full', () => {
  it('ReadView has from_full method', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    expect(rs).toContain('impl PlayerOwnerReadView {');
    expect(rs).toContain('pub fn from_full(full: &Player) -> Self {');
  });
});

// ---------------------------------------------------------------------------
// apply_write method
// ---------------------------------------------------------------------------

describe('GuardedView apply_write', () => {
  it('WriteView has apply_write method', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    expect(rs).toContain('impl PlayerOwnerWriteView {');
    expect(rs).toContain('pub fn apply_write(view: Self, target: &mut Player) {');
    expect(rs).toContain('target.name = view.name;');
  });
});

// ---------------------------------------------------------------------------
// Field type mapping
// ---------------------------------------------------------------------------

describe('GuardedView type mapping', () => {
  it('maps Int to i32', async () => {
    const result = await generateEcho({ sdl: allTypesSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;
    expect(rs).toMatch(/pub count: i32/);
  });

  it('maps Float to f32', async () => {
    const result = await generateEcho({ sdl: allTypesSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;
    expect(rs).toMatch(/pub ratio: f32/);
  });

  it('maps Boolean to bool', async () => {
    const result = await generateEcho({ sdl: allTypesSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;
    expect(rs).toMatch(/pub flag: bool/);
  });

  it('maps String to String', async () => {
    const result = await generateEcho({ sdl: allTypesSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;
    expect(rs).toMatch(/pub label: String/);
  });

  it('maps ID to String', async () => {
    const result = await generateEcho({ sdl: allTypesSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;
    expect(rs).toMatch(/pub uid: String/);
  });
});

// ---------------------------------------------------------------------------
// Clone semantics
// ---------------------------------------------------------------------------

describe('GuardedView clone semantics', () => {
  it('uses .clone() for String/ID types in from_full', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    // String fields need clone
    expect(rs).toContain('id: full.id.clone()');
    expect(rs).toContain('name: full.name.clone()');
  });

  it('does not use .clone() for Copy types (i32, f32, bool)', async () => {
    const result = await generateEcho({ sdl: allTypesSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    // Extract the from_full block
    expect(rs).toContain('count: full.count,');
    expect(rs).toContain('ratio: full.ratio,');
    expect(rs).toContain('flag: full.flag,');
    // But String/ID fields should clone
    expect(rs).toContain('label: full.label.clone()');
    expect(rs).toContain('uid: full.uid.clone()');
  });
});

// ---------------------------------------------------------------------------
// Optional fields
// ---------------------------------------------------------------------------

describe('GuardedView optional fields', () => {
  it('optional fields wrapped in Option<T>', async () => {
    const result = await generateEcho({ sdl: optionalSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    expect(rs).toMatch(/pub name: Option<String>/);
    expect(rs).toMatch(/pub score: Option<i32>/);
  });

  it('optional fields use .clone() in from_full', async () => {
    const result = await generateEcho({ sdl: optionalSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    // Option types always need clone
    expect(rs).toContain('name: full.name.clone()');
    expect(rs).toContain('score: full.score.clone()');
  });
});

// ---------------------------------------------------------------------------
// List fields
// ---------------------------------------------------------------------------

describe('GuardedView list fields', () => {
  it('list fields wrapped in Vec<T>', async () => {
    const result = await generateEcho({ sdl: listSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    expect(rs).toMatch(/pub tags: Vec<String>/);
    expect(rs).toMatch(/pub scores: Vec<i32>/);
  });

  it('list fields use .clone() in from_full', async () => {
    const result = await generateEcho({ sdl: listSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    expect(rs).toContain('tags: full.tags.clone()');
    expect(rs).toContain('scores: full.scores.clone()');
  });
});

// ---------------------------------------------------------------------------
// DO NOT EDIT comment
// ---------------------------------------------------------------------------

describe('GuardedView DO NOT EDIT', () => {
  it('DO NOT EDIT comment present', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;
    expect(rs).toContain('DO NOT EDIT');
  });
});

// ---------------------------------------------------------------------------
// Alphabetical field order
// ---------------------------------------------------------------------------

describe('GuardedView alphabetical field order', () => {
  it('fields are sorted alphabetically in view structs', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const rs = result.files.find((f) => f.path === 'guarded_views.generated.rs').content;

    // In PlayerOwnerReadView: id, name, score (alphabetical)
    const readViewMatch = rs.match(/pub struct PlayerOwnerReadView \{([^}]*)\}/s);
    expect(readViewMatch).not.toBeNull();
    const readBody = readViewMatch[1];

    const idIdx = readBody.indexOf('pub id');
    const nameIdx = readBody.indexOf('pub name');
    const scoreIdx = readBody.indexOf('pub score');
    expect(idIdx).toBeLessThan(nameIdx);
    expect(nameIdx).toBeLessThan(scoreIdx);
  });
});

// ---------------------------------------------------------------------------
// views property in IR
// ---------------------------------------------------------------------------

describe('GuardedView IR views property', () => {
  it('fields have views property in IR JSON', async () => {
    const result = await generateEcho({ sdl: viewSDL });
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

    const player = ir.types.find((t) => t.name === 'Player');
    const idField = player.fields.find((f) => f.name === 'id');
    expect(idField.views).toEqual([
      { rule: 'owner', access: 'READ' },
      { rule: 'admin', access: 'READ' },
    ]);
  });

  it('fields without @wes_view have views: null', async () => {
    const result = await generateEcho({ sdl: noViewSDL });
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

    const plain = ir.types.find((t) => t.name === 'Plain');
    const nameField = plain.fields.find((f) => f.name === 'name');
    expect(nameField.views).toBeNull();
  });
});
