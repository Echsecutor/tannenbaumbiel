/**
 * Tannenbaumbiel Game - Main Entry Point
 */
import Phaser from "phaser";
import { GameConfig } from "./game/config";
import { NetworkManager } from "./network/NetworkManager";

class TannenbaumGame {
  private game: Phaser.Game | null = null;
  private networkManager: NetworkManager;

  constructor() {
    this.networkManager = new NetworkManager();

    // Expose networkManager globally for debugging and testing
    (window as any).networkManager = this.networkManager;

    this.init();
  }

  private async init() {
    try {
      // Initialize network connection
      await this.initializeNetwork();

      // Start game
      this.startGame();

      // Hide loading screen
      this.hideLoading();
    } catch (error) {
      console.error("Failed to initialize game:", error);
      this.showError(
        "Fehler beim Laden des Spiels. Bitte laden Sie die Seite neu."
      );
    }
  }

  private async initializeNetwork() {
    try {
      // Connect to game server
      const serverUrl =
        (import.meta as any).env.VITE_WS_URL || "ws://localhost:8000";

      console.log("Attempting to connect to:", `${serverUrl}/game`);
      await this.networkManager.connect(`${serverUrl}/game`);
      console.log("Connected to game server");
      this.hideError();
    } catch (error) {
      console.warn("Could not connect to game server:", error);
      this.showError(
        `Verbindung zum Spielserver fehlgeschlagen. Server-URL: ${serverUrl}/game. Das Spiel funktioniert im Offline-Modus.`
      );
      // Game can still work in offline mode
    }
  }

  private startGame() {
    // Create Phaser game instance
    this.game = new Phaser.Game({
      ...GameConfig,
      parent: "game-container",
      callbacks: {
        postBoot: (game) => {
          // Pass network manager to game
          game.registry.set("networkManager", this.networkManager);
        },
      },
    });

    console.log("Tannenbaumbiel game started!");
  }

  private hideLoading() {
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.style.display = "none";
    }
  }

  private showError(message: string) {
    const errorElement = document.getElementById("error-message");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = "block";
    }

    this.hideLoading();
  }

  private hideError() {
    const errorElement = document.getElementById("error-message");
    if (errorElement) {
      errorElement.style.display = "none";
    }
  }

  public destroy() {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }

    this.networkManager.disconnect();
  }
}

// Initialize game when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new TannenbaumGame();
});

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Game paused
    console.log("Game paused (tab hidden)");
  } else {
    // Game resumed
    console.log("Game resumed (tab visible)");
  }
});
