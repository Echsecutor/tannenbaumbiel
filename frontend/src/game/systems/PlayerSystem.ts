/**
 * PlayerSystem - Handles player creation, animations, movement, and state
 */
import Phaser from 'phaser'

export class PlayerSystem {
    private scene: Phaser.Scene
    private player!: Phaser.Physics.Arcade.Sprite
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private wasd!: any

    // Mobile touch input state
    private mobileInput = {
        left: false,
        right: false,
        jump: false,
        shoot: false
    }

    constructor(scene: Phaser.Scene) {
        this.scene = scene
    }

    createPlayer(): Phaser.Physics.Arcade.Sprite {
        this.player = this.scene.physics.add.sprite(100, 450, 'player_idle')
        this.player.setBounce(0.2)
        this.player.setCollideWorldBounds(true)
        this.player.setData('health', 100)
        this.player.setData('facingRight', true)
        this.player.setDepth(10)  // Player in front of trees and background

        this.createPlayerAnimations()
        this.player.play('player_idle_anim')
        
        return this.player
    }

    private createPlayerAnimations() {
        // Idle animation
        if (!this.scene.anims.exists('player_idle_anim')) {
            this.scene.anims.create({
                key: 'player_idle_anim',
                frames: this.scene.anims.generateFrameNumbers('player_idle', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            })
        }
        
        // Run animation
        if (!this.scene.anims.exists('player_run_anim')) {
            this.scene.anims.create({
                key: 'player_run_anim',
                frames: this.scene.anims.generateFrameNumbers('player_run', { start: 0, end: 5 }),
                frameRate: 10,
                repeat: -1
            })
        }
        
        // Jump animation
        if (!this.scene.anims.exists('player_jump_anim')) {
            this.scene.anims.create({
                key: 'player_jump_anim',
                frames: this.scene.anims.generateFrameNumbers('player_jump', { start: 0, end: 7 }),
                frameRate: 15,
                repeat: 0
            })
        }
    }

    handleMovement(): boolean {
        if (!this.player) return false

        const speed = 200
        const jumpSpeed = 550
        let inputDetected = false

        // Horizontal movement
        if (this.cursors.left.isDown || this.wasd.A.isDown || this.mobileInput.left) {
            this.player.setVelocityX(-speed)
            this.player.setData('facingRight', false)
            this.player.setFlipX(true)
            if (this.player.body!.touching.down) {
                this.player.play('player_run_anim', true)
            }
            inputDetected = true
        } else if (this.cursors.right.isDown || this.wasd.D.isDown || this.mobileInput.right) {
            this.player.setVelocityX(speed)
            this.player.setData('facingRight', true)
            this.player.setFlipX(false)
            if (this.player.body!.touching.down) {
                this.player.play('player_run_anim', true)
            }
            inputDetected = true
        } else {
            this.player.setVelocityX(0)
            if (this.player.body!.touching.down) {
                this.player.play('player_idle_anim', true)
            }
        }

        // Jumping
        if ((this.cursors.up.isDown || this.wasd.W.isDown || this.mobileInput.jump) && this.player.body!.touching.down) {
            this.player.setVelocityY(-jumpSpeed)
            this.player.play('player_jump_anim', true)
            this.mobileInput.jump = false  // Reset to prevent continuous jumping
            inputDetected = true
        }

        return inputDetected
    }

    isShootPressed(): boolean {
        const isShootPressed = (this.scene.input.activePointer.isDown && !this.scene.input.activePointer.wasTouch) || 
                              this.wasd.SPACE.isDown || 
                              this.mobileInput.shoot
        return isShootPressed
    }

    getPlayer(): Phaser.Physics.Arcade.Sprite {
        return this.player
    }

    getPlayerState() {
        if (!this.player) return null

        return {
            x: this.player.x,
            y: this.player.y,
            velocity_x: this.player.body!.velocity.x,
            velocity_y: this.player.body!.velocity.y,
            facing_right: this.player.getData('facingRight'),
            is_grounded: this.player.body!.touching.down,
            is_jumping: this.player.body!.velocity.y < -10,
            health: this.player.getData('health') || 100
        }
    }

    setControls(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: any) {
        this.cursors = cursors
        this.wasd = wasd
    }

    setMobileInput(action: string, pressed: boolean) {
        if (action in this.mobileInput) {
            (this.mobileInput as any)[action] = pressed
        }
    }

    takeDamage(amount: number): number {
        if (!this.player) return 0

        const currentHealth = this.player.getData('health') || 100
        const newHealth = Math.max(0, currentHealth - amount)
        this.player.setData('health', newHealth)

        // Visual feedback
        this.player.setTint(0xff0000)
        this.scene.time.delayedCall(200, () => {
            this.player.setTint(0x3498db)
        })

        return newHealth
    }

    applyKnockback(direction: number) {
        if (!this.player) return
        this.player.setVelocity(direction * 300, -200)
    }

    getCurrentInputs() {
        return {
            left: this.cursors.left.isDown || this.wasd.A.isDown || this.mobileInput.left,
            right: this.cursors.right.isDown || this.wasd.D.isDown || this.mobileInput.right,
            jump: this.cursors.up.isDown || this.wasd.W.isDown || this.mobileInput.jump,
            shoot: this.isShootPressed()
        }
    }

    reconcilePosition(serverState: any) {
        if (!this.player) return

        const positionThreshold = 15
        const velocityThreshold = 100
        
        const positionDiff = Math.abs(this.player.x - serverState.x) + Math.abs(this.player.y - serverState.y)
        const velocityDiffX = Math.abs(this.player.body!.velocity.x - serverState.velocity_x)
        const velocityDiffY = Math.abs(this.player.body!.velocity.y - serverState.velocity_y)
        
        if (positionDiff > positionThreshold || velocityDiffX > velocityThreshold || velocityDiffY > velocityThreshold) {
            console.log('🔧 Server reconciliation: Correcting local player state')
            this.player.setPosition(serverState.x, serverState.y)
            this.player.setVelocity(serverState.velocity_x, serverState.velocity_y)
        }
        
        // Always sync health
        if (serverState.health !== undefined) {
            this.player.setData('health', serverState.health)
        }
    }
}