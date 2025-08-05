# Multiplayer Debugging Guide

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

### 2. Sprite Undefined Errors

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

  // Store sprite
  this.sprites.set(id, sprite);
} catch (error) {
  console.error(`Error creating sprite ${id}:`, error);
  continue;
}

// Later, when updating:
if (!sprite) {
  console.error(`Sprite undefined for ${id}, skipping update`);
  continue;
}

try {
  sprite.setVelocity(vx, vy);
} catch (error) {
  console.error(`Error updating sprite ${id}:`, error);
  continue;
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
