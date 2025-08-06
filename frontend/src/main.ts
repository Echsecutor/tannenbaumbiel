/**
 * Tannenbaumbiel Game - Main Entry Point
 */
import Phaser from "phaser";
import { GameConfig } from "./game/config";
import { NetworkManager } from "./network/NetworkManager";

class TannenbaumGame {
  private game: Phaser.Game | null = null;
  private networkManager: NetworkManager;
  private isFullscreen: boolean = false;

  constructor() {
    this.networkManager = new NetworkManager();

    // Expose networkManager globally for debugging and testing
    (window as any).networkManager = this.networkManager;

    this.setupFullscreenHandlers();
    this.init();
  }

  private setupFullscreenHandlers() {
    // Handle orientation change events
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        this.handleOrientationChange();
      }, 100);
    });

    // Handle fullscreen change events
    document.addEventListener("fullscreenchange", () => {
      this.isFullscreen = !!document.fullscreenElement;
      this.handleFullscreenChange();
    });

    // Listen for mobile device ready
    document.addEventListener("DOMContentLoaded", () => {
      // Add fullscreen button for mobile devices
      if (this.isMobileDevice()) {
        this.addFullscreenButton();
      }
    });
  }

  private isMobileDevice(): boolean {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    );
  }

  private async enterFullscreen() {
    try {
      const element = document.documentElement;

      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }

      // Try to lock orientation to landscape
      this.lockLandscapeOrientation();

      console.log("Fullscreen mode activated");
    } catch (error) {
      console.warn("Could not enter fullscreen mode:", error);
    }
  }

  private async lockLandscapeOrientation() {
    try {
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock("landscape");
        console.log("Orientation locked to landscape");
      }
    } catch (error) {
      console.warn("Could not lock orientation to landscape:", error);
    }
  }

  private addFullscreenButton() {
    const button = document.createElement("button");
    button.id = "fullscreen-btn";
    button.innerHTML = "🔳 Vollbild";
    button.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 2000;
      background: rgba(52, 152, 219, 0.8);
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.3s;
    `;

    button.addEventListener("click", () => {
      if (!this.isFullscreen) {
        this.enterFullscreen();
      }
    });

    button.addEventListener("mouseover", () => {
      button.style.background = "rgba(52, 152, 219, 1.0)";
    });

    button.addEventListener("mouseout", () => {
      button.style.background = "rgba(52, 152, 219, 0.8)";
    });

    document.body.appendChild(button);
  }

  private handleOrientationChange() {
    if (this.game && this.game.scale) {
      // Refresh game scale on orientation change
      this.game.scale.refresh();
      console.log("Game scale refreshed after orientation change");
    }
  }

  private handleFullscreenChange() {
    const button = document.getElementById("fullscreen-btn");
    if (button) {
      if (this.isFullscreen) {
        button.innerHTML = "↩️ Verlassen";
        button.style.display = "none"; // Hide in fullscreen
      } else {
        button.innerHTML = "🔳 Vollbild";
        button.style.display = "block";
      }
    }

    if (this.game && this.game.scale) {
      // Refresh game scale when entering/exiting fullscreen
      setTimeout(() => {
        this.game!.scale.refresh();
        console.log("Game scale refreshed after fullscreen change");
      }, 100);
    }
  }

  private async init() {
    try {
      // Network connection will be initiated from the MenuScene when user provides server URL
      // No automatic connection on startup

      // Start game in offline mode initially
      this.startGame();

      // Hide loading screen
      this.hideLoading();

      // Auto-enter fullscreen on mobile after game loads
      if (this.isMobileDevice()) {
        setTimeout(() => {
          console.log("Auto-entering fullscreen on mobile device");
          this.enterFullscreen();
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to initialize game:", error);
      this.showError(
        "Fehler beim Laden des Spiels. Bitte laden Sie die Seite neu."
      );
    }
  }

  private startGame() {
    try {
      console.log("Starting Phaser game...");

      // Create Phaser game instance
      this.game = new Phaser.Game({
        ...GameConfig,
        parent: "game-container",
        callbacks: {
          postBoot: (game) => {
            console.log("Phaser game booted, setting up registry...");
            // Pass network manager to game
            game.registry.set("networkManager", this.networkManager);
            console.log("Network manager added to registry");
          },
        },
      });

      console.log("Tannenbaumbiel game started!");
    } catch (error) {
      console.error("Error starting Phaser game:", error);
      throw error;
    }
  }

  private hideLoading() {
    console.log("Hiding loading screen...");
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.style.display = "none";
      console.log("Loading screen hidden");
    } else {
      console.warn("Loading element not found");
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
