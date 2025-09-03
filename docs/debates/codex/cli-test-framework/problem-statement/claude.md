# Problem Statement: CLI Test Framework Architecture

**Context**: We're building Wesley CLI and need to decide on testing strategy for command-line functionality.

**Current Situation**: 
- We have a custom bash-based test framework that copies example projects to temp directories
- Tests run CLI commands in isolated environments with proper cleanup
- Works well but is homebrew and potentially fragile

**The Question**: Should we continue with our custom "copy project to temp + run CLI in shell scripts" approach, or adopt a more established testing framework?

**Options Under Consideration**:

1. **Custom Bash Framework** (current approach):
   - Copy example project to `/tmp/wesley-test-$(date +%s)`
   - Set up isolated environment with proper PATH
   - Run actual CLI commands as subprocess calls
   - Assert on exit codes and output
   - Clean up temp directories

2. **Established Testing Frameworks**:
   - **Bats (Bash Automated Testing System)**: Industry standard for bash testing
   - **Pytest with subprocess**: Python-based CLI testing  
   - **Jest with execa**: Node.js-based CLI testing
   - **Go's testing package**: If we want to rewrite CLI in Go
   - **Deno's testing framework**: Modern alternative

**Stakes**: This decision affects maintainability, CI/CD integration, developer onboarding, and long-term project health.

**My Initial Position**: I lean toward keeping our custom framework for now, but with improvements. Here's why...

---

*Initiating debate with Codex to explore this decision thoroughly.*