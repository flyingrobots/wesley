# ENSIGN - Wesley Repository Reorganization Milestone

**Status:** In Progress  
**Target Completion:** Q4 2025  
**Primary Objective:** Transform Wesley from a "god module" architecture into a clean, extensible hexagonal system ready for MVP and community contributions

---

## Mission Statement

ENSIGN (Enterprise Software Infrastructure Grid & Node) represents Wesley's transition from prototype to production-ready platform. We will ruthlessly reorganize the codebase to achieve:

1. **Architectural Clarity**: Clean separation of concerns with hexagonal architecture
2. **Community Readiness**: Extensible plugin system for scaffolds, stacks, and generators  
3. **MVP Focus**: Single reference stack (Supabase + Next.js) perfected for multi-tenant SaaS
4. **Production Safety**: Zero-downtime migrations with provable guarantees

```mermaid
mindmap
  root((ENSIGN))
    Architecture
      Hexagonal Design
      Clean Boundaries
      Plugin System
      Domain Purity
    Community
      Scaffolds
      Generators
      Stacks
      Contributors
    MVP Stack
      Supabase
      Next.js
      TypeScript
      Multi-tenant
    Safety
      Zero-downtime
      Provable
      Journaling
      Rollback
```

## Current State Assessment

```mermaid
sankey-beta

"God Module (wesley-core)" as Core

Core,33.3,"CLI Commands"
Core,16.7,"Generators"
Core,16.7,"Scaffolds"
Core,16.7,"Platform Code"
Core,16.7,"Domain Logic"

"CLI Commands",33.3,"Needs Extraction"
"Generators",16.7,"Needs Extraction"
"Scaffolds",16.7,"Needs Extraction"
"Platform Code",16.7,"Needs Extraction"
"Domain Logic",16.7,"Keep in Core"
```

### **Problems We're Solving**
- ❌ **wesley-core has become a "god module"** with CLI, generators, scaffolds, and domain logic mixed together
- ❌ **Platform dependencies leaked into core** (Node.js imports, file system calls)
- ❌ **Nested git repository confusion** created duplicate/conflicting implementations
- ❌ **No clear extension points** for community contributions
- ❌ **Architectural violations** throughout the codebase

### **What's Working Well**
- ✅ **Core GraphQL → IR transformation** is solid
- ✅ **Multi-tenant scaffold** demonstrates full vision potential
- ✅ **Hexagonal architecture foundation** exists but needs extraction
- ✅ **Production safety concepts** (T.A.S.K.S., S.L.A.P.S.) are designed
- ✅ **Zero-downtime migration patterns** are conceptually proven

```mermaid
quadrantChart
    title Current State Analysis
    x-axis Low Effort --> High Effort
    y-axis Low Impact --> High Impact
    quadrant-1 Quick Wins
    quadrant-2 Major Initiatives
    quadrant-3 Fill Ins
    quadrant-4 Time Wasters
    "GraphQL→IR": [0.3, 0.8]
    "Multi-tenant": [0.2, 0.7]
    "Hex Foundation": [0.4, 0.75]
    "T.A.S.K.S.": [0.6, 0.85]
    "S.L.A.P.S.": [0.65, 0.85]
    "Extract CLI": [0.7, 0.9]
    "Extract Generators": [0.8, 0.85]
    "Plugin System": [0.85, 0.95]
```

## Success Criteria

### **Technical Outcomes**
1. **Pure Domain Core**: wesley-core contains only GraphQL parsing and IR generation (zero platform dependencies)
2. **Clean Package Boundaries**: Each package has ONE responsibility with strict dependency rules enforced by CI
3. **Extensible Architecture**: Plugin system allows community to add scaffolds, stacks, and generators
4. **Golden E2E Test**: `wesley generate` runs twice with identical output (idempotency proof)
5. **Production Stack**: Supabase + Next.js + Multi-tenant scaffold works end-to-end

### **Strategic Outcomes**
1. **Developer Experience**: "If you're building SaaS on Supabase, you use Wesley"
2. **Community Growth**: Clear contribution paths for scaffolds and generators
3. **Architectural Confidence**: No more confusion about "where does this code belong?"
4. **MVP Readiness**: Foundation solid enough to build demo applications

## Scope Boundaries

### **In Scope (ENSIGN)**
- Complete package reorganization following Vision.md blueprint
- Single reference stack: wesley-supabase-nextjs with multi-tenant scaffold
- Core orchestration: tasks (DAG planning) + slaps (execution with journaling)
- Architectural enforcement: dependency-cruiser rules, ESLint boundaries
- MVP demo application specification

### **Out of Scope (Future)**
- Multiple stacks (postgres-django, planetscale-astro, etc.)
- Advanced advisor/registry features
- Browser/Deno host adapters
- Complex migration rollback scenarios
- Auto-generated documentation

## Risk Assessment

### **High-Risk Areas**
1. **Generator Extraction**: Moving generators from core may break existing integrations
2. **CLI Refactoring**: Converting from direct calls to DAG execution changes behavior
3. **Import Dependencies**: Complex web of imports may create circular dependencies during transition

### **Mitigation Strategies**
1. **Git Tag Safety Net**: `pre-rewrite` tag allows complete rollback
2. **Incremental Validation**: Test at each phase to catch regressions early  
3. **Golden E2E**: Establish idempotency test BEFORE major changes
4. **Clean Slate Approach**: New packages avoid carrying forward architectural debt

## Timeline & Phases

```mermaid
gantt
    title ENSIGN Implementation Timeline
    dateFormat YYYY-MM-DD
    section Documentation
    ENSIGN Docs Suite       :done, doc1, 2024-01-01, 7d
    
    section Setup & Safety
    Git Safety Tags         :active, setup1, after doc1, 3d
    Audit Nested Git        :setup2, after setup1, 2d
    Create Package Dirs     :setup3, after setup2, 2d
    
    section Generator Extraction
    Move Generators         :gen1, after setup3, 5d
    Clean Interfaces        :gen2, after gen1, 3d
    Remove Non-MVP          :gen3, after gen2, 2d
    
    section Core Purification
    Evict CLI Code          :core1, after gen3, 4d
    Create Host-Node        :core2, after core1, 3d
    Pure CLI Framework      :core3, after core2, 3d
    
    section Scaffold/Stack
    Extract Multi-tenant    :stack1, after core3, 3d
    Create Stack Recipe     :stack2, after stack1, 3d
    Wire Extension System   :stack3, after stack2, 2d
    
    section Orchestration
    Implement Tasks         :orch1, after stack3, 4d
    Implement SLAPS         :orch2, after orch1, 3d
    Convert to DAG          :orch3, after orch2, 3d
    
    section Validation
    CI Boundaries           :val1, after orch3, 3d
    Golden E2E Test         :val2, after val1, 2d
    Regression Testing      :val3, after val2, 2d
```

### **Phase 1: Documentation (Week 1)**
Complete ENSIGN documentation suite in docs/ENSIGN/

### **Phase 2: Setup & Safety (Week 1-2)**
- Create git safety tags
- Audit nested git artifacts  
- Create target package directories

### **Phase 3: Generator Extraction (Week 2-3)**
- Move generators from core to dedicated packages
- Establish clean generator interfaces
- Remove non-MVP generators

### **Phase 4: Core Purification (Week 3-4)**  
- Evict all CLI and Node.js code from wesley-core
- Create host-node with platform adapters
- Establish pure CLI framework

### **Phase 5: Scaffold/Stack System (Week 4-5)**
- Extract multi-tenant scaffold to dedicated package
- Create supabase-nextjs stack recipe
- Wire extensible scaffold system

### **Phase 6: Orchestration (Week 5-6)**
- Implement tasks (DAG planning)
- Implement slaps (execution engine)
- Convert generate command to orchestrated pipeline

### **Phase 7: Boundaries & Validation (Week 6-7)**
- Enforce package boundaries with CI rules
- Establish Golden E2E test
- Comprehensive regression testing

## Success Metrics

```mermaid
pie title Package Distribution Goals
    "Core Domain" : 1
    "Orchestration" : 2
    "Generators" : 2
    "User Interface" : 2
    "Content/Recipes" : 2
```

- **0** Node.js imports in wesley-core (enforced by CI)
- **100%** package boundary compliance (dependency-cruiser)
- **<10** total packages (focused, not fragmented)
- **1** reference stack working end-to-end
- **2x** identical output from repeated generate commands (idempotency)

```mermaid
journey
    title ENSIGN Implementation Journey
    section Pre-Migration
      Current State: 2: Developer
      Document Plan: 3: Developer
      Setup Safety: 4: Developer
    section Core Extraction
      Extract Generators: 5: Developer
      Purify Core: 6: Developer
      Create Adapters: 7: Developer
    section Architecture
      Implement Tasks: 7: Developer
      Implement SLAPS: 8: Developer
      Wire Plugins: 8: Developer
    section Validation
      Golden E2E: 9: Developer
      CI Boundaries: 9: Developer
      MVP Release: 10: Developer, User
```

---

**Next Steps**: See ENSIGN-Architecture.md for detailed package structure and ENSIGN-Migration-Plan.md for execution roadmap.