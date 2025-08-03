# Tannenbaumbiel Project Changelog

## WIP

- Added comprehensive Selenium integration testing for frontend game functionality
  - Created `tools/selenium_test.py` with automated browser testing
  - Tests frontend loading, UI interaction, and game start functionality
  - Includes service health checks and detailed error reporting
  - Screenshots and console log analysis for debugging
  - Added HTML connection status element for easier automated testing of backend connectivity
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
