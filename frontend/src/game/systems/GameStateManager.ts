/**
 * GameStateManager - Handles game over, victory, restart, and level progression
 */
import Phaser from "phaser";
import { NetworkSystem } from "./NetworkSystem";

export class GameStateManager {
  private scene: Phaser.Scene;
  private networkSystem: NetworkSystem;
  private isOffline: boolean;
  private currentLevel: number = 1;

  constructor(
    scene: Phaser.Scene,
    networkSystem: NetworkSystem,
    isOffline: boolean = false
  ) {
    this.scene = scene;
    this.networkSystem = networkSystem;
    this.isOffline = isOffline;
  }



  getCurrentLevel(): number {
    return this.currentLevel;
  }

  isBossLevel(): boolean {
    return this.currentLevel % 3 === 0;
  }

  setLevel(level: number) {
    this.currentLevel = level;
    console.log(
      `🎮 Level set to: ${this.currentLevel}${this.isBossLevel() ? " (BOSS LEVEL!)" : ""}`
    );
    // Emit level change event for UI update
    this.scene.game.events.emit("level-changed", this.currentLevel);
  }

  nextLevel() {
    this.currentLevel++;
    console.log(
      `🎮 Advanced to level: ${this.currentLevel}${this.isBossLevel() ? " (BOSS LEVEL!)" : ""}`
    );
    // Emit level change event for UI update
    this.scene.game.events.emit("level-changed", this.currentLevel);
  }

  showGameOver(onRestart: () => void) {
    console.log("Game Over!");

    // Pause physics
    this.scene.physics.pause();

    // Get camera center for positioning
    const camera = this.scene.cameras.main;
    const centerX = camera.centerX;
    const centerY = camera.centerY;

    // Show game over screen
    this.scene.add
      .text(centerX, centerY, "Game Over", {
        fontSize: "64px",
        color: "#e74c3c",
        backgroundColor: "#2c3e50",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.scene.add
      .text(centerX, centerY + 100, "Klicken zum Neustart", {
        fontSize: "24px",
        color: "#ffffff",
        backgroundColor: "#3498db",
        padding: { x: 15, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.restartGame(onRestart);
      });
  }

  showVictory(onNextLevel: () => void, onMenu: () => void) {
    console.log("Victory!");

    // Pause physics to stop all movement and prevent player death
    this.scene.physics.pause();

    // Play victory music instead of background music
    if ((this.scene as any).playVictoryMusic) {
      (this.scene as any).playVictoryMusic();
    }

    // Get camera center for positioning
    const camera = this.scene.cameras.main;
    const centerX = camera.centerX;
    const centerY = camera.centerY;

    this.scene.add
      .text(centerX, centerY - 50, `Level ${this.currentLevel} Complete!`, {
        fontSize: "48px",
        color: "#27ae60",
        backgroundColor: "#2c3e50",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.scene.add
      .text(centerX, centerY + 20, "🎉 Victory! 🎉", {
        fontSize: "32px",
        color: "#f1c40f",
        backgroundColor: "#2c3e50",
        padding: { x: 15, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.scene.add
      .text(
        centerX,
        centerY + 100,
        `Weiter zum Level ${this.currentLevel + 1}`,
        {
          fontSize: "24px",
          color: "#ffffff",
          backgroundColor: "#27ae60",
          padding: { x: 15, y: 8 },
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.startNextLevel(onNextLevel);
      });

    this.scene.add
      .text(centerX, centerY + 150, "Zurück zum Menü", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#34495e",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        onMenu();
      });
  }

  private restartGame(onRestart: () => void) {
    console.log("🔄 Starting game restart...");

    // Resume physics for restart
    this.scene.physics.resume();

    // Restore background music for restart (stops victory music if playing)
    if ((this.scene as any).restoreBackgroundMusic) {
      (this.scene as any).restoreBackgroundMusic();
    }

    if (!this.isOffline && this.networkSystem.isOnline()) {
      console.log(
        "🏠 Leaving room before restart for proper synchronization..."
      );

      // Preserve room data before reset - get it from NetworkSystem (single source of truth)
      const roomDataToPreserve = this.networkSystem.getCurrentRoomData();
      console.log("🔄 Preserving room data for rejoin:", roomDataToPreserve);

      // Leave the room to notify other players
      this.networkSystem.leaveRoom();

      // Reset network system state for clean restart
      this.networkSystem.resetState();

      // Set flags for rejoin after restart using preserved data
      this.setRejoinFlagsWithData(roomDataToPreserve);

      // Wait for leave message to be processed
      setTimeout(() => {
        console.log("🎮 Restarting scene after leaving room...");
        const selectedSprite =
          localStorage.getItem("tannenbaum_selected_sprite") || "dude_monster";
        
        // Get original join parameters for restart
        const originalRoomName = this.scene.registry.get("originalRoomName");
        const originalUsername = this.scene.registry.get("originalUsername");
        
        this.scene.scene.restart({ 
          selectedSprite,
          offline: false,
          isRestart: true,
          roomName: originalRoomName,
          username: originalUsername
        });
      }, 100);
    } else {
      // Offline mode - restart with offline flag preserved
      console.log("🎮 Offline restart - preserving offline mode...");
      const selectedSprite =
        localStorage.getItem("tannenbaum_selected_sprite") || "dude_monster";
      this.scene.scene.restart({ offline: true, selectedSprite });
    }

    onRestart();
  }

  private startNextLevel(onNextLevel: () => void) {
    console.log("🎮 Starting next level...");

    // Resume physics for next level
    this.scene.physics.resume();

    // Restore background music for next level
    if ((this.scene as any).restoreBackgroundMusic) {
      (this.scene as any).restoreBackgroundMusic();
    }

    // Let the callback handle level advancement and scene restart
    // (this prevents double increment and double restart)
    onNextLevel();
  }



  private setRejoinFlagsWithData(roomData: any) {
    // Store rejoin information in scene registry
    this.scene.registry.set("shouldRejoinRoom", true);
    this.scene.registry.set("lastRoomData", roomData);
    
    console.log("🚩 Setting rejoin flags:", {
      shouldRejoinRoom: true,
      lastRoomData: roomData
    });

    // Ensure original join parameters are preserved
    if (
      !this.scene.registry.get("originalRoomName") ||
      !this.scene.registry.get("originalUsername")
    ) {
      console.warn(
        "⚠️ Original join parameters missing during restart, using defaults"
      );
      this.scene.registry.set("originalRoomName", "Winterwald");
      this.scene.registry.set("originalUsername", "Player");
    }
  }

  autoRejoinAfterRestart(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log("🔄 Auto-rejoining room after restart...");

      // Check if we have the original join parameters stored
      const originalRoomName = this.scene.registry.get("originalRoomName");
      const originalUsername = this.scene.registry.get("originalUsername");

      if (!originalRoomName || !originalUsername) {
        console.error("❌ No original join parameters available for rejoin");
        resolve(false);
        return;
      }

      try {
        // Reset networking state
        this.networkSystem.reset();

        // Rejoin the room using the original parameters
        console.log(
          "🏠 Rejoining room:",
          originalRoomName,
          "as",
          originalUsername
        );
        this.networkSystem.rejoinRoom(originalRoomName, originalUsername);

        // Request world state after a short delay to allow room join to complete
        setTimeout(() => {
          console.log("🌍 Requesting world state after rejoin");
          this.networkSystem.requestWorldState();
        }, 500);

        console.log("✅ Rejoin process initiated");
        resolve(true);
      } catch (error) {
        console.error("❌ Error during auto-rejoin:", error);
        // Fall back to offline mode if rejoin fails
        this.isOffline = true;
        resolve(false);
      }
    });
  }

  // Check if this is a restart that should rejoin the room
  shouldAutoRejoin(): boolean {
    const shouldRejoin = this.scene.registry.get("shouldRejoinRoom");
    const lastRoomData = this.scene.registry.get("lastRoomData");
    
    console.log("🔍 shouldAutoRejoin debug:", { 
      shouldRejoin, 
      lastRoomData, 
      isOffline: this.isOffline 
    });

    // If we're in offline mode, don't auto-rejoin regardless of registry flags
    if (this.isOffline) {
      console.log("🔄 In offline mode, clearing any stale rejoin flags");
      this.clearRejoinFlags();
      return false;
    }

    if (shouldRejoin && lastRoomData) {
      console.log("🔄 Restart detected, will rejoin room:", lastRoomData);
      // Note: room data will be restored to NetworkSystem during rejoin process
      return true;
    }

    return false;
  }

  // Clear rejoin flags after rejoin process is complete
  clearRejoinFlags(): void {
    this.scene.registry.set("shouldRejoinRoom", false);
    this.scene.registry.set("lastRoomData", null);
  }

  setOfflineMode(offline: boolean) {
    this.isOffline = offline;
  }

  isInOfflineMode(): boolean {
    return this.isOffline;
  }

  // Store original join parameters for restart functionality
  storeOriginalJoinParameters(roomName?: string, username?: string) {
    if (roomName && username) {
      this.scene.registry.set("originalRoomName", roomName);
      this.scene.registry.set("originalUsername", username);
      console.log("💾 Stored original join parameters:", roomName, username);
    }
  }

  // Get game state for save/load functionality
  getGameState(): any {
    return {
      isOffline: this.isOffline,
      roomData: this.isOffline ? null : this.networkSystem.getCurrentRoomData(),
      currentLevel: this.currentLevel,
      originalRoomName: this.scene.registry.get("originalRoomName"),
      originalUsername: this.scene.registry.get("originalUsername"),
    };
  }

  // Restore game state from save data
  restoreGameState(gameState: any) {
    this.isOffline = gameState.isOffline || false;
    this.currentLevel = gameState.currentLevel || 1;
    // Room data will be restored to NetworkSystem if needed

    if (gameState.originalRoomName) {
      this.scene.registry.set("originalRoomName", gameState.originalRoomName);
    }
    if (gameState.originalUsername) {
      this.scene.registry.set("originalUsername", gameState.originalUsername);
    }
  }

  // Victory cheat - triggers instant level completion
  triggerVictoryCheat(onNextLevel?: () => void, onMainMenu?: () => void) {
    console.log("🎉 Victory cheat activated! Triggering level completion...");

    // Use the existing victory flow to ensure consistency
    // Use provided callbacks or defaults
    this.showVictory(
      onNextLevel || (() => {
        console.log("✅ Cheat victory - no next level callback provided");
      }),
      onMainMenu || (() => {
        // Return to menu option
        this.scene.scene.start("MenuScene");
      })
    );
  }
}
