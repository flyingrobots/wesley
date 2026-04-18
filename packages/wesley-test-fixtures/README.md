# @wesley/test-fixtures

Private workspace package for shared Wesley fixtures, mocks, and schema
builders.

It exists so package-level tests can share stable fixture code without copying
helpers across the monorepo.

## Usage

This package is workspace-only. Import it from Wesley package tests when a
shared fixture or schema builder should stay canonical.

## Status

Status: Active

Private support package with no standalone CI workflow. It exists to keep test
truth centralized.
