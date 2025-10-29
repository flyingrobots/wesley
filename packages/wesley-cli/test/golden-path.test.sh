#!/usr/bin/env bash

# Golden Path Test - End-to-End compilation with realistic schema
# Tests the complete Wesley compilation pipeline with a real-world schema

set -euo pipefail

# Test framework functions
source "$(dirname "$0")/test-framework.sh"

# Test workspace
WORKSPACE="/tmp/wesley-golden-$(date +%s)"
CLI_PATH="$(pwd)/wesley.mjs"

setup_test_workspace() {
    mkdir -p "$WORKSPACE"
    cd "$WORKSPACE"
    echo "Golden path test workspace: $WORKSPACE"
}

cleanup_test_workspace() {
    if [[ -d "$WORKSPACE" ]]; then
        rm -rf "$WORKSPACE"
    fi
}

create_realistic_schema() {
    cat > schema.graphql << 'EOF'
"""
Multi-tenant SaaS application schema with:
- User management with organizations 
- Project/task management
- Audit logging
- Row-level security
"""

type User @table {
  id: ID! @pk @uid("tbl:user")
  email: String! @unique
  name: String!
  avatarUrl: String
  organizationId: ID! @fk(ref: "Organization.id")
  createdAt: DateTime! @default(value: "now()")
  updatedAt: DateTime! @default(value: "now()")
  
  # Relationships
  organization: Organization
  projects: [Project!]
  tasks: [Task!]
  auditLogs: [AuditLog!]
}

type Organization @table @rls(enable: true) {
  id: ID! @pk @uid("tbl:org")
  name: String! @unique
  slug: String! @unique @check(expr: "slug ~ '^[a-z0-9-]+$'")
  settings: JSON
  createdAt: DateTime! @default(value: "now()")
  
  # Relationships  
  users: [User!]
  projects: [Project!]
}

type Project @table @rls(enable: true) @tenant(by: "organizationId") {
  id: ID! @pk @uid("tbl:project")
  name: String!
  description: String
  status: ProjectStatus! @default(value: "ACTIVE")
  organizationId: ID! @fk(ref: "Organization.id")
  ownerId: ID! @fk(ref: "User.id") 
  createdAt: DateTime! @default(value: "now()")
  updatedAt: DateTime! @default(value: "now()")
  
  # Relationships
  organization: Organization
  owner: User  
  tasks: [Task!]
}

type Task @table @rls(enable: true) @tenant(by: "organizationId") {
  id: ID! @pk @uid("tbl:task")
  title: String!
  description: String
  status: TaskStatus! @default(value: "TODO")
  priority: Priority! @default(value: "MEDIUM")
  projectId: ID! @fk(ref: "Project.id")
  assigneeId: ID @fk(ref: "User.id")
  organizationId: ID! @fk(ref: "Organization.id")  # Denormalized for RLS
  dueDate: DateTime
  createdAt: DateTime! @default(value: "now()")
  updatedAt: DateTime! @default(value: "now()")
  
  # Relationships
  project: Project
  assignee: User
  organization: Organization
}

type AuditLog @table @rls(enable: true) @tenant(by: "organizationId") {
  id: ID! @pk @uid("tbl:audit")
  action: String!
  resourceType: String!
  resourceId: String!
  userId: ID! @fk(ref: "User.id")
  organizationId: ID! @fk(ref: "Organization.id")
  metadata: JSON
  createdAt: DateTime! @default(value: "now()")
  
  # Relationships
  user: User
  organization: Organization
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
  DELETED
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
  CANCELLED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

scalar DateTime
scalar JSON
EOF
}

# Test suite
run_golden_path_test() {
    echo "🚀 Starting Golden Path Test"
    
    setup_test_workspace
    trap cleanup_test_workspace EXIT
    
    echo "📄 Creating realistic multi-tenant SaaS schema..."
    create_realistic_schema
    
    echo "🔧 Running Wesley compilation..."
    
    # Capture full output for analysis
    local output_file="/tmp/wesley-golden-output-$(date +%s).log"
    
    if node "$CLI_PATH" generate --schema schema.graphql --verbose 2>&1 | tee "$output_file"; then
        echo "✅ Wesley compilation succeeded"
        
        echo "📊 Analyzing generated artifacts..."
        
        # Check for expected output files
        local expected_files=(
            "out/schema.sql"
        )
        
        local missing_files=()
        for file in "${expected_files[@]}"; do
            if [[ ! -f "$file" ]]; then
                missing_files+=("$file")
            fi
        done
        
        if [[ ${#missing_files[@]} -eq 0 ]]; then
            echo "✅ All expected files generated"
            
            # Analyze schema.sql content
            if [[ -f "out/schema.sql" ]]; then
                local table_count=$(grep -c "CREATE TABLE" out/schema.sql || true)
                local index_count=$(grep -c "CREATE.*INDEX" out/schema.sql || true)
                local fk_count=$(grep -c "FOREIGN KEY" out/schema.sql || true)
                
                echo "📈 Generated SQL statistics:"
                echo "   Tables: $table_count"
                echo "   Indexes: $index_count" 
                echo "   Foreign Keys: $fk_count"
                
                if [[ $table_count -ge 5 ]]; then
                    echo "✅ Expected table count (found $table_count tables)"
                else
                    echo "❌ Insufficient tables generated (expected ≥5, got $table_count)"
                    return 1
                fi
            fi
            
            echo "🎉 Golden Path Test PASSED - Wesley successfully compiled realistic schema"
            return 0
            
        else
            echo "❌ Missing expected files: ${missing_files[*]}"
            echo "Generated files:"
            find . -name "*.sql" -o -name "*.ts" -o -name "*.json" | sort
            return 1
        fi
        
    else
        echo "❌ Wesley compilation failed"
        echo "Full output saved to: $output_file"
        echo "Last 50 lines of output:"
        tail -50 "$output_file"
        return 1
    fi
}

# Run the test
main() {
    echo "Wesley Golden Path Test Suite"
    echo "============================="
    
    if run_golden_path_test; then
        echo ""
        echo "🏆 Golden Path Test Suite: PASSED"
        exit 0
    else
        echo ""
        echo "💥 Golden Path Test Suite: FAILED"
        exit 1
    fi
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi