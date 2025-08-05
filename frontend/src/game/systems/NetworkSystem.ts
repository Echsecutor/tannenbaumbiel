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

    this.networkManager.onMessage("room_joined", (data) => {
      if (!this.myPlayerId && data.your_player_id) {
        this.myPlayerId = data.your_player_id;
      }
      this.roomJoinConfirmed = true;
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
    console.log("🔄 Received server conflict-resolved state");

    if (gameState.players && Array.isArray(gameState.players)) {
      this.updateAllPlayersFromServer(gameState.players);
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
        sprite = this.scene.physics.add.sprite(
          playerState.x,
          playerState.y,
          "player_idle"
        );
        if (!sprite) return;

        sprite.setTint(0x00ff00); // Green tint
        sprite.setData("health", playerState.health);
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

        // Update animation
        if (Math.abs(playerState.velocity_x) > 10) {
          sprite.play("player_run_anim", true);
        } else if (playerState.is_jumping || !playerState.is_grounded) {
          sprite.play("player_jump_anim", true);
        } else {
          sprite.play("player_idle_anim", true);
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
            "projectile"
          );
          if (!sprite || !sprite.body) continue;

          sprite.setDepth(15);
          sprite.setTint(0xff0000); // Red tint for network projectiles

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
}
