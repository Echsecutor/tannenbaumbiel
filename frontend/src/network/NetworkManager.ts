/**
 * Network Manager for WebSocket communication with game server
 */

export interface GameMessage {
  type: string;
  timestamp: number;
  data?: any;
}

export class NetworkManager {
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private serverPlayerId: string | null = null; // Store server-provided player ID

  constructor() {
    this.setupMessageHandlers();
  }

  public async connect(url: string): Promise<void> {
    // Update status to connecting
    this.updateConnectionStatus("connecting");

    console.log("🔌 NetworkManager: Attempting WebSocket connection to:", url);
    console.log(
      "🔌 NetworkManager: WebSocket readyState before connection:",
      this.websocket?.readyState
    );

    return new Promise((resolve, reject) => {
      try {
        console.log("🔌 NetworkManager: Creating WebSocket instance...");
        this.websocket = new WebSocket(url);
        console.log(
          "🔌 NetworkManager: WebSocket instance created, readyState:",
          this.websocket.readyState
        );

        // Set a timeout for connection attempts
        const connectionTimeout = setTimeout(() => {
          if (
            this.websocket &&
            this.websocket.readyState === WebSocket.CONNECTING
          ) {
            console.log(
              "🔌 NetworkManager: Connection timeout after 10 seconds"
            );
            this.websocket.close();
            reject(
              new Error(`Connection timeout after 10 seconds. URL: ${url}`)
            );
          }
        }, 10000);

        this.websocket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log(
            "✅ NetworkManager: WebSocket connected successfully to:",
            url
          );
          console.log(
            "✅ NetworkManager: WebSocket readyState after connection:",
            this.websocket?.readyState
          );
          this.isConnected = true;
          this.notifyConnectionListeners(true);
          resolve();
        };

        this.websocket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log(
            "❌ NetworkManager: WebSocket disconnected:",
            event.code,
            event.reason,
            "URL:",
            url
          );
          console.log("❌ NetworkManager: Close event details:", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            readyState: this.websocket?.readyState,
          });
          this.isConnected = false;
          this.notifyConnectionListeners(false);

          // Note: We don't auto-reconnect to prevent falling back to wrong server URL
          // The UI will handle reconnection with the current URL from the input field
          console.log(
            "🔌 NetworkManager: Connection lost, but not auto-reconnecting to prevent URL fallback"
          );
        };

        this.websocket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error(
            "❌ NetworkManager: WebSocket error for URL:",
            url,
            error
          );
          console.error("❌ NetworkManager: Error details:", {
            error: error,
            readyState: this.websocket?.readyState,
            url: url,
          });
          this.isConnected = false;
          this.notifyConnectionListeners(false);
          reject(
            new Error(
              `WebSocket connection failed to ${url}. Check server availability and URL configuration.`
            )
          );
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.updateConnectionStatus("disconnected");
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        reject(
          new Error(
            `Failed to create WebSocket connection to ${url}: ${errorMessage}`
          )
        );
      }
    });
  }

  public disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
      this.isConnected = false;
      this.notifyConnectionListeners(false);
    }
  }

  public sendMessage(message: GameMessage): void {
    if (this.isConnected && this.websocket) {
      this.websocket.send(JSON.stringify(message));
    } else {
      console.warn("Cannot send message: WebSocket not connected");
    }
  }

  public joinRoom(roomName: string, username: string): void {
    this.sendMessage({
      type: "join_room",
      timestamp: Date.now(),
      data: {
        room_name: roomName,
        username: username,
        character_type: "hero1",
      },
    });
  }

  public leaveRoom(): void {
    this.sendMessage({
      type: "leave_room",
      timestamp: Date.now(),
    });
  }

  public sendPlayerInput(action: string, pressed: boolean = true): void {
    // Map frontend action names to protocol action names
    const actionMap: { [key: string]: string } = {
      left: "move_left",
      right: "move_right",
      jump: "jump",
      shoot: "shoot",
    };

    const protocolAction = actionMap[action] || action;

    this.sendMessage({
      type: "player_input",
      timestamp: Date.now(),
      data: {
        action: protocolAction,
        player_id: this.serverPlayerId || this.getPlayerId(), // Use server ID if available
        pressed: pressed,
      },
    });
  }

  public setServerPlayerId(playerId: string): void {
    this.serverPlayerId = playerId;
    console.log("🎮 NetworkManager: Server player ID set to:", playerId);
  }

  public getServerPlayerId(): string | null {
    return this.serverPlayerId;
  }

  public ping(): void {
    this.sendMessage({
      type: "ping",
      timestamp: Date.now(),
    });
  }

  public onMessage(messageType: string, handler: (data: any) => void): void {
    this.messageHandlers.set(messageType, handler);
  }

  public onConnectionChange(listener: (connected: boolean) => void): void {
    this.connectionListeners.add(listener);
  }

  public removeConnectionListener(
    listener: (connected: boolean) => void
  ): void {
    this.connectionListeners.delete(listener);
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  private handleMessage(data: string): void {
    try {
      const message: GameMessage = JSON.parse(data);
      const handler = this.messageHandlers.get(message.type);

      if (handler) {
        handler(message.data);
      } else {
        console.log("Unhandled message type:", message.type, message.data);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }

  private setupMessageHandlers(): void {
    // Default message handlers
    // Note: room_joined and game_state handlers are registered by NetworkSystem
    // to avoid conflicts with multiple components trying to handle the same messages

    this.onMessage("room_left", (data) => {
      console.log("Left room:", data);
    });

    this.onMessage("player_joined", (data) => {
      console.log("Player joined:", data);
    });

    this.onMessage("player_left", (data) => {
      console.log("Player left:", data);
    });

    this.onMessage("error", (data) => {
      console.error("Server error:", data);
    });

    this.onMessage("pong", (data) => {
      console.log("Pong received:", data);
    });
  }

  private notifyConnectionListeners(connected: boolean): void {
    console.log(
      `🔄 NetworkManager: Updating connection status to ${connected ? "CONNECTED" : "DISCONNECTED"}`
    );

    // Update HTML connection status element first
    this.updateConnectionStatus(connected ? "connected" : "disconnected");

    // Notify all game scene listeners
    console.log(
      `📢 NetworkManager: Notifying ${this.connectionListeners.size} listeners`
    );
    this.connectionListeners.forEach((listener) => {
      try {
        listener(connected);
      } catch (error) {
        console.error("Error in connection listener:", error);
      }
    });
  }

  private updateConnectionStatus(
    status: "connecting" | "connected" | "disconnected"
  ): void {
    // Connection status is now managed by MenuScene in the form HTML
    // This method is kept for compatibility but only logs the status change
    console.log(
      `📱 NetworkManager: Connection status changed to ${status.toUpperCase()}`
    );
  }

  private getPlayerId(): string {
    // Generate or retrieve player ID
    let playerId = localStorage.getItem("tannenbaum_player_id");
    if (!playerId) {
      playerId = "player_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("tannenbaum_player_id", playerId);
    }
    return playerId;
  }
}
