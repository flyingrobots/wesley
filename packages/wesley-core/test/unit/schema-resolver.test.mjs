import test from 'node:test';
import assert from 'node:assert/strict';
import { parse as gqlParse } from 'graphql';

import {
  resolve,
  escapePackage,
  unescapePackage,
  mangle,
  demangle,
  composeUnits,
  buildDemangleMap,
  demangleSdl,
  validateFilteredSdl,
} from '../../src/domain/SchemaResolver.mjs';

// ─── Escape helpers ──────────────────────────────────────────────────────────

test('escapePackage: dots become Xd', () => {
  assert.equal(escapePackage('echo.core'), 'echoXdcore');
});

test('escapePackage: underscores become Xu', () => {
  assert.equal(escapePackage('my_game'), 'myXugame');
});

test('escapePackage: X becomes XX', () => {
  assert.equal(escapePackage('aXb'), 'aXXb');
});

test('escapePackage: combined', () => {
  assert.equal(escapePackage('a.b_cXd'), 'aXdbXucXXd');
});

test('escapePackage: no special chars', () => {
  assert.equal(escapePackage('game'), 'game');
});

test('unescapePackage: round-trip for echo.core', () => {
  assert.equal(unescapePackage(escapePackage('echo.core')), 'echo.core');
});

test('unescapePackage: round-trip for my_game', () => {
  assert.equal(unescapePackage(escapePackage('my_game')), 'my_game');
});

test('unescapePackage: round-trip for aXb', () => {
  assert.equal(unescapePackage(escapePackage('aXb')), 'aXb');
});

test('mangle: package + type', () => {
  assert.equal(mangle('echo.core', 'Motion'), 'echoXdcore__Motion');
});

test('mangle: package with underscore', () => {
  assert.equal(mangle('my_game', 'Health'), 'myXugame__Health');
});

test('mangle: simple package', () => {
  assert.equal(mangle('game', 'Player'), 'game__Player');
});

test('mangle: type name with underscore', () => {
  assert.equal(mangle('echo.core', 'my_type'), 'echoXdcore__my_type');
});

test('mangle: no package → no prefix', () => {
  assert.equal(mangle(null, 'Motion'), 'Motion');
  assert.equal(mangle('', 'Motion'), 'Motion');
});

test('demangle: round-trip for echo.core / Motion', () => {
  const m = mangle('echo.core', 'Motion');
  const d = demangle(m);
  assert.equal(d.package, 'echo.core');
  assert.equal(d.name, 'Motion');
});

test('demangle: no package → null', () => {
  const d = demangle('Motion');
  assert.equal(d.package, null);
  assert.equal(d.name, 'Motion');
});

test('demangle: handles underscore in type name after __', () => {
  const m = mangle('echo.core', 'my_type');
  const d = demangle(m);
  assert.equal(d.package, 'echo.core');
  assert.equal(d.name, 'my_type');
});

// ─── Resolver: single file, no imports, no package ───────────────────────────

test('resolve: single file, no imports, no package → 1 unit, no mangling', async () => {
  const files = {
    '/root/schema.graphql': `
      type Widget @wes_table {
        id: ID! @wes_pk
        name: String!
      }
    `,
  };

  const units = await resolve('/root/schema.graphql', (p) => files[p], '/root');
  assert.equal(units.length, 1);
  assert.equal(units[0].package, null);
  // No mangling — type names unchanged
  assert.ok(units[0].sdl.includes('Widget'));
  assert.ok(!units[0].sdl.includes('__Widget'));
});

// ─── Resolver: single file with @wes_package → mangled ───────────────────────

test('resolve: single file with @wes_package → type names mangled', async () => {
  const files = {
    '/root/core.graphql': `
      extend schema @wes_package(name: "test.core")
      type Widget @wes_table {
        id: ID! @wes_pk
        name: String!
      }
    `,
  };

  const units = await resolve('/root/core.graphql', (p) => files[p], '/root');
  assert.equal(units.length, 1);
  assert.equal(units[0].package, 'test.core');
  assert.ok(units[0].sdl.includes('testXdcore__Widget'));
  // Directives preserved, schema extension stripped
  assert.ok(!units[0].sdl.includes('@wes_package'));
});

// ─── Resolver: linear chain A imports B ──────────────────────────────────────

test('resolve: linear chain A imports B → [B, A] topological order', async () => {
  const files = {
    '/root/base.graphql': `
      extend schema @wes_package(name: "base")
      type Motion {
        x: Float!
        y: Float!
      }
    `,
    '/root/game.graphql': `
      extend schema @wes_package(name: "game")
      extend schema @wes_import(from: "base.graphql")
      type Player {
        pos: Motion
      }
    `,
  };

  const units = await resolve('/root/game.graphql', (p) => files[p], '/root');
  assert.equal(units.length, 2);
  assert.equal(units[0].id, 'base.graphql');
  assert.equal(units[1].id, 'game.graphql');

  // Player references Motion — should be mangled
  assert.ok(units[1].sdl.includes('game__Player'));
  assert.ok(units[1].sdl.includes('base__Motion'));
});

// ─── Resolver: diamond dedup ─────────────────────────────────────────────────

test('resolve: diamond (A imports B + C, both import D) → deduped', async () => {
  const files = {
    '/root/d.graphql': `
      extend schema @wes_package(name: "d")
      type Base { id: ID! }
    `,
    '/root/b.graphql': `
      extend schema @wes_package(name: "b")
      extend schema @wes_import(from: "d.graphql")
      type Middle1 { base: Base }
    `,
    '/root/c.graphql': `
      extend schema @wes_package(name: "c")
      extend schema @wes_import(from: "d.graphql")
      type Middle2 { base: Base }
    `,
    '/root/a.graphql': `
      extend schema @wes_package(name: "a")
      extend schema @wes_import(from: "b.graphql")
      extend schema @wes_import(from: "c.graphql")
      type Top { m1: Middle1, m2: Middle2 }
    `,
  };

  const units = await resolve('/root/a.graphql', (p) => files[p], '/root');
  assert.equal(units.length, 4);
  // D should appear exactly once and before B/C
  const ids = units.map(u => u.id);
  assert.ok(ids.indexOf('d.graphql') < ids.indexOf('b.graphql'));
  assert.ok(ids.indexOf('d.graphql') < ids.indexOf('c.graphql'));
  assert.ok(ids.indexOf('b.graphql') < ids.indexOf('a.graphql'));
  assert.ok(ids.indexOf('c.graphql') < ids.indexOf('a.graphql'));
});

// ─── Resolver: multiple files same package ──────────────────────────────────

test('resolve: multiple files in same package → no collision', async () => {
  const files = {
    '/root/core1.graphql': `
      extend schema @wes_package(name: "pkg")
      type Foo { id: ID! }
    `,
    '/root/core2.graphql': `
      extend schema @wes_package(name: "pkg")
      extend schema @wes_import(from: "core1.graphql")
      type Bar { foo: Foo }
    `,
  };

  const units = await resolve('/root/core2.graphql', (p) => files[p], '/root');
  assert.equal(units.length, 2);
  // Both share package "pkg" — no collision
  assert.ok(units[1].sdl.includes('pkg__Bar'));
  assert.ok(units[1].sdl.includes('pkg__Foo'));
});

// ─── Resolver: collision error ──────────────────────────────────────────────

test('resolve: collision when two packages define same type name → error', async () => {
  const files = {
    '/root/a.graphql': `
      extend schema @wes_package(name: "alpha")
      type Widget { id: ID! }
    `,
    '/root/b.graphql': `
      extend schema @wes_package(name: "beta")
      extend schema @wes_import(from: "a.graphql")
      type Widget { id: ID! }
    `,
  };

  await assert.rejects(
    () => resolve('/root/b.graphql', (p) => files[p], '/root'),
    (err) => {
      assert.ok(err.message.includes('"Widget"'));
      assert.ok(err.message.includes('alpha'));
      assert.ok(err.message.includes('beta'));
      return true;
    }
  );
});

// ─── Resolver: local type shadows import → error ────────────────────────────

test('resolve: local type shadows imported type → error', async () => {
  const files = {
    '/root/imported.graphql': `
      extend schema @wes_package(name: "imported")
      type Health { hp: Int! }
    `,
    '/root/local.graphql': `
      extend schema @wes_package(name: "local")
      extend schema @wes_import(from: "imported.graphql")
      type Health { hp: Int! }
    `,
  };

  await assert.rejects(
    () => resolve('/root/local.graphql', (p) => files[p], '/root'),
    (err) => {
      assert.ok(err.message.includes('"Health"'));
      assert.ok(err.message.includes('shadows'));
      return true;
    }
  );
});

// ─── Resolver: duplicate definition in same package → error ──────────────────

test('resolve: duplicate definition in same package → error with hint', async () => {
  const files = {
    '/root/a.graphql': `
      extend schema @wes_package(name: "pkg")
      type Widget { id: ID! }
    `,
    '/root/b.graphql': `
      extend schema @wes_package(name: "pkg")
      extend schema @wes_import(from: "a.graphql")
      type Widget { id: ID! }
    `,
  };

  await assert.rejects(
    () => resolve('/root/b.graphql', (p) => files[p], '/root'),
    (err) => {
      assert.ok(err.message.includes('Duplicate definition'));
      assert.ok(err.message.includes('"Widget"'));
      assert.ok(err.message.includes('extend type'));
      return true;
    }
  );
});

// ─── Resolver: cycle detection ──────────────────────────────────────────────

test('resolve: cycle detection → descriptive error', async () => {
  const files = {
    '/root/a.graphql': `
      extend schema @wes_package(name: "a")
      extend schema @wes_import(from: "b.graphql")
      type A { id: ID! }
    `,
    '/root/b.graphql': `
      extend schema @wes_package(name: "b")
      extend schema @wes_import(from: "a.graphql")
      type B { id: ID! }
    `,
  };

  await assert.rejects(
    () => resolve('/root/a.graphql', (p) => files[p], '/root'),
    (err) => {
      assert.ok(err.message.includes('cycle'));
      return true;
    }
  );
});

// ─── Resolver: missing file → ENOENT ────────────────────────────────────────

test('resolve: missing file → error with path', async () => {
  const files = {
    '/root/a.graphql': `
      extend schema @wes_package(name: "a")
      extend schema @wes_import(from: "nonexistent.graphql")
      type A { id: ID! }
    `,
  };

  await assert.rejects(
    () => resolve('/root/a.graphql', (p) => {
      if (!files[p]) {
        const e = new Error(`ENOENT: no such file: ${p}`);
        e.code = 'ENOENT';
        throw e;
      }
      return files[p];
    }, '/root'),
    (err) => {
      assert.ok(err.message.includes('nonexistent.graphql'));
      return true;
    }
  );
});

// ─── Resolver: root namespace (no @wes_package) → no prefix ──────────────────

test('resolve: root namespace (no @wes_package) → types unchanged', async () => {
  const files = {
    '/root/plain.graphql': `
      type Foo { id: ID! }
      type Bar { foo: Foo }
    `,
  };

  const units = await resolve('/root/plain.graphql', (p) => files[p], '/root');
  assert.equal(units.length, 1);
  assert.equal(units[0].package, null);
  assert.ok(units[0].sdl.includes('type Foo'));
  assert.ok(units[0].sdl.includes('type Bar'));
  assert.ok(!units[0].sdl.includes('__'));
});

// ─── Resolver: transitive visibility ─────────────────────────────────────────

test('resolve: transitive visibility (A imports B, B imports C) → A sees C types', async () => {
  const files = {
    '/root/c.graphql': `
      extend schema @wes_package(name: "c")
      type Deep { val: Int! }
    `,
    '/root/b.graphql': `
      extend schema @wes_package(name: "b")
      extend schema @wes_import(from: "c.graphql")
      type Middle { deep: Deep }
    `,
    '/root/a.graphql': `
      extend schema @wes_package(name: "a")
      extend schema @wes_import(from: "b.graphql")
      type Top { deep: Deep, mid: Middle }
    `,
  };

  const units = await resolve('/root/a.graphql', (p) => files[p], '/root');
  assert.equal(units.length, 3);
  // A references Deep from C transitively — should resolve
  const topUnit = units.find(u => u.id === 'a.graphql');
  assert.ok(topUnit.sdl.includes('c__Deep'));
  assert.ok(topUnit.sdl.includes('b__Middle'));
});

// ─── Resolver: extend type across units ──────────────────────────────────────

test('resolve: extend type across units in same package → works', async () => {
  const files = {
    '/root/base.graphql': `
      extend schema @wes_package(name: "pkg")
      type Widget {
        id: ID!
      }
    `,
    '/root/ext.graphql': `
      extend schema @wes_package(name: "pkg")
      extend schema @wes_import(from: "base.graphql")
      extend type Widget {
        name: String
      }
    `,
  };

  const units = await resolve('/root/ext.graphql', (p) => files[p], '/root');
  assert.equal(units.length, 2);
  // Extension should reference the mangled name
  const extUnit = units.find(u => u.id === 'ext.graphql');
  assert.ok(extUnit.sdl.includes('pkg__Widget'));
});

// ─── Resolver: all definition kinds are collected and mangled ────────────────

test('resolve: all definition kinds (type, input, interface, union, enum, scalar) mangled', async () => {
  const files = {
    '/root/all.graphql': `
      extend schema @wes_package(name: "test")
      type Obj { id: ID! }
      input Inp { name: String }
      interface Iface { id: ID! }
      union Uni = Obj
      enum Color { RED GREEN }
      scalar MyDate
    `,
  };

  const units = await resolve('/root/all.graphql', (p) => files[p], '/root');
  assert.equal(units.length, 1);
  const sdl = units[0].sdl;
  assert.ok(sdl.includes('test__Obj'));
  assert.ok(sdl.includes('test__Inp'));
  assert.ok(sdl.includes('test__Iface'));
  assert.ok(sdl.includes('test__Uni'));
  assert.ok(sdl.includes('test__Color'));
  assert.ok(sdl.includes('test__MyDate'));
});

// ─── Resolver: custom scalar is namespaced ──────────────────────────────────

test('resolve: custom scalar is namespaced like any other type', async () => {
  const files = {
    '/root/s.graphql': `
      extend schema @wes_package(name: "echo")
      scalar Timestamp
    `,
  };

  const units = await resolve('/root/s.graphql', (p) => files[p], '/root');
  assert.ok(units[0].sdl.includes('echo__Timestamp'));
});

// ─── Resolver: built-in scalars are NOT mangled ─────────────────────────────

test('resolve: built-in scalars (String, Int, Float, Boolean, ID) are never mangled', async () => {
  const files = {
    '/root/builtins.graphql': `
      extend schema @wes_package(name: "test")
      type Obj {
        s: String!
        i: Int!
        f: Float!
        b: Boolean!
        id: ID!
      }
    `,
  };

  const units = await resolve('/root/builtins.graphql', (p) => files[p], '/root');
  const sdl = units[0].sdl;
  assert.ok(sdl.includes('String'));
  assert.ok(sdl.includes('Int'));
  assert.ok(sdl.includes('Float'));
  assert.ok(sdl.includes('Boolean'));
  assert.ok(sdl.includes('ID'));
  // Built-in scalars should NOT have test__ prefix
  assert.ok(!sdl.includes('test__String'));
  assert.ok(!sdl.includes('test__Int'));
  assert.ok(!sdl.includes('test__Float'));
  assert.ok(!sdl.includes('test__Boolean'));
  assert.ok(!sdl.includes('test__ID'));
});

// ─── Resolver: unit metadata ────────────────────────────────────────────────

test('resolve: units have correct metadata', async () => {
  const files = {
    '/root/dep.graphql': `
      extend schema @wes_package(name: "dep")
      type Item { id: ID! }
    `,
    '/root/main.graphql': `
      extend schema @wes_package(name: "main")
      extend schema @wes_import(from: "dep.graphql")
      type Container { item: Item }
    `,
  };

  const units = await resolve('/root/main.graphql', (p) => files[p], '/root');

  const dep = units.find(u => u.id === 'dep.graphql');
  assert.equal(dep.package, 'dep');
  assert.ok(dep.hash);
  assert.deepEqual(dep.imports, []);

  const main = units.find(u => u.id === 'main.graphql');
  assert.equal(main.package, 'main');
  assert.deepEqual(main.imports, ['dep.graphql']);
});

// ─── Resolver: directives are stripped from output SDL ───────────────────────

test('resolve: @wes_package and @wes_import are stripped from output SDL', async () => {
  const files = {
    '/root/a.graphql': `
      extend schema @wes_package(name: "a")
      type Foo { id: ID! }
    `,
  };

  const units = await resolve('/root/a.graphql', (p) => files[p], '/root');
  assert.ok(!units[0].sdl.includes('@wes_package'));
  assert.ok(!units[0].sdl.includes('@wes_import'));
  assert.ok(!units[0].sdl.includes('extend schema'));
});

// ─── Resolver: other directives preserved ────────────────────────────────────

test('resolve: non-composition directives are preserved', async () => {
  const files = {
    '/root/a.graphql': `
      extend schema @wes_package(name: "a")
      type Widget @wes_table {
        id: ID! @wes_pk
      }
    `,
  };

  const units = await resolve('/root/a.graphql', (p) => files[p], '/root');
  assert.ok(units[0].sdl.includes('@wes_table'));
  assert.ok(units[0].sdl.includes('@wes_pk'));
});

// ─── Resolver: mangled names are valid GraphQL identifiers ──────────────────

test('resolve: mangled names are valid GraphQL identifiers (re-parseable)', async () => {
  const files = {
    '/root/a.graphql': `
      extend schema @wes_package(name: "echo.core")
      type Motion { x: Float!, y: Float! }
      scalar Timestamp
    `,
  };

  const units = await resolve('/root/a.graphql', (p) => files[p], '/root');
  // The mangled SDL should be valid GraphQL that can be re-parsed
  assert.doesNotThrow(() => gqlParse(units[0].sdl));
  assert.ok(units[0].sdl.includes('echoXdcore__Motion'));
  assert.ok(units[0].sdl.includes('echoXdcore__Timestamp'));
});

// ─── resolve: units carry doc alongside sdl ─────────────────────────────────

test('resolve: units have doc (AST DocumentNode) alongside sdl', async () => {
  const files = {
    '/root/a.graphql': `
      extend schema @wes_package(name: "pkg")
      type Foo { id: ID! }
    `,
  };

  const units = await resolve('/root/a.graphql', (p) => files[p], '/root');
  assert.ok(units[0].doc, 'unit should have doc');
  assert.equal(units[0].doc.kind, 'Document');
  assert.ok(units[0].doc.definitions.length > 0);
});

// ─── composeUnits ───────────────────────────────────────────────────────────

test('composeUnits: filters to selected unit IDs', async () => {
  const files = {
    '/root/core.graphql': `
      extend schema @wes_package(name: "core")
      type Widget { id: ID! }
    `,
    '/root/game.graphql': `
      extend schema @wes_package(name: "game")
      extend schema @wes_import(from: "core.graphql")
      type Player { widget: Widget }
    `,
  };

  const units = await resolve('/root/game.graphql', (p) => files[p], '/root');
  const composed = composeUnits(units, ['core.graphql']);
  assert.equal(composed.units.length, 1);
  assert.equal(composed.units[0].id, 'core.graphql');
  assert.ok(composed.sdl.includes('core__Widget'));
  assert.ok(!composed.sdl.includes('game__Player'));
});

test('composeUnits: comma-separated IDs are expanded', async () => {
  const files = {
    '/root/core.graphql': `
      extend schema @wes_package(name: "core")
      type Widget { id: ID! }
    `,
    '/root/game.graphql': `
      extend schema @wes_package(name: "game")
      extend schema @wes_import(from: "core.graphql")
      type Player { widget: Widget }
    `,
  };

  const units = await resolve('/root/game.graphql', (p) => files[p], '/root');
  const composed = composeUnits(units, ['core.graphql,game.graphql']);
  assert.equal(composed.units.length, 2);
});

test('composeUnits: throws on no matching units', async () => {
  const files = {
    '/root/a.graphql': `
      extend schema @wes_package(name: "a")
      type Foo { id: ID! }
    `,
  };

  const units = await resolve('/root/a.graphql', (p) => files[p], '/root');
  assert.throws(
    () => composeUnits(units, ['nonexistent.graphql']),
    (err) => {
      assert.ok(err.message.includes('nonexistent.graphql'));
      assert.ok(err.message.includes('Available units'));
      return true;
    }
  );
});

// ─── buildDemangleMap ───────────────────────────────────────────────────────

test('buildDemangleMap: builds correct mangled→short mapping', async () => {
  const files = {
    '/root/core.graphql': `
      extend schema @wes_package(name: "echo.core")
      type Motion { x: Float! }
      scalar Timestamp
    `,
  };

  const units = await resolve('/root/core.graphql', (p) => files[p], '/root');
  const map = buildDemangleMap(units);
  assert.equal(map.get('echoXdcore__Motion'), 'Motion');
  assert.equal(map.get('echoXdcore__Timestamp'), 'Timestamp');
  assert.equal(map.size, 2);
});

test('buildDemangleMap: skips unpackaged units', async () => {
  const files = {
    '/root/plain.graphql': `
      type Widget { id: ID! }
    `,
  };

  const units = await resolve('/root/plain.graphql', (p) => files[p], '/root');
  const map = buildDemangleMap(units);
  assert.equal(map.size, 0);
});

// ─── demangleSdl ────────────────────────────────────────────────────────────

test('demangleSdl: restores short names in SDL', async () => {
  const { parse: gqlParse } = await import('graphql');
  const files = {
    '/root/core.graphql': `
      extend schema @wes_package(name: "test")
      type Widget { id: ID!, name: String! }
      type Player { widget: Widget }
    `,
  };

  const units = await resolve('/root/core.graphql', (p) => files[p], '/root');
  const map = buildDemangleMap(units);
  const demangled = demangleSdl(units[0].sdl, map);

  // Should have short names, not mangled ones
  assert.ok(demangled.includes('type Widget'));
  assert.ok(!demangled.includes('test__Widget'));
  assert.ok(demangled.includes('type Player'));
  assert.ok(!demangled.includes('test__Player'));
  // Field type reference should also be demangled
  assert.ok(demangled.includes(': Widget'));

  // Demangled SDL should still be valid GraphQL
  assert.doesNotThrow(() => gqlParse(demangled));
});

test('demangleSdl: no-op when map is empty', async () => {
  const sdl = 'type Widget { id: ID! }';
  const result = demangleSdl(sdl, new Map());
  assert.equal(result, sdl);
});

// ─── validateFilteredSdl ────────────────────────────────────────────────────

test('validateFilteredSdl: returns null when all types are present', async () => {
  const files = {
    '/root/core.graphql': `
      extend schema @wes_package(name: "core")
      type Widget { id: ID!, name: String! }
    `,
    '/root/game.graphql': `
      extend schema @wes_package(name: "game")
      extend schema @wes_import(from: "core.graphql")
      type Player { widget: Widget }
    `,
  };

  const units = await resolve('/root/game.graphql', (p) => files[p], '/root');
  // Selecting both units — all types present
  const mergedSdl = units.map(u => u.sdl).join('\n\n');
  const diag = validateFilteredSdl(mergedSdl, units, ['core.graphql', 'game.graphql']);
  assert.equal(diag, null);
});

test('validateFilteredSdl: detects missing types from excluded units', async () => {
  const files = {
    '/root/core.graphql': `
      extend schema @wes_package(name: "core")
      type Widget { id: ID! }
    `,
    '/root/game.graphql': `
      extend schema @wes_package(name: "game")
      extend schema @wes_import(from: "core.graphql")
      type Player { widget: Widget }
    `,
  };

  const units = await resolve('/root/game.graphql', (p) => files[p], '/root');
  const map = buildDemangleMap(units);
  // Only game.graphql selected — Widget is missing
  const gameSdl = units.find(u => u.id === 'game.graphql').sdl;
  const demangled = demangleSdl(gameSdl, map);
  const diag = validateFilteredSdl(demangled, units, ['game.graphql']);

  assert.ok(diag !== null);
  assert.equal(diag.missing.length, 1);
  assert.equal(diag.missing[0].type, 'Widget');
  assert.equal(diag.missing[0].definedIn, 'core.graphql');
});
