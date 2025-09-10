#!/bin/bash

# This script runs the full BLADE workflow.

set -e

# For the demo, we'll use the pre-generated keys.
export HOLMES_KEY=./holmes.key
export WAT_KEY=./wat.key

# Run the one-shot command.
wesley blade --schema-v1 ./schema-v1.graphql --schema-v2 ./schema-v2.graphql

# The SHIPME.md file is now ready for inspection.
echo "✅ BLADE workflow complete. Inspect SHIPME.md for the Daywalker Deploys badge."

