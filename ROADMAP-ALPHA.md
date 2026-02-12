# Alpha Roadmap – Wesley in the Browser

> **Goal:** Deliver an in-browser Wesley playground (“Try now”) where users can edit GraphQL schemas, compile them to Postgres migrations, and see the resulting database live via an in-browser Postgres (PGLite) console – **no install required**.
>
> **Scope:** One solid end-to-end experience on the public website (`wesley-website`), backed by `@wesley/host-browser` and PGLite, suitable to call “Alpha”.
>
> **TOTAL ESTIMATE (solo, no AI):** 34–60 hours.

<!-- progress bar -->
```text
PROGRESS
343/343 complete
██████████████████████████████████████████████████ 100%
|••••|••••|••••|••••|••••|••••|••••|••••|••••|••••|
0   10   20   30   40   50   60   70   80  90  100
```

---

## Legend

- **Feature** – A cohesive user-visible capability.
- **User Story** – What the user can do with that feature.
- **Task** – Concrete implementation work, with a checklist.
- **Acceptance Criteria** – Verifiable behaviors from the user’s perspective.
- **Specs as Tests** – Tests we should have (unit / integration / e2e) that encode the spec.
- **Definition of Done** – What must be true before we check the task off.
- **Suggested Commits** – Ideal git commit boundaries for solo-dev workflow.

---

## Feature A – “Try Now” Playground Shell

Create a dedicated `/try` page in `wesley-website` that hosts the playground UI: navigation, layout, file tree, and editor (before wiring up Wesley or PGLite).

### User Stories (Feature A)

- **A1. Navigation to Playground**
  - As a visitor, I can click “Try now” on the landing page and land on `/try`.
  - As a visitor, I can navigate directly to `/try` and see the playground shell.

- **A2. Schema Workspace Shell**
  - As a visitor, I see a simple “workspace” with a file list and an editor area.
  - As a visitor, I can switch between schema files and edit them inline.

---

### Task A1.1 – Add `/try` route and stub page

**Description:** Introduce a `/try` route in `wesley-website` using the existing manual router in `src/App.jsx`, and create a placeholder `TryNow` page component.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Create `wesley-website/src/pages/TryNow.jsx` that renders a minimal placeholder:
  - [x] Page title (“Wesley Playground (Alpha)”).
  - [x] Short description of what this page will do.
  - [x] Placeholder sections for:
    - [x] “File tree”
    - [x] “Schema editor”
    - [x] “Database console”
- [x] Update `wesley-website/src/App.jsx` to recognize `/try`:
  - [x] Import `TryNow`.
  - [x] Add a `path === '/try'` branch in the main render switch.
  - [x] Ensure the default route remains the landing page.
- [x] Verify manual navigation:
  - [x] Run `pnpm dev` in `wesley-website`.
  - [x] Hit `http://localhost:5173/try` (or configured dev URL).
  - [x] Confirm the stub page loads without console errors.

**Acceptance Criteria**

- [x] Navigating directly to `/try` loads the playground shell without a full-page reload.
- [x] The page clearly indicates that it is an **Alpha** playground.
- [x] No regressions to `/` or `/docs` routing.

**Specs as Tests**

- [x] Add a React test (e.g. `wesley-website/src/App.test.jsx`) that:
  - [x] Renders `<App />` with a mocked `window.location.pathname = '/try'`.
  - [x] Asserts that text like “Playground” or “Try Wesley in your browser” is visible.

**Definition of Done**

- [x] `/try` route exists and is reachable in dev mode.
- [x] Basic tests for routing to `/try` are passing.
- [x] No warnings or errors in browser console when loading `/try`.

**Suggested Commits**

- `feat(website): add /try route and TryNow shell page`

---

### Task A1.2 – Add “Try now” entry points from landing page

**Description:** Surface the playground from the homepage hero and, optionally, header navigation.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Update `wesley-website/src/components/HeroBullets.jsx`:
  - [x] Add a “Try now” button next to “Get started” / “Docs”.
  - [x] Wire its click handler to call `onNavigate('/try')` using the existing `App` navigation hook.
- [x] Optionally, update `HeaderSearch` or navbar to include a “Try now” link:
  - [x] Clicking “Try now” should call `onNavigate('/try')` (no full-page reload).
- [x] Visually check:
  - [x] “Try now” appears in the hero.
  - [x] Button styling is consistent with existing buttons.

**Acceptance Criteria**

- [x] From the landing page, a prominent “Try now” action exists.
- [x] Clicking “Try now” navigates to `/try` via SPA navigation (no hard reload).
- [x] Navigation back to `/` and `/docs` still works.

**Specs as Tests**

- [x] Extend/adjust hero tests (if present) or add a new test:
  - [x] Render `HeroBullets` with a mock `onNavigate`.
  - [x] Simulate click on “Try now”.
  - [x] Assert `onNavigate` was called with `'/try'`.

**Definition of Done**

- [x] “Try now” entry points are discoverable and functional.
- [x] Tests for hero navigation are passing.
- [x] No eslint/TypeScript/Vite warnings stemming from these changes.

**Suggested Commits**

- `feat(website): add Try now CTA to hero`

---

### Task A2.1a – Define schema workspace state

**Description:** Set up the initial in-memory schema workspace and active file selection, without worrying yet about the precise file tree UI layout.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] In `TryNow.jsx`, define an `initialFiles` object with at least one GraphQL schema (e.g., `schema.graphql`).
- [x] Add React state: `const [files, setFiles] = useState(initialFiles);`.
- [x] Add React state: `const [activePath, setActivePath] = useState('schema.graphql');`.
- [x] Ensure the initial active file exists in `initialFiles`.
- [x] Log or visually surface the current active file name somewhere on the page for debugging.

**Acceptance Criteria**

- [x] On first load, there is at least one default GraphQL schema file in memory.
- [x] `activePath` is set to a valid key from `files` (e.g. `schema.graphql`).

**Specs as Tests**

- [x] Add a component/unit test (for `TryNow` or an extracted workspace hook/component) that:
  - [x] Asserts the default `activePath` is `schema.graphql` (or whichever you choose).
  - [x] Asserts `files[activePath]` is a non-empty string.

**Definition of Done**

- [x] Workspace state exists and initializes correctly.
- [x] Tests verify initial active file and content.

**Suggested Commits**

- `feat(website): initialize TryNow schema workspace state`

---

### Task A2.1b – Render schema file tree UI

**Description:** Render a clickable file list/tree that reflects the in-memory workspace and updates `activePath`.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Use Mantine components (e.g., `NavLink`, `Stack`, or `List`) to render the file names from `Object.keys(files)`.
- [x] Visually distinguish the active file (bold, highlight, or icon).
- [x] On click, update `activePath` to the clicked file key.
- [x] Ensure the file list is placed on the left side of the layout and reserves space for editor and DB console.

**Acceptance Criteria**

- [x] The playground shows a visible list of schema files, including the default.
- [x] Clicking a different file updates the active selection (both visually and in state).
- [x] The file tree layout does not overlap the editor or DB console area.

**Specs as Tests**

- [x] Extend the workspace component test:
  - [x] Verify that all keys in `files` appear in the rendered file list.
  - [x] Simulate a click on a non-default file and assert `activePath` changes accordingly (through visible selection).

**Definition of Done**

- [x] File tree UI is functional and correctly updates `activePath`.
- [x] Tests cover clicking and selection.

**Suggested Commits**

- `feat(website): render schema file tree for TryNow workspace`

---

### Task A2.1c – Harden workspace behavior and tests

**Description:** Add any remaining guards and tests to ensure workspace behavior is stable (no runtime errors when switching files).

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Add defensive checks so that if `activePath` points to a missing file key, it falls back to a default (e.g. first key in `files`).
- [x] Ensure workspace still behaves correctly if additional files are added in future (e.g. from presets).
- [x] Write or extend tests to:
  - [x] Cover switching between multiple files.
  - [x] Handle the case where a missing key is encountered.

**Acceptance Criteria**

- [x] Switching between files never throws runtime errors related to missing keys.
- [x] Future additions to `files` do not break the workspace behavior.

**Specs as Tests**

- [x] Add tests to simulate:
  - [x] More than two files in the workspace.
  - [x] An invalid `activePath` being corrected to a safe default.

**Definition of Done**

- [x] Workspace behavior is well-covered by tests.
- [x] No runtime errors occur when switching files under normal use.

**Suggested Commits**

- `test(website): harden TryNow schema workspace behavior`

---

### Task A2.2a – Wire basic schema editor to workspace

**Description:** Provide a basic text editor bound to the active schema file using simple Mantine components.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] In `TryNow.jsx`, render a text editing component (Mantine `Textarea` or `Code`) for the active file.
- [x] Use `files[activePath]` as the editor value.
- [x] On change, update `setFiles` so that the in-memory `files` reflects edits for `activePath`.
- [x] Ensure the editor is placed to the right of the file tree and visible at typical viewport sizes.

**Acceptance Criteria**

- [x] Editing text in the editor updates the corresponding entry in `files`.
- [x] Switching active files updates the editor content immediately.

**Specs as Tests**

- [x] Add or extend tests to:
  - [x] Simulate typing into the editor and assert the in-memory `files[activePath]` has changed (via component behavior).
  - [x] Switch active files and assert the editor shows the new file content.

**Definition of Done**

- [x] Editor is fully wired to workspace state for basic text editing.
- [x] Tests cover editing and switching files.

**Suggested Commits**

- `feat(website): add basic schema editor bound to TryNow workspace`

---

### Task A2.2b – Improve editor layout and UX

**Description:** Refine the editor layout and behavior for a more IDE-like experience (without yet adding heavy editor dependencies).

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Adjust layout (flex/grid) so editor and file tree resize with the window and remain usable on smaller screens.
- [x] Ensure the editor scrolls independently of the file tree and DB console.
- [x] Consider adding a monospace font and basic styling for readability.

**Acceptance Criteria**

- [x] The editor is readable and usable alongside the file tree and DB console.
- [x] Resizing the browser window keeps the editor usable (no overflow hiding the editor).

**Specs as Tests**

- [x] Visual/manual QA:
  - [x] Confirm layout works at common viewport sizes (e.g., 1024×768, 1440×900).

**Definition of Done**

- [x] Editor layout is pleasant to use and doesn’t break the surrounding layout.

**Suggested Commits**

- `style(website): refine TryNow editor layout and UX`

---

### Task A2.2c – Optional: upgrade editor (Monaco/CodeMirror) and tests — N/A (Tiptap chosen)

**Description:** Optionally swap the simple editor for a richer editor (e.g., Monaco) with GraphQL syntax highlighting, and adjust tests accordingly. **Decision: Tiptap-based RichEditor was implemented instead — lighter weight, adequate for Alpha, includes GraphQL syntax highlighting via lowlight.**

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [x] Add a dependency such as `@monaco-editor/react` if you choose to upgrade.
- [x] Replace the simple editor component with Monaco/CodeMirror in `TryNow.jsx`.
- [x] Configure language mode for GraphQL if feasible.
- [x] Ensure the editor still reads/writes `files[activePath]`.
- [x] Update tests to work with the new editor component (mock or shallow render as needed).

**Acceptance Criteria**

- [x] Rich editor renders without runtime errors and maintains the same state semantics.
- [x] Syntax highlighting is active (if configured) or at least the editor remains functional and accessible.

**Specs as Tests**

- [x] Maintain existing editor behavior tests (edit + switch file).
- [x] Optionally add a snapshot test to guard against major layout regressions.

**Definition of Done**

- [x] Editor upgrade (if pursued) is fully integrated and tested.
- [x] No regressions in workspace behavior after the swap.

**Suggested Commits**

- `feat(website): upgrade TryNow schema editor to Monaco`
- `test(website): adjust TryNow editor tests for Monaco`

---

## Feature B – Wesley Compile Engine (Browser Host)

Expose a clean browser API via `@wesley/host-browser` to compile GraphQL schemas into SQL migrations and metadata, using only Web APIs. The playground will call this API.

### User Stories (Feature B)

- **B1. Compile Schema in Browser**
  - As a user, I can click “Compile & apply” and either see a success indicator with table counts or a clear error describing what went wrong with my schema.

- **B2. Stable Browser Engine Contract**
  - As a developer, I have a stable browser API that takes a set of schema files and returns SQL migrations + summary data (tables, warnings) without touching disk.

---

### Task B1.1 – Design `compileSchemaInBrowser` API

**Description:** Define a higher-level API on top of `runInBrowser` that accepts multiple schema files and returns structured compile results for the UI.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [x] Create/extend `packages/wesley-host-browser/src/index.mjs` to export a new function:

  ```js
  /**
   * @typedef {Object} BrowserCompileResult
   * @property {boolean} ok
   * @property {number} tables
   * @property {string[]} sqlMigrations
   * @property {string[]} warnings
   * @property {{ message: string, location?: { line: number, column: number } }[]=} errors
   */
  ```

- [x] Define the function signature:

  ```js
  /**
   * @param {Record<string, string>} files - GraphQL SDL files keyed by path.
   * @returns {Promise<BrowserCompileResult>}
   */
  export async function compileSchemaInBrowser(files) { /* impl later */ }
  ```

- [x] Document the API in `packages/wesley-host-browser/README.md` under an “Alpha Playground” section.

**Acceptance Criteria**

- [x] A clear JSDoc’d API exists for `compileSchemaInBrowser(files)`.
- [x] The return type covers `ok`, `tables`, `sqlMigrations`, `warnings`, `errors`.
- [x] README documents how this API is intended to be used by web UIs.

**Specs as Tests**

- [x] Add a small unit test (Node-based) that:
  - [x] Imports `compileSchemaInBrowser` (can be a stub initially).
  - [x] Asserts that calling it with `{ 'schema.graphql': 'type Query { ping: String }' }` returns a `Promise` and a shape matching `BrowserCompileResult` (even if fields are placeholders).

**Definition of Done**

- [x] API shape is defined and exported.
- [x] README updated with a short usage snippet.
- [x] A basic test enforces the shape (so refactors don’t silently break the playground).

**Suggested Commits**

- `feat(host-browser): define compileSchemaInBrowser API contract`

---

### Task B1.2a – Sanitize inputs and join SDL files

**Description:** Implement the input handling portion of `compileSchemaInBrowser(files)`, validating the `files` object and producing a single combined SDL string.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [x] In `compileSchemaInBrowser`, assert that `files` is a plain object mapping string paths to string contents.
- [x] Normalize line endings if needed and join multiple SDL files into a single SDL string (or prepare a structure compatible with the parser).
- [x] Reuse `sanitizeGraphQL` (or similar) to enforce size limits and strip BOM/null bytes.
- [x] Decide on and implement error behavior for invalid inputs (e.g., throw a typed error or return `{ ok: false, errors: [...] }`).

**Acceptance Criteria**

- [x] Calling `compileSchemaInBrowser` with a valid `files` object produces a combined SDL string ready for parsing.
- [x] Invalid input (non-object or non-string values) is handled deterministically (either well-typed error or `{ ok: false }`).

**Specs as Tests**

- [x] Add unit tests that:
  - [x] Pass a minimal valid `files` object and assert the combined SDL includes all file contents.
  - [x] Pass invalid inputs (e.g., `null`, arrays, non-string values) and assert the chosen error behavior occurs.

**Definition of Done**

- [x] Input validation and SDL combination are implemented and tested.

**Suggested Commits**

- `feat(host-browser): add multi-file SDL handling for compileSchemaInBrowser`

---

### Task B1.2b – Wire `createBrowserRuntime` and `GenerationPipeline`

**Description:** Connect the combined SDL string to `GenerationPipeline` using the browser runtime, without yet focusing on full migration generation.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [x] Import and reuse `createBrowserRuntime()` from `@wesley/host-browser`.
- [x] Instantiate `GenerationPipeline` with:
  - [x] `parser: rt.parsers.graphql`.
  - [x] A placeholder or minimal diff engine compatible with browser constraints.
  - [x] `fileSystem` undefined or a memory-backed FS as appropriate.
  - [x] `logger` from the browser runtime.
- [x] Call `pipeline.execute(combinedSDL, { sha: 'browser-alpha' })` and capture the output bundle.

**Acceptance Criteria**

- [x] For a valid schema, `pipeline.execute` completes without throwing and returns a bundle with a schema representation.
- [x] For an invalid schema, errors are captured and can be surfaced later.

**Specs as Tests**

- [x] Add tests (Node + JSDOM or a small browser-smoke harness) that:
  - [x] Run `compileSchemaInBrowser` with a valid example schema and assert that the internal pipeline step completes.
  - [x] Run with an invalid schema and assert that the error path is triggered.

**Definition of Done**

- [x] Browser-based pipeline wiring is in place and passes basic smoke tests.

**Suggested Commits**

- `feat(host-browser): wire createBrowserRuntime and GenerationPipeline in compileSchemaInBrowser`

---

### Task B1.2c – Generate SQL migrations and map results

**Description:** Replace the placeholder diff/generator with logic that produces SQL migrations from the pipeline and maps the bundle into `BrowserCompileResult`.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [x] Implement or integrate a diff engine that can compute migration steps between previous and current schemas (for the Alpha demo, a simple “from empty” diff is acceptable).
- [x] Implement or integrate a generator that converts diff steps into SQL migration statements.
- [x] Count tables (e.g., number of `@wes_table` types) and set `tables` in the result.
- [x] Populate `BrowserCompileResult` fields:
  - [x] `ok` based on pipeline/diff success.
  - [x] `tables` count.
  - [x] `sqlMigrations` array.
  - [x] `warnings` (even if initially empty).
  - [x] `errors` for failures, with messages and optional locations.
- [x] Ensure no Node-only imports are used (pure ESM + Web APIs).

**Acceptance Criteria**

- [x] For a valid schema, `compileSchemaInBrowser` returns `{ ok: true, tables > 0, sqlMigrations.length >= 1 }`.
- [x] For an invalid schema, it returns `{ ok: false, errors: [...] }` without uncaught exceptions.

**Specs as Tests**

- [x] Add or extend tests to:
  - [x] Assert that a known example schema yields non-empty `sqlMigrations` and a sensible `tables` count.
  - [x] Assert that a broken schema yields `ok === false` and at least one error entry.

**Definition of Done**

- [x] `compileSchemaInBrowser` produces real SQL migrations for the canonical example schema and reports errors correctly.

**Suggested Commits**

- `feat(host-browser): generate SQL migrations in compileSchemaInBrowser`
- `test(host-browser): cover success and failure cases for compileSchemaInBrowser`

---

### Task B1.3a – Add compile state and button in TryNow

**Description:** Add minimal compile state to the TryNow UI and a “Compile & apply” button that calls the engine and stores the result.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] In `TryNow.jsx`, add state:
  - [x] `compileStatus` (`idle` | `running` | `success` | `error`).
  - [x] `compileResult` (last `BrowserCompileResult`).
- [x] Add a “Compile & apply” button:
  - [x] Disable the button while `compileStatus === 'running'`.
- [x] Implement `onCompile` handler:
  - [x] Set `compileStatus = 'running'`.
  - [x] Call `compileSchemaInBrowser(files)`.
  - [x] Store the result in `compileResult`.
  - [x] Set `compileStatus` to `'success'` or `'error'` based on `ok`.
- [x] Render a simple summary (e.g., `tables` and number of migrations) when `compileResult` is present.

**Acceptance Criteria**

- [x] Clicking “Compile & apply” triggers a call to `compileSchemaInBrowser(files)`.
- [x] The button disables while a compile is in flight.
- [x] On success, a basic summary is visible; on failure, a simple error indicator is shown.

**Specs as Tests**

- [x] Add a test that:
  - [x] Renders `TryNow` with `compileSchemaInBrowser` mocked.
  - [x] Simulates clicking “Compile & apply”.
  - [x] Asserts that the mock was called and that summary text appears for a mocked success.

**Definition of Done**

- [x] TryNow page can trigger compilation and display a basic status/summary.

**Suggested Commits**

- `feat(website): add compile button and state to TryNow`

---

### Task B1.3b – Display detailed errors and add UI tests

**Description:** Improve the compile UI to show detailed error messages and add tests for both success and failure flows.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Expand the compile summary UI to:
  - [x] Show `tables` and `sqlMigrations.length` on success.
  - [x] Render human-readable error messages from `compileResult.errors` on failure.
- [x] Ensure no stack traces leak to the user; only friendly messages.
- [x] Extend tests to:
  - [x] Cover a mocked failure result and assert error messages render.
  - [x] Confirm there are no unhandled promise rejections in the console during tests.

**Acceptance Criteria**

- [x] Clicking “Compile & apply” with invalid schema surfaces clear errors in the UI.
- [x] No console stacktraces are shown to end users (errors are handled and displayed cleanly).

**Specs as Tests**

- [x] Tests verify both success and failure paths end up with the correct UI output.

**Definition of Done**

- [x] Compile errors are displayed clearly and are covered by tests.

**Suggested Commits**

- `feat(website): surface compile errors in TryNow`
- `test(website): add TryNow compile success/failure tests`

---

## Feature C – In-Browser Postgres (PGLite) Integration

Use PGLite to back the playground’s “Database view” so users can see and query the generated schema live in the browser.

### User Stories (Feature C)

- **C1. Live Schema Application**
  - As a user, when I compile a schema, I can apply the migrations to an in-browser Postgres and know that the tables really exist.

- **C2. Interactive Database Console**
  - As a user, I can run SQL queries (`SELECT`, `INSERT`, etc.) against the in-browser DB and see results in a simple table view.

---

### Task C1.1a – Add PGLite dependency and minimal `DbSession`

**Description:** Introduce PGLite to `wesley-website` and create a minimal `DbSession` that can execute basic queries. `DbSession` acts as the browser-friendly Postgres port that both real (PGLite) and fake implementations can satisfy.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [x] Add PGLite dependency to `wesley-website/package.json` (e.g. `@electric-sql/pglite` or chosen library).
- [x] Create `wesley-website/src/db/pglite.ts` (or `.mjs`) that exports the types (or JSDoc interface):

  ```ts
  export type DbSession = {
    reset(): Promise<void>
    applyMigrations(sql: string[]): Promise<void>
    query(sql: string): Promise<{ rows: any[]; fields: string[] }>
  }
  export async function createDbSession(): Promise<DbSession>
  ```

- [x] Implement `createDbSession`:
  - [x] Instantiate PGLite.
  - [x] Implement a no-op `reset()` initially.
  - [x] Implement a minimal `query()` that runs SQL and returns `{ rows, fields }`.
- [x] Ensure `DbSession` is the only surface `TryNow` and related components depend on (so tests can swap in fakes).

**Acceptance Criteria**

- [x] `createDbSession` can be imported from `wesley-website/src/db/pglite` and used to execute a basic `SELECT 1` query in a dev sandbox.

**Specs as Tests**

- [x] Add a small integration/unit test (Node or browser-driven) that:
  - [x] Calls `createDbSession()`.
  - [x] Executes a trivial query (e.g. `SELECT 1`) and asserts on the returned rows/fields.

**Definition of Done**

- [x] PGLite builds with Vite and a minimal `DbSession` is in place.
- [x] `DbSession` is exported in a way that tests and other hosts can implement compatible fakes/adapters.

**Suggested Commits**

- `feat(website): add PGLite dependency and minimal DbSession`

---

### Task C1.1d – Define `FakeDbSession` for tests

**Description:** Create a lightweight in-memory `FakeDbSession` implementation for tests so React components can be exercised without a real PGLite instance.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Add `wesley-website/src/test/FakeDbSession.ts` (or similar) that implements the `DbSession` interface:
  - [x] Track `reset()` calls, applied migrations, and executed queries in memory.
  - [x] Return canned `{ rows, fields }` data from `query()` suitable for UI tests.
- [x] Ensure `FakeDbSession` can be constructed with optional initial data (e.g., initial tables or rows) for richer scenarios.
- [x] Use `FakeDbSession` in TryNow tests by:
  - [x] Mocking `createDbSession` to return a `FakeDbSession` instance, or
  - [x] Passing it via a context/provider if you introduce one.

**Acceptance Criteria**

- [x] TryNow tests do not require a real PGLite instance; they can rely on `FakeDbSession`.
- [x] Tests can assert on applied migrations and executed queries via the fake.

**Specs as Tests**

- [x] Add tests that:
  - [x] Use `FakeDbSession` with TryNow and assert that `applyMigrations` and `query` were called with expected SQL.
  - [x] Verify that error paths can be simulated by having `FakeDbSession` throw or return error-like results.

**Definition of Done**

- [x] `FakeDbSession` exists, matches the `DbSession` interface, and is used in TryNow tests.

**Suggested Commits**

- `test(website): add FakeDbSession for TryNow tests`

---

### Task C1.1b – Implement `applyMigrations` and `reset`

**Description:** Flesh out `DbSession.applyMigrations` and `reset` to support applying a list of SQL migrations and returning to a clean state.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Implement `applyMigrations(sql: string[])`:
  - [x] Execute each migration inside a transaction where possible.
  - [x] Surface any errors with meaningful messages.
- [x] Implement `reset()`:
  - [x] Decide on reset strategy (e.g., drop and recreate database/schema, or reinstantiate PGLite).
  - [x] Ensure subsequent queries run against a clean state.

**Acceptance Criteria**

- [x] Applying a simple `CREATE TABLE` + `INSERT` + `SELECT` sequence via `applyMigrations` and `query` works end-to-end.
- [x] Calling `reset()` clears previous schema/data so migrations can be reapplied cleanly.

**Specs as Tests**

- [x] Extend tests to:
  - [x] Apply a migration that creates a table.
  - [x] Insert and select data.
  - [x] Call `reset()` and confirm the schema/data is cleared.

**Definition of Done**

- [x] `applyMigrations` and `reset` behave predictably and are covered by tests.

**Suggested Commits**

- `feat(website): add applyMigrations and reset behavior to DbSession`
- `test(website): cover DbSession migrations and reset`

---

### Task C1.1c – Harden `query` and limit result size

**Description:** Finalize the `query` method to be safe and convenient for the playground UI.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Ensure `query(sql)`:
  - [x] Limits result size (e.g., first 100 rows).
  - [x] Returns field metadata friendly for table rendering.
- [x] Handle and wrap errors into readable messages (do not throw raw PGLite internals at the UI).
- [x] Add JSDoc comments to `DbSession` and `query`.

**Acceptance Criteria**

- [x] `query` returns a predictable `{ rows, fields }` shape even for large result sets (truncated appropriately).
- [x] Errors are represented as clean messages suitable for UI display.

**Specs as Tests**

- [x] Tests that:
  - [x] Insert >100 rows and confirm that `query` truncates results.
  - [x] Run invalid SQL and assert on the error message shape.

**Definition of Done**

- [x] `DbSession` is stable and documented, with `query` safe for the playground UI.

**Suggested Commits**

- `feat(website): harden DbSession query behavior`

---

### Task C1.2a – Initialize `DbSession` in TryNow

**Description:** Wire the PGLite-backed `DbSession` into the TryNow page and expose an optional “Reset database” control.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] In `TryNow.jsx`, add state for the DB session: `const [dbSession, setDbSession] = useState<DbSession | null>(null);`.
- [x] On mount, call `createDbSession()` and store the result in `dbSession`.
- [x] Add a “Reset database” button that calls `dbSession.reset()` when clicked.
- [x] Handle the case where `dbSession` is not yet ready (disable DB-related controls until initialized).

**Acceptance Criteria**

- [x] On loading `/try`, a `DbSession` is created and stored in state.
- [x] Clicking “Reset database” successfully calls `reset()` without errors.

**Specs as Tests**

- [x] Add tests (with `createDbSession` mocked) that:
  - [x] Confirm `createDbSession` is called on mount.
  - [x] Confirm clicking “Reset database” invokes `reset()` on the mocked session.

**Definition of Done**

- [x] TryNow page has a working DB session stored in state and a reset control.

**Suggested Commits**

- `feat(website): initialize PGLite DbSession in TryNow`

---

### Task C1.2b – Apply compile results to PGLite on success

**Description:** When compilation succeeds, apply `sqlMigrations` from `compileSchemaInBrowser` to the active `DbSession` and surface success/failure to the user.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Extend `onCompile` handler in `TryNow.jsx`:
  - [x] After a successful compile, call `dbSession.applyMigrations(result.sqlMigrations)` (if `dbSession` is present).
  - [x] Catch and surface any migration errors in the error panel.
- [x] Add a small UI cue for successful migration application (e.g. “Database schema updated” message).

**Acceptance Criteria**

- [x] After a successful compile, migrations are applied to PGLite and queries see the new tables.
- [x] If migrations fail, a clear error message is displayed, and the user can try again after fixing the schema.

**Specs as Tests**

- [x] Add tests (with `DbSession` mocked) that:
  - [x] Confirm `applyMigrations` is called with the `sqlMigrations` array on compile success.
  - [x] Confirm compile failures **do not** call `applyMigrations`.

**Definition of Done**

- [x] Compile success leads to PGLite updates; failures are safely handled and reported.

**Suggested Commits**

- `feat(website): apply compile migrations to PGLite session in TryNow`

---

### Task C2.1a – Basic database console UI and wiring

**Description:** Build a simple DB console panel in TryNow with SQL input, run button, and a basic text/JSON output.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [x] In `TryNow.jsx`, add:
  - [x] `queryText` state (SQL input).
  - [x] `queryResult` state (`{ rows, fields }` or `null`).
  - [x] `queryError` state (string or error object or `null`).
- [x] Render a “Database” panel:
  - [x] Textarea or small editor for SQL queries.
  - [x] “Run query” button.
- [x] Implement `onRunQuery` handler:
  - [x] Call `dbSession.query(queryText)`.
  - [x] Store result in `queryResult` or error in `queryError`.
- [x] For now, render output as simple JSON or plain text.

**Acceptance Criteria**

- [x] With a simple schema applied, users can run basic `SELECT` queries and see results in the console.
- [x] Invalid SQL produces a human-readable error message in the console area.

**Specs as Tests**

- [x] Add tests (with `DbSession` mocked) that:
  - [x] Simulate entering SQL and clicking “Run query”.
  - [x] Assert that `dbSession.query` was called.
  - [x] Assert that results or errors are reflected in the rendered output.

**Definition of Done**

- [x] The DB console is wired enough to run queries and show raw results/errors.

**Suggested Commits**

- `feat(website): add basic DB console to TryNow`

---

### Task C2.1b – Table view and console polish

**Description:** Upgrade the DB console to render results in a table and improve error display and UX.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Replace or augment the raw JSON output with a Mantine `Table` using `queryResult.rows` and `queryResult.fields`.
- [x] Add an error banner or callout when `queryError` is non-null.
- [x] Ensure styling matches the rest of the TryNow page and handles long results gracefully (scrolling).

**Acceptance Criteria**

- [x] Query results are displayed in a readable table format.
- [x] Errors are clearly highlighted and contained to the DB console area.

**Specs as Tests**

- [x] Extend console tests to:
  - [x] Assert that table rows/columns appear for a mocked `queryResult`.
  - [x] Assert that the error banner appears for a mocked `queryError`.

**Definition of Done**

- [x] Database console is usable, readable, and visually integrated with the playground.

**Suggested Commits**

- `style(website): render DB query results in table view`
- `test(website): enhance TryNow DB console tests`

---

## Feature D – UX, Safety, Docs, and CI

Polish the experience, ensure graceful failure modes, and document/automate the Alpha slice.

### User Stories (Feature D)

- **D1. Graceful Failure and Reset**
  - As a user, I’m never stuck; if something goes wrong, I get a readable error and a way to reset.

- **D2. Learnability and Confidence**
  - As a new user, I can understand how to use the playground from on-page hints and docs.
  - As a developer, I can trust CI to keep the playground from silently breaking.

---

### Task D1.1a – Add error panel for compile and DB failures

**Description:** Provide a centralized “Status / Errors” panel in TryNow that surfaces compile and DB errors in plain language.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Add a “Status / Errors” panel area in `TryNow`.
- [x] Render compile errors (from `compileResult.errors`) as readable messages.
- [x] Render DB migration/query errors (from `queryError` or migration failures) in the same panel.
- [x] Ensure the panel layout does not interfere with the editor or DB console.

**Acceptance Criteria**

- [x] When compile or DB operations fail, the error panel surfaces the failure in human-friendly language.
- [x] No raw stack traces are shown directly to the user.

**Specs as Tests**

- [x] Add tests that:
  - [x] Inject a mocked compile failure and assert that an error message appears in the panel.
  - [x] Inject a mocked DB error and assert that it appears in the panel.

**Definition of Done**

- [x] All compile/DB errors have a clear place to be displayed and are covered by tests.

**Suggested Commits**

- `feat(website): add centralized error panel to TryNow`

---

### Task D1.1b – Implement “Reset playground” behavior

**Description:** Implement a “Reset playground” control that returns the TryNow page to a known-good baseline (schema, DB, and status).

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Add a “Reset playground” button to `TryNow`.
- [x] On click:
  - [x] Reset schema files to `initialFiles`.
  - [x] Recreate or reset the `DbSession` (drop tables or reinstantiate).
  - [x] Clear compile state (`compileStatus`, `compileResult`).
  - [x] Clear DB console state (`queryText`, `queryResult`, `queryError`).
- [x] Ensure resetting does **not** require a full-page reload.

**Acceptance Criteria**

- [x] Clicking “Reset playground” returns schema, DB, and status to a clean initial state.
- [x] Users can always recover from errors by using the reset control.

**Specs as Tests**

- [x] Add tests that:
  - [x] Force compile or DB errors, then click reset and assert:
    - [x] Schema content returns to defaults.
    - [x] Errors and statuses are cleared.

**Definition of Done**

- [x] No unhandled errors bubble to the browser console during normal mis-use.
- [x] Users can always get back to a known-good baseline through the UI.

**Suggested Commits**

- `feat(website): add reset behavior to TryNow playground`

---

### Task D2.1a – Update root README for Alpha playground

**Description:** Document the “Try now” experience at the root README level so visitors know where and how to use it.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Update root `README.md`:
  - [x] Add a short “Try Wesley in your browser” section linking to the playground URL (e.g. `/try`).
  - [x] Explicitly label it as **Alpha** and non-persistent.
  - [x] Briefly describe what the playground shows (file tree, editor, DB console).

**Acceptance Criteria**

- [x] Someone reading the root README can:
  - [x] Find the “Try now” section.
  - [x] Understand that the playground runs entirely in the browser and is Alpha quality.

**Specs as Tests**

- [x] Not automated; rely on docs review. Optionally:
  - [x] Run existing docs link checks to ensure the new link is valid.

**Definition of Done**

- [x] Root README clearly advertises and correctly describes the Alpha playground.

**Suggested Commits**

- `docs: add Alpha browser playground section to root README`

---

### Task D2.1b – Document playground in website README and docs

**Description:** Document the TryNow page and its architecture for developers working in `wesley-website` and the broader docs set.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [x] Update `wesley-website/README.md`:
  - [x] Describe the TryNow page.
  - [x] Outline its architecture (host-browser + PGLite + React UI).
- [x] Optionally add `docs/guides/browser-playground.md` that:
  - [x] Explains how the playground is wired end-to-end.
  - [x] Notes current limitations (schema size, missing features, non-persistence).
- [x] Ensure any new docs are linked from an appropriate docs index page.

**Acceptance Criteria**

- [x] Devs working inside `wesley-website` can understand how TryNow is structured and how to run it.
- [x] Docs mention tradeoffs and limitations of the playground.

**Specs as Tests**

- [x] Not automated; rely on docs review and link checking (existing `docs/ci` tooling).

**Definition of Done**

- [x] Website README and optional guide accurately describe the playground and its constraints.

**Suggested Commits**

- `docs(website): document TryNow playground architecture`

---

### Task D2.2 – CI checks for playground build and basic behavior

**Description:** Ensure CI at least builds the website with the playground and exercises minimal behavior to catch regressions.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [x] Add or update a GitHub Actions workflow (e.g. `website.yml`):
  - [x] Install dependencies for `wesley-website`.
  - [x] Run `pnpm --filter wesley-website build` (or equivalent).
- [x] Add a minimal test command:
  - [x] `pnpm --filter wesley-website test` (Vitest) covering the TryNow page.
- [x] Ensure this workflow runs on PRs touching `wesley-website/**`.

**Acceptance Criteria**

- [x] CI fails if the website no longer builds (e.g., due to PGLite or host-browser changes).
- [x] CI fails if core TryNow tests break.

**Specs as Tests**

- [x] The CI workflow itself is the test: build + test for `wesley-website`.

**Definition of Done**

- [x] CI protects the Alpha playground from obvious regressions.
- [x] The workflow is documented in `docs/ci.md` or `wesley-website/README.md`.

**Suggested Commits**

- `ci(website): add build+test workflow for TryNow playground`

---

## Using This Roadmap

- Work **Feature by Feature**, top to bottom.
- For each **Task**, treat the checklist as your micro-TODOs.
- Use the **Suggested Commits** as a guide to keep history tidy.
- After major chunks, run `node scripts/compute-progress.mjs` if you want the global progress badge to reflect that Alpha is coming into view – but the real “Alpha” here is this browser playground experience.***
