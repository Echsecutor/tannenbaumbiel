/**
 * Menu Scene - Main menu and room selection
 */
import Phaser, { Scene } from "phaser";
import { NetworkManager } from "../../network/NetworkManager";

export class MenuScene extends Scene {
  private networkManager!: NetworkManager;
  private menuForm!: Phaser.GameObjects.DOMElement;

  constructor() {
    super({ key: "MenuScene" });
  }

  preload() {
    // Load menu assets
    this.createMenuAssets();

    // Load HTML form for menu inputs
    this.load.html("menuform", "/game/forms/menu-form.html");
  }

  create() {
    console.log("MenuScene: Starting create method");

    this.networkManager = this.registry.get("networkManager");
    console.log("MenuScene: Network manager obtained:", !!this.networkManager);

    this.createBackground();
    console.log("MenuScene: Background created");

    this.createMenuForm();
    console.log("MenuScene: Menu form created");

    this.createConnectionStatus(); // Called after menuForm is created
    console.log("MenuScene: Connection status created");

    this.setupNetworkHandlers();
    console.log("MenuScene: Network handlers set up");

    console.log("MenuScene: Create method completed successfully");
  }

  private createMenuAssets() {
    // Create simple colored rectangles as placeholders
    this.add
      .graphics()
      .fillStyle(0x3498db)
      .fillRect(0, 0, 200, 50)
      .generateTexture("button", 200, 50);

    this.add
      .graphics()
      .fillStyle(0x2ecc71)
      .fillRect(0, 0, 200, 50)
      .generateTexture("button-hover", 200, 50);
  }

  private createBackground() {
    // Winter forest background (placeholder)
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2c3e50, 0x2c3e50, 0x34495e, 0x34495e);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);

    // Snow effect (simple)
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, this.scale.width);
      const y = Phaser.Math.Between(0, this.scale.height);
      const snowflake = this.add.circle(x, y, 2, 0xffffff, 0.8);

      // Animate snowflakes
      this.tweens.add({
        targets: snowflake,
        y: snowflake.y + this.scale.height,
        duration: Phaser.Math.Between(3000, 8000),
        repeat: -1,
        yoyo: false,
        onComplete: () => {
          snowflake.y = -10;
        },
      });
    }
  }

  private createMenuForm() {
    // Create embedded HTML form using Phaser's DOM support
    this.menuForm = this.add
      .dom(this.scale.width / 2, this.scale.height / 2)
      .createFromCache("menuform");

    // Set default values from localStorage
    const usernameInput = this.menuForm.getChildByName(
      "username"
    ) as HTMLInputElement;
    const roomnameInput = this.menuForm.getChildByName(
      "roomname"
    ) as HTMLInputElement;
    const serverUrlInput = this.menuForm.getChildByName(
      "serverurl"
    ) as HTMLInputElement;
    const joinButton = this.menuForm.getChildByID(
      "join-game-btn"
    ) as HTMLButtonElement;
    const offlineButton = this.menuForm.getChildByID(
      "offline-game-btn"
    ) as HTMLButtonElement;

    if (usernameInput) {
      usernameInput.value = localStorage.getItem("tannenbaum_username") || "";
    }

    if (roomnameInput) {
      roomnameInput.value = "Winterwald";
    }

    if (serverUrlInput) {
      serverUrlInput.value =
        localStorage.getItem("tannenbaum_serverurl") ||
        "https://server.tannenbaumbiel.echsecutables.de/";
    }

    // Setup button event listeners
    if (joinButton) {
      joinButton.addEventListener("click", () => this.joinGame());
    }

    if (offlineButton) {
      offlineButton.addEventListener("click", () => this.startOfflineGame());
    }

    // Setup sprite selection
    this.setupSpriteSelection();

    // Setup Enter key listener for form submission
    this.input.keyboard?.on("keydown-ENTER", () => {
      this.joinGame();
    });

    // Update connection status now that the form is created
    this.updateConnectionStatus();
  }

  private setupSpriteSelection() {
    if (!this.menuForm || !this.menuForm.node) return;

    const spriteButtons = this.menuForm.node.querySelectorAll(".sprite-button");

    // Load selected sprite from localStorage or default to dude_monster
    const savedSprite =
      localStorage.getItem("tannenbaum_selected_sprite") || "dude_monster";

    spriteButtons.forEach((button) => {
      const htmlButton = button as HTMLElement;
      const spriteType = htmlButton.getAttribute("data-sprite");

      // Set initial selection
      if (spriteType === savedSprite) {
        htmlButton.classList.add("selected");
      } else {
        htmlButton.classList.remove("selected");
      }

      // Add click handler
      htmlButton.addEventListener("click", () => {
        // Remove selected class from all buttons
        spriteButtons.forEach((btn) => btn.classList.remove("selected"));

        // Add selected class to clicked button
        htmlButton.classList.add("selected");

        // Save selection to localStorage
        if (spriteType) {
          localStorage.setItem("tannenbaum_selected_sprite", spriteType);
          console.log("🎨 MenuScene: Player sprite selected:", spriteType);
        }
      });
    });
  }

  private getSelectedSprite(): string {
    return localStorage.getItem("tannenbaum_selected_sprite") || "dude_monster";
  }

  private createConnectionStatus() {
    // Set up connection status listener (initial update already done in createMenuForm)
    if (this.networkManager) {
      this.networkManager.onConnectionChange((_connected) => {
        this.updateConnectionStatus();
      });
    }
  }

  public updateConnectionStatus() {
    const isConnected =
      this.networkManager && this.networkManager.getConnectionStatus();
    const statusText = isConnected
      ? "Verbindung: Verbunden"
      : "Verbindung: Getrennt";

    // Update the connection status in the embedded form
    if (this.menuForm && this.menuForm.node) {
      const statusElement = this.menuForm.node.querySelector(
        "#connection-status"
      ) as HTMLElement;
      const onlineButton = this.menuForm.node.querySelector(
        "#join-game-btn"
      ) as HTMLButtonElement;

      if (statusElement) {
        statusElement.textContent = statusText;

        // Remove all status classes and add the appropriate one
        statusElement.classList.remove(
          "connected",
          "disconnected",
          "connecting"
        );
        statusElement.classList.add(isConnected ? "connected" : "disconnected");

        console.log(
          `🎮 MenuScene Status Updated: '${statusText}' (${isConnected ? "CONNECTED" : "DISCONNECTED"})`
        );
      } else {
        console.warn(
          "⚠️ MenuScene: connection-status element not found in form!"
        );
      }

      // Hide/show online button based on connection status
      if (onlineButton) {
        onlineButton.style.display = isConnected ? "block" : "none";
        console.log(
          `🎮 MenuScene: Online button ${isConnected ? "shown" : "hidden"}`
        );
      } else {
        console.warn("⚠️ MenuScene: Online button not found in form!");
      }

      // Ensure offline button is always visible
      const offlineButton = this.menuForm.node.querySelector(
        "#offline-game-btn"
      ) as HTMLButtonElement;
      if (offlineButton) {
        offlineButton.style.display = "block";
        console.log("🎮 MenuScene: Offline button ensured visible");
      } else {
        console.warn("⚠️ MenuScene: Offline button not found in form!");
      }
    } else {
      console.log(
        "ℹ️ MenuScene: menuForm or DOM node not ready yet, status update skipped"
      );
    }
  }

  private setupNetworkHandlers() {
    if (this.networkManager) {
      this.networkManager.onMessage("room_joined", (data) => {
        console.log("🏠 MenuScene: Successfully joined room:", data);
        console.log(
          "🔍 MenuScene: Passing player ID to GameScene:",
          data.your_player_id
        );

        // Get the original join parameters for restart functionality
        const usernameInput = this.menuForm.getChildByName(
          "username"
        ) as HTMLInputElement;
        const roomnameInput = this.menuForm.getChildByName(
          "roomname"
        ) as HTMLInputElement;
        const originalUsername = usernameInput?.value.trim() || "Player";
        const originalRoomName = roomnameInput?.value.trim() || "Winterwald";

        // Start game scene with room data including player ID and original join parameters
        this.scene.start("GameScene", {
          roomData: data,
          myPlayerId: data.your_player_id,
          originalRoomName: originalRoomName,
          originalUsername: originalUsername,
          selectedSprite: this.getSelectedSprite(),
        });
      });

      this.networkManager.onMessage("error", (data) => {
        console.error("Server error:", data);
        // Show error message
        this.showError(data.message || "Unbekannter Fehler");
      });
    }
  }

  private joinGame() {
    const usernameInput = this.menuForm.getChildByName(
      "username"
    ) as HTMLInputElement;
    const roomnameInput = this.menuForm.getChildByName(
      "roomname"
    ) as HTMLInputElement;
    const serverUrlInput = this.menuForm.getChildByName(
      "serverurl"
    ) as HTMLInputElement;

    const username = usernameInput?.value.trim() || "";
    const roomName = roomnameInput?.value.trim() || "Winterwald";
    const serverUrl =
      serverUrlInput?.value.trim() ||
      "https://server.tannenbaumbiel.echsecutables.de/";

    if (!username) {
      this.showError("Bitte geben Sie einen Spielernamen ein");
      return;
    }

    if (!roomName) {
      this.showError("Bitte geben Sie einen Weltnamen ein");
      return;
    }

    if (!serverUrl) {
      this.showError("Bitte geben Sie eine Server-URL ein");
      return;
    }

    // Save form values
    localStorage.setItem("tannenbaum_username", username);
    localStorage.setItem("tannenbaum_serverurl", serverUrl);

    // Try to connect to the server with the provided URL
    this.connectToServer(serverUrl)
      .then(() => {
        if (this.networkManager && this.networkManager.getConnectionStatus()) {
          // Join multiplayer game
          this.networkManager.joinRoom(roomName, username);
        } else {
          // Start offline game
          this.startOfflineGame();
        }
      })
      .catch((error) => {
        console.error("Failed to connect to server:", error);
        this.showError(
          `Verbindung zum Server fehlgeschlagen: ${error.message}`
        );
      });
  }

  private startOfflineGame() {
    console.log("MenuScene: Starting offline game");
    // Start game scene in offline mode
    this.scene.start("GameScene", {
      offline: true,
      myPlayerId: "offline_player",
      originalRoomName: "Offline Mode",
      originalUsername: "Offline Player",
      selectedSprite: this.getSelectedSprite(),
    });
  }

  private async connectToServer(serverUrl: string): Promise<void> {
    if (!this.networkManager) {
      throw new Error("Network manager not available");
    }

    // Convert HTTP URLs to WebSocket URLs
    let wsUrl = serverUrl;
    if (serverUrl.startsWith("http://")) {
      wsUrl = serverUrl.replace("http://", "ws://");
    } else if (serverUrl.startsWith("https://")) {
      wsUrl = serverUrl.replace("https://", "wss://");
    }

    // Ensure the URL ends with /game for WebSocket endpoint
    if (!wsUrl.endsWith("/game")) {
      wsUrl = wsUrl.endsWith("/") ? wsUrl + "game" : wsUrl + "/game";
    }

    console.log("Attempting to connect to:", wsUrl);

    try {
      await this.networkManager.connect(wsUrl);
      console.log("Successfully connected to server");
      this.updateConnectionStatus();
    } catch (error) {
      console.error("Failed to connect to server:", error);
      this.updateConnectionStatus();
      throw error;
    }
  }

  private showError(message: string) {
    // Simple error display
    const errorText = this.add
      .text(this.scale.width / 2, 650, message, {
        fontSize: "18px",
        color: "#e74c3c",
        backgroundColor: "#2c3e50",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5);

    // Auto-hide after 3 seconds
    this.time.delayedCall(3000, () => {
      errorText.destroy();
    });
  }
}
