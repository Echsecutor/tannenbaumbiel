# Project Changelog

This file documents major project-wide changes and restructuring.

## WIP

- **ASSET MANAGEMENT**: Fixed winter ground tile synchronization issue

  - Synchronized all winter ground tiles (32x32 pixels) between `tiles/winter/` and `frontend/src/assets/winter/`
  - Ensured game uses updated `winter_ground_upper_right.png` with correct proportions
  - Established clear asset workflow: source tiles in `tiles/` directory, deployed assets in `frontend/src/assets/`

- **CLEANUP**: Removed obsolete folder references and updated documentation

  - Removed obsolete `shared/` directory references (protocol moved to backend)
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
