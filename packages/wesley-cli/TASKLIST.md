# Wesley CLI Task List

## 🔄 Deferred for Future Releases

### Config File Support
- **Task**: `wesley.config.{js,ts,json}` support
- **Needs**: Config system architecture
- **Priority**: Medium
- **Notes**: Should support env var overrides, project root detection

### STDIN Schema Input  
- **Task**: Support `wesley generate < schema.graphql`
- **Needs**: STDIN detection and piping architecture
- **Priority**: Low
- **Notes**: Useful for CI/CD pipelines

### Watch Mode
- **Task**: `--watch` flag for auto-regeneration
- **Needs**: Chokidar integration + incremental compilation
- **Priority**: High (DX improvement)
- **Notes**: Should debounce file changes, show diff summaries

### Atomic File Writes
- **Task**: De-risk writes with temp files + rename
- **Needs**: File system safety layer
- **Priority**: High (production safety)
- **Notes**: Prevent partial writes, ensure consistency

### Test Runner Implementation
- **Task**: Real pgTAP test execution
- **Needs**: pg_prove integration + database connection management
- **Priority**: High (core functionality)
- **Notes**: Should handle connection failures gracefully

## ✅ Completed
- CLI argument parsing with Commander.js
- JSON output support
- Verbose/debug/quiet flags
- Error handling with proper exit codes
- Missing schema file detection
- Bundle artifact guards