# Tannenbaumbiel Project Changelog

## WIP

- Major UI refactoring: Moved headlines and buttons from Phaser to HTML form

  - Transferred game title "Tannenbaumbiel" and subtitle from Phaser text to HTML `<h1>` and `<p>` elements
  - Moved "Spiel Starten" and "Offline Spielen" buttons from Phaser to HTML `<button>` elements with improved styling
  - Consolidated all UI elements in `menu-form.html` for better layout consistency
  - Updated `MenuScene.ts` to handle HTML button events instead of Phaser text objects
  - Improved button styling with gradients, hover effects, and modern CSS animations
  - Enhanced selenium tests to interact with HTML buttons instead of trying to click Phaser canvas elements
  - Connection status remains in menu form for unified UI presentation

- **Improved UI/UX**: Refactored text input system using embedded HTML forms instead of programmatic DOM creation
  - Replaced manual DOM element creation in `MenuScene.ts` with cleaner HTML form approach
  - Added DOM support to Phaser configuration for embedded HTML forms
  - Created styled `menu-form.html` with modern CSS design
  - Integrated connection status display within the game form (removed external HTML overlay)
  - Better scaling and integration with Phaser's canvas system
- Added comprehensive Selenium integration testing for frontend game functionality
  - Created `tools/selenium_test.py` with automated browser testing
  - Tests frontend loading, UI interaction, and game start functionality
  - Includes service health checks and detailed error reporting
  - Screenshots and console log analysis for debugging
- Added Docker Compose test service for automated testing
  - Test service with Chrome browser and all necessary dependencies
  - Isolated test environment with proper dependency management
  - Integration with CI/CD workflows through `docker compose run --rm test`
- Created testing tools and documentation
  - `tools/run_test.sh` script for easy test execution
  - `tools/README.md` with comprehensive testing documentation
  - Updated `README_DEVELOPMENT.md` with testing instructions
- **BREAKING CHANGE**: Simplified development infrastructure by removing Redis dependency
  - Removed Redis service from `docker-compose.yml`
  - Removed Redis volume configuration
  - Updated backend dependencies to only require PostgreSQL
  - Simplified development setup to single-database architecture
- Updated project architecture documentation
  - Revised architecture diagrams to reflect PostgreSQL-only approach
  - Updated deployment configuration examples
  - Enhanced database architecture documentation with implementation details
  - Updated technology stack documentation in project notes
- **ARCHITECTURAL CHANGE**: Migrated from dual-database (Redis + PostgreSQL) to single PostgreSQL approach
  - All session management now handled through PostgreSQL
  - Game state persistence unified in single database
  - Reduced operational complexity for development and deployment
  - Improved data consistency and transaction safety
