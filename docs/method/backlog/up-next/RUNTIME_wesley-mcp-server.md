# RUNTIME: Wesley Model Context Protocol (MCP) Server

- Lane: `future`
- Legend: `RUNTIME`

## Why (Cool Idea)

Wesley acts as an Assurance Toolchain. AI agents (like Claude or custom internal bots) currently manipulate files blindly. By exposing Wesley via the Model Context Protocol (MCP), we provide an Interactive Assurance Oracle for AI.

An agent could query the schema, ask for relationships, or ask Wesley to "dry run" a proposed SDL change to see if it causes compiler errors or breaks target contracts—all *before* making the change.

## Done looks like

- A new crate `crates/wesley-mcp` (or integrated into the native host).
- Implements the standard MCP JSON-RPC protocol over stdio/HTTP.
- Exposes resources: `wesley://schema/ir`, `wesley://schema/sdl`.
- Exposes tools: `validate_sdl(sdl: string)`, `get_relationships(table: string)`.
- Agents can actively reason about the Wesley graph.

## Repo Evidence

- `crates/wesley-core` (Provides the semantic truth to the MCP layer)
