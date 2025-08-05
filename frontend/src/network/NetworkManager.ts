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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private serverPlayerId: string | null = null; // Store server-provided player ID

  constructor() {
    this.setupMessageHandlers();
  }

  public async connect(url: string): Promise<void> {
    // Update status to connecting
    this.updateConnectionStatus("connecting");

    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(url);

        // Set a timeout for connection attempts
        const connectionTimeout = setTimeout(() => {
          if (
            this.websocket &&
            this.websocket.readyState === WebSocket.CONNECTING
          ) {
            this.websocket.close();
            reject(
              new Error(`Connection timeout after 10 seconds. URL: ${url}`)
            );
          }
        }, 10000);

        this.websocket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log("WebSocket connected to:", url);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyConnectionListeners(true);
          resolve();
        };

        this.websocket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log(
            "WebSocket disconnected:",
            event.code,
            event.reason,
            "URL:",
            url
          );
          this.isConnected = false;
          this.notifyConnectionListeners(false);

          // Attempt reconnection only if not manually disconnected
          if (
            event.code !== 1000 &&
            this.reconnectAttempts < this.maxReconnectAttempts
          ) {
            this.scheduleReconnect(url);
          }
        };

        this.websocket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error("WebSocket error for URL:", url, error);
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
        reject(
          new Error(
            `Failed to create WebSocket connection to ${url}: ${error.message}`
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
    this.onMessage("room_joined", (data) => {
      console.log("🏠 NetworkManager: Joined room:", data);
      console.log(
        "🔍 NetworkManager: Checking your_player_id:",
        data.your_player_id
      );
      // Store the server player ID immediately when we join
      if (data.your_player_id) {
        this.setServerPlayerId(data.your_player_id);
        console.log(
          "✅ NetworkManager: Player ID stored:",
          data.your_player_id
        );
        console.log(
          "🔍 NetworkManager: Verification - stored ID:",
          this.serverPlayerId
        );
      } else {
        console.error(
          "❌ NetworkManager: No your_player_id in room_joined data!"
        );
      }
    });

    this.onMessage("room_left", (data) => {
      console.log("Left room:", data);
    });

    this.onMessage("player_joined", (data) => {
      console.log("Player joined:", data);
    });

    this.onMessage("player_left", (data) => {
      console.log("Player left:", data);
    });

    // game_state handler is now in GameScene.ts

    this.onMessage("error", (data) => {
      console.error("Server error:", data);
    });

    this.onMessage("pong", (data) => {
      console.log("Pong received:", data);
    });
  }

  private scheduleReconnect(url: string): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      this.connect(url).catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
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
    const statusElement = document.getElementById("connection-status");
    if (statusElement) {
      let newText: string;
      switch (status) {
        case "connecting":
          newText = "Verbindung: Verbinde...";
          break;
        case "connected":
          newText = "Verbindung: Verbunden";
          break;
        case "disconnected":
          newText = "Verbindung: Getrennt";
          break;
      }

      statusElement.textContent = newText;
      statusElement.className = status;

      console.log(
        `📱 Connection Status Updated: '${newText}' (class: ${status})`
      );
    }
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
