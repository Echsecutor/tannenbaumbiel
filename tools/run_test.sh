#!/bin/bash

# Tannenbaum Game Integration Test Runner
# This script sets up and runs Selenium tests for the game
# Usage: ./run_test.sh [--debug]

set -e

echo "🎮 Tannenbaum Game Integration Test Runner"
echo "=========================================="

# Parse command line arguments
TEST_MODE=""
for arg in "$@"; do
    case $arg in
    --debug | -d)
        TEST_MODE="--debug"
        echo "🔍 Debug mode enabled - browser will be visible with manual pauses"
        shift
        ;;
    --visible | -v)
        TEST_MODE="--visible"
        echo "👁️ Visible mode enabled - browser will be visible without manual pauses"
        shift
        ;;
    --help | -h)
        echo "Usage: $0 [--debug|--visible|--help]"
        echo "  --debug, -d    Run in debug mode with visible browser and manual pauses"
        echo "  --visible, -v  Run with visible browser but no manual pauses"
        echo "  --help, -h     Show this help message"
        exit 0
        ;;
    *)
        echo "Unknown option: $arg"
        echo "Use --help for usage information"
        exit 1
        ;;
    esac
done

# Check if Python is available
if ! command -v python3 &>/dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

# Check if Docker Compose is running
if ! docker compose ps | grep -q "Up"; then
    echo "⚠ Docker Compose services don't appear to be running"
    echo "Starting Docker Compose services..."
    docker compose up -d
    echo "Waiting for services to start..."
    sleep 10
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install test dependencies
echo "📥 Installing test dependencies..."
pip install -r test_requirements.txt

# Run the test
if [ "$TEST_MODE" = "--debug" ]; then
    echo "🔍 Running Selenium integration test in DEBUG mode..."
    echo "  - Browser will be visible"
    echo "  - Interactive pauses will allow inspection"
    echo "  - Press Enter at each pause to continue"
elif [ "$TEST_MODE" = "--visible" ]; then
    echo "👁️ Running Selenium integration test in VISIBLE mode..."
    echo "  - Browser will be visible"
    echo "  - No manual pauses - test runs automatically"
    echo "  - Slower timing for better visibility"
else
    echo "🚀 Running Selenium integration test in headless mode..."
fi

python selenium_test.py $TEST_MODE

echo "✅ Test runner completed!"
