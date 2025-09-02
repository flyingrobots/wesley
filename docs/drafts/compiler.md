# Wesley - GraphQL -> Wesley IR -> Everything else

## Compiler Stack

Wesley is GraphQL-first, so the clean, boring - reliable stack is:

Use GraphQL Code Generator as the engine, and wire these plugins:

- `@graphql-codegen/typescript` → base TS types from your schema.  ￼
- `@graphql-codegen/typescript-resolvers` → resolver signatures (backend).  ￼ ￼
- `@graphql-codegen/typescript-operations` (+ `@graphql-codegen/typed-document`-node if you want typed DocumentNodes) → operation types (frontend/server).  ￼ ￼
- `graphql-codegen-typescript-validation-schema` with schema: "zod" → Zod schemas straight from your GraphQL types/inputs. It supports custom scalar→Zod mappings and can import your generated TS types so Zod infers correctly.  ￼
- **Nice-to-have**: add plugin to prepend your “SHA-locked certificate” banner.  ￼

## Why this setup?

There are community Zod plugins (e.g., `@anatine/graphql-codegen-zod`) but they’re older and less active. The Guild-hosted validation-schema plugin is maintained and documented, supports Zod/Yup/MyZod/Valibot, and was updated in 2025. Use the official path.  ￼ ￼

## Minimal `codegen.ts` for Wesley

**NOTE** We will not be writing our compiler in TypeScript, this is just an illustrative example.

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  // your SDL is the source of truth
  schema: 'schema.graphql',
  // GraphQL documents (if you want operation types)
  documents: ['src/**/*.{graphql,gql}'],

  // 1) Base schema types + Zod validators in one place
  generates: {
    'src/__generated__/types.ts': {
      plugins: [
        'typescript',
        'typescript-resolvers',
      ],
      config: {
        // map scalars to TS (used by both types and validators)
        scalars: {
          ID: 'string',
          DateTime: 'string', // or 'Date' if you prefer
          JSON: 'Record<string, unknown>',
        },
        // resolver type config examples:
        contextType: './context#Context',
        mappers: {
          // e.g. User: './models#UserModel'
        },
      },
    },

    // 2) Zod from the schema (imports types from the file above)
    'src/__generated__/zod.ts': {
      plugins: ['typescript-validation-schema'],
      config: {
        schema: 'zod',
        importFrom: './types', // imports generated TS types so Zod infers
        // Map GraphQL scalars to Zod:
        schemaNamespacedImportName: 'T', // use `import * as T from './types'`
        scalarSchemas: {
          DateTime: 'z.string().datetime()',
          JSON: 'z.record(z.unknown())',
          ID: 'z.string().min(1)',
          Email: 'z.string().email()',
        },
        // Also emit Zod for object types if you want it:
        withObjectType: true, // excludes Query/Mutation/Subscription
      },
    },

    // 3) Operation types (and typed DocumentNodes) colocated near the ops
    'src/': {
      preset: 'near-operation-file',
      presetConfig: {
        baseTypesPath: '__generated__/types.ts',
        extension: '.generated.ts',
      },
      plugins: [
        'typescript-operations',
        'typed-document-node',
      ],
    },

    // 4) Stamp a header (SHA, build time) onto each artifact
    'src/__generated__/banner.txt': {
      plugins: [
        { add: { content: '/* Wesley Build: ${GIT_SHA} – ${new Date().toISOString()} */' } }
      ]
    }
  }
};
export default config;
```

### Notes that matter

- The Zod plugin supports `scalarSchemas`, `withObjectType`, `importFrom`, `schemaNamespacedImportName`—use these to keep Zod = TS = GraphQL perfectly aligned.  ￼
- near-operation-file keeps per-query artifacts small and tree-shakeable; point it at your shared `types.ts`.  ￼
- If you also use the “client preset,” split generation in two runs—there’s a known interop quirk with the validation plugin; the docs show the split workaround.  ￼

---

Usage example (server)

import { z } from 'zod';
import { CreateOrgInput } from '../__generated__/types';
import { CreateOrgInputSchema } from '../__generated__/zod';

export const createOrg = async (args: { input: CreateOrgInput }) => {
  const input = CreateOrgInputSchema().parse(args.input); // runtime check
  // safe to use now…
};

Usage example (client)

import { GetOrgDocument } from './getOrg.generated';
client.query(GetOrgDocument, { id });


⸻

TL;DR “Do this” checklist
- ✅ The Guild Codegen core + official plugins for types/ops/resolvers.  ￼
- ✅ typescript-validation-schema with schema: "zod" for validators.  ￼
- ✅ near-operation-file for per-op artifacts; typed-document-node for fully typed queries.  ￼
- ✅ add to stamp your SHA banner.  ￼

If you want, I can tighten this to a drop -in PR for Wesley with scripts, strict scalar policy, and a few example resolvers wired to the generated Zod.

