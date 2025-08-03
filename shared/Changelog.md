# Shared Protocol Changelog

This file documents changes to the shared protocol used between frontend and backend.

## WIP

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
