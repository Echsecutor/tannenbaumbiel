/**
 * Network Manager for WebSocket communication with game server
 */

export interface GameMessage {
    type: string
    timestamp: number
    data?: any
}

export class NetworkManager {
    private websocket: WebSocket | null = null
    private isConnected = false
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private reconnectDelay = 1000
    private messageHandlers: Map<string, (data: any) => void> = new Map()
    private connectionListeners: Set<(connected: boolean) => void> = new Set()

    constructor() {
        this.setupMessageHandlers()
    }

    public async connect(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.websocket = new WebSocket(url)
                
                this.websocket.onopen = () => {
                    console.log('WebSocket connected')
                    this.isConnected = true
                    this.reconnectAttempts = 0
                    this.notifyConnectionListeners(true)
                    resolve()
                }
                
                this.websocket.onclose = (event) => {
                    console.log('WebSocket disconnected:', event.code, event.reason)
                    this.isConnected = false
                    this.notifyConnectionListeners(false)
                    
                    // Attempt reconnection
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.scheduleReconnect(url)
                    }
                }
                
                this.websocket.onerror = (error) => {
                    console.error('WebSocket error:', error)
                    reject(error)
                }
                
                this.websocket.onmessage = (event) => {
                    this.handleMessage(event.data)
                }
                
            } catch (error) {
                reject(error)
            }
        })
    }

    public disconnect(): void {
        if (this.websocket) {
            this.websocket.close()
            this.websocket = null
            this.isConnected = false
            this.notifyConnectionListeners(false)
        }
    }

    public sendMessage(message: GameMessage): void {
        if (this.isConnected && this.websocket) {
            this.websocket.send(JSON.stringify(message))
        } else {
            console.warn('Cannot send message: WebSocket not connected')
        }
    }

    public joinRoom(roomName: string, username: string): void {
        this.sendMessage({
            type: 'join_room',
            timestamp: Date.now(),
            data: {
                room_name: roomName,
                username: username,
                character_type: 'hero1'
            }
        })
    }

    public leaveRoom(): void {
        this.sendMessage({
            type: 'leave_room',
            timestamp: Date.now()
        })
    }

    public sendPlayerInput(action: string, pressed: boolean = true): void {
        this.sendMessage({
            type: 'player_input',
            timestamp: Date.now(),
            data: {
                action: action,
                player_id: this.getPlayerId(),
                pressed: pressed
            }
        })
    }

    public ping(): void {
        this.sendMessage({
            type: 'ping',
            timestamp: Date.now()
        })
    }

    public onMessage(messageType: string, handler: (data: any) => void): void {
        this.messageHandlers.set(messageType, handler)
    }

    public onConnectionChange(listener: (connected: boolean) => void): void {
        this.connectionListeners.add(listener)
    }

    public removeConnectionListener(listener: (connected: boolean) => void): void {
        this.connectionListeners.delete(listener)
    }

    public getConnectionStatus(): boolean {
        return this.isConnected
    }

    private handleMessage(data: string): void {
        try {
            const message: GameMessage = JSON.parse(data)
            const handler = this.messageHandlers.get(message.type)
            
            if (handler) {
                handler(message.data)
            } else {
                console.log('Unhandled message type:', message.type, message.data)
            }
        } catch (error) {
            console.error('Error parsing message:', error)
        }
    }

    private setupMessageHandlers(): void {
        // Default message handlers
        this.onMessage('room_joined', (data) => {
            console.log('Joined room:', data)
        })

        this.onMessage('room_left', (data) => {
            console.log('Left room:', data)
        })

        this.onMessage('player_joined', (data) => {
            console.log('Player joined:', data)
        })

        this.onMessage('player_left', (data) => {
            console.log('Player left:', data)
        })

        this.onMessage('game_state', (data) => {
            // This would update game state
            console.log('Game state update:', data)
        })

        this.onMessage('error', (data) => {
            console.error('Server error:', data)
        })

        this.onMessage('pong', (data) => {
            console.log('Pong received:', data)
        })
    }

    private scheduleReconnect(url: string): void {
        this.reconnectAttempts++
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
        
        console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)
        
        setTimeout(() => {
            this.connect(url).catch((error) => {
                console.error('Reconnection failed:', error)
            })
        }, delay)
    }

    private notifyConnectionListeners(connected: boolean): void {
        this.connectionListeners.forEach(listener => {
            try {
                listener(connected)
            } catch (error) {
                console.error('Error in connection listener:', error)
            }
        })
    }

    private getPlayerId(): string {
        // Generate or retrieve player ID
        let playerId = localStorage.getItem('tannenbaum_player_id')
        if (!playerId) {
            playerId = 'player_' + Math.random().toString(36).substr(2, 9)
            localStorage.setItem('tannenbaum_player_id', playerId)
        }
        return playerId
    }
}