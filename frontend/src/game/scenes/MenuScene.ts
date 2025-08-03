/**
 * Menu Scene - Main menu and room selection
 */
import { Scene } from 'phaser'
import { NetworkManager } from '../../network/NetworkManager'

export class MenuScene extends Scene {
    private networkManager!: NetworkManager
    private roomNameInput!: HTMLInputElement
    private usernameInput!: HTMLInputElement
    private joinButton!: Phaser.GameObjects.Text
    private connectionStatus!: Phaser.GameObjects.Text

    constructor() {
        super({ key: 'MenuScene' })
    }

    preload() {
        // Load menu assets
        this.createMenuAssets()
    }

    create() {
        this.networkManager = this.registry.get('networkManager')
        
        this.createBackground()
        this.createTitle()
        this.createInputs()
        this.createButtons()
        this.createConnectionStatus()
        
        this.setupNetworkHandlers()
    }

    private createMenuAssets() {
        // Create simple colored rectangles as placeholders
        this.add.graphics()
            .fillStyle(0x3498db)
            .fillRect(0, 0, 200, 50)
            .generateTexture('button', 200, 50)

        this.add.graphics()
            .fillStyle(0x2ecc71)
            .fillRect(0, 0, 200, 50)
            .generateTexture('button-hover', 200, 50)
    }

    private createBackground() {
        // Winter forest background (placeholder)
        const bg = this.add.graphics()
        bg.fillGradientStyle(0x2c3e50, 0x2c3e50, 0x34495e, 0x34495e)
        bg.fillRect(0, 0, this.scale.width, this.scale.height)
        
        // Snow effect (simple)
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, this.scale.width)
            const y = Phaser.Math.Between(0, this.scale.height)
            const snowflake = this.add.circle(x, y, 2, 0xffffff, 0.8)
            
            // Animate snowflakes
            this.tweens.add({
                targets: snowflake,
                y: snowflake.y + this.scale.height,
                duration: Phaser.Math.Between(3000, 8000),
                repeat: -1,
                yoyo: false,
                onComplete: () => {
                    snowflake.y = -10
                }
            })
        }
    }

    private createTitle() {
        const title = this.add.text(this.scale.width / 2, 150, 'Tannenbaumbiel', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#2c3e50',
            strokeThickness: 4
        }).setOrigin(0.5)

        const subtitle = this.add.text(this.scale.width / 2, 200, 'Ein magisches Winterabenteuer', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ecf0f1',
            style: 'italic'
        }).setOrigin(0.5)

        // Title animation
        this.tweens.add({
            targets: title,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        })
    }

    private createInputs() {
        // Create HTML inputs (overlayed on canvas)
        const container = document.createElement('div')
        container.style.position = 'absolute'
        container.style.top = '300px'
        container.style.left = '50%'
        container.style.transform = 'translateX(-50%)'
        container.style.zIndex = '100'
        
        // Username input
        const usernameLabel = document.createElement('label')
        usernameLabel.textContent = 'Spielername:'
        usernameLabel.style.color = 'white'
        usernameLabel.style.display = 'block'
        usernameLabel.style.marginBottom = '5px'
        
        this.usernameInput = document.createElement('input')
        this.usernameInput.type = 'text'
        this.usernameInput.placeholder = 'Dein Name'
        this.usernameInput.maxLength = 20
        this.usernameInput.style.padding = '10px'
        this.usernameInput.style.marginBottom = '20px'
        this.usernameInput.style.borderRadius = '5px'
        this.usernameInput.style.border = 'none'
        this.usernameInput.style.width = '200px'
        
        // Room name input
        const roomLabel = document.createElement('label')
        roomLabel.textContent = 'Weltname:'
        roomLabel.style.color = 'white'
        roomLabel.style.display = 'block'
        roomLabel.style.marginBottom = '5px'
        
        this.roomNameInput = document.createElement('input')
        this.roomNameInput.type = 'text'
        this.roomNameInput.placeholder = 'Winterwald'
        this.roomNameInput.maxLength = 30
        this.roomNameInput.style.padding = '10px'
        this.roomNameInput.style.borderRadius = '5px'
        this.roomNameInput.style.border = 'none'
        this.roomNameInput.style.width = '200px'
        
        container.appendChild(usernameLabel)
        container.appendChild(this.usernameInput)
        container.appendChild(roomLabel)
        container.appendChild(this.roomNameInput)
        
        document.body.appendChild(container)
        
        // Default values
        this.usernameInput.value = localStorage.getItem('tannenbaum_username') || ''
        this.roomNameInput.value = 'Winterwald'
    }

    private createButtons() {
        this.joinButton = this.add.text(this.scale.width / 2, 500, 'Spiel Starten', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.joinGame())
        .on('pointerover', () => this.joinButton.setStyle({ backgroundColor: '#2980b9' }))
        .on('pointerout', () => this.joinButton.setStyle({ backgroundColor: '#3498db' }))

        // Offline mode button
        const offlineButton = this.add.text(this.scale.width / 2, 570, 'Offline Spielen', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#95a5a6',
            backgroundColor: '#7f8c8d',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.startOfflineGame())
        .on('pointerover', () => offlineButton.setStyle({ backgroundColor: '#6c7b7d' }))
        .on('pointerout', () => offlineButton.setStyle({ backgroundColor: '#7f8c8d' }))
    }

    private createConnectionStatus() {
        this.connectionStatus = this.add.text(20, 20, 'Verbindung: Getrennt', {
            fontSize: '16px',
            color: '#e74c3c'
        })

        // Update connection status
        this.updateConnectionStatus()
        
        if (this.networkManager) {
            this.networkManager.onConnectionChange((connected) => {
                this.updateConnectionStatus()
            })
        }
    }

    private updateConnectionStatus() {
        if (this.networkManager && this.networkManager.getConnectionStatus()) {
            this.connectionStatus.setText('Verbindung: Verbunden')
            this.connectionStatus.setColor('#27ae60')
        } else {
            this.connectionStatus.setText('Verbindung: Getrennt')
            this.connectionStatus.setColor('#e74c3c')
        }
    }

    private setupNetworkHandlers() {
        if (this.networkManager) {
            this.networkManager.onMessage('room_joined', (data) => {
                console.log('Successfully joined room:', data)
                // Start game scene
                this.scene.start('GameScene', { roomData: data })
            })

            this.networkManager.onMessage('error', (data) => {
                console.error('Server error:', data)
                // Show error message
                this.showError(data.message || 'Unbekannter Fehler')
            })
        }
    }

    private joinGame() {
        const username = this.usernameInput.value.trim()
        const roomName = this.roomNameInput.value.trim()

        if (!username) {
            this.showError('Bitte geben Sie einen Spielernamen ein')
            return
        }

        if (!roomName) {
            this.showError('Bitte geben Sie einen Weltnamen ein')
            return
        }

        // Save username
        localStorage.setItem('tannenbaum_username', username)

        if (this.networkManager && this.networkManager.getConnectionStatus()) {
            // Join multiplayer game
            this.networkManager.joinRoom(roomName, username)
        } else {
            // Start offline game
            this.startOfflineGame()
        }
    }

    private startOfflineGame() {
        console.log('Starting offline game')
        this.scene.start('GameScene', { offline: true })
    }

    private showError(message: string) {
        // Simple error display
        const errorText = this.add.text(this.scale.width / 2, 650, message, {
            fontSize: '18px',
            color: '#e74c3c',
            backgroundColor: '#2c3e50',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5)

        // Auto-hide after 3 seconds
        this.time.delayedCall(3000, () => {
            errorText.destroy()
        })
    }
}