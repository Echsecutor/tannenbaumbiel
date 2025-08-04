# Tools Changelog

## WIP

- **NEW FEATURE**: Image Analysis Tools

  - Added `tools/image_analysis/` directory with computer vision tools for sprite sheet analysis
  - `analyze_tileset.py`: Advanced tileset analyzer using OpenCV and scikit-image
  - Automated tile boundary detection using Canny edge detection and Hough transforms
  - Theme-specific region identification (winter/seasonal sprites) using LAB color space analysis
  - Automatic asset extraction from complex sprite collections
  - Created for analyzing Season_collection.png to extract proper winter-themed sprites
  - Includes virtual environment setup and comprehensive documentation

- Added new `--visible` mode for test execution
  - Browser window is visible for debugging without manual pauses
  - `tools/run_test.sh --visible` option for automated visible testing
  - `tools/test_debug.sh` now defaults to visible mode instead of debug mode
  - Provides slower timing for better visibility of test actions without requiring manual confirmation
  - Complements existing `--debug` mode which still includes manual pauses for detailed inspection
- Enhanced connection status debugging and synchronization
  - Added debugging info for dual connection status indicators (HTML element vs Phaser game text)
  - Test now captures screenshots in visible/debug mode to show both status indicators
  - HTML status indicator (top-right) vs Phaser game text (top-left) may show different states
  - **FIXED**: Implemented unified status update mechanism to ensure both indicators show the same state
  - Added force synchronization method and enhanced logging for connection status changes
  - Test now checks both HTML element and Phaser game text for status mismatches
- **FIXED**: Improved "Spiel Starten" button click reliability in Selenium tests
  - **Issue**: Test reported button click success but button wasn't actually clicked
  - **Root Cause**: Coordinate-based clicking didn't align with actual button position in Phaser game
  - **Solution**: Implemented dual-approach button clicking
    - Primary: JavaScript execution to directly trigger button `pointerdown` event
    - Fallback: Enhanced coordinate calculation using actual game dimensions and scaling
  - Added game state verification to confirm button click success
    - Checks for scene transitions (MenuScene → GameScene)
    - Detects offline mode activation
    - Verifies button interaction worked
  - Enhanced debugging with before/after game state logging
    - Shows active scenes, button existence, and input values
    - Helps diagnose click failures and timing issues
