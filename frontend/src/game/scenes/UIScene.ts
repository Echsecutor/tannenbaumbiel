/**
 * UI Scene - HUD and user interface overlay
 */
import { Scene } from 'phaser'
import { NetworkManager } from '../../network/NetworkManager'

export class UIScene extends Scene {
    private networkManager!: NetworkManager
    private healthBar!: Phaser.GameObjects.Graphics
    private healthText!: Phaser.GameObjects.Text
    private scoreText!: Phaser.GameObjects.Text
    private connectionText!: Phaser.GameObjects.Text
    private menuButton!: Phaser.GameObjects.Text
    
    private score = 0
    private health = 100

    constructor() {
        super({ key: 'UIScene' })
    }

    create() {
        this.networkManager = this.registry.get('networkManager')
        
        this.createHealthBar()
        this.createScoreDisplay()
        this.createConnectionStatus()
        this.createMenuButton()
        this.createAudioToggle()
        
        // Start listening for game events
        this.setupEventListeners()
        
        // Check connection status periodically
        this.time.addEvent({
            delay: 1000, // Check every second
            callback: () => {
                this.updateConnectionStatus()
            },
            loop: true
        })
    }

    private createHealthBar() {
        // Health bar background
        this.add.graphics()
            .fillStyle(0x2c3e50)
            .fillRect(20, 20, 204, 24)
            .lineStyle(2, 0xffffff)
            .strokeRect(20, 20, 204, 24)

        // Health bar fill
        this.healthBar = this.add.graphics()

        // Health text
        this.healthText = this.add.text(30, 25, `Leben: ${this.health}`, {
            fontSize: '16px',
            color: '#ffffff',
            fontFamily: 'Arial'
        })

        // Update health bar after all components are created
        this.updateHealthBar()
    }

    private createScoreDisplay() {
        this.scoreText = this.add.text(this.scale.width - 20, 20, `Punkte: ${this.score}`, {
            fontSize: '18px',
            color: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(1, 0)
    }

    private createConnectionStatus() {
        this.connectionText = this.add.text(this.scale.width / 2, 20, '', {
            fontSize: '14px',
            color: '#95a5a6',
            fontFamily: 'Arial'
        }).setOrigin(0.5, 0)

        this.updateConnectionStatus()

        if (this.networkManager) {
            this.networkManager.onConnectionChange((connected) => {
                this.updateConnectionStatus()
            })
        }
    }

    private createMenuButton() {
        this.menuButton = this.add.text(20, this.scale.height - 50, 'Menü', {
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#34495e',
            padding: { x: 10, y: 5 }
        }).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.returnToMenu())
        .on('pointerover', () => this.menuButton.setStyle({ backgroundColor: '#2c3e50' }))
        .on('pointerout', () => this.menuButton.setStyle({ backgroundColor: '#34495e' }))
    }

    private createAudioToggle() {
        const audioButton = this.add.text(this.scale.width - 20, this.scale.height - 50, '🔊', {
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#34495e',
            padding: { x: 10, y: 5 }
        }).setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.toggleAudio(audioButton))
        .on('pointerover', () => audioButton.setStyle({ backgroundColor: '#2c3e50' }))
        .on('pointerout', () => audioButton.setStyle({ backgroundColor: '#34495e' }))
    }

    private setupEventListeners() {
        // Listen for game events from the main game scene
        this.game.events.on('health-changed', (newHealth: number) => {
            this.health = newHealth
            this.updateHealthBar()
        })

        this.game.events.on('score-changed', (newScore: number) => {
            this.score = newScore
            this.updateScoreDisplay()
        })

        this.game.events.on('enemy-defeated', () => {
            this.score += 100
            this.updateScoreDisplay()
        })
    }

    private updateHealthBar() {
        this.healthBar.clear()
        
        // Health bar fill color based on health percentage
        let fillColor = 0x27ae60 // Green
        if (this.health < 60) fillColor = 0xf39c12 // Orange
        if (this.health < 30) fillColor = 0xe74c3c // Red
        
        const fillWidth = Math.max(0, (this.health / 100) * 200)
        
        this.healthBar
            .fillStyle(fillColor)
            .fillRect(22, 22, fillWidth, 20)

        this.healthText.setText(`Leben: ${this.health}`)
    }

    private updateScoreDisplay() {
        this.scoreText.setText(`Punkte: ${this.score}`)
    }

    public updateConnectionStatus() {
        // Get fresh NetworkManager from registry each time
        const currentNetworkManager = this.registry.get('networkManager')
        const isConnected = currentNetworkManager ? currentNetworkManager.getConnectionStatus() : false
        
        if (this.connectionText) {
            if (currentNetworkManager && isConnected) {
                this.connectionText.setText('Online: Verbunden')
                this.connectionText.setColor('#27ae60')
                console.log(`🎮 UIScene Status Updated: 'Online: Verbunden' (CONNECTED)`)
            } else {
                this.connectionText.setText('Offline Modus') 
                this.connectionText.setColor('#95a5a6')
                console.log(`🎮 UIScene Status Updated: 'Offline Modus' (DISCONNECTED)`)
            }
        } else {
            console.warn('⚠️ UIScene: connectionText object not initialized!')
        }
    }

    private toggleAudio(button: Phaser.GameObjects.Text) {
        // Toggle audio on/off
        const audioEnabled = this.sound.mute
        this.sound.setMute(!audioEnabled)
        
        button.setText(audioEnabled ? '🔊' : '🔇')
        
        // Store preference
        localStorage.setItem('tannenbaum_audio', audioEnabled ? 'enabled' : 'disabled')
    }

    private returnToMenu() {
        // Confirm dialog (simple implementation)
        const confirmDialog = this.add.container(this.scale.width / 2, this.scale.height / 2)
        
        const background = this.add.graphics()
            .fillStyle(0x2c3e50, 0.9)
            .fillRect(-150, -75, 300, 150)
            .lineStyle(2, 0xffffff)
            .strokeRect(-150, -75, 300, 150)
        
        const questionText = this.add.text(0, -30, 'Zurück zum Menü?', {
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0.5)
        
        const yesButton = this.add.text(-50, 20, 'Ja', {
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            // Leave room if online
            if (this.networkManager && this.networkManager.getConnectionStatus()) {
                this.networkManager.leaveRoom()
            }
            
            // Stop all scenes and return to menu
            this.scene.stop('GameScene')
            this.scene.stop('UIScene')
            this.scene.start('MenuScene')
        })
        
        const noButton = this.add.text(50, 20, 'Nein', {
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            confirmDialog.destroy()
        })
        
        confirmDialog.add([background, questionText, yesButton, noButton])
    }
}