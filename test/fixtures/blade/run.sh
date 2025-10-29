#!/bin/bash

# This script runs the full BLADE workflow.

set -e

# For the demo, we'll use the pre-generated keys.
export HOLMES_KEY=./holmes.key
export WAT_KEY=./wat.key

# Seed a baseline snapshot (optional, for a true v1→v2 diff demo)
wesley generate --schema ./schema-v1.graphql --out-dir ../../out/blade --quiet || true

# Run the one-shot command against v2
wesley blade --schema ./schema-v2.graphql --out-dir ../../out/blade

# The SHIPME.md file is now ready for inspection.
echo "✅ BLADE workflow complete. Inspect SHIPME.md for the Daywalker Deploys badge."
