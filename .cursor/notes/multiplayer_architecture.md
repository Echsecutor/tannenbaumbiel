# Multiplayer Architecture - Hybrid Conflict Resolution

## Overview

Tannenbaumbiel uses a **hybrid client-server architecture** where clients run full physics simulations locally for responsiveness, while the server resolves conflicts using distance-based authority.

## Core Principles

### 1. Client-Side Physics

- Each client runs complete Phaser physics simulation
- Immediate responsiveness for local player
- No waiting for server round-trips
- Physics updates at 60fps locally

### 2. Server Conflict Resolution

- Server receives game state updates from all clients
- Uses distance-based authority to resolve conflicts
- Broadcasts resolved authoritative state back to clients
- Updates at 30fps for network efficiency

### 3. Authority Rules

- **Player Authority**: Players have complete authority over their own character
- **Distance-Based Authority**: For shared objects (enemies), closest player has authority
- **Owner Authority**: Projectile owners always control their projectiles

## Data Flow

```
Client A (Physics 60fps) ──┐
                           ├──> Server (Conflict Resolution) ──> Broadcast (30fps) ──> All Clients
Client B (Physics 60fps) ──┘
```

### Client → Server (Game State Updates)

**Frequency**: 30fps (33ms throttle)
**Content**: Complete game state

```typescript
{
  player: { id, x, y, velocity_x, velocity_y, health, ... },
  enemies: [{ enemy_id, x, y, velocity_x, velocity_y, health, ... }],
  projectiles: [{ projectile_id, x, y, velocity_x, velocity_y, owner_id, ... }]
}
```

### Server → Clients (Resolved State)

**Frequency**: 30fps
**Content**: Conflict-resolved authoritative state

```python
GameStateData(
    room_id="room_123",
    tick=1250,
    players=[...],
    enemies=[...],
    projectiles=[...]
)
```

## Conflict Resolution Algorithm

### 1. Player State

```python
# Players always have authority over themselves
if client_player_data['player_id'] == connection_id:
    world.update_player_from_client(connection_id, client_player_data)
```

### 2. Enemy State

```python
# Distance-based authority for enemies
for enemy_data in client_state['enemies']:
    enemy_id = enemy_data['enemy_id']

    # Check if this client has authority over this enemy
    if world.player_has_authority(connection_id, enemy_id):
        world.update_enemy_from_client(enemy_id, enemy_data)
        print(f"✅ {connection_id} has authority over {enemy_id}")
    else:
        print(f"❌ {connection_id} denied authority over {enemy_id}")
```

### 3. Projectile State

```python
# Owner authority for projectiles
if projectile_data['owner_id'] == connection_id:
    world.update_projectile_from_client(projectile_id, projectile_data)
```

## Distance-Based Authority Implementation

```python
def resolve_object_authority(self, object_x: float, object_y: float) -> Optional[str]:
    """Return player_id of closest player to object position"""
    closest_player = None
    min_distance = float('inf')

    for player_id, player in self.players.items():
        distance = ((player.x - object_x)**2 + (player.y - object_y)**2)**0.5
        if distance < min_distance:
            min_distance = distance
            closest_player = player_id

    return closest_player
```

## Client Reconciliation

### Thresholds for Correction

```typescript
const positionThreshold = 15; // pixels - higher for client physics
const velocityThreshold = 100; // pixels/second - allow local variation
```

### Reconciliation Strategy

- **Conservative Correction**: Only apply server corrections for significant deviations
- **Maintain Local Physics**: Keep client physics running for responsiveness
- **Health Sync**: Always sync critical gameplay state (health)
- **Smooth Corrections**: Apply corrections without jarring jumps

## Initial World State Sync

When a player joins:

1. **Room Confirmation**: Server sends room_joined message
2. **World State**: Server immediately sends complete current world state
3. **Client Setup**: Client creates all existing entities (players, enemies, projectiles)
4. **Start Broadcasting**: Client begins sending its game state updates

```python
# After player joins room
initial_state = world.get_game_state()
state_message = GameMessage(
    type=MessageType.GAME_STATE,
    timestamp=message.timestamp,
    data=initial_state.model_dump()
)
await connection_manager.send_message(connection_id, state_message)
```

## Network Efficiency

### Bandwidth Optimization

- **Client Updates**: 30fps instead of 60fps (reduces by 50%)
- **Delta Compression**: Only send changed input states
- **Authority Filtering**: Server only processes authorized updates
- **Broadcast Batching**: Server batches all updates into single broadcast

### Latency Optimization

- **Local Prediction**: Clients continue local physics while waiting for server
- **Reconciliation Thresholds**: Minimize jarring corrections
- **Input Responsiveness**: Immediate local feedback for player actions

## Error Handling

### Authority Conflicts

- Server logs authority decisions for debugging
- Clients gracefully handle rejected updates
- No cascading failures from authority disputes

### Network Issues

- Client-side physics continues during network interruptions
- Server maintains world state even with disconnected clients
- Automatic reconnection and state resync

## Performance Characteristics

### Client Performance

- **Physics**: 60fps local simulation
- **Network**: 30fps game state broadcasting
- **Reconciliation**: Only on significant deviations

### Server Performance

- **Update Loop**: 60fps physics processing
- **Broadcast**: 30fps state distribution
- **Authority Resolution**: O(n) distance calculations per object

## Benefits of This Architecture

1. **Immediate Responsiveness**: No network delays for local player
2. **Consistent Shared State**: Server resolves all conflicts authoritatively
3. **Fair Authority**: Distance-based authority feels natural and fair
4. **Scalable**: Minimal server computation required
5. **Robust**: Continues working with packet loss or network delays
6. **Smooth Gameplay**: High threshold for corrections maintains fluidity

## Files Implementing This Architecture

### Backend

- `backend/app/game/world.py` - Authority resolution and conflict handling
- `backend/app/api/websocket.py` - Network message processing
- `backend/app/network/protocol.py` - Message structure definitions

### Frontend

- `frontend/src/game/scenes/GameScene.ts` - Client physics and broadcasting
- `frontend/src/network/NetworkManager.ts` - Network communication
