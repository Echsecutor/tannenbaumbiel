import Phaser from 'phaser';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys: { [key: string]: Phaser.Input.Keyboard.Key };
    private speed: number = 160;
    private jumpPower: number = 330;
    private isOnGround: boolean = false;
    private playerId: string;
    private username: string;

    constructor(scene: Phaser.Scene, x: number, y: number, playerId: string, username: string) {
        super(scene, x, y, 'dude_idle');
        
        this.playerId = playerId;
        this.username = username;
        
        // Add to scene
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Setup physics
        this.setCollideWorldBounds(true);
        this.setBounce(0.2);
        this.setGravityY(300);
        
        // Setup input
        this.cursors = scene.input.keyboard.createCursorKeys();
        this.wasdKeys = scene.input.keyboard.addKeys('W,S,A,D') as { [key: string]: Phaser.Input.Keyboard.Key };
        
        // Create animations
        this.createAnimations();
        
        // Play idle animation
        this.play('dude_idle');
        
        // Create username text above player
        const nameText = scene.add.text(x, y - 40, username, {
            fontSize: '12px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5);
        
        // Make text follow player
        scene.physics.add.existing(nameText);
        (nameText.body as Phaser.Physics.Arcade.Body).setGravityY(-300);
    }

    createAnimations(): void {
        const scene = this.scene;
        
        // Create idle animation
        if (!scene.anims.exists('dude_idle')) {
            scene.anims.create({
                key: 'dude_idle',
                frames: scene.anims.generateFrameNumbers('dude_idle', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            });
        }
        
        // Create walk animation
        if (!scene.anims.exists('dude_walk')) {
            scene.anims.create({
                key: 'dude_walk',
                frames: scene.anims.generateFrameNumbers('dude_walk', { start: 0, end: 5 }),
                frameRate: 10,
                repeat: -1
            });
        }
        
        // Create jump animation
        if (!scene.anims.exists('dude_jump')) {
            scene.anims.create({
                key: 'dude_jump',
                frames: scene.anims.generateFrameNumbers('dude_jump', { start: 0, end: 7 }),
                frameRate: 15,
                repeat: 0
            });
        }
    }

    update(): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        this.isOnGround = body.touching.down;
        
        // Handle horizontal movement
        if (this.cursors.left?.isDown || this.wasdKeys.A?.isDown) {
            this.setVelocityX(-this.speed);
            this.setFlipX(true);
            if (this.isOnGround) {
                this.play('dude_walk', true);
            }
        } else if (this.cursors.right?.isDown || this.wasdKeys.D?.isDown) {
            this.setVelocityX(this.speed);
            this.setFlipX(false);
            if (this.isOnGround) {
                this.play('dude_walk', true);
            }
        } else {
            this.setVelocityX(0);
            if (this.isOnGround) {
                this.play('dude_idle', true);
            }
        }
        
        // Handle jumping
        if ((this.cursors.up?.isDown || this.wasdKeys.W?.isDown) && this.isOnGround) {
            this.setVelocityY(-this.jumpPower);
            this.play('dude_jump', true);
        }
    }
    
    getPlayerId(): string {
        return this.playerId;
    }
    
    getUsername(): string {
        return this.username;
    }
}