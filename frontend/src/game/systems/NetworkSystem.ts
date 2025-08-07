/**
 * NetworkSystem - Handles multiplayer networking and state synchronization
 */
import { NetworkManager } from "../../network/NetworkManager";

export class NetworkSystem {
  private scene: Phaser.Scene;
  private networkManager: NetworkManager | null = null;
  private myPlayerId: string = "";
  private roomJoinConfirmed: boolean = false;
  private lastBroadcastTime: number = 0;
  private broadcastThrottle: number = 33; // 30fps
  private inputState: Map<string, boolean> = new Map();

  // Network entities
  private networkPlayers: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();
  private networkProjectiles: Map<string, Phaser.Physics.Arcade.Sprite> =
    new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(networkManager: NetworkManager, myPlayerId?: string) {
    this.networkManager = networkManager;
    if (myPlayerId) {
      this.myPlayerId = myPlayerId;
      this.roomJoinConfirmed = true;
    }
    this.setupNetworkHandlers();
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

    console.log("🔧 NetworkSystem: Registered game_state handler");

    // Note: room_joined is handled by MenuScene, which passes the player ID to GameScene
    // We get the player ID from the scene data instead of registering another handler
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
    console.log("🔄 NetworkSystem: Received server game state update");
    console.log("📊 Game state data:", {
      room_id: gameState.room_id,
      tick: gameState.tick,
      players_count: gameState.players?.length || 0,
      enemies_count: gameState.enemies?.length || 0,
      projectiles_count: gameState.projectiles?.length || 0,
    });

    if (gameState.players && Array.isArray(gameState.players)) {
      this.updateAllPlayersFromServer(gameState.players);

      // Emit event to notify UI about network state updates
      this.scene.game.events.emit("network-state-updated");
    }
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

        this.networkPlayers.set(playerState.player_id, sprite);
        console.log(`🟢 Created network player: ${playerState.player_id}`);
      } catch (error) {
        console.error(`❌ Error creating network player:`, error);
        return;
      }
    }

    if (sprite) {
      try {
        sprite.setPosition(playerState.x, playerState.y);
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

  clearNetworkEntities() {
    // Clear network players
    for (const [_playerId, sprite] of this.networkPlayers) {
      sprite.destroy();
    }
    this.networkPlayers.clear();

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

  reset() {
    this.myPlayerId = "";
    this.roomJoinConfirmed = false;
    this.inputState.clear();
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
