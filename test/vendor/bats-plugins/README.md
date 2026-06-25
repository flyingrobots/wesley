# Vendored Bats Plugins

This directory contains the pinned helper plugins used by repo-level Bats
suites. Tests resolve these files with `BATS_LIB_PATH=test/vendor` and
`load 'bats-plugins/<plugin>/load'`.

The vendored set is intentionally small: each plugin keeps its upstream license,
`load.bash`, and the sourced files under `src/`. Upstream test suites, package
metadata, and CI files are not part of Wesley's runtime test harness.

| Plugin | Upstream | Version | Source archive SHA-256 |
| --- | --- | --- | --- |
| `bats-support` | `bats-core/bats-support` | `v0.3.0` | `7815237aafeb42ddcc1b8c698fc5808026d33317d8701d5ec2396e9634e2918f` |
| `bats-assert` | `bats-core/bats-assert` | `v2.2.3` | `749abf9d9cd254bd492a9d22ef6e347bacb3041d2bc95032a38af5293ded3198` |
| `bats-file` | `bats-core/bats-file` | `v0.4.0` | `9b69043241f3af1c2d251f89b4fcafa5df3f05e97b89db18d7c9bdf5731bb27a` |
