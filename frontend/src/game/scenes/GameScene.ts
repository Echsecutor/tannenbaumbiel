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
        console.log('GameScene initialized:', { offline: this.isOffline, roomData: this.roomData })
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
        
        // Create owlet enemies
        const enemy1 = this.enemies.create(300, 400, 'enemy_idle')
        enemy1.setBounce(1)
        enemy1.setCollideWorldBounds(true)
        enemy1.setVelocity(Phaser.Math.Between(-200, 200), 20)
        enemy1.setData('health', 50)
        enemy1.setData('type', 'owlet')
        enemy1.play('enemy_idle_anim')

        const enemy2 = this.enemies.create(600, 300, 'enemy_idle')
        enemy2.setBounce(1)
        enemy2.setCollideWorldBounds(true)
        enemy2.setVelocity(Phaser.Math.Between(-200, 200), 20)
        enemy2.setData('health', 50)
        enemy2.setData('type', 'owlet')
        enemy2.play('enemy_idle_anim')
        
        // Create a pink enemy boss
        const boss = this.enemies.create(800, 250, 'pink_enemy_idle')
        boss.setBounce(1)
        boss.setCollideWorldBounds(true)
        boss.setVelocity(Phaser.Math.Between(-100, 100), 20)
        boss.setData('health', 100)
        boss.setData('type', 'pink_boss')
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
        const speed = 200
        const jumpSpeed = 550

        // Horizontal movement
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            this.setPlayerInput('move_left', true)
        } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
            this.setPlayerInput('move_right', true)
        } else {
            this.setPlayerInput('stop_move', true)
        }

        // Jumping
        if ((this.cursors.up.isDown || this.wasd.W.isDown || this.wasd.SPACE.isDown) && this.player.body!.touching.down) {
            this.setPlayerInput('jump', true)
        }

        // Shooting
        if (this.input.activePointer.isDown && !this.input.activePointer.wasTouch) {
            this.setPlayerInput('shoot', true)
        }
    }

    private setPlayerInput(action: string, pressed: boolean) {
        const speed = 200
        const jumpSpeed = 550
        const isOnGround = this.player.body!.touching.down

        switch (action) {
            case 'move_left':
                this.player.setVelocityX(-speed)
                this.player.setData('facingRight', false)
                this.player.setFlipX(true)
                if (isOnGround) {
                    this.player.play('player_run_anim', true)
                }
                break
            case 'move_right':
                this.player.setVelocityX(speed)
                this.player.setData('facingRight', true)
                this.player.setFlipX(false)
                if (isOnGround) {
                    this.player.play('player_run_anim', true)
                }
                break
            case 'stop_move':
                this.player.setVelocityX(0)
                if (isOnGround) {
                    this.player.play('player_idle_anim', true)
                }
                break
            case 'jump':
                if (isOnGround) {
                    this.player.setVelocityY(-jumpSpeed)
                    this.player.play('player_jump_anim', true)
                }
                break
            case 'shoot':
                this.shootProjectile()
                break
        }

        // Send input to server if online
        if (!this.isOffline && this.networkManager) {
            this.networkManager.sendPlayerInput(action, pressed)
        }
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
            this.networkManager.onMessage('game_state', (data) => {
                this.updateGameState(data)
            })
        }
    }

    private updateGameState(gameState: any) {
        // Update game state from server
        console.log('Game state update:', gameState)
        // This would sync player positions, enemy states, etc.
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