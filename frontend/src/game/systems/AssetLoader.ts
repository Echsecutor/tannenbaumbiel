/**
 * AssetLoader - Handles loading and management of game assets
 */
import Phaser from 'phaser'

export class AssetLoader {
    private scene: Phaser.Scene

    constructor(scene: Phaser.Scene) {
        this.scene = scene
    }

    loadAllAssets() {
        this.loadPlayerSprites()
        this.loadEnemySprites()
        this.loadWinterAssets()
        this.createProjectileTexture()
    }

    private loadPlayerSprites() {
        // Load Dude Monster sprites for player
        this.scene.load.spritesheet('player_idle', '/src/assets/sprites/dude_monster/Dude_Monster_Idle_4.png', {
            frameWidth: 32,
            frameHeight: 32
        })
        
        this.scene.load.spritesheet('player_run', '/src/assets/sprites/dude_monster/Dude_Monster_Run_6.png', {
            frameWidth: 32,
            frameHeight: 32
        })
        
        this.scene.load.spritesheet('player_jump', '/src/assets/sprites/dude_monster/Dude_Monster_Jump_8.png', {
            frameWidth: 32,
            frameHeight: 32
        })
    }

    private loadEnemySprites() {
        // Load Owlet Monster sprites for enemies
        this.scene.load.spritesheet('enemy_idle', '/src/assets/sprites/owlet_monster/Owlet_Monster_Idle_4.png', {
            frameWidth: 32,
            frameHeight: 32
        })
        
        this.scene.load.spritesheet('enemy_walk', '/src/assets/sprites/owlet_monster/Owlet_Monster_Walk_6.png', {
            frameWidth: 32,
            frameHeight: 32
        })
        
        // Load Pink Monster sprites for special enemies
        this.scene.load.spritesheet('pink_enemy_idle', '/src/assets/sprites/pink_monster/Pink_Monster_Idle_4.png', {
            frameWidth: 32,
            frameHeight: 32
        })
    }

    private loadWinterAssets() {
        // Load winter-themed assets
        this.scene.load.image('winter_bg', '/src/assets/winter/winter_bg.png')
        
        // Load all winter ground tile variants for intelligent tiling
        this.scene.load.image('winter_ground_upper_left', '/src/assets/winter/winter_ground_upper_left.png')
        this.scene.load.image('winter_ground_upper_middle', '/src/assets/winter/winter_ground_upper_middle.png')
        this.scene.load.image('winter_ground_upper_right', '/src/assets/winter/winter_ground_upper_right.png')
        this.scene.load.image('winter_ground_inner', '/src/assets/winter/winter_ground_inner.png')
        this.scene.load.image('winter_ground_lower_left', '/src/assets/winter/winter_ground_lower_left.png')
        this.scene.load.image('winter_ground_lower_middle', '/src/assets/winter/winter_ground_lower_middle.png')
        this.scene.load.image('winter_ground_lower_right', '/src/assets/winter/winter_ground_lower_right.png')
        
        // Winter decoration assets
        this.scene.load.image('winter_tree', '/src/assets/winter/winter_tree.png')
        this.scene.load.image('tree', '/src/assets/winter/tree.png')
    }

    private createProjectileTexture() {
        // Create simple projectile texture
        const projectileGraphics = this.scene.add.graphics()
        projectileGraphics.fillStyle(0xe8f4fd)  // Light blue/white for snow projectile
        projectileGraphics.fillRect(0, 0, 8, 4)
        projectileGraphics.generateTexture('projectile', 8, 4)
        projectileGraphics.destroy()
    }
}