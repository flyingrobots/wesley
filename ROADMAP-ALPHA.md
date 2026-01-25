# Alpha Roadmap – Wesley in the Browser

> **Goal:** Deliver an in-browser Wesley playground (“Try now”) where users can edit GraphQL schemas, compile them to Postgres migrations, and see the resulting database live via an in-browser Postgres (PGLite) console – **no install required**.
>
> **Scope:** One solid end-to-end experience on the public website (`wesley-website`), backed by `@wesley/host-browser` and PGLite, suitable to call “Alpha”.
>
> **TOTAL ESTIMATE (solo, no AI):** 34–60 hours.

<!-- progress bar -->
```text
PROGRESS
0/343 complete
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%
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

- [ ] Create `wesley-website/src/pages/TryNow.jsx` that renders a minimal placeholder:
  - [ ] Page title (“Wesley Playground (Alpha)”).
  - [ ] Short description of what this page will do.
  - [ ] Placeholder sections for:
    - [ ] “File tree”
    - [ ] “Schema editor”
    - [ ] “Database console”
- [ ] Update `wesley-website/src/App.jsx` to recognize `/try`:
  - [ ] Import `TryNow`.
  - [ ] Add a `path === '/try'` branch in the main render switch.
  - [ ] Ensure the default route remains the landing page.
- [ ] Verify manual navigation:
  - [ ] Run `pnpm dev` in `wesley-website`.
  - [ ] Hit `http://localhost:5173/try` (or configured dev URL).
  - [ ] Confirm the stub page loads without console errors.

**Acceptance Criteria**

- [ ] Navigating directly to `/try` loads the playground shell without a full-page reload.
- [ ] The page clearly indicates that it is an **Alpha** playground.
- [ ] No regressions to `/` or `/docs` routing.

**Specs as Tests**

- [ ] Add a React test (e.g. `wesley-website/src/App.test.jsx`) that:
  - [ ] Renders `<App />` with a mocked `window.location.pathname = '/try'`.
  - [ ] Asserts that text like “Playground” or “Try Wesley in your browser” is visible.

**Definition of Done**

- [ ] `/try` route exists and is reachable in dev mode.
- [ ] Basic tests for routing to `/try` are passing.
- [ ] No warnings or errors in browser console when loading `/try`.

**Suggested Commits**

- `feat(website): add /try route and TryNow shell page`

---

### Task A1.2 – Add “Try now” entry points from landing page

**Description:** Surface the playground from the homepage hero and, optionally, header navigation.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Update `wesley-website/src/components/HeroBullets.jsx`:
  - [ ] Add a “Try now” button next to “Get started” / “Docs”.
  - [ ] Wire its click handler to call `onNavigate('/try')` using the existing `App` navigation hook.
- [ ] Optionally, update `HeaderSearch` or navbar to include a “Try now” link:
  - [ ] Clicking “Try now” should call `onNavigate('/try')` (no full page reload).
- [ ] Visually check:
  - [ ] “Try now” appears in the hero.
  - [ ] Button styling is consistent with existing buttons.

**Acceptance Criteria**

- [ ] From the landing page, a prominent “Try now” action exists.
- [ ] Clicking “Try now” navigates to `/try` via SPA navigation (no hard reload).
- [ ] Navigation back to `/` and `/docs` still works.

**Specs as Tests**

- [ ] Extend/adjust hero tests (if present) or add a new test:
  - [ ] Render `HeroBullets` with a mock `onNavigate`.
  - [ ] Simulate click on “Try now”.
  - [ ] Assert `onNavigate` was called with `'/try'`.

**Definition of Done**

- [ ] “Try now” entry points are discoverable and functional.
- [ ] Tests for hero navigation are passing.
- [ ] No eslint/TypeScript/Vite warnings stemming from these changes.

**Suggested Commits**

- `feat(website): add Try now CTA to hero`

---

### Task A2.1a – Define schema workspace state

**Description:** Set up the initial in-memory schema workspace and active file selection, without worrying yet about the precise file tree UI layout.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] In `TryNow.jsx`, define an `initialFiles` object with at least one GraphQL schema (e.g., `schema.graphql`).
- [ ] Add React state: `const [files, setFiles] = useState(initialFiles);`.
- [ ] Add React state: `const [activePath, setActivePath] = useState('schema.graphql');`.
- [ ] Ensure the initial active file exists in `initialFiles`.
- [ ] Log or visually surface the current active file name somewhere on the page for debugging.

**Acceptance Criteria**

- [ ] On first load, there is at least one default GraphQL schema file in memory.
- [ ] `activePath` is set to a valid key from `files` (e.g. `schema.graphql`).

**Specs as Tests**

- [ ] Add a component/unit test (for `TryNow` or an extracted workspace hook/component) that:
  - [ ] Asserts the default `activePath` is `schema.graphql` (or whichever you choose).
  - [ ] Asserts `files[activePath]` is a non-empty string.

**Definition of Done**

- [ ] Workspace state exists and initializes correctly.
- [ ] Tests verify initial active file and content.

**Suggested Commits**

- `feat(website): initialize TryNow schema workspace state`

---

### Task A2.1b – Render schema file tree UI

**Description:** Render a clickable file list/tree that reflects the in-memory workspace and updates `activePath`.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Use Mantine components (e.g., `NavLink`, `Stack`, or `List`) to render the file names from `Object.keys(files)`.
- [ ] Visually distinguish the active file (bold, highlight, or icon).
- [ ] On click, update `activePath` to the clicked file key.
- [ ] Ensure the file list is placed on the left side of the layout and reserves space for editor and DB console.

**Acceptance Criteria**

- [ ] The playground shows a visible list of schema files, including the default.
- [ ] Clicking a different file updates the active selection (both visually and in state).
- [ ] The file tree layout does not overlap the editor or DB console area.

**Specs as Tests**

- [ ] Extend the workspace component test:
  - [ ] Verify that all keys in `files` appear in the rendered file list.
  - [ ] Simulate a click on a non-default file and assert `activePath` changes accordingly (through visible selection).

**Definition of Done**

- [ ] File tree UI is functional and correctly updates `activePath`.
- [ ] Tests cover clicking and selection.

**Suggested Commits**

- `feat(website): render schema file tree for TryNow workspace`

---

### Task A2.1c – Harden workspace behavior and tests

**Description:** Add any remaining guards and tests to ensure workspace behavior is stable (no runtime errors when switching files).

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Add defensive checks so that if `activePath` points to a missing file key, it falls back to a default (e.g. first key in `files`).
- [ ] Ensure workspace still behaves correctly if additional files are added in future (e.g. from presets).
- [ ] Write or extend tests to:
  - [ ] Cover switching between multiple files.
  - [ ] Handle the case where a missing key is encountered.

**Acceptance Criteria**

- [ ] Switching between files never throws runtime errors related to missing keys.
- [ ] Future additions to `files` do not break the workspace behavior.

**Specs as Tests**

- [ ] Add tests to simulate:
  - [ ] More than two files in the workspace.
  - [ ] An invalid `activePath` being corrected to a safe default.

**Definition of Done**

- [ ] Workspace behavior is well-covered by tests.
- [ ] No runtime errors occur when switching files under normal use.

**Suggested Commits**

- `test(website): harden TryNow schema workspace behavior`

---

### Task A2.2a – Wire basic schema editor to workspace

**Description:** Provide a basic text editor bound to the active schema file using simple Mantine components.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] In `TryNow.jsx`, render a text editing component (Mantine `Textarea` or `Code`) for the active file.
- [ ] Use `files[activePath]` as the editor value.
- [ ] On change, update `setFiles` so that the in-memory `files` reflects edits for `activePath`.
- [ ] Ensure the editor is placed to the right of the file tree and visible at typical viewport sizes.

**Acceptance Criteria**

- [ ] Editing text in the editor updates the corresponding entry in `files`.
- [ ] Switching active files updates the editor content immediately.

**Specs as Tests**

- [ ] Add or extend tests to:
  - [ ] Simulate typing into the editor and assert the in-memory `files[activePath]` has changed (via component behavior).
  - [ ] Switch active files and assert the editor shows the new file content.

**Definition of Done**

- [ ] Editor is fully wired to workspace state for basic text editing.
- [ ] Tests cover editing and switching files.

**Suggested Commits**

- `feat(website): add basic schema editor bound to TryNow workspace`

---

### Task A2.2b – Improve editor layout and UX

**Description:** Refine the editor layout and behavior for a more IDE-like experience (without yet adding heavy editor dependencies).

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Adjust layout (flex/grid) so editor and file tree resize with the window and remain usable on smaller screens.
- [ ] Ensure the editor scrolls independently of the file tree and DB console.
- [ ] Consider adding a monospace font and basic styling for readability.

**Acceptance Criteria**

- [ ] The editor is readable and usable alongside the file tree and DB console.
- [ ] Resizing the browser window keeps the editor usable (no overflow hiding the editor).

**Specs as Tests**

- [ ] Visual/manual QA:
  - [ ] Confirm layout works at common viewport sizes (e.g., 1024×768, 1440×900).

**Definition of Done**

- [ ] Editor layout is pleasant to use and doesn’t break the surrounding layout.

**Suggested Commits**

- `style(website): refine TryNow editor layout and UX`

---

### Task A2.2c – Optional: upgrade editor (Monaco/CodeMirror) and tests

**Description:** Optionally swap the simple editor for a richer editor (e.g., Monaco) with GraphQL syntax highlighting, and adjust tests accordingly.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [ ] Add a dependency such as `@monaco-editor/react` if you choose to upgrade.
- [ ] Replace the simple editor component with Monaco/CodeMirror in `TryNow.jsx`.
- [ ] Configure language mode for GraphQL if feasible.
- [ ] Ensure the editor still reads/writes `files[activePath]`.
- [ ] Update tests to work with the new editor component (mock or shallow render as needed).

**Acceptance Criteria**

- [ ] Rich editor renders without runtime errors and maintains the same state semantics.
- [ ] Syntax highlighting is active (if configured) or at least the editor remains functional and accessible.

**Specs as Tests**

- [ ] Maintain existing editor behavior tests (edit + switch file).
- [ ] Optionally add a snapshot test to guard against major layout regressions.

**Definition of Done**

- [ ] Editor upgrade (if pursued) is fully integrated and tested.
- [ ] No regressions in workspace behavior after the swap.

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

- [ ] Create/extend `packages/wesley-host-browser/src/index.mjs` to export a new function:

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

- [ ] Define the function signature:

  ```js
  /**
   * @param {Record<string, string>} files - GraphQL SDL files keyed by path.
   * @returns {Promise<BrowserCompileResult>}
   */
  export async function compileSchemaInBrowser(files) { /* impl later */ }
  ```

- [ ] Document the API in `packages/wesley-host-browser/README.md` under an “Alpha Playground” section.

**Acceptance Criteria**

- [ ] A clear JSDoc’d API exists for `compileSchemaInBrowser(files)`.
- [ ] The return type covers `ok`, `tables`, `sqlMigrations`, `warnings`, `errors`.
- [ ] README documents how this API is intended to be used by web UIs.

**Specs as Tests**

- [ ] Add a small unit test (Node-based) that:
  - [ ] Imports `compileSchemaInBrowser` (can be a stub initially).
  - [ ] Asserts that calling it with `{ 'schema.graphql': 'type Query { ping: String }' }` returns a `Promise` and a shape matching `BrowserCompileResult` (even if fields are placeholders).

**Definition of Done**

- [ ] API shape is defined and exported.
- [ ] README updated with a short usage snippet.
- [ ] A basic test enforces the shape (so refactors don’t silently break the playground).

**Suggested Commits**

- `feat(host-browser): define compileSchemaInBrowser API contract`

---

### Task B1.2a – Sanitize inputs and join SDL files

**Description:** Implement the input handling portion of `compileSchemaInBrowser(files)`, validating the `files` object and producing a single combined SDL string.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [ ] In `compileSchemaInBrowser`, assert that `files` is a plain object mapping string paths to string contents.
- [ ] Normalize line endings if needed and join multiple SDL files into a single SDL string (or prepare a structure compatible with the parser).
- [ ] Reuse `sanitizeGraphQL` (or similar) to enforce size limits and strip BOM/null bytes.
- [ ] Decide on and implement error behavior for invalid inputs (e.g., throw a typed error or return `{ ok: false, errors: [...] }`).

**Acceptance Criteria**

- [ ] Calling `compileSchemaInBrowser` with a valid `files` object produces a combined SDL string ready for parsing.
- [ ] Invalid input (non-object or non-string values) is handled deterministically (either well-typed error or `{ ok: false }`).

**Specs as Tests**

- [ ] Add unit tests that:
  - [ ] Pass a minimal valid `files` object and assert the combined SDL includes all file contents.
  - [ ] Pass invalid inputs (e.g., `null`, arrays, non-string values) and assert the chosen error behavior occurs.

**Definition of Done**

- [ ] Input validation and SDL combination are implemented and tested.

**Suggested Commits**

- `feat(host-browser): add multi-file SDL handling for compileSchemaInBrowser`

---

### Task B1.2b – Wire `createBrowserRuntime` and `GenerationPipeline`

**Description:** Connect the combined SDL string to `GenerationPipeline` using the browser runtime, without yet focusing on full migration generation.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [ ] Import and reuse `createBrowserRuntime()` from `@wesley/host-browser`.
- [ ] Instantiate `GenerationPipeline` with:
  - [ ] `parser: rt.parsers.graphql`.
  - [ ] A placeholder or minimal diff engine compatible with browser constraints.
  - [ ] `fileSystem` undefined or a memory-backed FS as appropriate.
  - [ ] `logger` from the browser runtime.
- [ ] Call `pipeline.execute(combinedSDL, { sha: 'browser-alpha' })` and capture the output bundle.

**Acceptance Criteria**

- [ ] For a valid schema, `pipeline.execute` completes without throwing and returns a bundle with a schema representation.
- [ ] For an invalid schema, errors are captured and can be surfaced later.

**Specs as Tests**

- [ ] Add tests (Node + JSDOM or a small browser-smoke harness) that:
  - [ ] Run `compileSchemaInBrowser` with a valid example schema and assert that the internal pipeline step completes.
  - [ ] Run with an invalid schema and assert that the error path is triggered.

**Definition of Done**

- [ ] Browser-based pipeline wiring is in place and passes basic smoke tests.

**Suggested Commits**

- `feat(host-browser): wire createBrowserRuntime and GenerationPipeline in compileSchemaInBrowser`

---

### Task B1.2c – Generate SQL migrations and map results

**Description:** Replace the placeholder diff/generator with logic that produces SQL migrations from the pipeline and maps the bundle into `BrowserCompileResult`.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [ ] Implement or integrate a diff engine that can compute migration steps between previous and current schemas (for the Alpha demo, a simple “from empty” diff is acceptable).
- [ ] Implement or integrate a generator that converts diff steps into SQL migration statements.
- [ ] Count tables (e.g., number of `@wes_table` types) and set `tables` in the result.
- [ ] Populate `BrowserCompileResult` fields:
  - [ ] `ok` based on pipeline/diff success.
  - [ ] `tables` count.
  - [ ] `sqlMigrations` array.
  - [ ] `warnings` (even if initially empty).
  - [ ] `errors` for failures, with messages and optional locations.
- [ ] Ensure no Node-only imports are used (pure ESM + Web APIs).

**Acceptance Criteria**

- [ ] For a valid schema, `compileSchemaInBrowser` returns `{ ok: true, tables > 0, sqlMigrations.length >= 1 }`.
- [ ] For an invalid schema, it returns `{ ok: false, errors: [...] }` without uncaught exceptions.

**Specs as Tests**

- [ ] Add or extend tests to:
  - [ ] Assert that a known example schema yields non-empty `sqlMigrations` and a sensible `tables` count.
  - [ ] Assert that a broken schema yields `ok === false` and at least one error entry.

**Definition of Done**

- [ ] `compileSchemaInBrowser` produces real SQL migrations for the canonical example schema and reports errors correctly.

**Suggested Commits**

- `feat(host-browser): generate SQL migrations in compileSchemaInBrowser`
- `test(host-browser): cover success and failure cases for compileSchemaInBrowser`

---

### Task B1.3a – Add compile state and button in TryNow

**Description:** Add minimal compile state to the TryNow UI and a “Compile & apply” button that calls the engine and stores the result.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] In `TryNow.jsx`, add state:
  - [ ] `compileStatus` (`idle` | `running` | `success` | `error`).
  - [ ] `compileResult` (last `BrowserCompileResult`).
- [ ] Add a “Compile & apply” button:
  - [ ] Disable the button while `compileStatus === 'running'`.
- [ ] Implement `onCompile` handler:
  - [ ] Set `compileStatus = 'running'`.
  - [ ] Call `compileSchemaInBrowser(files)`.
  - [ ] Store the result in `compileResult`.
  - [ ] Set `compileStatus` to `'success'` or `'error'` based on `ok`.
- [ ] Render a simple summary (e.g., `tables` and number of migrations) when `compileResult` is present.

**Acceptance Criteria**

- [ ] Clicking “Compile & apply” triggers a call to `compileSchemaInBrowser(files)`.
- [ ] The button disables while a compile is in flight.
- [ ] On success, a basic summary is visible; on failure, a simple error indicator is shown.

**Specs as Tests**

- [ ] Add a test that:
  - [ ] Renders `TryNow` with `compileSchemaInBrowser` mocked.
  - [ ] Simulates clicking “Compile & apply”.
  - [ ] Asserts that the mock was called and that summary text appears for a mocked success.

**Definition of Done**

- [ ] TryNow page can trigger compilation and display a basic status/summary.

**Suggested Commits**

- `feat(website): add compile button and state to TryNow`

---

### Task B1.3b – Display detailed errors and add UI tests

**Description:** Improve the compile UI to show detailed error messages and add tests for both success and failure flows.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Expand the compile summary UI to:
  - [ ] Show `tables` and `sqlMigrations.length` on success.
  - [ ] Render human-readable error messages from `compileResult.errors` on failure.
- [ ] Ensure no stack traces leak to the user; only friendly messages.
- [ ] Extend tests to:
  - [ ] Cover a mocked failure result and assert error messages render.
  - [ ] Confirm there are no unhandled promise rejections in the console during tests.

**Acceptance Criteria**

- [ ] Clicking “Compile & apply” with invalid schema surfaces clear errors in the UI.
- [ ] No console stacktraces are shown to end users (errors are handled and displayed cleanly).

**Specs as Tests**

- [ ] Tests verify both success and failure paths end up with the correct UI output.

**Definition of Done**

- [ ] Compile errors are displayed clearly and are covered by tests.

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

- [ ] Add PGLite dependency to `wesley-website/package.json` (e.g. `@electric-sql/pglite` or chosen library).
- [ ] Create `wesley-website/src/db/pglite.ts` (or `.mjs`) that exports the types (or JSDoc interface):

  ```ts
  export type DbSession = {
    reset(): Promise<void>
    applyMigrations(sql: string[]): Promise<void>
    query(sql: string): Promise<{ rows: any[]; fields: string[] }>
  }
  export async function createDbSession(): Promise<DbSession>
  ```

- [ ] Implement `createDbSession`:
  - [ ] Instantiate PGLite.
  - [ ] Implement a no-op `reset()` initially.
  - [ ] Implement a minimal `query()` that runs SQL and returns `{ rows, fields }`.
- [ ] Ensure `DbSession` is the only surface `TryNow` and related components depend on (so tests can swap in fakes).

**Acceptance Criteria**

- [ ] `createDbSession` can be imported from `wesley-website/src/db/pglite` and used to execute a basic `SELECT 1` query in a dev sandbox.

**Specs as Tests**

- [ ] Add a small integration/unit test (Node or browser-driven) that:
  - [ ] Calls `createDbSession()`.
  - [ ] Executes a trivial query (e.g. `SELECT 1`) and asserts on the returned rows/fields.

**Definition of Done**

- [ ] PGLite builds with Vite and a minimal `DbSession` is in place.
- [ ] `DbSession` is exported in a way that tests and other hosts can implement compatible fakes/adapters.

**Suggested Commits**

- `feat(website): add PGLite dependency and minimal DbSession`

---

### Task C1.1d – Define `FakeDbSession` for tests

**Description:** Create a lightweight in-memory `FakeDbSession` implementation for tests so React components can be exercised without a real PGLite instance.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Add `wesley-website/src/test/FakeDbSession.ts` (or similar) that implements the `DbSession` interface:
  - [ ] Track `reset()` calls, applied migrations, and executed queries in memory.
  - [ ] Return canned `{ rows, fields }` data from `query()` suitable for UI tests.
- [ ] Ensure `FakeDbSession` can be constructed with optional initial data (e.g., initial tables or rows) for richer scenarios.
- [ ] Use `FakeDbSession` in TryNow tests by:
  - [ ] Mocking `createDbSession` to return a `FakeDbSession` instance, or
  - [ ] Passing it via a context/provider if you introduce one.

**Acceptance Criteria**

- [ ] TryNow tests do not require a real PGLite instance; they can rely on `FakeDbSession`.
- [ ] Tests can assert on applied migrations and executed queries via the fake.

**Specs as Tests**

- [ ] Add tests that:
  - [ ] Use `FakeDbSession` with TryNow and assert that `applyMigrations` and `query` were called with expected SQL.
  - [ ] Verify that error paths can be simulated by having `FakeDbSession` throw or return error-like results.

**Definition of Done**

- [ ] `FakeDbSession` exists, matches the `DbSession` interface, and is used in TryNow tests.

**Suggested Commits**

- `test(website): add FakeDbSession for TryNow tests`

---

### Task C1.1b – Implement `applyMigrations` and `reset`

**Description:** Flesh out `DbSession.applyMigrations` and `reset` to support applying a list of SQL migrations and returning to a clean state.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Implement `applyMigrations(sql: string[])`:
  - [ ] Execute each migration inside a transaction where possible.
  - [ ] Surface any errors with meaningful messages.
- [ ] Implement `reset()`:
  - [ ] Decide on reset strategy (e.g., drop and recreate database/schema, or reinstantiate PGLite).
  - [ ] Ensure subsequent queries run against a clean state.

**Acceptance Criteria**

- [ ] Applying a simple `CREATE TABLE` + `INSERT` + `SELECT` sequence via `applyMigrations` and `query` works end-to-end.
- [ ] Calling `reset()` clears previous schema/data so migrations can be reapplied cleanly.

**Specs as Tests**

- [ ] Extend tests to:
  - [ ] Apply a migration that creates a table.
  - [ ] Insert and select data.
  - [ ] Call `reset()` and confirm the schema/data is cleared.

**Definition of Done**

- [ ] `applyMigrations` and `reset` behave predictably and are covered by tests.

**Suggested Commits**

- `feat(website): add applyMigrations and reset behavior to DbSession`
- `test(website): cover DbSession migrations and reset`

---

### Task C1.1c – Harden `query` and limit result size

**Description:** Finalize the `query` method to be safe and convenient for the playground UI.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Ensure `query(sql)`:
  - [ ] Limits result size (e.g., first 100 rows).
  - [ ] Returns field metadata friendly for table rendering.
- [ ] Handle and wrap errors into readable messages (do not throw raw PGLite internals at the UI).
- [ ] Add JSDoc comments to `DbSession` and `query`.

**Acceptance Criteria**

- [ ] `query` returns a predictable `{ rows, fields }` shape even for large result sets (truncated appropriately).
- [ ] Errors are represented as clean messages suitable for UI display.

**Specs as Tests**

- [ ] Tests that:
  - [ ] Insert >100 rows and confirm that `query` truncates results.
  - [ ] Run invalid SQL and assert on the error message shape.

**Definition of Done**

- [ ] `DbSession` is stable and documented, with `query` safe for the playground UI.

**Suggested Commits**

- `feat(website): harden DbSession query behavior`

---

### Task C1.2a – Initialize `DbSession` in TryNow

**Description:** Wire the PGLite-backed `DbSession` into the TryNow page and expose an optional “Reset database” control.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] In `TryNow.jsx`, add state for the DB session: `const [dbSession, setDbSession] = useState<DbSession | null>(null);`.
- [ ] On mount, call `createDbSession()` and store the result in `dbSession`.
- [ ] Add a “Reset database” button that calls `dbSession.reset()` when clicked.
- [ ] Handle the case where `dbSession` is not yet ready (disable DB-related controls until initialized).

**Acceptance Criteria**

- [ ] On loading `/try`, a `DbSession` is created and stored in state.
- [ ] Clicking “Reset database” successfully calls `reset()` without errors.

**Specs as Tests**

- [ ] Add tests (with `createDbSession` mocked) that:
  - [ ] Confirm `createDbSession` is called on mount.
  - [ ] Confirm clicking “Reset database” invokes `reset()` on the mocked session.

**Definition of Done**

- [ ] TryNow page has a working DB session stored in state and a reset control.

**Suggested Commits**

- `feat(website): initialize PGLite DbSession in TryNow`

---

### Task C1.2b – Apply compile results to PGLite on success

**Description:** When compilation succeeds, apply `sqlMigrations` from `compileSchemaInBrowser` to the active `DbSession` and surface success/failure to the user.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Extend `onCompile` handler in `TryNow.jsx`:
  - [ ] After a successful compile, call `dbSession.applyMigrations(result.sqlMigrations)` (if `dbSession` is present).
  - [ ] Catch and surface any migration errors in the error panel.
- [ ] Add a small UI cue for successful migration application (e.g. “Database schema updated” message).

**Acceptance Criteria**

- [ ] After a successful compile, migrations are applied to PGLite and queries see the new tables.
- [ ] If migrations fail, a clear error message is displayed, and the user can try again after fixing the schema.

**Specs as Tests**

- [ ] Add tests (with `DbSession` mocked) that:
  - [ ] Confirm `applyMigrations` is called with the `sqlMigrations` array on compile success.
  - [ ] Confirm compile failures **do not** call `applyMigrations`.

**Definition of Done**

- [ ] Compile success leads to PGLite updates; failures are safely handled and reported.

**Suggested Commits**

- `feat(website): apply compile migrations to PGLite session in TryNow`

---

### Task C2.1a – Basic database console UI and wiring

**Description:** Build a simple DB console panel in TryNow with SQL input, run button, and a basic text/JSON output.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [ ] In `TryNow.jsx`, add:
  - [ ] `queryText` state (SQL input).
  - [ ] `queryResult` state (`{ rows, fields }` or `null`).
  - [ ] `queryError` state (string or error object or `null`).
- [ ] Render a “Database” panel:
  - [ ] Textarea or small editor for SQL queries.
  - [ ] “Run query” button.
- [ ] Implement `onRunQuery` handler:
  - [ ] Call `dbSession.query(queryText)`.
  - [ ] Store result in `queryResult` or error in `queryError`.
- [ ] For now, render output as simple JSON or plain text.

**Acceptance Criteria**

- [ ] With a simple schema applied, users can run basic `SELECT` queries and see results in the console.
- [ ] Invalid SQL produces a human-readable error message in the console area.

**Specs as Tests**

- [ ] Add tests (with `DbSession` mocked) that:
  - [ ] Simulate entering SQL and clicking “Run query”.
  - [ ] Assert that `dbSession.query` was called.
  - [ ] Assert that results or errors are reflected in the rendered output.

**Definition of Done**

- [ ] The DB console is wired enough to run queries and show raw results/errors.

**Suggested Commits**

- `feat(website): add basic DB console to TryNow`

---

### Task C2.1b – Table view and console polish

**Description:** Upgrade the DB console to render results in a table and improve error display and UX.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Replace or augment the raw JSON output with a Mantine `Table` using `queryResult.rows` and `queryResult.fields`.
- [ ] Add an error banner or callout when `queryError` is non-null.
- [ ] Ensure styling matches the rest of the TryNow page and handles long results gracefully (scrolling).

**Acceptance Criteria**

- [ ] Query results are displayed in a readable table format.
- [ ] Errors are clearly highlighted and contained to the DB console area.

**Specs as Tests**

- [ ] Extend console tests to:
  - [ ] Assert that table rows/columns appear for a mocked `queryResult`.
  - [ ] Assert that the error banner appears for a mocked `queryError`.

**Definition of Done**

- [ ] Database console is usable, readable, and visually integrated with the playground.

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

- [ ] Add a “Status / Errors” panel area in `TryNow`.
- [ ] Render compile errors (from `compileResult.errors`) as readable messages.
- [ ] Render DB migration/query errors (from `queryError` or migration failures) in the same panel.
- [ ] Ensure the panel layout does not interfere with the editor or DB console.

**Acceptance Criteria**

- [ ] When compile or DB operations fail, the error panel surfaces the failure in human-friendly language.
- [ ] No raw stack traces are shown directly to the user.

**Specs as Tests**

- [ ] Add tests that:
  - [ ] Inject a mocked compile failure and assert that an error message appears in the panel.
  - [ ] Inject a mocked DB error and assert that it appears in the panel.

**Definition of Done**

- [ ] All compile/DB errors have a clear place to be displayed and are covered by tests.

**Suggested Commits**

- `feat(website): add centralized error panel to TryNow`

---

### Task D1.1b – Implement “Reset playground” behavior

**Description:** Implement a “Reset playground” control that returns the TryNow page to a known-good baseline (schema, DB, and status).

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Add a “Reset playground” button to `TryNow`.
- [ ] On click:
  - [ ] Reset schema files to `initialFiles`.
  - [ ] Recreate or reset the `DbSession` (drop tables or reinstantiate).
  - [ ] Clear compile state (`compileStatus`, `compileResult`).
  - [ ] Clear DB console state (`queryText`, `queryResult`, `queryError`).
- [ ] Ensure resetting does **not** require a full page reload.

**Acceptance Criteria**

- [ ] Clicking “Reset playground” returns schema, DB, and status to a clean initial state.
- [ ] Users can always recover from errors by using the reset control.

**Specs as Tests**

- [ ] Add tests that:
  - [ ] Force compile or DB errors, then click reset and assert:
    - [ ] Schema content returns to defaults.
    - [ ] Errors and statuses are cleared.

**Definition of Done**

- [ ] No unhandled errors bubble to the browser console during normal mis-use.
- [ ] Users can always get back to a known-good baseline through the UI.

**Suggested Commits**

- `feat(website): add reset behavior to TryNow playground`

---

### Task D2.1a – Update root README for Alpha playground

**Description:** Document the “Try now” experience at the root README level so visitors know where and how to use it.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Update root `README.md`:
  - [ ] Add a short “Try Wesley in your browser” section linking to the playground URL (e.g. `/try`).
  - [ ] Explicitly label it as **Alpha** and non-persistent.
  - [ ] Briefly describe what the playground shows (file tree, editor, DB console).

**Acceptance Criteria**

- [ ] Someone reading the root README can:
  - [ ] Find the “Try now” section.
  - [ ] Understand that the playground runs entirely in the browser and is Alpha quality.

**Specs as Tests**

- [ ] Not automated; rely on docs review. Optionally:
  - [ ] Run existing docs link checks to ensure the new link is valid.

**Definition of Done**

- [ ] Root README clearly advertises and correctly describes the Alpha playground.

**Suggested Commits**

- `docs: add Alpha browser playground section to root README`

---

### Task D2.1b – Document playground in website README and docs

**Description:** Document the TryNow page and its architecture for developers working in `wesley-website` and the broader docs set.

**Estimated effort (solo, no AI):** 1–2 hours.

#### Checklist

- [ ] Update `wesley-website/README.md`:
  - [ ] Describe the TryNow page.
  - [ ] Outline its architecture (host-browser + PGLite + React UI).
- [ ] Optionally add `docs/guides/browser-playground.md` that:
  - [ ] Explains how the playground is wired end-to-end.
  - [ ] Notes current limitations (schema size, missing features, non-persistence).
- [ ] Ensure any new docs are linked from an appropriate docs index page.

**Acceptance Criteria**

- [ ] Devs working inside `wesley-website` can understand how TryNow is structured and how to run it.
- [ ] Docs mention tradeoffs and limitations of the playground.

**Specs as Tests**

- [ ] Not automated; rely on docs review and link checking (existing `docs/ci` tooling).

**Definition of Done**

- [ ] Website README and optional guide accurately describe the playground and its constraints.

**Suggested Commits**

- `docs(website): document TryNow playground architecture`

---

### Task D2.2 – CI checks for playground build and basic behavior

**Description:** Ensure CI at least builds the website with the playground and exercises minimal behavior to catch regressions.

**Estimated effort (solo, no AI):** 2–3 hours.

#### Checklist

- [ ] Add or update a GitHub Actions workflow (e.g. `website.yml`):
  - [ ] Install dependencies for `wesley-website`.
  - [ ] Run `pnpm --filter wesley-website build` (or equivalent).
- [ ] Add a minimal test command:
  - [ ] `pnpm --filter wesley-website test` (Vitest) covering the TryNow page.
- [ ] Ensure this workflow runs on PRs touching `wesley-website/**`.

**Acceptance Criteria**

- [ ] CI fails if the website no longer builds (e.g., due to PGLite or host-browser changes).
- [ ] CI fails if core TryNow tests break.

**Specs as Tests**

- [ ] The CI workflow itself is the test: build + test for `wesley-website`.

**Definition of Done**

- [ ] CI protects the Alpha playground from obvious regressions.
- [ ] The workflow is documented in `docs/ci.md` or `wesley-website/README.md`.

**Suggested Commits**

- `ci(website): add build+test workflow for TryNow playground`

---

## Using This Roadmap

- Work **Feature by Feature**, top to bottom.
- For each **Task**, treat the checklist as your micro-TODOs.
- Use the **Suggested Commits** as a guide to keep history tidy.
- After major chunks, run `node scripts/compute-progress.mjs` if you want the global progress badge to reflect that Alpha is coming into view – but the real “Alpha” here is this browser playground experience.***
