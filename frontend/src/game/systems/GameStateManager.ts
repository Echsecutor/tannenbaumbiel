/**
 * GameStateManager - Handles game over, victory, restart, and level progression
 */
import Phaser from "phaser";
import { NetworkSystem } from "./NetworkSystem";

export class GameStateManager {
  private scene: Phaser.Scene;
  private networkSystem: NetworkSystem;
  private isOffline: boolean;
  private roomData: any = null;
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

  setRoomData(roomData: any) {
    this.roomData = roomData;
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  setLevel(level: number) {
    this.currentLevel = level;
    console.log(`🎮 Level set to: ${this.currentLevel}`);
    // Emit level change event for UI update
    this.scene.game.events.emit("level-changed", this.currentLevel);
  }

  nextLevel() {
    this.currentLevel++;
    console.log(`🎮 Advanced to level: ${this.currentLevel}`);
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
        `Continue to Level ${this.currentLevel + 1}`,
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

    if (!this.isOffline && this.networkSystem.isOnline()) {
      console.log(
        "🏠 Leaving room before restart for proper synchronization..."
      );

      // Leave the room to notify other players
      this.networkSystem.leaveRoom();

      // Set flags for rejoin after restart
      this.setRejoinFlags();

      // Wait for leave message to be processed
      setTimeout(() => {
        console.log("🎮 Restarting scene after leaving room...");
        this.scene.scene.restart();
      }, 100);
    } else {
      // Offline mode - restart with offline flag preserved
      console.log("🎮 Offline restart - preserving offline mode...");
      this.scene.scene.restart({ offline: true });
    }

    onRestart();
  }

  private startNextLevel(onNextLevel: () => void) {
    console.log("🎮 Starting next level...");

    // Advance to next level
    this.nextLevel();

    if (this.isOffline) {
      // Offline mode - restart with offline flag preserved and current level
      console.log("🎮 Next level in offline mode...");
      this.scene.scene.restart({ offline: true, level: this.currentLevel });
    } else {
      // Online mode - handle multiplayer level transition
      console.log("🎮 Next level in multiplayer mode...");

      if (this.networkSystem.isOnline()) {
        // Clean up and notify other players we're moving to next level
        this.networkSystem.clearNetworkEntities();

        // Set flag to rejoin after level transition
        this.setRejoinFlags();

        // Restart scene - will automatically rejoin the room
        this.scene.scene.restart({ level: this.currentLevel });
      } else {
        // Connection lost - fallback to offline mode
        console.log(
          "⚠️ Connection lost, switching to offline mode for next level"
        );
        this.scene.scene.restart({ offline: true, level: this.currentLevel });
      }
    }

    onNextLevel();
  }

  private setRejoinFlags() {
    // Store rejoin information in scene registry
    this.scene.registry.set("shouldRejoinRoom", true);
    this.scene.registry.set("lastRoomData", this.roomData);

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

    if (shouldRejoin && lastRoomData && !this.isOffline) {
      console.log("🔄 Restart detected, will rejoin room:", lastRoomData);
      this.isOffline = false;
      this.roomData = lastRoomData;

      // Clear the rejoin flags
      this.scene.registry.set("shouldRejoinRoom", false);
      this.scene.registry.set("lastRoomData", null);

      return true;
    }

    return false;
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
      roomData: this.roomData,
      currentLevel: this.currentLevel,
      originalRoomName: this.scene.registry.get("originalRoomName"),
      originalUsername: this.scene.registry.get("originalUsername"),
    };
  }

  // Restore game state from save data
  restoreGameState(gameState: any) {
    this.isOffline = gameState.isOffline || false;
    this.roomData = gameState.roomData || null;
    this.currentLevel = gameState.currentLevel || 1;

    if (gameState.originalRoomName) {
      this.scene.registry.set("originalRoomName", gameState.originalRoomName);
    }
    if (gameState.originalUsername) {
      this.scene.registry.set("originalUsername", gameState.originalUsername);
    }
  }
}
