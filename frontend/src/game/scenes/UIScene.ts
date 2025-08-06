/**
 * UI Scene - HUD and user interface overlay
 */
import { Scene } from "phaser";
import { NetworkManager } from "../../network/NetworkManager";

export class UIScene extends Scene {
  private networkManager!: NetworkManager;
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private multiplayerScoreText!: Phaser.GameObjects.Text;
  private connectionText!: Phaser.GameObjects.Text;
  private menuButton!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  private score = 0;
  private health = 100;
  private currentLevel = 1;

  // Victory cheat properties
  private levelClickCount = 0;
  private lastClickTime = 0;
  private readonly CLICK_RESET_TIMEOUT = 2000; // Reset clicks after 2 seconds of inactivity

  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    this.networkManager = this.registry.get("networkManager");

    this.createHealthBar();
    this.createScoreDisplay();
    this.createLevelDisplay();
    this.createMultiplayerScoreDisplay();
    this.createConnectionStatus();
    this.createMenuButton();
    this.createAudioToggle();

    // Start listening for game events
    this.setupEventListeners();

    // Check connection status periodically
    this.time.addEvent({
      delay: 1000, // Check every second
      callback: () => {
        this.updateConnectionStatus();
        this.updateMultiplayerScores();
      },
      loop: true,
    });
  }

  private createHealthBar() {
    // Health bar background
    this.add
      .graphics()
      .fillStyle(0x2c3e50)
      .fillRect(20, 20, 204, 24)
      .lineStyle(2, 0xffffff)
      .strokeRect(20, 20, 204, 24)
      .setDepth(997)
      .setScrollFactor(0); // Don't scroll with camera

    // Health bar fill
    this.healthBar = this.add.graphics().setDepth(998).setScrollFactor(0); // Don't scroll with camera

    // Health text
    this.healthText = this.add
      .text(30, 25, `Leben: ${this.health}`, {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "Arial",
      })
      .setDepth(999)
      .setScrollFactor(0); // Don't scroll with camera

    // Update health bar after all components are created
    this.updateHealthBar();
  }

  private createScoreDisplay() {
    const x = this.scale.width - 20;
    const y = 20;
    console.log(
      `🎯 UIScene: Creating score display at (${x}, ${y}), screen size: ${this.scale.width}x${this.scale.height}`
    );

    this.scoreText = this.add
      .text(x, y, `Punkte: ${this.score}`, {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "Arial",
        backgroundColor: "#000000", // Add black background for visibility
        padding: { x: 5, y: 2 },
      })
      .setOrigin(1, 0)
      .setDepth(1000) // High depth to ensure it's on top
      .setScrollFactor(0); // Don't scroll with camera

    console.log(
      `🎯 UIScene: Score text created at position:`,
      this.scoreText.x,
      this.scoreText.y
    );
  }

  private createLevelDisplay() {
    const x = this.scale.width / 2;
    const y = 20;
    console.log(
      `🎮 UIScene: Creating level display at center-top (${x}, ${y})`
    );

    this.levelText = this.add
      .text(x, y, `Level ${this.currentLevel}`, {
        fontSize: "24px",
        color: "#ffffff",
        fontFamily: "Arial",
        backgroundColor: "#2c3e50", // Dark blue background
        padding: { x: 15, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setDepth(1000) // High depth to ensure it's on top
      .setScrollFactor(0) // Don't scroll with camera
      .setInteractive({ useHandCursor: true }) // Make clickable for cheat
      .on("pointerdown", () => this.handleLevelClick())
      .on("pointerover", () => {
        // Subtle hover effect for cheat discoverability
        this.levelText.setStyle({ backgroundColor: "#34495e" });
      })
      .on("pointerout", () => {
        this.levelText.setStyle({ backgroundColor: "#2c3e50" });
      });

    console.log(
      `🎮 UIScene: Level text created at position:`,
      this.levelText.x,
      this.levelText.y
    );
  }

  private createMultiplayerScoreDisplay() {
    this.multiplayerScoreText = this.add
      .text(this.scale.width - 20, 50, "", {
        fontSize: "14px",
        color: "#95a5a6",
        fontFamily: "Arial",
      })
      .setOrigin(1, 0)
      .setDepth(999)
      .setScrollFactor(0); // Don't scroll with camera
  }

  private createConnectionStatus() {
    this.connectionText = this.add
      .text(this.scale.width / 2, 60, "", {
        fontSize: "14px",
        color: "#95a5a6",
        fontFamily: "Arial",
      })
      .setOrigin(0.5, 0)
      .setDepth(998)
      .setScrollFactor(0); // Don't scroll with camera

    this.updateConnectionStatus();

    if (this.networkManager) {
      this.networkManager.onConnectionChange((_connected) => {
        this.updateConnectionStatus();
      });
    }
  }

  private createMenuButton() {
    this.menuButton = this.add
      .text(20, this.scale.height - 50, "Menü", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#34495e",
        padding: { x: 10, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(100) // Lower than mobile controls (depth 1000)
      .setScrollFactor(0) // Don't scroll with camera
      .on("pointerdown", () => this.returnToMenu())
      .on("pointerover", () =>
        this.menuButton.setStyle({ backgroundColor: "#2c3e50" })
      )
      .on("pointerout", () =>
        this.menuButton.setStyle({ backgroundColor: "#34495e" })
      );
  }

  private createAudioToggle() {
    const audioButton = this.add
      .text(this.scale.width - 20, this.scale.height - 50, "🔊", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#34495e",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(100) // Lower than mobile controls (depth 1000)
      .setScrollFactor(0) // Don't scroll with camera
      .on("pointerdown", () => this.toggleAudio(audioButton))
      .on("pointerover", () =>
        audioButton.setStyle({ backgroundColor: "#2c3e50" })
      )
      .on("pointerout", () =>
        audioButton.setStyle({ backgroundColor: "#34495e" })
      );
  }

  private setupEventListeners() {
    // Listen for game events from the main game scene
    this.game.events.on("health-changed", (newHealth: number) => {
      this.health = newHealth;
      this.updateHealthBar();
    });

    this.game.events.on("score-changed", (newScore: number) => {
      console.log(
        `🎯 UIScene: Received score-changed event with score: ${newScore}`
      );
      this.score = newScore;
      this.updateScoreDisplay();
    });

    this.game.events.on("level-changed", (newLevel: number) => {
      console.log(
        `🎮 UIScene: Received level-changed event with level: ${newLevel}`
      );
      this.currentLevel = newLevel;
      this.updateLevelDisplay();
    });

    // Listen for network game state updates to refresh multiplayer scores
    this.game.events.on("network-state-updated", () => {
      this.updateMultiplayerScores();
    });
  }

  private updateHealthBar() {
    this.healthBar.clear();

    // Health bar fill color based on health percentage
    let fillColor = 0x27ae60; // Green
    if (this.health < 60) fillColor = 0xf39c12; // Orange
    if (this.health < 30) fillColor = 0xe74c3c; // Red

    const fillWidth = Math.max(0, (this.health / 100) * 200);

    this.healthBar.fillStyle(fillColor).fillRect(22, 22, fillWidth, 20);

    this.healthText.setText(`Leben: ${this.health}`);
  }

  private updateScoreDisplay() {
    console.log(`🎯 UIScene: Updating score display to ${this.score} points`);
    if (this.scoreText) {
      this.scoreText.setText(`Punkte: ${this.score}`);
      console.log(`🎯 UIScene: Score display updated successfully`);
    } else {
      console.warn(`⚠️ UIScene: scoreText object not initialized!`);
    }
  }

  private updateLevelDisplay() {
    const isBossLevel = this.currentLevel % 5 === 0;
    const displayText = isBossLevel
      ? `BOSS LEVEL ${this.currentLevel}`
      : `Level ${this.currentLevel}`;
    const textColor = isBossLevel ? "#e74c3c" : "#ffffff"; // Red for boss levels

    console.log(`🎮 UIScene: Updating level display to ${displayText}`);
    if (this.levelText) {
      this.levelText.setText(displayText);
      this.levelText.setColor(textColor);
      console.log(`🎮 UIScene: Level display updated successfully`);
    } else {
      console.warn(`⚠️ UIScene: levelText object not initialized!`);
    }
  }

  private handleLevelClick() {
    const currentTime = Date.now();

    // Reset click count if too much time passed since last click
    if (currentTime - this.lastClickTime > this.CLICK_RESET_TIMEOUT) {
      this.levelClickCount = 0;
    }

    this.levelClickCount++;
    this.lastClickTime = currentTime;

    console.log(`🎮 Level clicked ${this.levelClickCount}/5 times`);

    // Add visual feedback for each click
    this.levelText.setScale(1.1, 1.1);
    this.time.delayedCall(100, () => {
      if (this.levelText) {
        this.levelText.setScale(1, 1);
      }
    });

    // Trigger victory cheat if clicked 5 times
    if (this.levelClickCount >= 5) {
      console.log("🎉 Victory cheat activated!");
      this.levelClickCount = 0; // Reset for next use

      // Emit event to trigger victory in the game scene
      this.game.events.emit("victory-cheat-triggered");

      // Visual feedback for cheat activation
      this.levelText.setTint(0x00ff00); // Green tint
      this.time.delayedCall(500, () => {
        if (this.levelText) {
          this.levelText.clearTint();
        }
      });
    }
  }

  private updateMultiplayerScores() {
    // Get NetworkSystem from the game scene
    const gameScene = this.scene.get("GameScene");
    if (!gameScene || !gameScene.scene.settings.data) return;

    // Access network system through the game scene's data
    const networkSystem = (gameScene as any).networkSystem;
    if (!networkSystem || !networkSystem.isOnline()) {
      this.multiplayerScoreText.setText("");
      return;
    }

    const otherPlayerScores = networkSystem.getAllPlayerScores();
    if (otherPlayerScores.length === 0) {
      this.multiplayerScoreText.setText("");
      return;
    }

    // Format scores for display
    const scoreLines = otherPlayerScores.map(
      (player: { playerId: string; username: string; score: number }) =>
        `${player.username}: ${player.score}`
    );

    this.multiplayerScoreText.setText(
      "Andere Spieler:\n" + scoreLines.join("\n")
    );
  }

  public updateConnectionStatus() {
    // Get fresh NetworkManager from registry each time
    const currentNetworkManager = this.registry.get("networkManager");
    const isConnected = currentNetworkManager
      ? currentNetworkManager.getConnectionStatus()
      : false;

    if (this.connectionText) {
      if (currentNetworkManager && isConnected) {
        this.connectionText.setText("Online: Verbunden");
        this.connectionText.setColor("#27ae60");
        console.log(
          `🎮 UIScene Status Updated: 'Online: Verbunden' (CONNECTED)`
        );
      } else {
        this.connectionText.setText("Offline Modus");
        this.connectionText.setColor("#95a5a6");
        console.log(
          `🎮 UIScene Status Updated: 'Offline Modus' (DISCONNECTED)`
        );
      }
    } else {
      console.warn("⚠️ UIScene: connectionText object not initialized!");
    }
  }

  private toggleAudio(button: Phaser.GameObjects.Text) {
    // Toggle audio on/off
    const audioEnabled = this.sound.mute;
    this.sound.setMute(!audioEnabled);

    button.setText(audioEnabled ? "🔊" : "🔇");

    // Store preference
    localStorage.setItem(
      "tannenbaum_audio",
      audioEnabled ? "enabled" : "disabled"
    );
  }

  private returnToMenu() {
    // Confirm dialog (simple implementation)
    const confirmDialog = this.add.container(
      this.scale.width / 2,
      this.scale.height / 2
    );

    const background = this.add
      .graphics()
      .fillStyle(0x2c3e50, 0.9)
      .fillRect(-150, -75, 300, 150)
      .lineStyle(2, 0xffffff)
      .strokeRect(-150, -75, 300, 150);

    const questionText = this.add
      .text(0, -30, "Zurück zum Menü?", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const yesButton = this.add
      .text(-50, 20, "Ja", {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#e74c3c",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        // Leave room if online
        if (this.networkManager && this.networkManager.getConnectionStatus()) {
          this.networkManager.leaveRoom();
        }

        // Stop all scenes and return to menu
        this.scene.stop("GameScene");
        this.scene.stop("UIScene");
        this.scene.start("MenuScene");
      });

    const noButton = this.add
      .text(50, 20, "Nein", {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#27ae60",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        confirmDialog.destroy();
      });

    confirmDialog.add([background, questionText, yesButton, noButton]);
  }
}
