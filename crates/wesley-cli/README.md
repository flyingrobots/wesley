# wesley-cli

`wesley-cli` installs the native `wesley` command. The CLI exposes Wesley's
Rust compiler kernel, schema inspection commands, schema diffing, and Rust or
TypeScript emitter commands.

Use `wesley normalize-sdl --schema <path>` to print the deterministic,
extension-folded SDL view produced from Rust compiler facts.

The crate is named `wesley-cli` because the bare `wesley` crate name is already
occupied on crates.io.

See the repository
[README](https://github.com/flyingrobots/wesley#readme) and
[architecture guide](https://github.com/flyingrobots/wesley/blob/main/docs/ARCHITECTURE.md)
for the full project context.
