# wesley-cli

`wesley-cli` installs the native `wesley` command. The CLI exposes Wesley's
Rust compiler kernel, schema inspection commands, schema diffing, and Rust or
TypeScript emitter commands.

Use `wesley doctor` to run narrow Rust-native health checks for the native CLI,
Rust lowerer, normalized SDL hash evidence, and Rust emitter crates. It does
not inspect legacy Node config, plugins, or package state.

Use `wesley normalize-sdl --schema <path>` to print the deterministic,
extension-folded SDL view produced from Rust compiler facts, or
`wesley normalize-sdl --schema <path> --hash` to print its SHA-256 evidence
hash.

Use `wesley emit rust --schema <path> --out <path> --metadata-out <path>` or
`wesley emit typescript --schema <path> --out <path> --metadata-out <path>` to
write a deterministic sidecar with schema hash, generator identity, generator
version, and `rust-native` execution mode.

The crate is named `wesley-cli` because the bare `wesley` crate name is already
occupied on crates.io.

See the repository
[README](https://github.com/flyingrobots/wesley#readme) and
[architecture guide](https://github.com/flyingrobots/wesley/blob/main/docs/ARCHITECTURE.md)
for the full project context.
