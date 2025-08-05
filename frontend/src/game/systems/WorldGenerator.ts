/**
 * WorldGenerator - Handles procedural world generation, platforms, backgrounds, and streaming
 */
import Phaser from 'phaser'
import { EnemySystem } from './EnemySystem'

export class WorldGenerator {
    private scene: Phaser.Scene
    private enemySystem: EnemySystem
    private platforms!: Phaser.Physics.Arcade.StaticGroup
    
    // World configuration
    private worldWidth: number = 10000
    private leftBoundary: number = -2000
    private rightBoundary: number = 12000
    private chunkSize: number = 1024
    
    // Procedural generation state
    private platformChunks: Map<number, Phaser.Physics.Arcade.StaticGroup> = new Map()
    private backgroundElements: Map<number, Phaser.GameObjects.Group> = new Map()
    private chunksGenerated: Set<number> = new Set()
    private visibleChunks: Set<number> = new Set()

    constructor(scene: Phaser.Scene, enemySystem: EnemySystem) {
        this.scene = scene
        this.enemySystem = enemySystem
    }

    createWorld(): Phaser.Physics.Arcade.StaticGroup {
        // Extended winter forest background for side-scrolling
        this.createScrollingBackground()

        // Initialize platforms group for procedural generation
        this.platforms = this.scene.physics.add.staticGroup()
        
        // Set extended world bounds for side-scrolling
        this.scene.physics.world.setBounds(this.leftBoundary, 0, this.rightBoundary - this.leftBoundary, this.scene.scale.height)
        
        // Generate initial chunks around player start position
        const startChunk = Math.floor(100 / this.chunkSize)  // Player starts at x=100
        for (let i = startChunk - 2; i <= startChunk + 3; i++) {
            this.generateChunk(i)
        }

        // Snow particles
        this.createSnowEffect()
        
        return this.platforms
    }

    private createScrollingBackground() {
        const bgImage = this.scene.textures.get('winter_bg')
        const bgOriginalWidth = bgImage.source[0].width   // 288px
        const bgOriginalHeight = bgImage.source[0].height // 208px
        
        const screenHeight = this.scene.scale.height
        const verticalScale = screenHeight / bgOriginalHeight
        
        const scaledBgWidth = Math.round(bgOriginalWidth * verticalScale)
        const numBgTiles = Math.ceil((this.rightBoundary - this.leftBoundary) / scaledBgWidth) + 2
        
        for (let i = 0; i < numBgTiles; i++) {
            const x = Math.round(this.leftBoundary + (i * scaledBgWidth))
            const y = 0
            const bg = this.scene.add.image(x, y, 'winter_bg')
            bg.setOrigin(0, 0)
            bg.setScale(verticalScale, verticalScale)
            bg.setScrollFactor(0.1)  // Background scrolls slowly
        }
    }

    private generateChunk(chunkIndex: number) {
        if (this.chunksGenerated.has(chunkIndex)) return
        
        const chunkX = chunkIndex * this.chunkSize
        console.log(`🏗️ Generating chunk ${chunkIndex} at x=${chunkX}`)
        
        const chunkPlatforms = this.scene.physics.add.staticGroup()
        
        this.generateGroundPlatforms(chunkX, chunkPlatforms)
        this.generateFloatingPlatforms(chunkX, chunkPlatforms)
        this.generateBackgroundElements(chunkX, chunkIndex)
        this.generateChunkEnemies(chunkX, chunkIndex)
        
        this.platformChunks.set(chunkIndex, chunkPlatforms)
        this.chunksGenerated.add(chunkIndex)
        
        console.log(`✅ Generated chunk ${chunkIndex} with ${chunkPlatforms.children.size} platforms`)
    }

    private createWinterTiledPlatform(x: number, y: number, width: number, height: number = 64, platformGroup: Phaser.Physics.Arcade.StaticGroup) {
        const tileSize = 32
        const tilesWide = Math.ceil(width / tileSize)
        const tilesHigh = Math.ceil(height / tileSize)
        
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                const tileX = x + (col * tileSize)
                const tileY = y + (row * tileSize)
                
                let tileTexture: string
                
                if (row === 0) {
                    // Top row
                    if (col === 0) {
                        tileTexture = 'winter_ground_upper_left'
                    } else if (col === tilesWide - 1) {
                        tileTexture = 'winter_ground_upper_right'
                    } else {
                        tileTexture = 'winter_ground_upper_middle'
                    }
                } else if (row === tilesHigh - 1) {
                    // Bottom row
                    if (col === 0) {
                        tileTexture = 'winter_ground_lower_left'
                    } else if (col === tilesWide - 1) {
                        tileTexture = 'winter_ground_lower_right'
                    } else {
                        tileTexture = 'winter_ground_lower_middle'
                    }
                } else {
                    // Middle rows
                    tileTexture = 'winter_ground_inner'
                }
                
                const tile = this.platforms.create(tileX, tileY, tileTexture)
                tile.setOrigin(0, 0)
                tile.refreshBody()
                platformGroup.add(tile)
            }
        }
    }

    private generateGroundPlatforms(chunkX: number, chunkPlatforms: Phaser.Physics.Arcade.StaticGroup) {
        const groundY = 700
        const platformWidth = 192  // 6 tiles * 32px
        const platformHeight = 64  // 2 tiles high
        const numGroundPlatforms = Math.floor(this.chunkSize / platformWidth) + 1
        
        for (let i = 0; i < numGroundPlatforms; i++) {
            const x = chunkX + (i * platformWidth)
            this.createWinterTiledPlatform(x, groundY, platformWidth, platformHeight, chunkPlatforms)
        }
    }

    private generateFloatingPlatforms(chunkX: number, chunkPlatforms: Phaser.Physics.Arcade.StaticGroup) {
        const numPlatforms = 3 + Math.floor(Math.random() * 3)
        
        for (let i = 0; i < numPlatforms; i++) {
            const platformWidth = 96 + Math.random() * 96  // 96-192px wide
            const platformHeight = 32  // Single row for floating platforms
            const x = chunkX + 100 + Math.random() * (this.chunkSize - platformWidth - 100)
            const y = 300 + Math.random() * 250
            
            // Avoid overlapping platforms
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
        const backgroundGroup = this.scene.add.group()
        
        const screenHeight = this.scene.scale.height
        const bgOriginalHeight = 208
        const treeBandStart = (145 / bgOriginalHeight) * screenHeight
        const treeBandEnd = (190 / bgOriginalHeight) * screenHeight
        const treeBandHeight = treeBandEnd - treeBandStart
        
        const depthLayers = [
            { 
                scrollFactor: 0.2, scale: { min: 0.4, max: 0.6 },
                yRange: { min: treeBandStart, max: treeBandStart + treeBandHeight * 0.8 },
                count: { min: 1, max: 2 }, alpha: 0.6, depth: 1
            },
            { 
                scrollFactor: 0.4, scale: { min: 0.6, max: 0.9 },
                yRange: { min: treeBandStart + treeBandHeight * 0.2, max: treeBandEnd },
                count: { min: 1, max: 3 }, alpha: 0.8, depth: 2
            },
            { 
                scrollFactor: 0.7, scale: { min: 1.0, max: 1.8 },
                yRange: { min: treeBandStart + treeBandHeight * 0.4, max: treeBandEnd + treeBandHeight * 0.3 },
                count: { min: 0, max: 2 }, alpha: 1.0, depth: 3
            }
        ]
        
        depthLayers.forEach((layer) => {
            const numTrees = layer.count.min + Math.floor(Math.random() * (layer.count.max - layer.count.min + 1))
            
            for (let i = 0; i < numTrees; i++) {
                const x = chunkX + 100 + Math.random() * (this.chunkSize - 200)
                const y = layer.yRange.min + Math.random() * (layer.yRange.max - layer.yRange.min)
                const scale = layer.scale.min + Math.random() * (layer.scale.max - layer.scale.min)
                const treeTexture = Math.random() < 0.6 ? 'winter_tree' : 'tree'
                
                const tree = this.scene.add.image(x, y, treeTexture)
                tree.setScale(scale)
                tree.setScrollFactor(layer.scrollFactor)
                tree.setAlpha(layer.alpha)
                tree.setDepth(layer.depth)
                
                backgroundGroup.add(tree)
            }
        })
        
        this.backgroundElements.set(chunkIndex, backgroundGroup)
    }

    private generateChunkEnemies(chunkX: number, chunkIndex: number) {
        const numEnemies = 1 + Math.floor(Math.random() * 3)
        
        for (let i = 0; i < numEnemies; i++) {
            const x = chunkX + 150 + Math.random() * (this.chunkSize - 300)
            const y = 650
            
            const enemyTypes = ['owlet', 'owlet', 'pink_boss']
            const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)]
            
            this.enemySystem.createEnemy(x, y, enemyType, chunkIndex)
            console.log(`👹 Generated ${enemyType} enemy in chunk ${chunkIndex}`)
        }
    }

    private createSnowEffect() {
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, this.scene.scale.width)
            const y = Phaser.Math.Between(-100, this.scene.scale.height)
            const snowflake = this.scene.add.circle(x, y, 1, 0xffffff, 0.8)
            
            this.scene.tweens.add({
                targets: snowflake,
                y: snowflake.y + this.scene.scale.height + 100,
                x: snowflake.x + Phaser.Math.Between(-50, 50),
                duration: Phaser.Math.Between(3000, 8000),
                repeat: -1,
                onComplete: () => {
                    snowflake.y = -10
                    snowflake.x = Phaser.Math.Between(0, this.scene.scale.width)
                }
            })
        }
    }

    updateWorldStreaming(playerX: number) {
        const currentChunk = Math.floor(playerX / this.chunkSize)
        const loadDistance = 3
        
        // Generate chunks around player
        for (let i = currentChunk - loadDistance; i <= currentChunk + loadDistance; i++) {
            if (!this.chunksGenerated.has(i)) {
                this.generateChunk(i)
            }
            this.visibleChunks.add(i)
        }
        
        // Cleanup distant chunks
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
        
        // Remove enemies
        this.enemySystem.removeEnemiesInChunk(chunkIndex)
        
        this.chunksGenerated.delete(chunkIndex)
        this.visibleChunks.delete(chunkIndex)
        
        console.log(`🗑️ Unloaded chunk ${chunkIndex}`)
    }

    getPlatforms(): Phaser.Physics.Arcade.StaticGroup {
        return this.platforms
    }

    reset() {
        this.chunksGenerated.clear()
        this.visibleChunks.clear()
        this.platformChunks.clear()
        this.backgroundElements.clear()
    }
}