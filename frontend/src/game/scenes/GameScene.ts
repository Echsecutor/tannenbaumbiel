/**
 * Game Scene - Main game world
 */
import Phaser from 'phaser'
import { NetworkManager } from '../../network/NetworkManager'

export class GameScene extends Phaser.Scene {
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
    
    // Mobile touch input state
    private mobileInput = {
        left: false,
        right: false,
        jump: false,
        shoot: false
    }
    
    private isOffline = false
    private roomData: any = null

    // Side-scrolling system
    private worldWidth: number = 10000  // Extended world width for side-scrolling
    private cameraDeadZone: number = 200  // Area around player where camera doesn't move
    private lastCameraX: number = 0
    
    // Procedural generation
    private platformChunks: Map<number, Phaser.Physics.Arcade.StaticGroup> = new Map()
    private backgroundElements: Map<number, Phaser.GameObjects.Group> = new Map()
    private chunkSize: number = 1024  // Size of each procedural chunk
    private chunksGenerated: Set<number> = new Set()
    private visibleChunks: Set<number> = new Set()
    
    // World streaming
    private leftBoundary: number = -2000
    private rightBoundary: number = 12000

    constructor() {
        super({ key: 'GameScene' })
    }

    init(data: any) {
        this.isOffline = data.offline || false
        this.roomData = data.roomData || null
        
        // Reset world generation state on init to prevent empty world bug
        this.chunksGenerated.clear()
        this.visibleChunks.clear()
        this.platformChunks.clear()
        this.backgroundElements.clear()
        
        // Reset multiplayer state
        this.networkPlayers.clear()
        this.networkEnemies.clear()
        this.networkProjectiles.clear()
        this.myPlayerId = ''
        this.roomJoinConfirmed = false
        this.inputState.clear()
        
        console.log('🔄 GameScene state reset completed')
        
        // Store original join parameters for restart functionality
        if (data.roomData && !this.isOffline) {
            // Extract or determine the original join parameters
            // These should be passed from MenuScene or derived from the data
            this.registry.set('originalRoomName', data.originalRoomName || 'Winterwald')
            this.registry.set('originalUsername', data.originalUsername || 'Player')
            console.log('💾 Stored original join parameters:', data.originalRoomName, data.originalUsername)
        }
        
        // Get player ID directly from scene data (passed from MenuScene)
        if (data.myPlayerId) {
            this.myPlayerId = data.myPlayerId
            this.roomJoinConfirmed = true  // Room join already confirmed by MenuScene
            console.log('🎮 GameScene.init: Player ID received directly:', this.myPlayerId)
            console.log('✅ GameScene.init: Room join pre-confirmed, ready to broadcast game state')
        }
        
        // Check if this is a restart that should rejoin the room
        const shouldRejoinRoom = this.registry.get('shouldRejoinRoom')
        const lastRoomData = this.registry.get('lastRoomData')
        
        if (shouldRejoinRoom && lastRoomData && !this.isOffline) {
            console.log('🔄 Restart detected, will rejoin room:', lastRoomData)
            this.isOffline = false
            this.roomData = lastRoomData
            
            // Clear the rejoin flags
            this.registry.set('shouldRejoinRoom', false)
            this.registry.set('lastRoomData', null)
            
            // Set up for automatic rejoin after scene creation
            this.events.once('create', () => {
                setTimeout(() => {
                    this.autoRejoinAfterRestart()
                }, 200) // Small delay to ensure scene is fully created
            })
        }
        
        console.log('GameScene initialized:', { 
            offline: this.isOffline, 
            roomData: this.roomData,
            myPlayerId: this.myPlayerId,
            shouldRejoin: shouldRejoinRoom 
        })
    }

    preload() {
        this.loadAssets()
    }

    create() {
        this.networkManager = this.registry.get('networkManager')
        
        // Initialize enemy and projectile groups first (needed for world generation)
        this.enemies = this.physics.add.group()
        this.projectiles = this.physics.add.group()
        
        this.createWorld()
        this.createPlayer()
        this.createEnemies()  // This will now just create animations since groups are already initialized
        this.createControls()
        this.createPhysics()
        
        // Setup side-scrolling camera system
        this.setupSideScrollingCamera()
        
        if (!this.isOffline) {
            this.setupNetworkHandlers()
        }
        
        // Start UI scene
        this.scene.launch('UIScene')
        
        // Initialize UI with current health and score
        this.game.events.emit('health-changed', this.player.getData('health'))
    }

    update() {
        this.handlePlayerMovement()
        this.updateEnemies()
        
        // Update side-scrolling camera and world streaming
        this.updateSideScrollingCamera()
        this.updateWorldStreaming()
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

        // Load winter-themed assets
        this.load.image('winter_bg', '/src/assets/winter/winter_bg.png')
        
        // Load all winter ground tile variants for intelligent tiling
        this.load.image('winter_ground_upper_left', '/src/assets/winter/winter_ground_upper_left.png')
        this.load.image('winter_ground_upper_middle', '/src/assets/winter/winter_ground_upper_middle.png')
        this.load.image('winter_ground_upper_right', '/src/assets/winter/winter_ground_upper_right.png')
        this.load.image('winter_ground_inner', '/src/assets/winter/winter_ground_inner.png')
        this.load.image('winter_ground_lower_left', '/src/assets/winter/winter_ground_lower_left.png')
        this.load.image('winter_ground_lower_middle', '/src/assets/winter/winter_ground_lower_middle.png')
        this.load.image('winter_ground_lower_right', '/src/assets/winter/winter_ground_lower_right.png')
        
        // Winter decoration assets
        this.load.image('winter_tree', '/src/assets/winter/winter_tree.png')
        this.load.image('tree', '/src/assets/winter/tree.png')

        // Create simple projectile (keep for now - could be snowball later)
        const projectileGraphics = this.add.graphics()
        projectileGraphics.fillStyle(0xe8f4fd)  // Light blue/white for snow projectile
        projectileGraphics.fillRect(0, 0, 8, 4)
        projectileGraphics.generateTexture('projectile', 8, 4)
        projectileGraphics.destroy()
    }

    private createWorld() {
        // Extended winter forest background for side-scrolling
        this.createScrollingBackground()

        // Initialize platforms group for procedural generation
        this.platforms = this.physics.add.staticGroup()
        
        // Set extended world bounds for side-scrolling
        this.physics.world.setBounds(this.leftBoundary, 0, this.rightBoundary - this.leftBoundary, this.scale.height)
        
        // Generate initial chunks around player start position
        const startChunk = Math.floor(100 / this.chunkSize)  // Player starts at x=100
        for (let i = startChunk - 2; i <= startChunk + 3; i++) {
            this.generateChunk(i)
        }

        // Snow particles (scrolling with world)
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
        // Create enemy animations (groups are already initialized in create())
        this.createEnemyAnimations()
        
        // CLIENT-SIDE PHYSICS: Always create local enemies with Phaser physics
        // In side-scrolling, enemies are generated procedurally as chunks are created
        console.log('🎮 Enemy animations created for procedural generation')
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
        // Simple touch areas for mobile - fixed to camera (don't scroll with world)
        const leftArea = this.add.rectangle(100, this.scale.height - 100, 150, 150, 0x000000, 0.3)
        leftArea.setInteractive()
        leftArea.setScrollFactor(0)  // Stay fixed to camera
        leftArea.on('pointerdown', () => this.setPlayerInput('left', true))
        leftArea.on('pointerup', () => this.setPlayerInput('left', false))
        leftArea.on('pointerout', () => this.setPlayerInput('left', false))  // Stop when finger leaves button

        const rightArea = this.add.rectangle(250, this.scale.height - 100, 150, 150, 0x000000, 0.3)
        rightArea.setInteractive()
        rightArea.setScrollFactor(0)  // Stay fixed to camera
        rightArea.on('pointerdown', () => this.setPlayerInput('right', true))
        rightArea.on('pointerup', () => this.setPlayerInput('right', false))
        rightArea.on('pointerout', () => this.setPlayerInput('right', false))  // Stop when finger leaves button

        const jumpArea = this.add.rectangle(this.scale.width - 150, this.scale.height - 100, 150, 150, 0x000000, 0.3)
        jumpArea.setInteractive()
        jumpArea.setScrollFactor(0)  // Stay fixed to camera
        jumpArea.on('pointerdown', () => this.setPlayerInput('jump', true))
        jumpArea.on('pointerup', () => this.setPlayerInput('jump', false))

        const shootArea = this.add.rectangle(this.scale.width - 300, this.scale.height - 100, 150, 150, 0x000000, 0.3)
        shootArea.setInteractive()
        shootArea.setScrollFactor(0)  // Stay fixed to camera
        shootArea.on('pointerdown', () => this.setPlayerInput('shoot', true))
        shootArea.on('pointerup', () => this.setPlayerInput('shoot', false))

        // Add control labels - also fixed to camera
        this.add.text(100, this.scale.height - 100, '←', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0)
        this.add.text(250, this.scale.height - 100, '→', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0)
        this.add.text(this.scale.width - 150, this.scale.height - 100, '↑', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0)
        this.add.text(this.scale.width - 300, this.scale.height - 100, '⚡', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0)
    }
    
    private setPlayerInput(action: string, pressed: boolean) {
        // Set mobile input state
        if (action in this.mobileInput) {
            (this.mobileInput as any)[action] = pressed
        }
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

        // Horizontal movement (include mobile touch input)
        if (this.cursors.left.isDown || this.wasd.A.isDown || this.mobileInput.left) {
            this.player.setVelocityX(-speed)
            this.player.setData('facingRight', false)
            this.player.setFlipX(true)
            if (this.player.body!.touching.down) {
                this.player.play('player_run_anim', true)
            }
        } else if (this.cursors.right.isDown || this.wasd.D.isDown || this.mobileInput.right) {
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

        // Jumping (include mobile touch input)
        if ((this.cursors.up.isDown || this.wasd.W.isDown || this.mobileInput.jump) && this.player.body!.touching.down) {
            this.player.setVelocityY(-jumpSpeed)
            this.player.play('player_jump_anim', true)
            // Reset jump input to prevent continuous jumping
            this.mobileInput.jump = false
        }

        // Shooting (include mobile touch input)
        const isShootPressed = (this.input.activePointer.isDown && !this.input.activePointer.wasTouch) || this.wasd.SPACE.isDown || this.mobileInput.shoot
        if (isShootPressed) {
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
            left: this.cursors.left.isDown || this.wasd.A.isDown || this.mobileInput.left,
            right: this.cursors.right.isDown || this.wasd.D.isDown || this.mobileInput.right,
            jump: this.cursors.up.isDown || this.wasd.W.isDown || this.mobileInput.jump,
            shoot: (this.input.activePointer.isDown && !this.input.activePointer.wasTouch) || this.wasd.SPACE.isDown || this.mobileInput.shoot
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
        
        // Emit health change event for UI update
        this.game.events.emit('health-changed', health)
        
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
            
            // Emit enemy defeated event for score update
            this.game.events.emit('enemy-defeated')
            
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
            try {
                // Create new network player sprite
                sprite = this.physics.add.sprite(playerState.x, playerState.y, 'player_idle')
                
                // Verify sprite was created successfully
                if (!sprite) {
                    console.error(`❌ Failed to create sprite for network player ${playerState.player_id}`)
                    return // Exit early
                }
                
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
            } catch (error) {
                console.error(`❌ Error creating network player ${playerState.player_id}:`, error)
                return // Exit early
            }
        }
        
        // Safety check: Ensure sprite exists before updating
        if (!sprite) {
            console.error(`❌ Sprite is undefined for network player ${playerState.player_id}, skipping update`)
            return
        }
        
        try {
            // Update position and state
            sprite.setPosition(playerState.x, playerState.y)
            sprite.setFlipX(!playerState.facing_right)
            sprite.setData('health', playerState.health)
            sprite.setData('facingRight', playerState.facing_right)
        } catch (error) {
            console.error(`❌ Error updating network player ${playerState.player_id}:`, error)
            return
        }
        
        // Update animation based on server state (with safety checks)
        if (sprite && sprite.anims) {
            try {
                if (Math.abs(playerState.velocity_x) > 10) {
                    sprite.play('player_run_anim', true)
                } else if (playerState.is_jumping || !playerState.is_grounded) {
                    sprite.play('player_jump_anim', true)
                } else {
                    sprite.play('player_idle_anim', true)
                }
            } catch (error) {
                console.error(`❌ Error playing animation for network player ${playerState.player_id}:`, error)
            }
        }
    }
    
    private updateEnemiesFromServer(enemyStates: any[]) {
        console.log('🦴 Updating enemies from server conflict resolution:', enemyStates.length)
        
        const activeEnemyIds = new Set<string>()
        
        for (const enemyState of enemyStates) {
            activeEnemyIds.add(enemyState.enemy_id)
            let sprite = this.networkEnemies.get(enemyState.enemy_id)
            
            if (!sprite) {
                try {
                    // Create new network enemy sprite
                    const texture = enemyState.enemy_type === 'pink_boss' ? 'pink_enemy_idle' : 'enemy_idle'
                    sprite = this.physics.add.sprite(enemyState.x, enemyState.y, texture)
                    
                    // Verify sprite was created successfully
                    if (!sprite) {
                        console.error(`❌ Failed to create sprite for enemy ${enemyState.enemy_id}`)
                        continue // Skip this enemy and move to next
                    }
                    
                    // Verify physics body was created
                    if (!sprite.body) {
                        console.warn(`⚠️ Physics body missing for enemy ${enemyState.enemy_id}, attempting to enable physics`)
                        // Try to enable physics manually
                        this.physics.world.enable(sprite)
                        if (!sprite.body) {
                            console.error(`❌ Failed to enable physics for enemy ${enemyState.enemy_id}`)
                            continue
                        }
                    }
                    
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
                } catch (error) {
                    console.error(`❌ Error creating network enemy ${enemyState.enemy_id}:`, error)
                    continue // Skip this enemy and move to next
                }
            }
            
            // Safety check: Ensure sprite exists before updating
            if (!sprite) {
                console.error(`❌ Sprite is undefined for enemy ${enemyState.enemy_id}, skipping update`)
                continue
            }
            
            try {
                // Update position and state from server
                sprite.setPosition(enemyState.x, enemyState.y)
                
                // Check if physics body exists before setting velocity
                if (sprite.body) {
                    sprite.setVelocity(enemyState.velocity_x, enemyState.velocity_y)
                } else {
                    console.warn(`⚠️ Enemy ${enemyState.enemy_id} has no physics body, skipping velocity update`)
                }
                
                sprite.setFlipX(!enemyState.facing_right)
                sprite.setData('health', enemyState.health)
            } catch (error) {
                console.error(`❌ Error updating enemy ${enemyState.enemy_id}:`, error)
                continue
            }
            
            // Update animation based on server state (with safety checks)
            if (sprite && sprite.anims) {
                try {
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
                } catch (error) {
                    console.error(`❌ Error playing animation for enemy ${enemyState.enemy_id}:`, error)
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
                try {
                    // Create new network projectile sprite
                    sprite = this.physics.add.sprite(projectileState.x, projectileState.y, 'projectile')
                    
                    // Verify sprite was created successfully
                    if (!sprite) {
                        console.error(`❌ Failed to create sprite for projectile ${projectileState.projectile_id}`)
                        continue // Skip this projectile and move to next
                    }
                    
                    // Verify physics body was created
                    if (!sprite.body) {
                        console.warn(`⚠️ Physics body missing for projectile ${projectileState.projectile_id}, attempting to enable physics`)
                        // Try to enable physics manually
                        this.physics.world.enable(sprite)
                        if (!sprite.body) {
                            console.error(`❌ Failed to enable physics for projectile ${projectileState.projectile_id}`)
                            continue
                        }
                    }
                    
                    sprite.setTint(0xff0000) // Red tint for network projectiles
                    
                    // Add collisions
                    this.physics.add.overlap(sprite, this.enemies, this.projectileHitEnemy, undefined, this)
                    this.physics.add.collider(sprite, this.platforms, this.projectileHitPlatform, undefined, this)
                    
                    this.networkProjectiles.set(projectileState.projectile_id, sprite)
                    console.log(`🔴 Created network projectile: ${projectileState.projectile_id}`)
                } catch (error) {
                    console.error(`❌ Error creating network projectile ${projectileState.projectile_id}:`, error)
                    continue // Skip this projectile and move to next
                }
            }
            
            // Safety check: Ensure sprite exists before updating
            if (!sprite) {
                console.error(`❌ Sprite is undefined for projectile ${projectileState.projectile_id}, skipping update`)
                continue
            }
            
            try {
                // Update position and velocity
                sprite.setPosition(projectileState.x, projectileState.y)
                
                // Check if physics body exists before setting velocity
                if (sprite.body) {
                    sprite.setVelocity(projectileState.velocity_x, projectileState.velocity_y)
                } else {
                    console.warn(`⚠️ Projectile ${projectileState.projectile_id} has no physics body, skipping velocity update`)
                }
            } catch (error) {
                console.error(`❌ Error updating projectile ${projectileState.projectile_id}:`, error)
                continue
            }
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
        
        // Calculate center position relative to current camera view
        const camera = this.cameras.main
        const centerX = camera.centerX
        const centerY = camera.centerY
        
        // Show game over screen
        const gameOverText = this.add.text(centerX, centerY, 'Game Over', {
            fontSize: '64px',
            color: '#e74c3c',
            backgroundColor: '#2c3e50',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setScrollFactor(0)

        const restartText = this.add.text(centerX, centerY + 100, 'Klicken zum Neustart', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.restartMultiplayerGame()
        })

        this.physics.pause()
    }

    private restartMultiplayerGame() {
        console.log('🔄 Starting multiplayer-aware game restart...')
        
        if (!this.isOffline && this.networkManager && this.networkManager.getConnectionStatus()) {
            console.log('🏠 Leaving room before restart for proper synchronization...')
            
            // Clean up network state before leaving
            this.cleanupNetworkEntities()
            
            // Leave the room to notify other players
            this.networkManager.leaveRoom()
            
            // Set a flag to rejoin after restart and preserve original join parameters
            this.registry.set('shouldRejoinRoom', true)
            this.registry.set('lastRoomData', this.roomData)
            
            // Ensure original join parameters are preserved for rejoin
            if (!this.registry.get('originalRoomName') || !this.registry.get('originalUsername')) {
                console.warn('⚠️ Original join parameters missing during restart, using defaults')
                this.registry.set('originalRoomName', 'Winterwald')
                this.registry.set('originalUsername', 'Player')
            }
            
            // Wait a moment for leave message to be processed
            setTimeout(() => {
                console.log('🎮 Restarting scene after leaving room...')
                this.scene.restart()
            }, 100)
        } else {
            // Offline mode - restart with offline flag preserved
            console.log('🎮 Offline restart - preserving offline mode...')
            this.scene.restart({ offline: true })
        }
    }
    
    private cleanupNetworkEntities() {
        console.log('🧹 Cleaning up network entities before restart...')
        
        // Destroy all network players
        for (const [playerId, sprite] of this.networkPlayers) {
            sprite.destroy()
        }
        this.networkPlayers.clear()
        
        // Destroy all network enemies
        for (const [enemyId, sprite] of this.networkEnemies) {
            sprite.destroy()
        }
        this.networkEnemies.clear()
        
        // Destroy all network projectiles
        for (const [projectileId, sprite] of this.networkProjectiles) {
            sprite.destroy()
        }
        this.networkProjectiles.clear()
        
        console.log('✅ Network entities cleaned up')
    }
    
    private async autoRejoinAfterRestart() {
        console.log('🔄 Auto-rejoining room after restart...')
        
        if (!this.networkManager) {
            console.error('❌ NetworkManager not available for rejoin')
            return
        }
        
        // Check if we have the original join parameters stored
        const originalRoomName = this.registry.get('originalRoomName')
        const originalUsername = this.registry.get('originalUsername')
        
        if (!originalRoomName || !originalUsername) {
            console.error('❌ No original join parameters available for rejoin')
            return
        }
        
        try {
            // Reset networking state
            this.myPlayerId = ''
            this.roomJoinConfirmed = false
            this.networkPlayers.clear()
            this.networkEnemies.clear()
            this.networkProjectiles.clear()
            
            // Rejoin the room using the original parameters
            console.log('🏠 Rejoining room:', originalRoomName, 'as', originalUsername)
            this.networkManager.joinRoom(originalRoomName, originalUsername)
            
            // Set up network handlers for the rejoined session
            this.setupNetworkHandlers()
            
            console.log('✅ Rejoin process initiated')
        } catch (error) {
            console.error('❌ Error during auto-rejoin:', error)
            // Fall back to offline mode if rejoin fails
            this.isOffline = true
        }
    }

    private victory() {
        console.log('Victory!')
        
        // Calculate center position relative to current camera view
        const camera = this.cameras.main
        const centerX = camera.centerX
        const centerY = camera.centerY
        
        const victoryText = this.add.text(centerX, centerY, 'Sieg!', {
            fontSize: '64px',
            color: '#27ae60',
            backgroundColor: '#2c3e50',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setScrollFactor(0)

        const continueText = this.add.text(centerX, centerY + 100, 'Nächste Welt', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.startNextLevel()
        })

        const menuText = this.add.text(centerX, centerY + 150, 'Zurück zum Menü', {
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#34495e',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.scene.start('MenuScene')
        })
    }

    private startNextLevel() {
        console.log('🎮 Starting next level...')
        
        if (this.isOffline) {
            // Offline mode - restart with offline flag preserved  
            console.log('🎮 Next level in offline mode...')
            this.scene.restart({ offline: true })
        } else {
            // Online mode - handle multiplayer level transition
            console.log('🎮 Next level in multiplayer mode...')
            
            if (this.networkManager && this.networkManager.getConnectionStatus()) {
                // Clean up and notify other players we're moving to next level
                this.cleanupNetworkEntities()
                
                // Set flag to rejoin after level transition
                this.registry.set('shouldRejoinRoom', true)
                this.registry.set('lastRoomData', this.roomData)
                
                // Restart scene - will automatically rejoin the room
                this.scene.restart()
            } else {
                // Connection lost - fallback to offline mode
                console.log('⚠️ Connection lost, switching to offline mode for next level')
                this.scene.restart({ offline: true })
            }
        }
    }

    // =================
    // SIDE-SCROLLING CAMERA SYSTEM
    // =================
    
    private setupSideScrollingCamera() {
        // Setup camera to follow player with dead zone
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05)
        this.cameras.main.setDeadzone(this.cameraDeadZone, this.scale.height)
        
        // Set camera bounds to allow scrolling across extended world
        this.cameras.main.setBounds(this.leftBoundary, 0, this.rightBoundary - this.leftBoundary, this.scale.height)
        
        console.log('📷 Side-scrolling camera setup completed')
    }
    
    private updateSideScrollingCamera() {
        const currentCameraX = this.cameras.main.scrollX
        
        // Only update if camera has moved significantly
        if (Math.abs(currentCameraX - this.lastCameraX) > 10) {
            this.lastCameraX = currentCameraX
            
            // For multiplayer: Send camera position to other players so they can see our viewport
            if (!this.isOffline && this.roomJoinConfirmed) {
                // Camera position is sent as part of player state in broadcastGameState()
                // Each player maintains their own camera view
            }
        }
    }
    
    // =================
    // PROCEDURAL WORLD GENERATION
    // =================
    
    private createScrollingBackground() {
        // Create winter background that scales vertically to fit screen and tiles horizontally
        const bgImage = this.textures.get('winter_bg')
        const bgOriginalWidth = bgImage.source[0].width   // 288px from winter_bg.png
        const bgOriginalHeight = bgImage.source[0].height // 208px from winter_bg.png
        
        // Calculate vertical scale to fit screen height exactly
        const screenHeight = this.scale.height
        const verticalScale = screenHeight / bgOriginalHeight
        
        // Calculate how many horizontal tiles we need to cover the world width
        const scaledBgWidth = bgOriginalWidth * verticalScale
        const numBgTiles = Math.ceil((this.rightBoundary - this.leftBoundary) / scaledBgWidth) + 2
        
        // Create horizontally tiled backgrounds, each scaled to fit screen height
        for (let i = 0; i < numBgTiles; i++) {
            const x = this.leftBoundary + (i * scaledBgWidth)
            const y = 0  // Start from top of screen
            const bg = this.add.image(x, y, 'winter_bg')
            bg.setOrigin(0, 0)  // Top-left origin for precise positioning
            bg.setScale(verticalScale, verticalScale)  // Scale uniformly to fit screen height
            bg.setScrollFactor(0.5)  // Parallax scrolling effect for depth
        }
    }
    
    private generateChunk(chunkIndex: number) {
        if (this.chunksGenerated.has(chunkIndex)) return
        
        const chunkX = chunkIndex * this.chunkSize
        console.log(`🏗️ Generating chunk ${chunkIndex} at x=${chunkX}`)
        
        // Create platform group for this chunk
        const chunkPlatforms = this.physics.add.staticGroup()
        
        // Generate ground platforms
        this.generateGroundPlatforms(chunkX, chunkPlatforms)
        
        // Generate floating platforms
        this.generateFloatingPlatforms(chunkX, chunkPlatforms)
        
        // Generate background elements (trees, decorations)
        this.generateBackgroundElements(chunkX, chunkIndex)
        
        // Generate enemies for this chunk
        this.generateChunkEnemies(chunkX, chunkIndex)
        
        // Store chunk data
        this.platformChunks.set(chunkIndex, chunkPlatforms)
        this.chunksGenerated.add(chunkIndex)
        
        console.log(`✅ Generated chunk ${chunkIndex} with ${chunkPlatforms.children.size} platforms`)
    }
    
    /**
     * Creates a winter-themed tiled platform using proper tile variants
     * @param x - Left edge x position
     * @param y - Top edge y position  
     * @param width - Platform width in pixels
     * @param height - Platform height in pixels (defaults to 64px = 2 tiles)
     * @param platformGroup - Physics group to add platform tiles to
     */
    private createWinterTiledPlatform(x: number, y: number, width: number, height: number = 64, platformGroup: Phaser.Physics.Arcade.StaticGroup) {
        const tileSize = 32  // Each winter tile is 32x32
        const tilesWide = Math.ceil(width / tileSize)
        const tilesHigh = Math.ceil(height / tileSize)
        
        // Create tiles row by row
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                const tileX = x + (col * tileSize)
                const tileY = y + (row * tileSize)
                
                // Determine which tile texture to use based on position
                let tileTexture: string
                
                if (row === 0) {
                    // Top row - use upper tiles
                    if (col === 0) {
                        tileTexture = 'winter_ground_upper_left'
                    } else if (col === tilesWide - 1) {
                        tileTexture = 'winter_ground_upper_right'
                    } else {
                        tileTexture = 'winter_ground_upper_middle'
                    }
                } else if (row === tilesHigh - 1) {
                    // Bottom row - use lower tiles
                    if (col === 0) {
                        tileTexture = 'winter_ground_lower_left'
                    } else if (col === tilesWide - 1) {
                        tileTexture = 'winter_ground_lower_right'
                    } else {
                        tileTexture = 'winter_ground_lower_middle'
                    }
                } else {
                    // Middle rows - use inner tiles  
                    tileTexture = 'winter_ground_inner'
                }
                
                // Create the tile sprite with physics
                const tile = this.platforms.create(tileX, tileY, tileTexture)
                tile.setOrigin(0, 0)  // Align to top-left for precise positioning
                tile.refreshBody()
                platformGroup.add(tile)
            }
        }
    }
    
    private generateGroundPlatforms(chunkX: number, chunkPlatforms: Phaser.Physics.Arcade.StaticGroup) {
        const groundY = 700
        const platformWidth = 192  // Changed to 192 (6 tiles * 32px) for proper tiling
        const platformHeight = 64  // 2 tiles high for substantial ground
        const numGroundPlatforms = Math.floor(this.chunkSize / platformWidth) + 1
        
        for (let i = 0; i < numGroundPlatforms; i++) {
            const x = chunkX + (i * platformWidth)
            this.createWinterTiledPlatform(x, groundY, platformWidth, platformHeight, chunkPlatforms)
        }
    }
    
    private generateFloatingPlatforms(chunkX: number, chunkPlatforms: Phaser.Physics.Arcade.StaticGroup) {
        // Generate 3-5 floating platforms per chunk
        const numPlatforms = 3 + Math.floor(Math.random() * 3)
        
        for (let i = 0; i < numPlatforms; i++) {
            const platformWidth = 96 + Math.random() * 96  // 96-192px wide (3-6 tiles)
            const platformHeight = 32  // Single row for floating platforms
            const x = chunkX + 100 + Math.random() * (this.chunkSize - platformWidth - 100)
            const y = 300 + Math.random() * 250  // Random height between 300-550
            
            // Avoid placing platforms too close to each other
            const minDistance = 150
            let validPosition = true
            
            chunkPlatforms.children.entries.forEach((existingPlatform: any) => {
                if (Math.abs(existingPlatform.x - x) < minDistance && Math.abs(existingPlatform.y - y) < 100) {
                    validPosition = false
                }
            })
            
            if (validPosition) {
                this.createWinterTiledPlatform(x, y, platformWidth, platformHeight, chunkPlatforms)
            }
        }
    }
    
    private generateBackgroundElements(chunkX: number, chunkIndex: number) {
        const backgroundGroup = this.add.group()
        
        // Generate 2-4 trees per chunk
        const numTrees = 2 + Math.floor(Math.random() * 3)
        
        for (let i = 0; i < numTrees; i++) {
            const x = chunkX + 50 + Math.random() * (this.chunkSize - 100)
            const y = 400 + Math.random() * 200
            const scale = 0.3 + Math.random() * 0.5
            
            const tree = this.add.image(x, y, 'winter_tree')
            tree.setScale(scale)
            tree.setScrollFactor(0.8)  // Parallax effect for depth
            backgroundGroup.add(tree)
        }
        
        this.backgroundElements.set(chunkIndex, backgroundGroup)
    }
    
    private generateChunkEnemies(chunkX: number, chunkIndex: number) {
        // Generate 1-3 enemies per chunk randomly
        const numEnemies = 1 + Math.floor(Math.random() * 3)
        
        for (let i = 0; i < numEnemies; i++) {
            const x = chunkX + 150 + Math.random() * (this.chunkSize - 300)
            const y = 650  // Place on ground level initially
            
            // Random enemy type
            const enemyTypes = ['owlet', 'owlet', 'pink_boss']  // 2/3 chance for owlet, 1/3 for boss
            const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)]
            
            let enemy: Phaser.Physics.Arcade.Sprite
            
            if (enemyType === 'pink_boss') {
                enemy = this.enemies.create(x, y, 'pink_enemy_idle')
                enemy.setData('health', 100)
                enemy.setData('type', 'pink_boss')
                enemy.setScale(1.5) // Make boss bigger
                enemy.play('pink_enemy_idle_anim')
                enemy.setVelocity(Phaser.Math.Between(-100, 100), 20)
            } else {
                enemy = this.enemies.create(x, y, 'enemy_idle')
                enemy.setData('health', 50)
                enemy.setData('type', 'owlet')
                enemy.play('enemy_idle_anim')
                enemy.setVelocity(Phaser.Math.Between(-200, 200), 20)
            }
            
            enemy.setBounce(1)
            enemy.setCollideWorldBounds(true)
            enemy.setData('facingRight', true)
            enemy.setData('chunkIndex', chunkIndex)  // Track which chunk this enemy belongs to
            
            console.log(`👹 Generated ${enemyType} enemy in chunk ${chunkIndex} at x=${x}`)
        }
    }
    
    // =================
    // WORLD STREAMING SYSTEM
    // =================
    
    private updateWorldStreaming() {
        const playerX = this.player.x
        const currentChunk = Math.floor(playerX / this.chunkSize)
        
        // Generate chunks ahead and behind player
        const loadDistance = 3  // Load 3 chunks in each direction
        
        for (let i = currentChunk - loadDistance; i <= currentChunk + loadDistance; i++) {
            if (!this.chunksGenerated.has(i)) {
                this.generateChunk(i)
            }
            this.visibleChunks.add(i)
        }
        
        // Cleanup distant chunks to save memory
        const unloadDistance = 5
        const chunksToRemove: number[] = []
        
        this.chunksGenerated.forEach(chunkIndex => {
            if (Math.abs(chunkIndex - currentChunk) > unloadDistance) {
                chunksToRemove.push(chunkIndex)
            }
        })
        
        chunksToRemove.forEach(chunkIndex => {
            this.unloadChunk(chunkIndex)
        })
    }
    
    private unloadChunk(chunkIndex: number) {
        // Remove platforms
        const chunkPlatforms = this.platformChunks.get(chunkIndex)
        if (chunkPlatforms) {
            chunkPlatforms.destroy(true)
            this.platformChunks.delete(chunkIndex)
        }
        
        // Remove background elements
        const backgroundElements = this.backgroundElements.get(chunkIndex)
        if (backgroundElements) {
            backgroundElements.destroy(true)
            this.backgroundElements.delete(chunkIndex)
        }
        
        // Remove enemies belonging to this chunk
        this.enemies.children.entries.forEach((enemy: any) => {
            if (enemy.getData('chunkIndex') === chunkIndex) {
                enemy.destroy()
                console.log(`👹 Removed enemy from chunk ${chunkIndex}`)
            }
        })
        
        this.chunksGenerated.delete(chunkIndex)
        this.visibleChunks.delete(chunkIndex)
        
        console.log(`🗑️ Unloaded chunk ${chunkIndex}`)
    }
}