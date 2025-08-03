#!/bin/bash

# Quick debug test runner
# This is a convenience script to run tests in visible mode

echo "👁️ Running Tannenbaum Game Test in VISIBLE MODE"
echo "==============================================="
echo "This will:"
echo "  - Show the browser window"
echo "  - Run automatically without manual pauses"
echo "  - Use slower timing for better visibility"
echo ""
echo "💡 To run with manual pauses instead, use: ./run_test.sh --debug"
echo ""

./run_test.sh --visible
