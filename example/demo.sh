#!/bin/bash
# Wesley + SHA-lock HOLMES Demo Script
# This demonstrates the complete workflow from schema to production

set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           🚀 Wesley + 🔍 SHA-lock HOLMES Demo                    ║"
echo "║                                                                   ║"
echo "║  'Everyone generates GraphQL from databases.                     ║"
echo "║   Wesley generates databases from GraphQL.'                      ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Show the schema
echo -e "${BLUE}📋 Step 1: GraphQL Schema as Single Source of Truth${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Our e-commerce schema defines everything with intelligent directives:"
echo ""
head -40 ecommerce.graphql | grep -E "@(critical|weight|sensitive|pii|uid)" | head -10
echo ""
echo "Key features:"
echo "  • @uid for stable identities across renames"
echo "  • @weight for prioritization (critical fields matter more)"
echo "  • @sensitive/@pii for automatic security enforcement"
echo "  • @critical for mission-critical tables"
echo ""
read -p "Press Enter to continue..."

# Step 2: Generate everything
echo ""
echo -e "${BLUE}🎯 Step 2: Wesley Generation with Evidence Bundle${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Running: wesley generate --schema ecommerce.graphql --emit-bundle"
echo ""

# Simulate generation (or run actual if available)
if command -v wesley &> /dev/null; then
    wesley generate --schema ecommerce.graphql --emit-bundle
else
    echo "✨ Generated:"
    echo "  ✓ PostgreSQL DDL       → out/schema.sql"
    echo "  ✓ TypeScript Types     → out/types.ts"
    echo "  ✓ Zod Schemas         → out/validation.ts"
    echo "  ✓ pgTAP Tests         → tests/generated.sql"
    echo "  ✓ Evidence Bundle     → .wesley/"
    echo ""
    echo "📊 Scores:"
    echo "  SCS: 84.3% (Schema Coverage Score)"
    echo "  MRI: 23.0% (Migration Risk Index - Low risk!)"
    echo "  TCI: 71.0% (Test Confidence Index)"
    echo ""
    echo "🎯 Verdict: READY FOR REVIEW"
    
    # Create mock evidence bundle
    mkdir -p .wesley
    cat > .wesley/evidence-map.json << 'EOF'
{
  "sha": "abc123def456",
  "timestamp": "2024-03-20T10:30:00Z",
  "evidence": {
    "col:user.password": {
      "sql": [{"file": "out/schema.sql", "lines": "15-18", "sha": "abc123d"}],
      "tests": [{"file": "tests/constraints.sql", "lines": "45-67", "sha": "abc123d"}]
    },
    "col:order.payment_intent_id": {
      "sql": [{"file": "out/schema.sql", "lines": "89-92", "sha": "abc123d"}],
      "tests": [{"file": "tests/security.sql", "lines": "112-130", "sha": "abc123d"}]
    }
  }
}
EOF
    
    cat > .wesley/scores.json << 'EOF'
{
  "scores": {
    "scs": 0.843,
    "mri": 0.23,
    "tci": 0.71
  },
  "readiness": {
    "verdict": "READY FOR REVIEW",
    "thresholds_passed": {
      "scs": true,
      "mri": true,
      "tci": true
    }
  }
}
EOF
fi

echo ""
read -p "Press Enter to continue..."

# Step 3: HOLMES Investigation
echo ""
echo -e "${BLUE}🔍 Step 3: SHA-lock HOLMES Investigation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Running: holmes investigate"
echo ""

if command -v holmes &> /dev/null; then
    holmes investigate
else
    cat << 'EOF'
🔍 SHA-lock HOLMES Investigation Report
=====================================

Weighted Completion: ████████░░ 84% (156/185 weighted points)
Verification Status: 47/47 claims independently verified
Ship Verdict: ELEMENTARY

┌─────────────────────┬────────┬────────┬──────────────────────┬────────────────────┐
│ Feature             │ Weight │ Status │ Evidence             │ Deduction          │
├─────────────────────┼────────┼────────┼──────────────────────┼────────────────────┤
│ User.password_hash  │   10   │   ✅   │ schema.sql:15@abc123 │ "Properly hashed!" │
│ Order.payment_id    │    9   │   ✅   │ schema.sql:89@abc123 │ "Secure storage"   │
│ User.email         │    9   │   ✅   │ schema.sql:12@abc123 │ "Unique enforced"  │
│ Product.sku        │    9   │   ✅   │ schema.sql:45@abc123 │ "Indexed & unique" │
│ Product.stock      │    8   │   ✅   │ schema.sql:48@abc123 │ "Tracked properly" │
│ User.phone         │    8   │   ⚠️   │ Missing RLS masking  │ "Minor oversight"  │
│ Order.status       │    9   │   ✅   │ schema.sql:87@abc123 │ "State machine OK" │
└─────────────────────┴────────┴────────┴──────────────────────┴────────────────────┘

Security Gates:
✅ Sensitive fields have proper constraints
✅ PII fields marked for compliance
⚠️ Consider RLS policies for User.phone

"The evidence is conclusive, Watson. Ship with confidence."
EOF
fi

echo ""
read -p "Press Enter to continue..."

# Step 4: WATSON Verification
echo ""
echo -e "${BLUE}🩺 Step 4: Dr. WATSON Independent Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Running: holmes verify"
echo ""

if command -v holmes &> /dev/null; then
    holmes verify
else
    cat << 'EOF'
🩺 Dr. WATSON Verification Report
=================================

Independent verification of HOLMES's deductions...

Evidence Checks:
  ✓ 47/47 file citations verified
  ✓ All SHA hashes match repository state
  ✓ Line ranges contain expected content

Cross-validation:
  ✓ SQL DDL matches schema directives
  ✓ Test coverage aligns with weights
  ✓ Critical fields have constraints

Discrepancies Found: 0

"Holmes's deductions are sound. The schema is production-ready."
EOF
fi

echo ""
read -p "Press Enter to continue..."

# Step 5: MORIARTY Predictions
echo ""
echo -e "${BLUE}🔮 Step 5: Professor MORIARTY's Predictions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Running: holmes predict"
echo ""

if command -v holmes &> /dev/null; then
    holmes predict
else
    cat << 'EOF'
🔮 Professor MORIARTY's Predictive Analysis
==========================================

Historical Velocity: 3.2% coverage/day
Current Coverage: 84.3%
Target Coverage: 95.0%

📈 Completion Prediction:
  • ETA to 95%: 3.3 days
  • Date: March 23, 2024
  • Confidence: 87% (based on 14-day history)

Risk Analysis:
  • MRI trending down (good!)
  • TCI steady improvement
  • No blocking issues detected

Recommended Actions:
  1. Add RLS policies for PII fields (+3% TCI)
  2. Complete TypeScript generators (+5% SCS)
  3. Add performance indexes (+2% TCI)

"The game is afoot. Victory in 3 days."
EOF
fi

echo ""
read -p "Press Enter to continue..."

# Step 6: Show generated SQL
echo ""
echo -e "${BLUE}📄 Step 6: Generated PostgreSQL DDL${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Sample of generated SQL with security constraints:"
echo ""

cat << 'EOF'
-- Generated by Wesley from GraphQL schema
-- SHA: abc123def456

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "password_hash" VARCHAR(60) NOT NULL,
  "full_name" TEXT,
  "phone" VARCHAR(20),
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Security constraints from @sensitive directive
  CONSTRAINT "password_hash_bcrypt" CHECK (char_length("password_hash") = 60),
  
  -- Indexes from @weight prioritization
  CREATE INDEX "idx_user_email" ON "User"("email"),
  CREATE INDEX "idx_user_created" ON "User"("created_at")
);

-- RLS policies from @critical directive
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON "User"
  FOR SELECT USING (auth.uid() = id);
EOF

echo ""
read -p "Press Enter to continue..."

# Step 7: Show generated tests
echo ""
echo -e "${BLUE}🧪 Step 7: Generated pgTAP Tests${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Risk-weighted tests automatically generated:"
echo ""

cat << 'EOF'
-- Weight 10: Critical password field
SELECT has_column('User', 'password_hash');
SELECT col_not_null('User', 'password_hash');
SELECT matches(
  'password_hash constraint',
  (SELECT pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conname = 'password_hash_bcrypt'),
  'char_length.*60'
);

-- Weight 9: Payment security
SELECT has_column('Order', 'payment_intent_id');
SELECT col_is_unique('Order', 'payment_intent_id');
SELECT is_indexed('Order', 'payment_intent_id');

-- RLS Testing with JWT claims
SET LOCAL request.jwt.claims TO 
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
  
SELECT throws_ok(
  $$ INSERT INTO "Order" (user_id, total_cents) 
     VALUES ('00000000-0000-0000-0000-000000000002', 1000) $$,
  'new row violates row-level security policy'
);
EOF

echo ""
read -p "Press Enter to continue..."

# Step 8: CI/CD Integration
echo ""
echo -e "${BLUE}🚀 Step 8: CI/CD Pipeline Integration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "GitHub Actions workflow automatically:"
echo ""
echo "  1. Generates artifacts on every PR"
echo "  2. Runs HOLMES investigation"
echo "  3. WATSON verifies evidence"
echo "  4. MORIARTY predicts readiness"
echo "  5. Posts report as PR comment"
echo ""
echo "Example PR comment:"
echo ""

cat << 'EOF'
┌────────────────────────────────────────────────────────┐
│ 🔍 The Case of Pull Request #42                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Weighted Coverage: ████████░░ 84%                     │
│ Migration Risk: ██░░░░░░░░ 23% (Low)                 │
│ Test Confidence: ███████░░░ 71%                      │
│                                                        │
│ Verdict: READY FOR REVIEW                             │
│                                                        │
│ Critical Issues: 0                                    │
│ Warnings: 1 (RLS policy for User.phone)              │
│                                                        │
│ "Elementary, my dear reviewer."                       │
└────────────────────────────────────────────────────────┘
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✨ Demo Complete!${NC}"
echo ""
echo "Wesley + SHA-lock HOLMES provides:"
echo "  • Single source of truth (GraphQL)"
echo "  • Automatic generation of everything"
echo "  • Intelligent prioritization"
echo "  • Production safety gates"
echo "  • Evidence-based verification"
echo "  • Predictive analytics"
echo ""
echo "'Make it so, schema.'"
echo ""