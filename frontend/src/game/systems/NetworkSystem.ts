/**
 * NetworkSystem - Handles multiplayer networking and state synchronization
 */
import { NetworkManager } from "../../network/NetworkManager";

// Connection states for state-based protocol
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTED = "connected", 
  ROOM_JOINED = "room_joined",
  WORLD_SENT = "world_sent",
  GAME_READY = "game_ready"
}

export class NetworkSystem {
  private scene: Phaser.Scene;
  private networkManager: NetworkManager | null = null;
  private myPlayerId: string = "";
  private roomJoinConfirmed: boolean = false;
  private lastBroadcastTime: number = 0;
  private broadcastThrottle: number = 33; // 30fps
  private inputState: Map<string, boolean> = new Map();
  
  // State-based protocol tracking
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private currentRoomId: string = "";
  private receivedWorldSeed: number = 0;

  // Network entities
  private networkPlayers: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();
  private networkEnemies: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();
  private networkProjectiles: Map<string, Phaser.Physics.Arcade.Sprite> =
    new Map();

  // World state callback
  private onWorldStateReceived: ((worldState: any) => void) | null = null;
  
  // Enemy collision setup callback
  private onEnemiesUpdated: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(networkManager: NetworkManager, myPlayerId?: string, roomData?: any) {
    this.networkManager = networkManager;
    this.connectionState = ConnectionState.CONNECTED;
    
    if (myPlayerId) {
      this.myPlayerId = myPlayerId;
      this.networkManager.setServerPlayerId(this.myPlayerId);
    }

    // If room was already joined by MenuScene, set appropriate state
    if (roomData) {
      this.connectionState = ConnectionState.ROOM_JOINED;
      this.roomJoinConfirmed = true;
      this.currentRoomId = roomData.room_id;
      console.log("🏠 NetworkSystem: Initialized with existing room join state");
    }

    this.setupNetworkHandlers();
  }

  setWorldStateCallback(callback: (worldState: any) => void) {
    this.onWorldStateReceived = callback;
  }

  setEnemiesUpdatedCallback(callback: () => void) {
    this.onEnemiesUpdated = callback;
  }

  requestWorldState() {
    if (!this.networkManager || !this.roomJoinConfirmed) {
      console.warn(
        "🌍 NetworkSystem: Cannot request world state - not connected or room not joined"
      );
      return;
    }

    console.log("🌍 NetworkSystem: Requesting world state from server");
    this.networkManager.sendMessage({
      type: "request_world_state",
      timestamp: Date.now(),
      data: {},
    });

    // Set a timeout to retry if no response
    setTimeout(() => {
      if (this.onWorldStateReceived) {
        console.log(
          "🌍 NetworkSystem: World state request timeout, retrying..."
        );
        this.requestWorldState();
      }
    }, 5000); // 5 second timeout
  }

  private setupNetworkHandlers() {
    if (!this.networkManager) return;

    // Fallback player ID retrieval
    if (!this.myPlayerId) {
      this.myPlayerId = this.networkManager.getServerPlayerId() || "";
    }

    if (this.myPlayerId && !this.networkManager.getServerPlayerId()) {
      this.networkManager.setServerPlayerId(this.myPlayerId);
    }

    this.networkManager.onMessage("game_state", (data) => {
      this.handleGameStateUpdate(data);
    });

    this.networkManager.onMessage("world_state", (data) => {
      this.handleWorldStateUpdate(data);
    });

    this.networkManager.onMessage("room_joined", (data) => {
      this.handleRoomJoined(data);
    });
  }

  private handleRoomJoined(data: any) {
    console.log("🏠 NetworkSystem: Room joined successfully:", data);
    this.roomJoinConfirmed = true;
    this.connectionState = ConnectionState.ROOM_JOINED;
    this.currentRoomId = data.room_id;
    
    if (data.your_player_id) {
      this.myPlayerId = data.your_player_id;
      console.log("🎮 NetworkSystem: Player ID confirmed:", this.myPlayerId);
    }

    // Note: ready_for_world acknowledgment is sent by MenuScene
    console.log("🏠 NetworkSystem: Room join handled, waiting for world state...");
  }

  private sendReadyForWorld() {
    if (!this.networkManager || !this.currentRoomId || !this.myPlayerId) {
      console.error("🌍 NetworkSystem: Cannot send ready_for_world - missing required data");
      return;
    }

    console.log("🌍 NetworkSystem: Sending ready_for_world acknowledgment");
    this.networkManager.sendMessage({
      type: "ready_for_world",
      timestamp: Date.now(),
      data: {
        room_id: this.currentRoomId,
        player_id: this.myPlayerId,
      },
    });
  }

  private handleWorldStateUpdate(worldState: any) {
    console.log("🌍 NetworkSystem: Received world state from server", {
      world_seed: worldState.world_seed,
      platforms_count: worldState.platforms?.length || 0,
      world_width: worldState.world_width,
    });
    
    // Validate state transition
    if (this.connectionState !== ConnectionState.ROOM_JOINED) {
      console.error("🌍 NetworkSystem: Received world state in invalid state:", this.connectionState);
      return;
    }
    
    this.connectionState = ConnectionState.WORLD_SENT;
    this.receivedWorldSeed = worldState.world_seed;
    
    console.log("🌍 NetworkSystem: Full world state data:", JSON.stringify(worldState, null, 2));
    if (this.onWorldStateReceived) {
      console.log("🌍 NetworkSystem: Calling world state callback");
      this.onWorldStateReceived(worldState);
      
      // Send acknowledgment that world state was received and processed
      this.sendWorldReady();
    } else {
      console.warn("🌍 NetworkSystem: No world state callback registered");
    }
  }

  private sendWorldReady() {
    if (!this.networkManager || !this.currentRoomId || !this.myPlayerId || !this.receivedWorldSeed) {
      console.error("🌍 NetworkSystem: Cannot send world_ready - missing required data");
      return;
    }

    console.log("🌍 NetworkSystem: Sending world_ready acknowledgment");
    this.networkManager.sendMessage({
      type: "world_ready",
      timestamp: Date.now(),
      data: {
        room_id: this.currentRoomId,
        player_id: this.myPlayerId,
        world_seed: this.receivedWorldSeed,
      },
    });
  }

  sendInputUpdates(currentInputs: any) {
    if (!this.networkManager || !this.myPlayerId) return;

    // Only send changes to reduce network traffic
    const inputsChanged = Object.entries(currentInputs).some(
      ([action, pressed]) => {
        const wasPressed = this.inputState.get(action) || false;
        return wasPressed !== pressed;
      }
    );

    if (inputsChanged) {
      Object.entries(currentInputs).forEach(([action, pressed]) => {
        const wasPressed = this.inputState.get(action) || false;
        if (wasPressed !== pressed) {
          this.networkManager!.sendPlayerInput(action, pressed as boolean);
          this.inputState.set(action, pressed as boolean);
        }
      });
    }
  }

  broadcastGameState(gameState: any) {
    if (!this.networkManager || !this.myPlayerId || !this.roomJoinConfirmed)
      return;

    // Throttle broadcasting
    const now = Date.now();
    if (now - this.lastBroadcastTime < this.broadcastThrottle) return;
    this.lastBroadcastTime = now;

    this.networkManager.sendMessage({
      type: "game_state_update",
      timestamp: Date.now(),
      data: gameState,
    });
  }

  private handleGameStateUpdate(gameState: any) {
    // Check if this is the initial game state (first one after world ready)
    if (this.connectionState === ConnectionState.WORLD_SENT) {
      console.log("🎮 NetworkSystem: Received initial game state from server");
      this.connectionState = ConnectionState.GAME_READY;
      
      // Send final acknowledgment that client is ready
      this.sendClientReady();
    }

    // Reduce log verbosity - only log every 30th update (once per second at 30fps)
    if (gameState.tick % 30 === 0) {
      console.log("🔄 NetworkSystem: Received server game state update");
      console.log("📊 Game state data:", {
        room_id: gameState.room_id,
        tick: gameState.tick,
        players_count: gameState.players?.length || 0,
        enemies_count: gameState.enemies?.length || 0,
        projectiles_count: gameState.projectiles?.length || 0,
      });
    }

    if (gameState.players && Array.isArray(gameState.players)) {
      this.updateAllPlayersFromServer(gameState.players);

      // Emit event to notify UI about network state updates
      this.scene.game.events.emit("network-state-updated");
    }

    // Process enemies from server
    if (gameState.enemies && Array.isArray(gameState.enemies)) {
      this.updateEnemiesFromServer(gameState.enemies);
    }
  }

  private sendClientReady() {
    if (!this.networkManager || !this.currentRoomId || !this.myPlayerId) {
      console.error("🎮 NetworkSystem: Cannot send client_ready - missing required data");
      return;
    }

    console.log("🎮 NetworkSystem: Sending client_ready acknowledgment - initialization complete");
    this.networkManager.sendMessage({
      type: "client_ready",
      timestamp: Date.now(),
      data: {
        room_id: this.currentRoomId,
        player_id: this.myPlayerId,
      },
    });
  }

  private updateAllPlayersFromServer(players: any[]) {
    // Remove disconnected players
    const activePlayerIds = new Set(players.map((p) => p.player_id));
    for (const [playerId, sprite] of this.networkPlayers) {
      if (!activePlayerIds.has(playerId)) {
        sprite.destroy();
        this.networkPlayers.delete(playerId);
      }
    }

    // Update/create players
    for (const playerState of players) {
      if (playerState.player_id !== this.myPlayerId) {
        this.updateNetworkPlayer(playerState);
      }
    }
  }

  private updateNetworkPlayer(playerState: any) {
    let sprite = this.networkPlayers.get(playerState.player_id);

    if (!sprite) {
      try {
        // Default to dude_monster for network players (TODO: get actual sprite type from server)
        const networkPlayerSprite = "dude_monster";
        sprite = this.scene.physics.add.sprite(
          playerState.x,
          playerState.y,
          `${networkPlayerSprite}_idle`
        );
        if (!sprite) return;

        sprite.setTint(0x00ff00); // Green tint
        sprite.setData("health", playerState.health);
        sprite.setData("score", playerState.score || 0);
        sprite.setData("username", playerState.username || "Unknown");
        sprite.setData("facingRight", playerState.facing_right);
        sprite.setBounce(0.2);
        sprite.setCollideWorldBounds(true);

        // CRITICAL FIX: Set proper physics body for network players
        sprite.body!.setSize(32, 48); // Match player collision box
        sprite.body!.setOffset(16, 16); // Center the collision box

        this.networkPlayers.set(playerState.player_id, sprite);
        console.log(`🟢 Created network player: ${playerState.player_id}`);
      } catch (error) {
        console.error(`❌ Error creating network player:`, error);
        return;
      }
    }

    if (sprite) {
      try {
        // CRITICAL FIX: Use interpolation to reduce flickering
        const currentX = sprite.x;
        const currentY = sprite.y;
        const targetX = playerState.x;
        const targetY = playerState.y;

        // Only update if position changed significantly (reduce micro-movements)
        const positionThreshold = 5;
        if (
          Math.abs(currentX - targetX) > positionThreshold ||
          Math.abs(currentY - targetY) > positionThreshold
        ) {
          sprite.setPosition(targetX, targetY);
        }

        sprite.setFlipX(!playerState.facing_right);
        sprite.setData("health", playerState.health);
        sprite.setData("score", playerState.score || 0);
        sprite.setData("username", playerState.username || "Unknown");

        // Update animation using dynamic sprite type
        const networkPlayerSprite = "dude_monster"; // TODO: get actual sprite type from server
        if (Math.abs(playerState.velocity_x) > 10) {
          sprite.play(`${networkPlayerSprite}_run_anim`, true);
        } else if (playerState.is_jumping || !playerState.is_grounded) {
          sprite.play(`${networkPlayerSprite}_jump_anim`, true);
        } else {
          sprite.play(`${networkPlayerSprite}_idle_anim`, true);
        }
      } catch (error) {
        console.error(`❌ Error updating network player:`, error);
      }
    }
  }

  updateNetworkProjectiles(
    projectileStates: any[],
    platforms: Phaser.Physics.Arcade.StaticGroup,
    enemies: Phaser.Physics.Arcade.Group
  ) {
    const activeProjectileIds = new Set<string>();

    for (const projectileState of projectileStates) {
      if (projectileState.owner_id === this.myPlayerId) continue;

      activeProjectileIds.add(projectileState.projectile_id);
      let sprite = this.networkProjectiles.get(projectileState.projectile_id);

      if (!sprite) {
        try {
          sprite = this.scene.physics.add.sprite(
            projectileState.x,
            projectileState.y,
            "fireball_1"
          );
          if (!sprite || !sprite.body) continue;

          sprite.setDepth(15);
          sprite.setTint(0xff0000); // Red tint for network projectiles

          // Scale and animate fireball
          sprite.setScale(0.1);
          // Default to left-facing animation, will be updated based on velocity
          sprite.play("fireball_left");

          // Add collisions
          this.scene.physics.add.overlap(
            sprite,
            enemies,
            (pr: any, _e: any) => {
              pr.destroy();
              // Handle enemy hit
            },
            undefined,
            this.scene
          );
          this.scene.physics.add.collider(
            sprite,
            platforms,
            (pr: any) => {
              pr.destroy();
            },
            undefined,
            this.scene
          );

          this.networkProjectiles.set(projectileState.projectile_id, sprite);
        } catch (error) {
          console.error(`❌ Error creating network projectile:`, error);
          continue;
        }
      }

      if (sprite && sprite.body) {
        try {
          sprite.setPosition(projectileState.x, projectileState.y);
          sprite.setVelocity(
            projectileState.velocity_x,
            projectileState.velocity_y
          );

          // Update fireball animation and direction based on velocity
          const animationKey =
            projectileState.velocity_x > 0 ? "fireball_right" : "fireball_left";
          sprite.play(animationKey, true);
          sprite.setFlipX(projectileState.velocity_x > 0);
        } catch (error) {
          console.error(`❌ Error updating network projectile:`, error);
        }
      }
    }

    // Remove old projectiles
    for (const [projectileId, sprite] of this.networkProjectiles) {
      if (!activeProjectileIds.has(projectileId)) {
        sprite.destroy();
        this.networkProjectiles.delete(projectileId);
      }
    }
  }

  isOnline(): boolean {
    return !!this.networkManager && this.roomJoinConfirmed;
  }

  getMyPlayerId(): string {
    return this.myPlayerId;
  }

  leaveRoom() {
    if (this.networkManager) {
      this.networkManager.leaveRoom();
    }
  }

  rejoinRoom(roomName: string, username: string) {
    if (this.networkManager) {
      this.myPlayerId = "";
      this.roomJoinConfirmed = false;
      this.clearNetworkEntities();
      this.networkManager.joinRoom(roomName, username);
    }
  }

  private updateEnemiesFromServer(enemies: any[]) {
    console.log(`🦴 NetworkSystem: Updating ${enemies.length} enemies from server`);
    
    // Remove disconnected enemies
    const activeEnemyIds = new Set(enemies.map((e) => e.enemy_id));
    for (const [enemyId, sprite] of this.networkEnemies) {
      if (!activeEnemyIds.has(enemyId)) {
        console.log(`🦴 NetworkSystem: Removing enemy ${enemyId}`);
        sprite.destroy();
        this.networkEnemies.delete(enemyId);
      }
    }

    // Update/create enemies
    for (const enemyState of enemies) {
      this.updateNetworkEnemy(enemyState);
    }

    // Trigger collision setup callback if enemies were updated
    if (this.onEnemiesUpdated) {
      this.onEnemiesUpdated();
    }
  }

  private updateNetworkEnemy(enemyState: any) {
    let sprite = this.networkEnemies.get(enemyState.enemy_id);

    if (!sprite) {
      try {
        // Create enemy sprite based on type
        let textureKey = "owlet_idle"; // Default
        let scale = 1;
        let health = 50;

        switch (enemyState.enemy_type) {
          case "owlet":
            textureKey = "owlet_idle";
            scale = 1;
            health = 50;
            break;
          case "pink_boss":
            textureKey = "pink_boss_idle";
            scale = 1.2;
            health = 100;
            break;
          case "slime":
            textureKey = "slime_idle";
            scale = 0.8;
            health = 30;
            break;
        }

        sprite = this.scene.physics.add.sprite(
          enemyState.x,
          enemyState.y,
          textureKey
        );
        
        if (!sprite) {
          console.error(`❌ Failed to create enemy sprite for ${enemyState.enemy_id}`);
          return;
        }

        sprite.setScale(scale);
        sprite.setData("health", health);
        sprite.setData("maxHealth", health);
        sprite.setData("enemyType", enemyState.enemy_type);
        sprite.setData("enemyId", enemyState.enemy_id);
        sprite.setBounce(0.2);
        sprite.setCollideWorldBounds(true);

        // Set proper physics body
        sprite.body!.setSize(32, 48);
        sprite.body!.setOffset(16, 16);

        this.networkEnemies.set(enemyState.enemy_id, sprite);
        console.log(`🦴 Created network enemy: ${enemyState.enemy_id} (${enemyState.enemy_type})`);
      } catch (error) {
        console.error(`❌ Error creating network enemy:`, error);
        return;
      }
    }

    if (sprite) {
      try {
        // Update position with interpolation
        const currentX = sprite.x;
        const currentY = sprite.y;
        const targetX = enemyState.x;
        const targetY = enemyState.y;

        const positionThreshold = 5;
        if (
          Math.abs(currentX - targetX) > positionThreshold ||
          Math.abs(currentY - targetY) > positionThreshold
        ) {
          sprite.setPosition(targetX, targetY);
        }

        sprite.setFlipX(!enemyState.facing_right);
        sprite.setData("health", enemyState.health);

        // Update animation based on movement
        const enemyType = enemyState.enemy_type;
        if (Math.abs(enemyState.velocity_x) > 10) {
          sprite.play(`${enemyType}_run_anim`, true);
        } else {
          sprite.play(`${enemyType}_idle_anim`, true);
        }
      } catch (error) {
        console.error(`❌ Error updating network enemy:`, error);
      }
    }
  }

  clearNetworkEntities() {
    // Clear network players
    for (const [_playerId, sprite] of this.networkPlayers) {
      sprite.destroy();
    }
    this.networkPlayers.clear();

    // Clear network enemies
    for (const [_enemyId, sprite] of this.networkEnemies) {
      sprite.destroy();
    }
    this.networkEnemies.clear();

    // Clear network projectiles
    for (const [_projectileId, sprite] of this.networkProjectiles) {
      sprite.destroy();
    }
    this.networkProjectiles.clear();
  }

  addPlatformCollisionForNetworkPlayers(
    platforms: Phaser.Physics.Arcade.StaticGroup
  ) {
    for (const [_playerId, sprite] of this.networkPlayers) {
      this.scene.physics.add.collider(sprite, platforms);
    }
  }

  addPlatformCollisionForNetworkEnemies(
    platforms: Phaser.Physics.Arcade.StaticGroup
  ) {
    for (const [_enemyId, sprite] of this.networkEnemies) {
      this.scene.physics.add.collider(sprite, platforms);
    }
  }

  getNetworkEnemies(): Map<string, Phaser.Physics.Arcade.Sprite> {
    return this.networkEnemies;
  }

  reset() {
    this.myPlayerId = "";
    this.roomJoinConfirmed = false;
    this.inputState.clear();
    this.connectionState = ConnectionState.DISCONNECTED;
    this.currentRoomId = "";
    this.receivedWorldSeed = 0;
    this.clearNetworkEntities();
  }

  getNetworkPlayers(): Map<string, Phaser.Physics.Arcade.Sprite> {
    return this.networkPlayers;
  }

  getAllPlayerScores(): Array<{
    playerId: string;
    username: string;
    score: number;
  }> {
    const scores: Array<{ playerId: string; username: string; score: number }> =
      [];

    // Add network players' scores
    for (const [playerId, sprite] of this.networkPlayers) {
      scores.push({
        playerId,
        username: sprite.getData("username") || "Unknown",
        score: sprite.getData("score") || 0,
      });
    }

    return scores;
  }
}
