# RUNTIME command auto-discovery regression coverage

The command auto-discovery refactor landed, but the old root task file still
flagged missing regression protection.

Done when:

- a regression test proves a new command file can be discovered without editing a hand-maintained import list
- helper or ignored files stay excluded intentionally
- command registration behavior is no longer protected only by luck
