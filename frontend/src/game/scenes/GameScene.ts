/**
 * Game Scene - Main game world
 */
import { Scene } from 'phaser'
import { NetworkManager } from '../../network/NetworkManager'

export class GameScene extends Scene {
    private networkManager!: NetworkManager
    private player!: Phaser.Physics.Arcade.Sprite
    private platforms!: Phaser.Physics.Arcade.StaticGroup
    private enemies!: Phaser.Physics.Arcade.Group
    private projectiles!: Phaser.Physics.Arcade.Group
    
    // Multiplayer support
    private networkPlayers: Map<string, Phaser.Physics.Arcade.Sprite> = new Map()
    private networkEnemies: Map<string, Phaser.Physics.Arcade.Sprite> = new Map()
    private networkProjectiles: Map<string, Phaser.Physics.Arcade.Sprite> = new Map()
    private myPlayerId: string = ''
    private roomJoinConfirmed: boolean = false
    private lastBroadcastTime: number = 0
    private broadcastThrottle: number = 33  // Broadcast max every 33ms (30fps) for conflict resolution
    
    // Input state tracking for multiplayer
    private inputState: Map<string, boolean> = new Map()
    
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private wasd!: any
    private touchControls!: any
    
    private isOffline = false
    private roomData: any = null

    constructor() {
        super({ key: 'GameScene' })
    }

    init(data: any) {
        this.isOffline = data.offline || false
        this.roomData = data.roomData || null
        
        // Get player ID directly from scene data (passed from MenuScene)
        if (data.myPlayerId) {
            this.myPlayerId = data.myPlayerId
            this.roomJoinConfirmed = true  // Room join already confirmed by MenuScene
            console.log('🎮 GameScene.init: Player ID received directly:', this.myPlayerId)
            console.log('✅ GameScene.init: Room join pre-confirmed, ready to broadcast game state')
        }
        
        console.log('GameScene initialized:', { 
            offline: this.isOffline, 
            roomData: this.roomData,
            myPlayerId: this.myPlayerId 
        })
    }

    preload() {
        this.loadAssets()
    }

    create() {
        this.networkManager = this.registry.get('networkManager')
        
        this.createWorld()
        this.createPlayer()
        this.createEnemies()
        this.createControls()
        this.createPhysics()
        
        if (!this.isOffline) {
            this.setupNetworkHandlers()
        }
        
        // Start UI scene
        this.scene.launch('UIScene')
    }

    update() {
        this.handlePlayerMovement()
        this.updateEnemies()
    }

    private loadAssets() {
        // Load Dude Monster sprites for player
        this.load.spritesheet('player_idle', '/src/assets/sprites/dude_monster/Dude_Monster_Idle_4.png', {
            frameWidth: 32,
            frameHeight: 32
        })
        
        this.load.spritesheet('player_run', '/src/assets/sprites/dude_monster/Dude_Monster_Run_6.png', {
            frameWidth: 32,
            frameHeight: 32
        })
        
        this.load.spritesheet('player_jump', '/src/assets/sprites/dude_monster/Dude_Monster_Jump_8.png', {
            frameWidth: 32,
            frameHeight: 32
        })
        
        // Load Owlet Monster sprites for enemies
        this.load.spritesheet('enemy_idle', '/src/assets/sprites/owlet_monster/Owlet_Monster_Idle_4.png', {
            frameWidth: 32,
            frameHeight: 32
        })
        
        this.load.spritesheet('enemy_walk', '/src/assets/sprites/owlet_monster/Owlet_Monster_Walk_6.png', {
            frameWidth: 32,
            frameHeight: 32
        })
        
        // Load Pink Monster sprites for special enemies
        this.load.spritesheet('pink_enemy_idle', '/src/assets/sprites/pink_monster/Pink_Monster_Idle_4.png', {
            frameWidth: 32,
            frameHeight: 32
        })

        // Create platform texture (keep simple for now)
        const platformGraphics = this.add.graphics()
        platformGraphics.fillStyle(0x27ae60)
        platformGraphics.fillRect(0, 0, 100, 32)
        platformGraphics.generateTexture('platform', 100, 32)
        platformGraphics.destroy()

        // Create simple projectile
        const projectileGraphics = this.add.graphics()
        projectileGraphics.fillStyle(0xf39c12)
        projectileGraphics.fillRect(0, 0, 8, 4)
        projectileGraphics.generateTexture('projectile', 8, 4)
        projectileGraphics.destroy()

        // Create tree texture
        const treeGraphics = this.add.graphics()
        treeGraphics.fillStyle(0x2ecc71)
        treeGraphics.fillRect(0, 0, 200, 150)
        treeGraphics.generateTexture('tree', 200, 150)
        treeGraphics.destroy()
    }

    private createWorld() {
        // Winter forest background
        const bg = this.add.graphics()
        bg.fillGradientStyle(0x87ceeb, 0x87ceeb, 0xe0f6ff, 0xe0f6ff)
        bg.fillRect(0, 0, this.scale.width, this.scale.height)

        // Create platforms
        this.platforms = this.physics.add.staticGroup()
        
        // Ground platforms
        this.platforms.create(100, 700, 'platform').setScale(2, 1).refreshBody()
        this.platforms.create(300, 700, 'platform').setScale(2, 1).refreshBody()
        this.platforms.create(500, 700, 'platform').setScale(2, 1).refreshBody()
        this.platforms.create(700, 700, 'platform').setScale(2, 1).refreshBody()
        this.platforms.create(900, 700, 'platform').setScale(2, 1).refreshBody()
        
        // Floating platforms
        this.platforms.create(400, 600, 'platform')
        this.platforms.create(200, 500, 'platform')
        this.platforms.create(600, 450, 'platform')
        this.platforms.create(800, 350, 'platform')

        // Decorative trees
        this.add.image(150, 550, 'tree').setScale(0.5)
        this.add.image(750, 550, 'tree').setScale(0.7)
        this.add.image(450, 300, 'tree').setScale(0.4)

        // Snow particles
        this.createSnowEffect()
    }

    private createPlayer() {
        this.player = this.physics.add.sprite(100, 450, 'player_idle')
        this.player.setBounce(0.2)
        this.player.setCollideWorldBounds(true)
        this.player.setData('health', 100)
        this.player.setData('facingRight', true)

        // Create player animations
        this.createPlayerAnimations()
        
        // Start with idle animation
        this.player.play('player_idle_anim')
    }
    
    private createPlayerAnimations() {
        // Idle animation
        if (!this.anims.exists('player_idle_anim')) {
            this.anims.create({
                key: 'player_idle_anim',
                frames: this.anims.generateFrameNumbers('player_idle', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            })
        }
        
        // Run animation
        if (!this.anims.exists('player_run_anim')) {
            this.anims.create({
                key: 'player_run_anim',
                frames: this.anims.generateFrameNumbers('player_run', { start: 0, end: 5 }),
                frameRate: 10,
                repeat: -1
            })
        }
        
        // Jump animation
        if (!this.anims.exists('player_jump_anim')) {
            this.anims.create({
                key: 'player_jump_anim',
                frames: this.anims.generateFrameNumbers('player_jump', { start: 0, end: 7 }),
                frameRate: 15,
                repeat: 0
            })
        }
    }

    private createEnemies() {
        this.enemies = this.physics.add.group()
        
        // Create enemy animations
        this.createEnemyAnimations()
        
        // CLIENT-SIDE PHYSICS: Always create local enemies with Phaser physics
        // In multiplayer, the first player to join will be the "host" and their enemy state will be authoritative
        console.log('🎮 Creating local enemies with client-side physics')
        
        // Create owlet enemies
        const enemy1 = this.enemies.create(300, 400, 'enemy_idle')
        enemy1.setBounce(1)
        enemy1.setCollideWorldBounds(true)
        enemy1.setVelocity(Phaser.Math.Between(-200, 200), 20)
        enemy1.setData('health', 50)
        enemy1.setData('type', 'owlet')
        enemy1.setData('facingRight', true)
        enemy1.play('enemy_idle_anim')

        const enemy2 = this.enemies.create(600, 300, 'enemy_idle')
        enemy2.setBounce(1)
        enemy2.setCollideWorldBounds(true)
        enemy2.setVelocity(Phaser.Math.Between(-200, 200), 20)
        enemy2.setData('health', 50)
        enemy2.setData('type', 'owlet')
        enemy2.setData('facingRight', true)
        enemy2.play('enemy_idle_anim')
        
        // Create a pink enemy boss
        const boss = this.enemies.create(800, 250, 'pink_enemy_idle')
        boss.setBounce(1)
        boss.setCollideWorldBounds(true)
        boss.setVelocity(Phaser.Math.Between(-100, 100), 20)
        boss.setData('health', 100)
        boss.setData('type', 'pink_boss')
        boss.setData('facingRight', true)
        boss.setScale(1.5) // Make boss bigger
        boss.play('pink_enemy_idle_anim')

        // Create projectiles group
        this.projectiles = this.physics.add.group()
    }
    
    private createEnemyAnimations() {
        // Enemy idle animation
        if (!this.anims.exists('enemy_idle_anim')) {
            this.anims.create({
                key: 'enemy_idle_anim',
                frames: this.anims.generateFrameNumbers('enemy_idle', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1
            })
        }
        
        // Enemy walk animation
        if (!this.anims.exists('enemy_walk_anim')) {
            this.anims.create({
                key: 'enemy_walk_anim',
                frames: this.anims.generateFrameNumbers('enemy_walk', { start: 0, end: 5 }),
                frameRate: 8,
                repeat: -1
            })
        }
        
        // Pink enemy idle animation
        if (!this.anims.exists('pink_enemy_idle_anim')) {
            this.anims.create({
                key: 'pink_enemy_idle_anim',
                frames: this.anims.generateFrameNumbers('pink_enemy_idle', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1
            })
        }
    }

    private createControls() {
        // Keyboard controls
        this.cursors = this.input.keyboard!.createCursorKeys()
        this.wasd = this.input.keyboard!.addKeys('W,S,A,D,SPACE')

        // Touch controls for mobile
        this.createTouchControls()
    }

    private createTouchControls() {
        // Simple touch areas for mobile
        const leftArea = this.add.rectangle(100, this.scale.height - 100, 150, 150, 0x000000, 0.3)
        leftArea.setInteractive()
        leftArea.on('pointerdown', () => this.setPlayerInput('left', true))
        leftArea.on('pointerup', () => this.setPlayerInput('left', false))

        const rightArea = this.add.rectangle(250, this.scale.height - 100, 150, 150, 0x000000, 0.3)
        rightArea.setInteractive()
        rightArea.on('pointerdown', () => this.setPlayerInput('right', true))
        rightArea.on('pointerup', () => this.setPlayerInput('right', false))

        const jumpArea = this.add.rectangle(this.scale.width - 150, this.scale.height - 100, 150, 150, 0x000000, 0.3)
        jumpArea.setInteractive()
        jumpArea.on('pointerdown', () => this.setPlayerInput('jump', true))

        const shootArea = this.add.rectangle(this.scale.width - 300, this.scale.height - 100, 150, 150, 0x000000, 0.3)
        shootArea.setInteractive()
        shootArea.on('pointerdown', () => this.setPlayerInput('shoot', true))

        // Add control labels
        this.add.text(100, this.scale.height - 100, '←', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5)
        this.add.text(250, this.scale.height - 100, '→', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5)
        this.add.text(this.scale.width - 150, this.scale.height - 100, '↑', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5)
        this.add.text(this.scale.width - 300, this.scale.height - 100, '⚡', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5)
    }

    private createPhysics() {
        // Player-platform collisions
        this.physics.add.collider(this.player, this.platforms)
        
        // Enemy-platform collisions
        this.physics.add.collider(this.enemies, this.platforms)
        
        // Player-enemy collisions
        this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, undefined, this)
        
        // Projectile-enemy collisions
        this.physics.add.overlap(this.projectiles, this.enemies, this.projectileHitEnemy, undefined, this)
        
        // Projectile-platform collisions
        this.physics.add.collider(this.projectiles, this.platforms, this.projectileHitPlatform, undefined, this)
    }

    private handlePlayerMovement() {
        // CLIENT-SIDE PHYSICS: Use local Phaser physics for both offline and multiplayer
        // In multiplayer, we'll broadcast our complete game state to other clients
        
        const speed = 200
        const jumpSpeed = 550

        // Horizontal movement
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            this.player.setVelocityX(-speed)
            this.player.setData('facingRight', false)
            this.player.setFlipX(true)
            if (this.player.body!.touching.down) {
                this.player.play('player_run_anim', true)
            }
        } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
            this.player.setVelocityX(speed)
            this.player.setData('facingRight', true)
            this.player.setFlipX(false)
            if (this.player.body!.touching.down) {
                this.player.play('player_run_anim', true)
            }
        } else {
            this.player.setVelocityX(0)
            if (this.player.body!.touching.down) {
                this.player.play('player_idle_anim', true)
            }
        }

        // Jumping
        if ((this.cursors.up.isDown || this.wasd.W.isDown) && this.player.body!.touching.down) {
            this.player.setVelocityY(-jumpSpeed)
            this.player.play('player_jump_anim', true)
        }

        // Shooting
        if ((this.input.activePointer.isDown && !this.input.activePointer.wasTouch) || this.wasd.SPACE.isDown) {
            if (!this.inputState.get('shoot')) {
                this.inputState.set('shoot', true)
                this.shootProjectile()
            }
        } else {
            this.inputState.set('shoot', false)
        }
        
        // HYBRID AUTHORITY: Send both input and game state for conflict resolution
        if (!this.isOffline && this.roomJoinConfirmed) {
            // Send input for immediate server processing
            this.sendInputUpdates()
            // Send game state for server conflict resolution
            this.broadcastGameState()
        }
    }
    
    private sendInputUpdates() {
        if (!this.networkManager || !this.myPlayerId) return
        
        // Send input state changes immediately for responsiveness
        // Server will handle all physics and broadcast authoritative state
        
        // Only send when input state actually changes to reduce network traffic
        const currentInputs = {
            left: this.cursors.left.isDown || this.wasd.A.isDown,
            right: this.cursors.right.isDown || this.wasd.D.isDown,
            jump: this.cursors.up.isDown || this.wasd.W.isDown,
            shoot: (this.input.activePointer.isDown && !this.input.activePointer.wasTouch) || this.wasd.SPACE.isDown
        }
        
        // Check if any input has changed since last update
        const inputsChanged = Object.entries(currentInputs).some(([action, pressed]) => {
            const wasPressed = this.inputState.get(action) || false
            return wasPressed !== pressed
        })
        
        if (inputsChanged) {
            // Send only changed inputs to server
            Object.entries(currentInputs).forEach(([action, pressed]) => {
                const wasPressed = this.inputState.get(action) || false
                if (wasPressed !== pressed) {
                    this.networkManager.sendPlayerInput(action, pressed)
                    this.inputState.set(action, pressed)
                }
            })
        }
    }
    
    private broadcastGameState() {
        if (!this.networkManager || !this.myPlayerId) return
        
        // Throttle broadcasting for conflict resolution (30fps)
        const now = Date.now()
        if (now - this.lastBroadcastTime < this.broadcastThrottle) return
        this.lastBroadcastTime = now
        
        // Create comprehensive game state from local physics simulation
        const gameState = {
            player: {
                player_id: this.myPlayerId,
                x: this.player.x,
                y: this.player.y,
                velocity_x: this.player.body!.velocity.x,
                velocity_y: this.player.body!.velocity.y,
                facing_right: this.player.getData('facingRight'),
                is_grounded: this.player.body!.touching.down,
                is_jumping: this.player.body!.velocity.y < -10,
                health: this.player.getData('health') || 100
            },
            enemies: this.getLocalEnemyStates(),
            projectiles: this.getLocalProjectileStates()
        }
        
        // Send to server for conflict resolution
        this.networkManager.sendMessage({
            type: 'game_state_update',
            timestamp: Date.now(),
            data: gameState
        })
    }
    
    private getLocalEnemyStates(): any[] {
        const enemyStates: any[] = []
        
        this.enemies.children.entries.forEach((enemy: any, index: number) => {
            if (enemy.active) {
                enemyStates.push({
                    enemy_id: `enemy_${index + 1}`, // Match server enemy IDs
                    enemy_type: enemy.getData('type'),
                    x: enemy.x,
                    y: enemy.y,
                    velocity_x: enemy.body.velocity.x,
                    velocity_y: enemy.body.velocity.y,
                    facing_right: enemy.getData('facingRight') !== false,
                    health: enemy.getData('health') || 50
                })
            }
        })
        
        return enemyStates
    }
    
    private getLocalProjectileStates(): any[] {
        const projectileStates: any[] = []
        
        this.projectiles.children.entries.forEach((projectile: any, index: number) => {
            if (projectile.active) {
                projectileStates.push({
                    projectile_id: `projectile_${this.myPlayerId}_${index}`,
                    x: projectile.x,
                    y: projectile.y,
                    velocity_x: projectile.body.velocity.x,
                    velocity_y: projectile.body.velocity.y,
                    owner_id: this.myPlayerId
                })
            }
        })
        
        return projectileStates
    }

    private shootProjectile() {
        const projectile = this.projectiles.create(this.player.x, this.player.y, 'projectile')
        const direction = this.player.getData('facingRight') ? 1 : -1
        projectile.setVelocityX(direction * 400)
        projectile.setVelocityY(-50)
        
        // Auto-destroy projectile after 3 seconds
        this.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.destroy()
            }
        })
    }

    private updateEnemies() {
        this.enemies.children.entries.forEach((enemy: any) => {
            // Simple AI: Change direction randomly
            if (Phaser.Math.Between(0, 100) < 2) {
                enemy.setVelocityX(Phaser.Math.Between(-200, 200))
            }
        })
    }

    private hitEnemy(player: any, enemy: any) {
        // Damage player
        const health = player.getData('health') - 25
        player.setData('health', health)
        
        // Knockback
        const direction = player.x < enemy.x ? -1 : 1
        player.setVelocity(direction * 300, -200)
        
        // Visual feedback
        player.setTint(0xff0000)
        this.time.delayedCall(200, () => {
            player.setTint(0x3498db)
        })
        
        if (health <= 0) {
            this.gameOver()
        }
    }

    private projectileHitEnemy(projectile: any, enemy: any) {
        projectile.destroy()
        
        const health = enemy.getData('health') - 25
        enemy.setData('health', health)
        
        // Visual feedback
        enemy.setTint(0xff0000)
        this.time.delayedCall(200, () => {
            enemy.setTint(0xe74c3c)
        })
        
        if (health <= 0) {
            enemy.destroy()
            
            // Check if all enemies defeated
            if (this.enemies.countActive() === 0) {
                this.victory()
            }
        }
    }

    private projectileHitPlatform(projectile: any, platform: any) {
        projectile.destroy()
    }

    private createSnowEffect() {
        // Simple snow particle effect
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, this.scale.width)
            const y = Phaser.Math.Between(-100, this.scale.height)
            const snowflake = this.add.circle(x, y, 1, 0xffffff, 0.8)
            
            this.tweens.add({
                targets: snowflake,
                y: snowflake.y + this.scale.height + 100,
                x: snowflake.x + Phaser.Math.Between(-50, 50),
                duration: Phaser.Math.Between(3000, 8000),
                repeat: -1,
                onComplete: () => {
                    snowflake.y = -10
                    snowflake.x = Phaser.Math.Between(0, this.scale.width)
                }
            })
        }
    }

    private setupNetworkHandlers() {
        if (this.networkManager) {
            // Player ID should already be set from init() - but try NetworkManager as fallback
            if (!this.myPlayerId) {
                this.myPlayerId = this.networkManager.getServerPlayerId() || ''
                console.log('🔄 GameScene: Fallback - retrieved player ID from NetworkManager:', this.myPlayerId)
            }
            
            // Ensure NetworkManager also has the player ID
            if (this.myPlayerId && !this.networkManager.getServerPlayerId()) {
                this.networkManager.setServerPlayerId(this.myPlayerId)
                console.log('🔄 GameScene: Updated NetworkManager with player ID:', this.myPlayerId)
            }
            
            console.log('🎮 GameScene: Final player ID:', this.myPlayerId)
            
            this.networkManager.onMessage('game_state', (data) => {
                this.updateGameState(data)
            })
            
            // Set up a fallback handler in case we missed the room_joined message
            this.networkManager.onMessage('room_joined', (data) => {
                console.log('🏠 GameScene: Received room_joined data (fallback):', data)
                if (!this.myPlayerId && data.your_player_id) {
                    this.myPlayerId = data.your_player_id
                    console.log('✅ GameScene: Fallback player ID set to:', this.myPlayerId)
                }
                // Confirm room join - now safe to start broadcasting game state
                this.roomJoinConfirmed = true
                console.log('✅ GameScene: Room join confirmed, will start broadcasting game state')
            })
        } else {
            console.error('❌ GameScene: NetworkManager not available!')
        }
    }

    private updateGameState(gameState: any) {
        // HYBRID AUTHORITY: Server resolves conflicts, clients run physics
        console.log('🔄 Received server conflict-resolved state')
        
        // Update all players from server state (includes conflict resolution)
        if (gameState.players && Array.isArray(gameState.players)) {
            this.updateAllPlayersFromServer(gameState.players)
        }
        
        // Update enemies from server state (server has resolved conflicts)
        if (gameState.enemies && Array.isArray(gameState.enemies)) {
            this.updateEnemiesFromServer(gameState.enemies)
        }
        
        // Update projectiles from server state (server has resolved ownership)
        if (gameState.projectiles && Array.isArray(gameState.projectiles)) {
            this.updateProjectilesFromServer(gameState.projectiles)
        }
    }
    
    // REMOVED: handlePlayerListUpdate() and isHostPlayer()
    // No longer needed with server-authoritative architecture
    
    private updateAllPlayersFromServer(players: any[]) {
        // Update all players including our own player (for reconciliation)
        for (const playerState of players) {
            if (playerState.player_id === this.myPlayerId) {
                // This is our own player - apply server reconciliation
                this.reconcileLocalPlayer(playerState)
            } else {
                // This is another player - update network player
                this.updateNetworkPlayer(playerState)
            }
        }
        
        // Remove any network players that are no longer in the server state
        const activePlayerIds = new Set(players.map(p => p.player_id))
        for (const [playerId, sprite] of this.networkPlayers) {
            if (!activePlayerIds.has(playerId)) {
                console.log('👋 Removing disconnected network player:', playerId)
                sprite.destroy()
                this.networkPlayers.delete(playerId)
            }
        }
    }
    
    private reconcileLocalPlayer(serverPlayerState: any) {
        // HYBRID RECONCILIATION: Only correct significant deviations from server conflict resolution
        const positionThreshold = 15 // pixels - higher threshold for client-side physics
        const velocityThreshold = 100 // pixels/second - allow more local variation
        
        const positionDiff = Math.abs(this.player.x - serverPlayerState.x) + Math.abs(this.player.y - serverPlayerState.y)
        const velocityDiffX = Math.abs(this.player.body!.velocity.x - serverPlayerState.velocity_x)
        const velocityDiffY = Math.abs(this.player.body!.velocity.y - serverPlayerState.velocity_y)
        
        if (positionDiff > positionThreshold || velocityDiffX > velocityThreshold || velocityDiffY > velocityThreshold) {
            console.log('🔧 Server conflict resolution: Correcting local player state')
            console.log(`Position diff: ${positionDiff.toFixed(1)}, velocity diff: ${velocityDiffX.toFixed(1)}, ${velocityDiffY.toFixed(1)}`)
            
            // Apply server correction for conflict resolution
            // Keep local physics responsive by only correcting major deviations
            this.player.setPosition(serverPlayerState.x, serverPlayerState.y)
            this.player.setVelocity(serverPlayerState.velocity_x, serverPlayerState.velocity_y)
        }
        
        // Always sync health (important for gameplay)
        if (serverPlayerState.health !== undefined) {
            this.player.setData('health', serverPlayerState.health)
        }
    }
    
    private updateNetworkPlayer(playerState: any) {
        let sprite = this.networkPlayers.get(playerState.player_id)
        
        if (!sprite) {
            // Create new network player sprite
            sprite = this.physics.add.sprite(playerState.x, playerState.y, 'player_idle')
            // Use same scale as local player (default 1.0)
            sprite.setTint(0x00ff00) // Green tint to differentiate from local player
            sprite.setData('health', playerState.health)
            sprite.setData('facingRight', playerState.facing_right)
            
            // Add physics (same as local player)
            sprite.setBounce(0.2)
            sprite.setCollideWorldBounds(true)
            
            // Add collisions with platforms
            this.physics.add.collider(sprite, this.platforms)
            
            this.networkPlayers.set(playerState.player_id, sprite)
            console.log(`🟢 Created network player: ${playerState.username} (${playerState.player_id}) at ${playerState.x},${playerState.y}`)
        }
        
        // Update position and state
        sprite.setPosition(playerState.x, playerState.y)
        sprite.setFlipX(!playerState.facing_right)
        sprite.setData('health', playerState.health)
        sprite.setData('facingRight', playerState.facing_right)
        
        // Update animation based on server state
        if (Math.abs(playerState.velocity_x) > 10) {
            sprite.play('player_run_anim', true)
        } else if (playerState.is_jumping || !playerState.is_grounded) {
            sprite.play('player_jump_anim', true)
        } else {
            sprite.play('player_idle_anim', true)
        }
    }
    
    private updateEnemiesFromServer(enemyStates: any[]) {
        console.log('🦴 Updating enemies from server conflict resolution:', enemyStates.length)
        
        const activeEnemyIds = new Set<string>()
        
        for (const enemyState of enemyStates) {
            activeEnemyIds.add(enemyState.enemy_id)
            let sprite = this.networkEnemies.get(enemyState.enemy_id)
            
            if (!sprite) {
                // Create new network enemy sprite
                const texture = enemyState.enemy_type === 'pink_boss' ? 'pink_enemy_idle' : 'enemy_idle'
                sprite = this.physics.add.sprite(enemyState.x, enemyState.y, texture)
                
                // Set up enemy properties
                sprite.setData('health', enemyState.health)
                sprite.setData('type', enemyState.enemy_type)
                sprite.setData('facingRight', enemyState.facing_right)
                
                // Boss is bigger
                if (enemyState.enemy_type === 'pink_boss') {
                    sprite.setScale(1.5)
                    sprite.setTint(0xff69b4) // Pink tint for network boss
                } else {
                    sprite.setTint(0xffa500) // Orange tint for network enemies
                }
                
                // Add physics (but no client-side AI)
                sprite.setBounce(0)
                sprite.setCollideWorldBounds(true)
                
                // Add collisions with platforms
                this.physics.add.collider(sprite, this.platforms)
                
                // Add collision with local player
                this.physics.add.overlap(this.player, sprite, this.hitEnemy, undefined, this)
                
                // Add collision with projectiles
                this.physics.add.overlap(this.projectiles, sprite, this.projectileHitEnemy, undefined, this)
                
                this.networkEnemies.set(enemyState.enemy_id, sprite)
                console.log(`🦴 Created network enemy: ${enemyState.enemy_id} (${enemyState.enemy_type}) at ${enemyState.x},${enemyState.y}`)
            }
            
            // Update position and state from server
            sprite.setPosition(enemyState.x, enemyState.y)
            sprite.setVelocity(enemyState.velocity_x, enemyState.velocity_y)
            sprite.setFlipX(!enemyState.facing_right)
            sprite.setData('health', enemyState.health)
            
            // Update animation based on server state
            if (Math.abs(enemyState.velocity_x) > 10) {
                if (enemyState.enemy_type === 'pink_boss') {
                    sprite.play('pink_enemy_walk_anim', true)
                } else {
                    sprite.play('enemy_walk_anim', true)
                }
            } else {
                if (enemyState.enemy_type === 'pink_boss') {
                    sprite.play('pink_enemy_idle_anim', true)
                } else {
                    sprite.play('enemy_idle_anim', true)
                }
            }
        }
        
        // Remove enemies that no longer exist on server
        for (const [enemyId, sprite] of this.networkEnemies) {
            if (!activeEnemyIds.has(enemyId)) {
                console.log('👋 Removing server enemy:', enemyId)
                sprite.destroy()
                this.networkEnemies.delete(enemyId)
            }
        }
    }
    
    private updateProjectilesFromServer(projectileStates: any[]) {
        // Create a map to track network projectiles (separate from local projectiles)
        if (!this.networkProjectiles) {
            this.networkProjectiles = new Map()
        }
        
        const activeProjectileIds = new Set<string>()
        
        for (const projectileState of projectileStates) {
            if (projectileState.owner_id === this.myPlayerId) continue // Skip our own projectiles
            
            activeProjectileIds.add(projectileState.projectile_id)
            let sprite = this.networkProjectiles.get(projectileState.projectile_id)
            
            if (!sprite) {
                // Create new network projectile sprite
                sprite = this.physics.add.sprite(projectileState.x, projectileState.y, 'projectile')
                sprite.setTint(0xff0000) // Red tint for network projectiles
                
                // Add collisions
                this.physics.add.overlap(sprite, this.enemies, this.projectileHitEnemy, undefined, this)
                this.physics.add.collider(sprite, this.platforms, this.projectileHitPlatform, undefined, this)
                
                this.networkProjectiles.set(projectileState.projectile_id, sprite)
                console.log(`🔴 Created network projectile: ${projectileState.projectile_id}`)
            }
            
            // Update position and velocity
            sprite.setPosition(projectileState.x, projectileState.y)
            sprite.setVelocity(projectileState.velocity_x, projectileState.velocity_y)
        }
        
        // Remove projectiles that no longer exist
        for (const [projectileId, sprite] of this.networkProjectiles) {
            if (!activeProjectileIds.has(projectileId)) {
                console.log('👋 Removing network projectile:', projectileId)
                sprite.destroy()
                this.networkProjectiles.delete(projectileId)
            }
        }
    }

    private gameOver() {
        console.log('Game Over!')
        
        // Show game over screen
        const gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Game Over', {
            fontSize: '64px',
            color: '#e74c3c',
            backgroundColor: '#2c3e50',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5)

        const restartText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 100, 'Klicken zum Neustart', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.scene.restart()
        })

        this.physics.pause()
    }

    private victory() {
        console.log('Victory!')
        
        const victoryText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Sieg!', {
            fontSize: '64px',
            color: '#27ae60',
            backgroundColor: '#2c3e50',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5)

        const continueText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 100, 'Nächste Welt', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            // TODO: Implement next level or return to menu
            this.scene.start('MenuScene')
        })
    }
}