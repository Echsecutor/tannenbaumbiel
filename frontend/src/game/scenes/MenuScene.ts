/**
 * Menu Scene - Main menu and room selection
 */
import Phaser, { Scene } from "phaser";
import { NetworkManager } from "../../network/NetworkManager";

export class MenuScene extends Scene {
  private networkManager!: NetworkManager;
  private menuForm!: Phaser.GameObjects.DOMElement;
  private stage1Data: {
    username: string;
    selectedSprite: string;
  } = {
    username: "",
    selectedSprite: "dude_monster",
  };
  private serverUrlChangeTimeout: number | null = null;

  constructor() {
    super({ key: "MenuScene" });
  }

  preload() {
    // Load HTML forms for menu inputs
    this.load.html("menuform-stage1", "/game/forms/menu-form-stage1.html");
    this.load.html("menuform-stage2", "/game/forms/menu-form-stage2.html");
  }

  create() {
    console.log("MenuScene: Starting create method");

    this.networkManager = this.registry.get("networkManager");
    console.log("MenuScene: Network manager obtained:", !!this.networkManager);

    this.createBackground();
    console.log("MenuScene: Background created");

    this.createStage1Menu();
    console.log("MenuScene: Stage 1 menu created");

    this.setupNetworkHandlers();
    console.log("MenuScene: Network handlers set up");

    console.log("MenuScene: Create method completed successfully");
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

  private createStage1Menu() {
    console.log("🎮 MenuScene: Creating stage 1 menu...");

    // Remove existing menu form if any
    if (this.menuForm) {
      this.menuForm.destroy();
    }

    // Create embedded HTML form using Phaser's DOM support
    this.menuForm = this.add
      .dom(this.scale.width / 2, this.scale.height / 2)
      .createFromCache("menuform-stage1");

    console.log("🎮 MenuScene: Stage 1 menu form created:", {
      menuForm: !!this.menuForm,
      menuFormNode: !!this.menuForm?.node,
    });

    // Set default values from localStorage
    const usernameInput = this.menuForm.getChildByName(
      "username"
    ) as HTMLInputElement;

    if (usernameInput) {
      usernameInput.value = localStorage.getItem("tannenbaum_username") || "";
    }

    // Setup button event listeners
    const singlePlayerButton = this.menuForm.getChildByID(
      "single-player-btn"
    ) as HTMLButtonElement;
    const multiPlayerButton = this.menuForm.getChildByID(
      "multi-player-btn"
    ) as HTMLButtonElement;

    console.log("🎮 MenuScene: Stage 1 buttons found:", {
      singlePlayerButton: !!singlePlayerButton,
      multiPlayerButton: !!multiPlayerButton,
    });

    if (singlePlayerButton) {
      singlePlayerButton.addEventListener("click", () => {
        console.log("🎮 MenuScene: Single player button clicked!");
        this.handleSinglePlayer();
      });
    }

    if (multiPlayerButton) {
      multiPlayerButton.addEventListener("click", () => {
        console.log("🎮 MenuScene: Multi player button clicked!");
        this.handleMultiPlayer();
      });
    }

    // Setup sprite selection
    this.setupSpriteSelection();

    // Setup Enter key listener for form submission
    this.input.keyboard?.on("keydown-ENTER", () => {
      this.handleSinglePlayer();
    });
  }

  private createStage2Menu() {
    console.log("🎮 MenuScene: Creating stage 2 menu...");

    // Remove existing menu form if any
    if (this.menuForm) {
      this.menuForm.destroy();
    }

    // Create embedded HTML form using Phaser's DOM support
    this.menuForm = this.add
      .dom(this.scale.width / 2, this.scale.height / 2)
      .createFromCache("menuform-stage2");

    console.log("🎮 MenuScene: Stage 2 menu form created:", {
      menuForm: !!this.menuForm,
      menuFormNode: !!this.menuForm?.node,
    });

    // Set default values
    const roomnameInput = this.menuForm.getChildByName(
      "roomname"
    ) as HTMLInputElement;
    const serverUrlInput = this.menuForm.getChildByName(
      "serverurl"
    ) as HTMLInputElement;

    if (roomnameInput) {
      roomnameInput.value = "Winterwald";
    }

    if (serverUrlInput) {
      serverUrlInput.value =
        localStorage.getItem("tannenbaum_serverurl") ||
        "https://server.tannenbaumbiel.echsecutables.de/";

      // Add listener for server URL changes with debouncing
      serverUrlInput.addEventListener("input", () => {
        console.log(
          "🌐 MenuScene: Server URL changed, scheduling auto-connection"
        );

        // Clear existing timeout
        if (this.serverUrlChangeTimeout) {
          clearTimeout(this.serverUrlChangeTimeout);
        }

        // Debounce the connection attempt to avoid rapid reconnections
        this.serverUrlChangeTimeout = window.setTimeout(() => {
          console.log("🌐 MenuScene: Executing debounced auto-connection");
          this.attemptAutoConnection();
        }, 1000); // Wait 1 second after user stops typing
      });
    }

    // Setup button event listeners
    const startMultiplayerButton = this.menuForm.getChildByID(
      "start-multiplayer-btn"
    ) as HTMLButtonElement;
    const backButton = this.menuForm.getChildByID(
      "back-btn"
    ) as HTMLButtonElement;

    if (startMultiplayerButton) {
      startMultiplayerButton.addEventListener("click", () => {
        console.log("🎮 MenuScene: Start multiplayer button clicked!");
        this.joinMultiplayerGame();
      });
    }

    if (backButton) {
      backButton.addEventListener("click", () => {
        console.log("🎮 MenuScene: Back button clicked!");
        this.backToStage1();
      });
    }

    // Update connection status now that the form is created
    this.updateConnectionStatus();

    // Only attempt automatic connection if not already connected
    if (!this.networkManager.getConnectionStatus()) {
      console.log(
        "🌐 MenuScene: Attempting initial auto-connection with default URL"
      );
      this.attemptAutoConnection();
    } else {
      console.log(
        "🌐 MenuScene: Already connected, skipping initial auto-connection"
      );
    }
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
          this.stage1Data.selectedSprite = spriteType;
          console.log("🎨 MenuScene: Player sprite selected:", spriteType);
        }
      });
    });
  }

  private handleSinglePlayer() {
    console.log("🎮 MenuScene: Handling single player selection");

    // Get username from stage 1
    const usernameInput = this.menuForm.getChildByName(
      "username"
    ) as HTMLInputElement;
    const username = usernameInput?.value.trim() || "";

    if (!username) {
      this.showError("Bitte geben Sie einen Spielernamen ein");
      return;
    }

    // Save username
    localStorage.setItem("tannenbaum_username", username);
    this.stage1Data.username = username;

    // Start offline game
    this.startOfflineGame();
  }

  private handleMultiPlayer() {
    console.log("🎮 MenuScene: Handling multi player selection");

    // Get username from stage 1
    const usernameInput = this.menuForm.getChildByName(
      "username"
    ) as HTMLInputElement;
    const username = usernameInput?.value.trim() || "";

    if (!username) {
      this.showError("Bitte geben Sie einen Spielernamen ein");
      return;
    }

    // Save username
    localStorage.setItem("tannenbaum_username", username);
    this.stage1Data.username = username;

    // Switch to stage 2
    this.createStage2Menu();
  }

  private backToStage1() {
    console.log("🎮 MenuScene: Going back to stage 1");
    this.createStage1Menu();
  }

  private updateConnectionStatus() {
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
      const startMultiplayerButton = this.menuForm.node.querySelector(
        "#start-multiplayer-btn"
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

      // Enable/disable start multiplayer button based on connection status
      if (startMultiplayerButton) {
        startMultiplayerButton.disabled = !isConnected;
        console.log(
          `🎮 MenuScene: Start multiplayer button ${isConnected ? "enabled" : "disabled"}`
        );
      } else {
        console.warn(
          "⚠️ MenuScene: Start multiplayer button not found in form!"
        );
      }
    } else {
      console.log(
        "ℹ️ MenuScene: menuForm or DOM node not ready yet, status update skipped"
      );
    }
  }

  private setupNetworkHandlers() {
    if (this.networkManager) {
      this.networkManager.onConnectionChange((_connected) => {
        this.updateConnectionStatus();
      });

      this.networkManager.onMessage("room_joined", (data) => {
        console.log("🏠 MenuScene: Successfully joined room:", data);
        console.log(
          "🔍 MenuScene: Passing player ID to GameScene:",
          data.your_player_id
        );

        // Get the original join parameters for restart functionality
        const roomnameInput = this.menuForm.getChildByName(
          "roomname"
        ) as HTMLInputElement;
        const originalRoomName = roomnameInput?.value.trim() || "Winterwald";

        // Start game scene with room data including player ID and original join parameters
        // Pass roomJoined flag to indicate GameScene should send ready_for_world acknowledgment
        this.scene.start("GameScene", {
          roomData: data,
          myPlayerId: data.your_player_id,
          originalRoomName: originalRoomName,
          originalUsername: this.stage1Data.username,
          selectedSprite: this.stage1Data.selectedSprite,
          roomJoined: true, // Flag to indicate room join was already processed
        });
      });

      this.networkManager.onMessage("error", (data) => {
        console.error("Server error:", data);
        // Show error message
        this.showError(data.message || "Unbekannter Fehler");
      });
    }
  }

  private joinMultiplayerGame() {
    console.log("🎮 MenuScene: joinMultiplayerGame() method called");

    const roomnameInput = this.menuForm.getChildByName(
      "roomname"
    ) as HTMLInputElement;
    const serverUrlInput = this.menuForm.getChildByName(
      "serverurl"
    ) as HTMLInputElement;

    const roomName = roomnameInput?.value.trim() || "Winterwald";
    const serverUrl = serverUrlInput?.value.trim();

    console.log("🎮 MenuScene: Form values:", {
      roomName,
      serverUrl,
      roomnameInput: !!roomnameInput,
      serverUrlInput: !!serverUrlInput,
    });

    if (!roomName) {
      this.showError("Bitte geben Sie einen Weltnamen ein");
      return;
    }

    if (!serverUrl) {
      this.showError("Bitte geben Sie eine Server-URL ein");
      return;
    }

    // Save form values
    localStorage.setItem("tannenbaum_serverurl", serverUrl);

    // Try to connect to the server with the provided URL
    this.connectToServer(serverUrl)
      .then(() => {
        if (this.networkManager && this.networkManager.getConnectionStatus()) {
          // Join multiplayer game
          this.networkManager.joinRoom(roomName, this.stage1Data.username);
        } else {
          this.showError("Verbindung zum Server fehlgeschlagen");
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
      originalUsername: this.stage1Data.username,
      selectedSprite: this.stage1Data.selectedSprite,
    });
  }

  private async connectToServer(serverUrl: string): Promise<void> {
    if (!this.networkManager) {
      throw new Error("Network manager not available");
    }

    // Convert HTTP URLs to WebSocket URLs using URL constructor for proper parsing
    let wsUrl = serverUrl;
    console.log("🌐 MenuScene: Original URL:", serverUrl);

    try {
      // Use URL constructor to properly parse the URL and preserve all components
      const url = new URL(serverUrl);

      if (url.protocol === "http:") {
        url.protocol = "ws:";
      } else if (url.protocol === "https:") {
        url.protocol = "wss:";
      }

      // Ensure the pathname ends with /ws/game
      if (!url.pathname.endsWith("/ws/game")) {
        if (url.pathname.endsWith("/")) {
          url.pathname = url.pathname + "ws/game";
        } else {
          url.pathname = url.pathname + "/ws/game";
        }
      }

      wsUrl = url.toString();
      console.log("🌐 MenuScene: After URL parsing and conversion:", wsUrl);
    } catch (error) {
      console.error(
        "🌐 MenuScene: Error parsing URL, falling back to string replacement:",
        error
      );

      // Fallback to string replacement method
      if (serverUrl.startsWith("http://")) {
        wsUrl = serverUrl.replace("http://", "ws://");
        console.log(
          "🌐 MenuScene: After HTTP->WS conversion (fallback):",
          wsUrl
        );
      } else if (serverUrl.startsWith("https://")) {
        wsUrl = serverUrl.replace("https://", "wss://");
        console.log(
          "🌐 MenuScene: After HTTPS->WSS conversion (fallback):",
          wsUrl
        );
      }

      // Ensure the URL ends with /ws/game for WebSocket endpoint
      if (!wsUrl.endsWith("/ws/game")) {
        if (wsUrl.endsWith("/")) {
          wsUrl = wsUrl + "ws/game";
        } else {
          wsUrl = wsUrl + "/ws/game";
        }
        console.log("🌐 MenuScene: After adding /ws/game (fallback):", wsUrl);
      }
    }

    console.log("🌐 MenuScene: Attempting to connect to:", wsUrl);
    console.log("🌐 MenuScene: Original server URL:", serverUrl);
    console.log(
      "🌐 MenuScene: NetworkManager available:",
      !!this.networkManager
    );

    try {
      await this.networkManager.connect(wsUrl);
      console.log("✅ MenuScene: Successfully connected to server");
      this.updateConnectionStatus();
    } catch (error) {
      console.error("❌ MenuScene: Failed to connect to server:", error);
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

  destroy() {
    // Clean up timeout when scene is destroyed
    if (this.serverUrlChangeTimeout) {
      clearTimeout(this.serverUrlChangeTimeout);
      this.serverUrlChangeTimeout = null;
    }
  }

  private async attemptAutoConnection(): Promise<void> {
    if (!this.menuForm || !this.networkManager) {
      console.log(
        "🌐 MenuScene: Cannot attempt auto-connection - form or network manager not ready"
      );
      return;
    }

    const serverUrlInput = this.menuForm.getChildByName(
      "serverurl"
    ) as HTMLInputElement;

    if (!serverUrlInput) {
      console.log(
        "🌐 MenuScene: Cannot attempt auto-connection - server URL input not found"
      );
      return;
    }

    const serverUrl = serverUrlInput.value.trim();
    if (!serverUrl) {
      console.log(
        "🌐 MenuScene: Cannot attempt auto-connection - no server URL provided"
      );
      return;
    }

    // Always save the current URL to localStorage to ensure it's the "current" URL
    localStorage.setItem("tannenbaum_serverurl", serverUrl);
    console.log("🌐 MenuScene: Saved current URL to localStorage:", serverUrl);

    // If already connected, disconnect first to allow reconnection to new URL
    if (this.networkManager.getConnectionStatus()) {
      console.log(
        "🌐 MenuScene: Disconnecting from current server to reconnect to new URL"
      );
      this.networkManager.disconnect();
      // Give a small delay for the disconnect to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("🌐 MenuScene: Attempting auto-connection to:", serverUrl);

    try {
      await this.connectToServer(serverUrl);
      console.log("✅ MenuScene: Auto-connection successful");
    } catch (error) {
      console.log("❌ MenuScene: Auto-connection failed:", error);
      // Don't show error message for auto-connection failures
      // User can still manually connect if needed
    }
  }
}
