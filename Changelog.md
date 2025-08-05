# Project Changelog

This file documents major project-wide changes and restructuring.

## WIP

- **DOCUMENTATION**: Added acknowledgments section to README.md

  - **Open Source Frameworks**: Added links and thanks to Phaser 3, FastAPI, TypeScript, Vite, SQLAlchemy, PostgreSQL, Docker, uvicorn
  - **Free Game Assets**: Credited OpenGameArt Super Seasonal Platformer Tiles and CraftPix Free Pixel Art Tiny Hero Sprites
  - Properly attributed all major frameworks and free assets used in the project

- **PRODUCTION DEPLOYMENT**: Added complete production Docker setup

  - Created `docker-compose.prod.yml` for production deployment
  - Added production deployment guide in `deployment/README.md`
  - Production environment variables in `.env.prod` format
  - Security features: CORS restrictions, secure credentials, health checks
  - Session storage: All handled via PostgreSQL (Redis was removed)
  - **Consistent Docker naming**: Standardized on `Dockerfile` (production) and `Dockerfile.dev` (development) for both frontend and backend
  - **Simplified deployments**: Removed empty `shared/` directories and cleaned up Docker volume mounts
  - **Removed unused Redis**: Cleaned up leftover Redis service from production Docker Compose (Redis was already removed from application code)

- **VISUAL IMPROVEMENTS**: Perfected winter scene parallax depth system

  - **Correct Parallax Hierarchy**: Fixed scroll factors - background (0.1) now slowest, trees increase with proximity (0.2, 0.4, 0.7)
  - **Accurate Tree Positioning**: Trees constrained to background tree band area (145-190px scaled to screen height)
  - **Realistic Perspective**: Near trees scaled much larger (up to 1.8x) for proper depth perception
  - **Seamless Background Tiling**: Fixed horizontal gaps with pixel-perfect positioning

- **ASSET MANAGEMENT**: Fixed winter ground tile synchronization issue

  - Synchronized all winter ground tiles (32x32 pixels) between `tiles/winter/` and `frontend/src/assets/winter/`
  - Ensured game uses updated `winter_ground_upper_right.png` with correct proportions
  - Established clear asset workflow: source tiles in `tiles/` directory, deployed assets in `frontend/src/assets/`

- **CLEANUP**: Removed obsolete folder references and updated documentation

  - Removed empty `shared/` directories and simplified volume mounts
  - Fixed `frontend/assets/` → `frontend/src/assets/` path references
  - Updated `free-pixel-art-tiny-hero-sprites/` → `tiles/free-pixel-art-tiny-hero-sprites/` paths
  - Updated repository structure notes to reflect current reality
  - Fixed .gitignore to remove incorrect sprite directory exclusion

- **PROTOCOL ENHANCEMENT**: Updated for hybrid client-server conflict resolution architecture

  - Confirmed compatibility with distance-based authority system
  - Game state messages support full world state synchronization
  - Player input protocol handles immediate responsiveness with server conflict resolution
  - Message types support both client broadcasting and server authority
  - Protocol structures optimized for 30fps conflict resolution updates

- **NEW MESSAGE TYPE**: Added GAME_STATE_UPDATE for client-side authoritative architecture
  - Enables clients to broadcast complete game state to server for relay to other players
  - Supports new client-side physics with server state relay model

## Current Version

- MessageType enum for WebSocket message types
- PlayerInputData for input handling
- GameStateData for complete game state
- PlayerState, EnemyState, ProjectileState for entity states
- JoinRoomData for room management
