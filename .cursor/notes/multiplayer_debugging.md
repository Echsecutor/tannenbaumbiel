# Multiplayer Debugging Guide

## Recent Major Fixes (2024)

### 4. World Synchronization Issues (FIXED)

**Problem**: Players saw completely different levels with different platform layouts and enemy positions.

**Root Cause**: Each client generated their own world using client-side random generation, leading to inconsistent multiplayer experience.

**Solution Implemented**:

- **Server-Side World Generation**: Moved world generation to server using deterministic seeds
- **World State Synchronization**: Server sends complete world layout to joining players
- **Client-Side WorldSynchronizer**: New system that generates world from server-provided state
- **Consistent Seeds**: Server uses same seed for all players in a room

**Code Changes**:

```python
# backend/app/game/world.py
class GameWorld:
    def __init__(self, room_id: str):
        self.world_seed = random.randint(1, 1000000)
        random.seed(self.world_seed)
        self.generate_world()  # Server generates world once

    def get_world_state(self) -> dict:
        return {
            "world_seed": self.world_seed,
            "platforms": [platform.to_dict() for platform in self.platforms.values()]
        }
```

```typescript
// frontend/src/game/systems/WorldSynchronizer.ts
export class WorldSynchronizer {
  setServerWorldState(worldState: ServerWorldState) {
    this.serverWorldState = worldState;
    // Generate world from server state instead of random
  }
}
```

### 5. Network Player Flickering (FIXED)

**Problem**: Network players flickered and had poor collision detection with platforms.

**Root Cause**:

- Network players lacked proper physics body setup
- Position updates happened too frequently without interpolation
- Missing collision detection between network players and platforms

**Solution Implemented**:

- **Proper Physics Bodies**: Set correct collision box size and offset for network players
- **Position Interpolation**: Only update position when change exceeds threshold (5px)
- **Collision Setup**: Added platform collisions for all network players

**Code Changes**:

```typescript
// frontend/src/game/systems/NetworkSystem.ts
private updateNetworkPlayer(playerState: any) {
    if (!sprite) {
        // CRITICAL FIX: Set proper physics body for network players
        sprite.body!.setSize(32, 48); // Match player collision box
        sprite.body!.setOffset(16, 16); // Center the collision box
    }

    // CRITICAL FIX: Use interpolation to reduce flickering
    const positionThreshold = 5;
    if (Math.abs(currentX - targetX) > positionThreshold ||
        Math.abs(currentY - targetY) > positionThreshold) {
        sprite.setPosition(targetX, targetY);
    }
}
```

### 6. Enemy Synchronization Issues (FIXED)

**Problem**: Enemies were not properly synchronized between clients.

**Root Cause**: Client-side enemy generation created different enemies than server state.

**Solution Implemented**:

- **Server Authority**: Server generates enemies with deterministic positioning
- **Consistent Enemy Types**: Server defines enemy types and positions
- **Authority Resolution**: Server resolves conflicts using distance-based authority

**Code Changes**:

```python
# backend/app/game/world.py
def create_enemies(self):
    """Create initial enemies in the world with consistent positioning"""
    random.seed(self.world_seed + 2000)  # Different seed for enemies

    # Create enemies with deterministic positioning
    enemy_positions = [
        (300, 650, "owlet"),
        (600, 650, "owlet"),
        (800, 650, "pink_boss"),
        # ... more enemies
    ]
```

## Common Issues and Fixes

### 1. WebSocket Content Security Policy (CSP) Violations

**Problem**: `Refused to connect to 'ws://...' because it violates the following Content Security Policy directive`

**Root Cause**: HTTPS sites block insecure WebSocket connections (`ws://`) due to mixed content security policies.

**Symptoms**:

- WebSocket connections fail in production (HTTPS)
- Works in development (HTTP) but fails in production
- CSP error mentioning `connect-src` or `default-src` fallback

**Fix**:

- Auto-upgrade `ws://` URLs to `wss://` when page served over HTTPS
- Add explicit CSP header with `connect-src 'self' ws: wss: http: https:`
- Ensure backend supports secure WebSocket connections

**Code Pattern**:

```typescript
// Auto-upgrade to secure WebSocket protocol
if (window.location.protocol === "https:" && serverUrl.startsWith("ws://")) {
  serverUrl = serverUrl.replace("ws://", "wss://");
}
```

### 2. Static Asset Serving Issues (404 on HTML/Assets)

**Problem**: Frontend tries to load static assets but gets 404 or wrong content (index.html instead)

**Root Cause**:

- Vite development paths (`/src/...`) don't work in production builds
- nginx client-side routing fallback (`try_files $uri $uri/ /index.html`) serves index.html for missing files
- Static assets need to be in `public/` directory to be included in production build

**Symptoms**:

- Development works but production fails to load assets
- URLs like `/src/game/forms/menu-form.html` return index.html content
- Browser console shows 404 errors or unexpected content

**Fix**:

- Move static assets from `src/` to `public/` directory
- Update code references to use public paths (remove `/src` prefix)
- Ensure nginx serves static file types properly

**Code Patterns**:

```typescript
// BAD: Development paths that won't work in production
this.load.html("menuform", "/src/game/forms/menu-form.html");
this.scene.load.spritesheet('player_idle', '/src/assets/sprites/dude_monster/Dude_Monster_Idle_4.png', ...);

// GOOD: Public paths that work in both dev and production
this.load.html("menuform", "/game/forms/menu-form.html");
this.scene.load.spritesheet('player_idle', '/assets/sprites/dude_monster/Dude_Monster_Idle_4.png', ...);
```

```nginx
# Ensure nginx serves HTML files as static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|html)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. Sprite Undefined Errors

**Problem**: `TypeError: Cannot read properties of undefined (reading 'setVelocity')`

**Root Cause**: Phaser sprite creation can fail silently, returning undefined, but code assumes sprite exists.

**Common Scenarios**:

- Physics system not initialized when sprite creation is attempted
- Missing texture resources (sprite sheets not loaded)
- Scene destroyed while network updates are still processing
- Race conditions between sprite creation and destruction

**Fix Pattern**:

```typescript
// BAD - No safety checks
sprite = this.physics.add.sprite(x, y, texture);
sprite.setVelocity(vx, vy); // CRASHES if sprite is undefined

// GOOD - Comprehensive safety checks
try {
  sprite = this.physics.add.sprite(x, y, texture);

  if (!sprite) {
    console.error(`Failed to create sprite for ${id}`);
    continue; // or return
  }

  sprite.setVelocity(vx, vy);
} catch (error) {
  console.error(`Error creating sprite:`, error);
  continue; // or return
}
```

### 2. Network State Desynchronization

**Problem**: Client and server have different views of game state

**Common Causes**:

- Message delivery order issues
- Client-side prediction drift
- Authority conflicts not properly resolved
- Network interruptions causing missed updates

**Debugging Strategy**:

```typescript
// Add detailed logging
console.log("🔄 Received server state:", gameState);
console.log("🎮 Current client state before update:", this.getLocalState());
console.log("🔧 Applying reconciliation:", corrections);
```

### 3. Entity ID Mismatches

**Problem**: Server sends updates for entities client doesn't recognize

**Common Causes**:

- Enemy IDs between server and client don't match
- Client missed initial world state sync
- Race condition between entity creation and updates

**Fix Pattern**:

```typescript
// Ensure consistent ID generation
// Server side:
enemy_id: `enemy_${index + 1}`; // 1-based to match server

// Client side:
enemy_id: `enemy_${index + 1}`; // Must match server exactly
```

### 4. Physics System Race Conditions

**Problem**: Physics operations fail when scene is transitioning

**Prevention**:

```typescript
// Check scene state before physics operations
if (!this.scene.isActive() || !this.physics) {
  console.warn("Scene inactive, skipping physics update");
  return;
}
```

### 5. Server URL Change Reconnection Issues

**Problem**: Changing server URL doesn't properly reconnect to new server, or connection reverts to old URL after successful connection

**Root Cause**:

- NetworkManager remains connected to old server when new URL is entered
- NetworkManager's auto-reconnection uses old URL instead of current input field value
- Fallback URLs in code override user-entered URLs

**Symptoms**:

- Repeated "Already connected, skipping auto-connection" messages
- NetworkManager doesn't use newly entered server URL
- Connection attempts fail silently
- Successful connection to new URL followed by automatic reconnection to old URL

**Fix Pattern**:

```typescript
// In attemptAutoConnection() - disconnect before reconnecting
if (this.networkManager.getConnectionStatus()) {
  console.log("Disconnecting from current server to reconnect to new URL");
  this.networkManager.disconnect();
  await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for disconnect
}

// Add debouncing to prevent rapid reconnection attempts
private serverUrlChangeTimeout: number | null = null;

serverUrlInput.addEventListener("input", () => {
  if (this.serverUrlChangeTimeout) {
    clearTimeout(this.serverUrlChangeTimeout);
  }

  this.serverUrlChangeTimeout = window.setTimeout(() => {
    this.attemptAutoConnection();
  }, 1000); // Wait 1 second after user stops typing
});

// Clean up timeout when scene is destroyed
destroy() {
  if (this.serverUrlChangeTimeout) {
    clearTimeout(this.serverUrlChangeTimeout);
    this.serverUrlChangeTimeout = null;
  }
}

// Use URL constructor for proper URL parsing and port preservation
try {
  const url = new URL(serverUrl);

  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  }

  // Ensure the pathname ends with /ws/game
  if (!url.pathname.endsWith("/ws/game")) {
    if (url.pathname.endsWith("/")) {
      url.pathname = url.pathname + "ws/game";
    } else {
      url.pathname = url.pathname + "/ws/game";
    }
  }

  wsUrl = url.toString();
} catch (error) {
  // Fallback to string replacement method
  // ... existing fallback code
}

// Always save current URL to localStorage and use input field value
localStorage.setItem("tannenbaum_serverurl", serverUrl);

// Disable NetworkManager auto-reconnection to prevent URL fallback
// In NetworkManager.onclose:
console.log("Connection lost, but not auto-reconnecting to prevent URL fallback");

// Remove fallback URLs from joinMultiplayerGame
const serverUrl = serverUrlInput?.value.trim(); // No fallback to default URL
```

## Best Practices for Multiplayer Error Handling

### 1. Fail Gracefully

- Never let network errors crash the game
- Use `continue` in loops to skip problematic entities
- Log errors but don't throw exceptions

### 2. Validate Everything

- Check sprite existence before every operation
- Verify required properties exist on network data
- Validate array lengths and object structures

### 3. Comprehensive Logging

- Log entity creation/destruction
- Log state transitions and reconciliation
- Include entity IDs in all log messages

### 4. State Recovery

- Implement cleanup for orphaned sprites
- Provide fallback values for missing data
- Re-sync from server when detecting inconsistencies

## Error Patterns to Watch For

### Memory Leaks

```typescript
// BAD - Sprites not cleaned up
sprite.destroy(); // Missing networkMap.delete(id)

// GOOD - Complete cleanup
sprite.destroy();
this.networkEntities.delete(entityId);
```

### Circular References

```typescript
// BAD - Can cause memory issues
sprite.setData("world", this);

// GOOD - Use IDs for references
sprite.setData("entityId", entityId);
```

### Animation State Errors

**Problem**: `TypeError: Cannot read properties of undefined (reading 'play')`

**Root Cause**: Animation calls on undefined sprites or sprites without animation system.

**Common Scenarios**:

- Sprite becomes undefined between update and animation code
- Animation system not initialized on sprite
- Sprite destroyed while animation update is processing

**Safe Animation Pattern**:

```typescript
// SAFE - Comprehensive animation safety checks
if (sprite && sprite.anims) {
  try {
    if (Math.abs(velocity_x) > 10) {
      sprite.play("walk_anim", true);
    } else {
      sprite.play("idle_anim", true);
    }
  } catch (error) {
    console.error(`Animation failed for ${entityId}:`, error);
  }
}

// BAD - No safety checks
sprite.play("walk_anim", true); // CRASHES if sprite undefined or no anims
```

### Physics Body Errors

**Problem**: `TypeError: can't access property "setVelocity", this.body is undefined`

**Root Cause**: Physics body not created or lost during sprite lifecycle.

**Common Scenarios**:

- Physics system overloaded during rapid sprite creation
- Sprite created but physics body initialization failed
- Physics body destroyed while sprite still exists
- Timing issues between sprite and physics system

**Safe Physics Pattern**:

```typescript
// SAFE - Comprehensive physics body validation
if (sprite && sprite.body) {
  try {
    sprite.setVelocity(vx, vy);
  } catch (error) {
    console.error(`Physics update failed for ${entityId}:`, error);
  }
} else if (sprite) {
  console.warn(`Physics body missing for ${entityId}, attempting recovery`);
  // Try to enable physics manually
  this.physics.world.enable(sprite);
  if (sprite.body) {
    sprite.setVelocity(vx, vy);
  } else {
    console.error(`Failed to enable physics for ${entityId}`);
  }
}

// BAD - No physics body check
sprite.setVelocity(vx, vy); // CRASHES if sprite.body is undefined
```

### Game Restart Synchronization Issues

**Problem**: After restart, only some players can see others in multiplayer.

**Root Cause**: Game restart doesn't properly handle multiplayer state cleanup and rejoin.

**Common Scenarios**:

- Player restarts game while in multiplayer session
- Other players aren't notified of the restart
- Restarting player rejoins with stale network state
- Network entity maps become desynchronized

**Proper Restart Sequence**:

```typescript
private restartMultiplayerGame() {
  if (!this.isOffline && this.networkManager.getConnectionStatus()) {
    // 1. Clean up network entities
    this.cleanupNetworkEntities();

    // 2. Leave room to notify other players
    this.networkManager.leaveRoom();

    // 3. Store state for rejoin
    this.registry.set('shouldRejoinRoom', true);
    this.registry.set('lastRoomData', this.roomData);

    // 4. Restart scene after leave message processed
    setTimeout(() => {
      this.scene.restart();
    }, 100);
  } else {
    // Offline mode - simple restart
    this.scene.restart();
  }
}

private autoRejoinAfterRestart() {
  // Reset networking state
  this.myPlayerId = '';
  this.roomJoinConfirmed = false;
  this.networkPlayers.clear();

  // Rejoin with clean state
  this.networkManager.joinRoom(roomName, username);
  this.setupNetworkHandlers();
}

// BAD - No multiplayer consideration
this.scene.restart(); // Breaks multiplayer synchronization
```

**Key Principles**:

- Always leave room before restart in multiplayer
- Clean up all network entities before restart
- Use registry to persist room data across scene restarts
- Auto-rejoin with fresh network state
- Add delays for network message processing

### Server Validation Errors

**Problem**: `2 validation errors for JoinRoomData - room_name Field required, username Field required`

**Root Cause**: Sending incomplete data structures to server API endpoints.

**Common Scenarios**:

- Auto-rejoin using server response data instead of original join parameters
- Missing required fields in network message construction
- Incorrect data structure mapping between client and server

**Fix Pattern**:

```typescript
// BAD - Using server response data for rejoin
const roomData = serverResponse; // Contains room_id, player_count, etc.
networkManager.joinRoom(roomData.roomName, roomData.username); // UNDEFINED!

// GOOD - Store and use original join parameters
// During initial join:
this.registry.set("originalRoomName", roomName);
this.registry.set("originalUsername", username);

// During rejoin:
const originalRoomName = this.registry.get("originalRoomName");
const originalUsername = this.registry.get("originalUsername");
networkManager.joinRoom(originalRoomName, originalUsername); // WORKS!
```

**Prevention Strategy**:

- Always validate required fields before sending network requests
- Store original join parameters separately from server response data
- Use TypeScript interfaces to enforce correct data structures
- Add logging to verify data structure before network calls

## Debugging Tools

### Network State Inspector

```typescript
// Add to console for debugging
window.gameDebug = {
  getNetworkPlayers: () => Array.from(this.networkPlayers.entries()),
  getNetworkEnemies: () => Array.from(this.networkEnemies.entries()),
  getLocalPlayer: () => ({
    x: this.player.x,
    y: this.player.y,
    health: this.player.getData("health"),
  }),
};
```

### Performance Monitoring

```typescript
// Track update performance
const updateStart = performance.now();
this.updateGameState(gameState);
const updateTime = performance.now() - updateStart;
if (updateTime > 16) {
  // More than one frame at 60fps
  console.warn(`Slow network update: ${updateTime.toFixed(2)}ms`);
}
```

This debugging guide should help quickly identify and fix similar issues in multiplayer development.

### 4. State-Based Protocol Implementation (NEW)

**Enhancement**: Replaced timing-dependent protocol with explicit state transitions and acknowledgments.

**Previous Problems with Timing-Based Protocol**:
- Race conditions between message sending and handler registration
- No validation of message order
- Client couldn't control when it was ready to receive messages
- Server sent all messages at once without waiting for client readiness

**New State-Based Protocol Flow**:

```
DISCONNECTED → CONNECTED → ROOM_JOINED → WORLD_SENT → GAME_READY
```

**Message Exchange Pattern**:

1. **Room Join Phase**:
   ```
   Client → join_room → Server
   Server → room_joined (state: ROOM_JOINED) → Client
   Client → ready_for_world → Server
   ```

2. **World Synchronization Phase**:
   ```
   Server → world_state (state: WORLD_SENT) → Client
   Client → world_ready (with world_seed validation) → Server
   ```

3. **Game State Phase**:
   ```
   Server → game_state (state: GAME_READY) → Client
   Client → client_ready → Server
   ```

**State Validation**:
- Backend validates state transitions before processing messages
- Invalid state transitions return error messages
- Each message includes expected connection state
- World seed validation ensures data integrity

**Implementation Details**:

```typescript
// Frontend state tracking
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTED = "connected",
  ROOM_JOINED = "room_joined", 
  WORLD_SENT = "world_sent",
  GAME_READY = "game_ready"
}

// Automatic acknowledgment sending
private handleRoomJoined(data: any) {
  this.connectionState = ConnectionState.ROOM_JOINED;
  this.sendReadyForWorld(); // Automatic acknowledgment
}

private handleWorldStateUpdate(worldState: any) {
  if (this.connectionState !== ConnectionState.ROOM_JOINED) {
    console.error("Invalid state for world state");
    return;
  }
  this.connectionState = ConnectionState.WORLD_SENT;
  this.processWorldState(worldState);
  this.sendWorldReady(); // Automatic acknowledgment
}
```

```python
# Backend state validation
async def handle_ready_for_world(connection_id: str, message: GameMessage):
    if not connection_manager.validate_state_transition(connection_id, ConnectionState.ROOM_JOINED):
        await send_error(connection_id, "INVALID_STATE", f"Expected ROOM_JOINED")
        return
    
    # Send world state only after client confirms readiness
    await send_world_state(connection_id)
    connection_manager.set_connection_state(connection_id, ConnectionState.WORLD_SENT)
```

**Benefits**:
- Eliminates race conditions and timing dependencies
- Provides explicit control flow with validation
- Enables proper error handling for invalid states
- Allows client to control initialization pace
- Ensures messages are processed in correct order

### 5. World State Reception Timing Issues (LEGACY - REPLACED BY STATE-BASED PROTOCOL)

**Problem**: Frontend doesn't receive initial world state message from server, causing "Cannot request world state - not connected or room not joined" errors.

**Root Cause**: World state callback registration happening too late in the initialization sequence.

**Common Scenarios**:
- GameScene requests world state before joining a room
- World state callback registered after messages arrive
- NetworkSystem initialization happens after server messages are sent
- Timing mismatch between server sending and frontend handler registration

**Symptoms**:
- Console shows "Cannot request world state - not connected or room not joined"
- Frontend doesn't create synchronized world
- Players see different world layouts
- Loading screen never disappears in online mode

**Fix Pattern**:

```typescript
// BAD - Callback registered too late
private createGameSystems() {
  // ... other initialization
  this.networkSystem.setWorldStateCallback((worldState) => {
    // Handler registered after messages might arrive
  });
}

// GOOD - Callback registered immediately after NetworkSystem init
private setupNetworking(networkManager?: NetworkManager) {
  this.networkSystem.initialize(manager, this.myPlayerId);
  
  // Set up world state callback immediately
  this.networkSystem.setWorldStateCallback((worldState) => {
    // Handler ready before any messages arrive
  });
}
```

**Prevention Strategy**:
- Register all message handlers immediately after NetworkSystem initialization
- Don't request world state manually - server sends automatically on room join
- Set up networking before creating game systems
- Use proper initialization order: networking → callbacks → systems

### 5. Unhandled Message Type Errors

**Problem**: `Unhandled message type: game_state {room_id: '...', tick: 41, players: Array(1), enemies: Array(3), projectiles: Array(0)}`

**Root Cause**: Conflicting message handlers between different components trying to handle the same message types.

**Common Scenarios**:

- Multiple components registering handlers for the same message type
- NetworkManager default handlers conflicting with NetworkSystem handlers
- MenuScene and NetworkSystem both trying to handle "room_joined" messages
- Handler registration order causing later handlers to overwrite earlier ones

**Symptoms**:

- Console shows "Unhandled message type" for messages that should be handled
- Network state updates not being processed
- Players not appearing in multiplayer games
- Game state synchronization failures

**Fix Pattern**:

```typescript
// BAD - Multiple components handling same message type
// NetworkManager.ts
this.onMessage("room_joined", (data) => {
  /* handler 1 */
});
this.onMessage("game_state", (data) => {
  /* handler 1 */
});

// NetworkSystem.ts
this.networkManager.onMessage("room_joined", (data) => {
  /* handler 2 */
});
this.networkManager.onMessage("game_state", (data) => {
  /* handler 2 */
});

// MenuScene.ts
this.networkManager.onMessage("room_joined", (data) => {
  /* handler 3 */
});

// GOOD - Clear separation of responsibilities
// NetworkManager.ts - Only handle basic messages
this.onMessage("room_left", (data) => {
  /* basic handler */
});
this.onMessage("player_joined", (data) => {
  /* basic handler */
});
this.onMessage("error", (data) => {
  /* basic handler */
});

// MenuScene.ts - Handle room joining and scene transitions
this.networkManager.onMessage("room_joined", (data) => {
  // Start GameScene with player ID
  this.scene.start("GameScene", { myPlayerId: data.your_player_id });
});

// NetworkSystem.ts - Handle game state updates
this.networkManager.onMessage("game_state", (data) => {
  this.handleGameStateUpdate(data);
});
```

**Prevention Strategy**:

- Document which component handles which message types
- Use clear separation of concerns for message handling
- Avoid registering multiple handlers for the same message type
- Add debugging logs to track handler registration
- Test message flow in both development and production builds

**Debugging Steps**:

1. Check all `onMessage` registrations across components
2. Verify handler registration order and timing
3. Add console logs to track message flow
4. Test with single player vs multiplayer scenarios
5. Verify build process doesn't affect handler registration

## Testing Multiplayer Functionality

### Manual Testing Checklist

1. **Connection Test**

   - [ ] Two players can connect to same room
   - [ ] Players see each other's characters
   - [ ] Players see identical world layout
   - [ ] Network players have proper collision with platforms

2. **Movement Test**

   - [ ] Local player movement is responsive
   - [ ] Network player movement is smooth (no flickering)
   - [ ] Both players can jump and move on platforms
   - [ ] Network players don't fall through platforms

3. **Enemy Test**

   - [ ] Enemies appear in same positions for both players
   - [ ] Enemy AI works consistently
   - [ ] Enemy damage affects both players
   - [ ] Enemy deaths are synchronized

4. **Projectile Test**
   - [ ] Projectiles are visible to both players
   - [ ] Projectile collisions work correctly
   - [ ] Projectile damage is synchronized

### Debug Commands

```typescript
// Enable debug logging
localStorage.setItem("debug_networking", "true");

// Check network state
console.log("Network status:", networkSystem.isOnline());
console.log("Player ID:", networkSystem.getMyPlayerId());

// Force world state request
networkSystem.requestWorldState();
```

### Performance Monitoring

- **Network Latency**: Monitor WebSocket message round-trip times
- **Frame Rate**: Ensure 60fps local physics, 30fps network updates
- **Memory Usage**: Check for memory leaks in network entity management
- **CPU Usage**: Monitor server-side world update performance
