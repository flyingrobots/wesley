# Legacy E2E Harness

`run-tests.sh` is a legacy end-to-end script that predates the new fixture layout. It creates a temporary workspace, runs a handful of CLI commands, and (optionally) boots Supabase via Docker if `supabase/config.toml` is present.

Use it manually only:

```bash
bash test/e2e/run-tests.sh
```

> [!warning]
> The script still references the old `example/` directory and may require updates before being considered production-ready.
