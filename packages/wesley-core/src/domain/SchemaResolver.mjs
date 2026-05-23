/**
 * SchemaResolver - Multi-file schema composition with import resolution and name mangling.
 *
 * Pure domain logic. Receives a `readFile(absolutePath) → string` function
 * as a dependency (hexagonal pattern). No direct I/O.
 *
 * resolve(entryPath, readFileFn, rootDir) → CompilationUnit[]
 */

import { parse, print, visit, Kind } from 'graphql';

// ─── Escape helpers ──────────────────────────────────────────────────────────

const BUILTIN_SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);

/**
 * Escape a package name for mangling.
 *
 * The mangled name must be a valid GraphQL identifier ([_A-Za-z][_0-9A-Za-z]*).
 * We use 'X' as an escape introducer:
 *   X → XX, _ → Xu, . → Xd
 *
 * 'X' is outlawed in package names (alongside '~') to keep things simple.
 */
export function escapePackage(pkg) {
  let out = '';
  for (const ch of pkg) {
    if (ch === 'X') out += 'XX';
    else if (ch === '_') out += 'Xu';
    else if (ch === '.') out += 'Xd';
    else out += ch;
  }
  return out;
}

/**
 * Unescape a mangled package portion.
 * Xd → ., Xu → _, XX → X
 */
export function unescapePackage(esc) {
  let out = '';
  let i = 0;
  while (i < esc.length) {
    if (esc[i] === 'X' && i + 1 < esc.length) {
      const next = esc[i + 1];
      if (next === 'd') {
        out += '.';
        i += 2;
        continue;
      }
      if (next === 'u') {
        out += '_';
        i += 2;
        continue;
      }
      if (next === 'X') {
        out += 'X';
        i += 2;
        continue;
      }
    }
    out += esc[i];
    i++;
  }
  return out;
}

/**
 * Mangle a (package, typeName) pair → qualified name.
 * No package (null/empty) → type name unchanged.
 *
 * Produces a valid GraphQL identifier: escapedPackage + '__' + typeName
 */
export function mangle(pkg, name) {
  if (!pkg) return name;
  return escapePackage(pkg) + '__' + name;
}

/**
 * Demangle a qualified name → { package, name }.
 * Split on the first `__`.
 */
export function demangle(mangled) {
  const sep = mangled.indexOf('__');
  if (sep === -1) return { package: null, name: mangled };
  const escapedPkg = mangled.slice(0, sep);
  const name = mangled.slice(sep + 2);
  return { package: unescapePackage(escapedPkg), name };
}

// ─── Definition kind sets ────────────────────────────────────────────────────

const BASE_DEF_KINDS = new Set([
  Kind.OBJECT_TYPE_DEFINITION,
  Kind.INPUT_OBJECT_TYPE_DEFINITION,
  Kind.INTERFACE_TYPE_DEFINITION,
  Kind.UNION_TYPE_DEFINITION,
  Kind.ENUM_TYPE_DEFINITION,
  Kind.SCALAR_TYPE_DEFINITION
]);

const EXT_DEF_KINDS = new Set([
  Kind.OBJECT_TYPE_EXTENSION,
  Kind.INPUT_OBJECT_TYPE_EXTENSION,
  Kind.INTERFACE_TYPE_EXTENSION,
  Kind.UNION_TYPE_EXTENSION,
  Kind.ENUM_TYPE_EXTENSION,
  Kind.SCALAR_TYPE_EXTENSION
]);

// ─── Resolution error ────────────────────────────────────────────────────────

class SchemaResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SchemaResolutionError';
    this.code = 'SCHEMA_RESOLUTION_FAILED';
  }
}

// ─── Main resolver ───────────────────────────────────────────────────────────

/**
 * Resolve an import DAG starting from `entryPath`.
 *
 * @param {string} entryPath  - Absolute path to the entry schema file.
 * @param {(absolutePath: string) => string|Promise<string>} readFileFn
 * @param {string} rootDir    - Root directory for resolving relative @wes_import paths.
 * @param {{ resolvePath?: (base: string, rel: string) => string }} [opts]
 * @returns {Promise<CompilationUnit[]>} Units in topological order (leaves first).
 */
export async function resolve(entryPath, readFileFn, rootDir, opts = {}) {
  const resolvePath = opts.resolvePath || defaultResolvePath;

  // Step 1 — Discovery & metadata extraction
  /** @type {Map<string, RawUnit>} absolutePath → RawUnit */
  const units = new Map();
  /** @type {Map<string, string>} absolutePath → unitId (relative) */
  const pathToId = new Map();

  await discover(entryPath, readFileFn, rootDir, units, pathToId, resolvePath);

  // Step 2 — Validation: cycles and duplicate definitions in same package
  const adj = buildAdjacencyList(units, pathToId);
  detectCycles(adj, pathToId);
  detectDuplicateDefinitions(units);

  // Step 3 — Topological sort (Kahn's algorithm)
  const sorted = topologicalSort(adj, pathToId);

  // Step 4 — Build name resolution maps and detect collisions
  const resolutionMaps = buildResolutionMaps(sorted, units, pathToId, adj);

  // Step 5 — AST-based name rewriting
  const result = [];
  for (const absPath of sorted) {
    const unit = units.get(absPath);
    const unitId = pathToId.get(absPath);
    const resMap = resolutionMaps.get(absPath);
    const { doc: mangledDoc, sdl: mangledSdl } = rewriteAST(unit, resMap);

    result.push({
      id: unitId,
      path: absPath,
      package: unit.package,
      doc: mangledDoc,
      sdl: mangledSdl,
      rawSdl: unit.rawSdl,
      imports: unit.importPaths.map((p) => pathToId.get(p)),
      definitions: unit.definitions,
      hash: simpleHash(unit.rawSdl)
    });
  }

  return result;
}

// ─── Step 1: Discovery ──────────────────────────────────────────────────────

async function discover(entryPath, readFileFn, rootDir, units, pathToId, resolvePath) {
  const queue = [entryPath];
  const visited = new Set();

  while (queue.length > 0) {
    const absPath = queue.shift();
    if (visited.has(absPath)) continue;
    visited.add(absPath);

    let rawSdl;
    try {
      rawSdl = await readFileFn(absPath);
    } catch (err) {
      throw new SchemaResolutionError(`Cannot read schema file: ${absPath}\n${err.message}`);
    }

    let ast;
    try {
      ast = parse(rawSdl);
    } catch (err) {
      throw new SchemaResolutionError(`GraphQL syntax error in ${absPath}: ${err.message}`);
    }

    // Extract metadata from SchemaExtension nodes
    let pkg = null;
    const importFroms = [];

    for (const def of ast.definitions) {
      if (def.kind === Kind.SCHEMA_EXTENSION && def.directives) {
        for (const dir of def.directives) {
          if (dir.name.value === 'wes_package') {
            const nameArg = dir.arguments?.find((a) => a.name.value === 'name');
            if (nameArg) {
              pkg = nameArg.value.value;
            }
          } else if (dir.name.value === 'wes_import') {
            const fromArg = dir.arguments?.find((a) => a.name.value === 'from');
            if (fromArg) {
              importFroms.push(fromArg.value.value);
            }
          }
        }
      }
    }

    // Collect definitions
    const definitions = new Map();
    const extensions = [];

    for (const def of ast.definitions) {
      if (BASE_DEF_KINDS.has(def.kind)) {
        const name = def.name.value;
        const loc = def.loc;
        definitions.set(name, {
          kind: def.kind,
          unitPath: absPath,
          package: pkg,
          line: loc ? loc.startToken.line : null
        });
      } else if (EXT_DEF_KINDS.has(def.kind)) {
        extensions.push({
          name: def.name.value,
          kind: def.kind,
          unitPath: absPath,
          package: pkg,
          line: def.loc ? def.loc.startToken.line : null
        });
      }
    }

    // Resolve import paths relative to rootDir and validate
    const importPaths = [];
    for (const from of importFroms) {
      const resolved = resolvePath(rootDir, from);
      // Validate the resolved path is inside rootDir to prevent path traversal
      if (!resolved.startsWith(rootDir + '/') && resolved !== rootDir) {
        throw new SchemaResolutionError(
          `Path traversal detected: "${from}" resolves outside rootDir (${rootDir})`
        );
      }
      importPaths.push(resolved);
    }

    // Build relative unit ID
    const unitId = absPath.startsWith(rootDir + '/')
      ? absPath.slice(rootDir.length + 1)
      : absPath.split('/').pop();

    pathToId.set(absPath, unitId);

    units.set(absPath, {
      absPath,
      package: pkg,
      rawSdl,
      ast,
      definitions,
      extensions,
      importPaths
    });

    // Enqueue imports for discovery
    for (const imp of importPaths) {
      if (!visited.has(imp)) {
        queue.push(imp);
      }
    }
  }
}

// ─── Step 2: Validation ──────────────────────────────────────────────────────

function buildAdjacencyList(units, _pathToId) {
  // adj[absPath] = [absPath of dependencies]
  const adj = new Map();
  for (const [absPath, unit] of units) {
    adj.set(
      absPath,
      unit.importPaths.filter((p) => units.has(p))
    );
  }
  return adj;
}

function detectCycles(adj, pathToId) {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map();
  for (const node of adj.keys()) color.set(node, WHITE);

  const path = [];

  function dfs(node) {
    color.set(node, GRAY);
    path.push(node);

    for (const dep of adj.get(node) || []) {
      if (color.get(dep) === GRAY) {
        // Found cycle — extract it
        const cycleStart = path.indexOf(dep);
        const cycle = path.slice(cycleStart).map((p) => pathToId.get(p));
        cycle.push(pathToId.get(dep)); // close the cycle
        throw new SchemaResolutionError(`Import cycle detected: ${cycle.join(' → ')}`);
      }
      if (color.get(dep) === WHITE) {
        dfs(dep);
      }
    }

    path.pop();
    color.set(node, BLACK);
  }

  // Sort keys for deterministic cycle detection
  const sortedKeys = [...adj.keys()].sort();
  for (const node of sortedKeys) {
    if (color.get(node) === WHITE) {
      dfs(node);
    }
  }
}

function detectDuplicateDefinitions(units) {
  // Group definitions by package → typeName → [{unitPath, line}]
  const pkgDefs = new Map();

  for (const [absPath, unit] of units) {
    const pkg = unit.package || '';
    if (!pkgDefs.has(pkg)) pkgDefs.set(pkg, new Map());
    const typeDefs = pkgDefs.get(pkg);

    for (const [name, def] of unit.definitions) {
      if (!typeDefs.has(name)) typeDefs.set(name, []);
      typeDefs.get(name).push({
        unitPath: absPath,
        unitId: null, // filled below
        line: def.line
      });
    }
  }

  for (const [pkg, typeDefs] of pkgDefs) {
    for (const [name, locations] of typeDefs) {
      if (locations.length > 1) {
        const pkgLabel = pkg || '(root)';
        const locs = locations
          .map((l) => {
            const id = l.unitPath.split('/').pop();
            return `${id}:${l.line}`;
          })
          .join(' and ');
        throw new SchemaResolutionError(
          `Duplicate definition of "${name}" in package ${pkgLabel}:\n` +
            `  ${locs}\n` +
            `Use "extend type ${name}" to add fields across files.`
        );
      }
    }
  }
}

// ─── Step 3: Topological sort ────────────────────────────────────────────────

function topologicalSort(adj, _pathToId) {
  // Kahn's algorithm with sorted adjacency for determinism.
  // adj[A] = [B, ...] means A depends on B (A imports B), so B must come before A.
  // For Kahn's algorithm: inDeg[A] = adj[A].length (number of dependencies).
  const inDeg = new Map();
  for (const [node, deps] of adj) {
    inDeg.set(node, deps.length);
  }

  // Start with nodes that have no dependencies
  const queue = [];
  for (const [node, deg] of inDeg) {
    if (deg === 0) queue.push(node);
  }
  // Sort for determinism
  queue.sort();

  const result = [];

  // Reverse graph: for each dep B in adj[A], B has a "depender" A
  const reverse = new Map();
  for (const node of adj.keys()) reverse.set(node, []);
  for (const [node, deps] of adj) {
    for (const dep of deps) {
      reverse.get(dep).push(node);
    }
  }

  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);

    const dependers = reverse.get(node) || [];
    dependers.sort(); // determinism
    for (const depender of dependers) {
      inDeg.set(depender, inDeg.get(depender) - 1);
      if (inDeg.get(depender) === 0) {
        // Binary search insertion for O(log n) instead of O(n log n) per push
        let lo = 0,
          hi = queue.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (queue[mid] < depender) lo = mid + 1;
          else hi = mid;
        }
        queue.splice(lo, 0, depender);
      }
    }
  }

  if (result.length !== adj.size) {
    throw new SchemaResolutionError('Topological sort failed — likely an undetected cycle');
  }

  return result;
}

// ─── Step 4: Name resolution maps ───────────────────────────────────────────

function buildResolutionMaps(sorted, units, pathToId, adj) {
  // For each unit, build a map: shortName → { package, mangledName }
  // considering own package + all transitively imported packages.
  const maps = new Map();

  // Precompute transitive closure of imports for each unit
  const transitiveImports = new Map();
  for (const absPath of sorted) {
    const visited = new Set();
    const stack = [...(adj.get(absPath) || [])];
    while (stack.length > 0) {
      const dep = stack.pop();
      if (visited.has(dep)) continue;
      visited.add(dep);
      stack.push(...(adj.get(dep) || []));
    }
    transitiveImports.set(absPath, visited);
  }

  // Collect all definitions per package (across all units in that package)
  const packageDefs = new Map(); // pkg → Map<shortName, {unitPath, line, kind}>
  for (const [_absPath, unit] of units) {
    const pkg = unit.package || '';
    if (!packageDefs.has(pkg)) packageDefs.set(pkg, new Map());
    const defs = packageDefs.get(pkg);
    for (const [name, def] of unit.definitions) {
      defs.set(name, { ...def, package: unit.package });
    }
  }

  for (const absPath of sorted) {
    const unit = units.get(absPath);
    const _unitId = pathToId.get(absPath);
    const ownPkg = unit.package || '';

    // Gather all reachable packages
    const reachableUnits = transitiveImports.get(absPath);
    const reachablePackages = new Set();
    for (const dep of reachableUnits) {
      const depUnit = units.get(dep);
      reachablePackages.add(depUnit.package || '');
    }

    // Also include own package's other units (same-package visibility)
    // and units in same package that are in the reachable set
    // Actually, own package is always visible
    reachablePackages.add(ownPkg);

    // Build resolution map: shortName → { package, mangledName }
    // Check for collisions
    const resMap = new Map();

    for (const pkg of reachablePackages) {
      const defs = packageDefs.get(pkg);
      if (!defs) continue;

      for (const [shortName, def] of defs) {
        if (BUILTIN_SCALARS.has(shortName)) continue;

        const mangledName = mangle(def.package, shortName);

        if (resMap.has(shortName)) {
          const existing = resMap.get(shortName);
          if (existing.package === (def.package || '')) {
            // Same package — not a collision
            continue;
          }

          // Check if local type shadows import
          const existingIsLocal = (existing.package || '') === ownPkg;
          const newIsLocal = (def.package || '') === ownPkg;

          if (existingIsLocal || newIsLocal) {
            const localPkg = existingIsLocal ? existing.package : def.package;
            const importedPkg = existingIsLocal ? def.package : existing.package;
            const localUnit = existingIsLocal ? existing.unitPath : def.unitPath;
            const importedUnit = existingIsLocal ? def.unitPath : existing.unitPath;

            throw new SchemaResolutionError(
              `"${shortName}" is defined locally in package ${localPkg || '(root)'} (${localUnit.split('/').pop()}) ` +
                `and also imported from package ${importedPkg || '(root)'} (${importedUnit.split('/').pop()}).\n` +
                'Local type shadows import — this is an error.\n' +
                'Rename one type (recommended), or use import aliasing (not yet supported).'
            );
          }

          // Collision: same short name in 2+ distinct packages
          const pkg1 = existing.package || '(root)';
          const pkg2 = def.package || '(root)';
          const file1 = existing.unitPath.split('/').pop();
          const file2 = def.unitPath.split('/').pop();
          const line1 = existing.line;
          const line2 = def.line;

          throw new SchemaResolutionError(
            `"${shortName}" is defined in both ${pkg1} (${file1}:${line1}) ` +
              `and ${pkg2} (${file2}:${line2}).\n` +
              'Rename one type (recommended), or use import aliasing (not yet supported).'
          );
        }

        resMap.set(shortName, {
          package: def.package,
          mangledName,
          unitPath: def.unitPath,
          line: def.line
        });
      }
    }

    maps.set(absPath, resMap);
  }

  return maps;
}

// ─── Step 5: AST rewriting ──────────────────────────────────────────────────

function rewriteAST(unit, resMap) {
  // Reuse unit.ast instead of re-parsing (visit returns new AST, doesn't mutate)
  const rewritten = visit(unit.ast, {
    // Rewrite NamedType references (field types, union members, interface implements, etc.)
    NamedType(node) {
      const name = node.name.value;
      if (BUILTIN_SCALARS.has(name)) return undefined; // unchanged
      const resolved = resMap.get(name);
      if (!resolved) return undefined; // leave as-is (will error at validation)
      if (resolved.mangledName === name) return undefined; // no change needed
      return {
        ...node,
        name: { ...node.name, value: resolved.mangledName }
      };
    },

    // Rewrite definition names
    ObjectTypeDefinition(node) {
      return rewriteDefName(node, resMap);
    },
    ObjectTypeExtension(node) {
      return rewriteDefName(node, resMap);
    },
    InputObjectTypeDefinition(node) {
      return rewriteDefName(node, resMap);
    },
    InputObjectTypeExtension(node) {
      return rewriteDefName(node, resMap);
    },
    InterfaceTypeDefinition(node) {
      return rewriteDefName(node, resMap);
    },
    InterfaceTypeExtension(node) {
      return rewriteDefName(node, resMap);
    },
    UnionTypeDefinition(node) {
      return rewriteDefName(node, resMap);
    },
    UnionTypeExtension(node) {
      return rewriteDefName(node, resMap);
    },
    EnumTypeDefinition(node) {
      return rewriteDefName(node, resMap);
    },
    EnumTypeExtension(node) {
      return rewriteDefName(node, resMap);
    },
    ScalarTypeDefinition(node) {
      return rewriteDefName(node, resMap);
    },
    ScalarTypeExtension(node) {
      return rewriteDefName(node, resMap);
    },

    // Strip SchemaExtension nodes carrying @wes_import / @wes_package
    SchemaExtension(node) {
      if (!node.directives) return undefined;
      const hasWesDir = node.directives.some(
        (d) => d.name.value === 'wes_package' || d.name.value === 'wes_import'
      );
      if (hasWesDir) return null; // remove from AST
      return undefined;
    }
  });

  return { doc: rewritten, sdl: print(rewritten) };
}

function rewriteDefName(node, resMap) {
  const name = node.name.value;
  if (BUILTIN_SCALARS.has(name)) return undefined;
  const resolved = resMap.get(name);
  if (!resolved) return undefined;
  if (resolved.mangledName === name) return undefined;
  return {
    ...node,
    name: { ...node.name, value: resolved.mangledName }
  };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Pure default path resolver (no node:path dependency).
 * Handles relative segments via simple normalization.
 */
function defaultResolvePath(base, rel) {
  const parts = (base + '/' + rel).split('/');
  const resolved = [];
  for (const p of parts) {
    if (p === '..') resolved.pop();
    else if (p && p !== '.') resolved.push(p);
  }
  const prefix = (base + '/' + rel).startsWith('/') ? '/' : '';
  return prefix + resolved.join('/');
}

function simpleHash(str) {
  // FNV-1a 32-bit hash, hex encoded (uses Math.imul for correct 32-bit multiply)
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ─── Composition helpers ─────────────────────────────────────────────────────

/**
 * Filter units to a selected subset and merge their SDL.
 *
 * @param {CompilationUnit[]} allUnits - Full set of units from resolve()
 * @param {string[]} selectedUnitIds - Unit IDs to keep
 * @returns {{ sdl: string, units: CompilationUnit[] }}
 */
export function composeUnits(allUnits, selectedUnitIds) {
  const idSet = new Set(selectedUnitIds.flatMap((id) => id.split(',')));

  const selected = allUnits.filter((u) => idSet.has(u.id));

  if (selected.length === 0) {
    const available = allUnits.map((u) => u.id).join(', ');
    throw new SchemaResolutionError(
      `No units match the requested IDs: ${[...idSet].join(', ')}\n` +
        `Available units: ${available}`
    );
  }

  const mergedSdl = selected.map((u) => u.sdl).join('\n\n');
  return { sdl: mergedSdl, units: selected };
}

/**
 * Build a map from mangled type names → short (demangled) names.
 *
 * Safe to call after resolve() succeeds — the resolver guarantees no
 * short-name collisions among reachable packages.
 *
 * @param {CompilationUnit[]} units - Units from resolve()
 * @returns {Map<string, string>} mangledName → shortName
 */
export function buildDemangleMap(units) {
  const map = new Map();
  for (const unit of units) {
    if (!unit.package) continue;
    for (const [shortName, _def] of unit.definitions) {
      const mangledName = mangle(unit.package, shortName);
      if (mangledName !== shortName) {
        map.set(mangledName, shortName);
      }
    }
  }
  return map;
}

/**
 * Rewrite all mangled type names in SDL back to short names.
 *
 * @param {string} sdl - Mangled SDL
 * @param {Map<string, string>} demangleMap - From buildDemangleMap()
 * @returns {string} SDL with short names
 */
export function demangleSdl(sdl, demangleMap) {
  if (demangleMap.size === 0) return sdl;

  const doc = parse(sdl);

  const rewritten = visit(doc, {
    NamedType(node) {
      const short = demangleMap.get(node.name.value);
      if (!short) return undefined;
      return { ...node, name: { ...node.name, value: short } };
    },

    ObjectTypeDefinition(node) {
      return _demangleNode(node, demangleMap);
    },
    ObjectTypeExtension(node) {
      return _demangleNode(node, demangleMap);
    },
    InputObjectTypeDefinition(node) {
      return _demangleNode(node, demangleMap);
    },
    InputObjectTypeExtension(node) {
      return _demangleNode(node, demangleMap);
    },
    InterfaceTypeDefinition(node) {
      return _demangleNode(node, demangleMap);
    },
    InterfaceTypeExtension(node) {
      return _demangleNode(node, demangleMap);
    },
    UnionTypeDefinition(node) {
      return _demangleNode(node, demangleMap);
    },
    UnionTypeExtension(node) {
      return _demangleNode(node, demangleMap);
    },
    EnumTypeDefinition(node) {
      return _demangleNode(node, demangleMap);
    },
    EnumTypeExtension(node) {
      return _demangleNode(node, demangleMap);
    },
    ScalarTypeDefinition(node) {
      return _demangleNode(node, demangleMap);
    },
    ScalarTypeExtension(node) {
      return _demangleNode(node, demangleMap);
    }
  });

  return print(rewritten);
}

function _demangleNode(node, demangleMap) {
  const short = demangleMap.get(node.name.value);
  if (!short) return undefined;
  return { ...node, name: { ...node.name, value: short } };
}

/**
 * Validate that a filtered SDL doesn't reference types from excluded units.
 *
 * Returns null if valid, or a diagnostic object if types are missing.
 *
 * @param {string} sdl - The filtered (and possibly demangled) SDL
 * @param {CompilationUnit[]} allUnits - All units from resolve()
 * @param {string[]} selectedUnitIds - The unit IDs that were included
 * @returns {{ missing: Array<{ type: string, definedIn: string }>, excludedUnits: string[] } | null}
 */
export function validateFilteredSdl(sdl, allUnits, selectedUnitIds) {
  const normalized = selectedUnitIds
    .flatMap((id) => id.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  const idSet = new Set(normalized);
  const doc = parse(sdl);

  // Collect all defined type names (only base definitions count — extensions need their base type)
  const defined = new Set();
  for (const def of doc.definitions) {
    if (BASE_DEF_KINDS.has(def.kind)) {
      defined.add(def.name.value);
    }
  }

  // Collect all referenced type names
  const referenced = new Set();
  visit(doc, {
    NamedType(node) {
      referenced.add(node.name.value);
    }
  });

  // Find missing references
  const missing = [];
  for (const ref of referenced) {
    if (defined.has(ref) || BUILTIN_SCALARS.has(ref)) continue;
    // Skip Mutation/Query — they're GraphQL root types
    if (ref === 'Mutation' || ref === 'Query' || ref === 'Subscription') continue;

    // Find which excluded unit defines this type
    let definedIn = null;
    for (const unit of allUnits) {
      if (idSet.has(unit.id)) continue;
      // Check definitions by short name (post-demangle) or mangled name
      for (const [shortName, _def] of unit.definitions) {
        const mangledName = unit.package ? mangle(unit.package, shortName) : shortName;
        if (shortName === ref || mangledName === ref) {
          definedIn = unit.id;
          break;
        }
      }
      if (definedIn) break;
    }

    missing.push({ type: ref, definedIn });
  }

  if (missing.length === 0) return null;

  const excludedUnits = allUnits.filter((u) => !idSet.has(u.id)).map((u) => u.id);

  return { missing, excludedUnits };
}
