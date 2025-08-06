/**
 * WorldGenerator - Handles procedural world generation, platforms, backgrounds, and streaming
 */
import Phaser from "phaser";
import { EnemySystem } from "./EnemySystem";

export class WorldGenerator {
  private scene: Phaser.Scene;
  private enemySystem: EnemySystem;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private movingPlatforms!: Phaser.Physics.Arcade.Group;
  private currentLevel: number = 1;
  private isBossLevel: boolean = false;

  // World configuration
  private leftBoundary: number = -2000;
  private rightBoundary: number = 12000;
  private chunkSize: number = 1024;

  // Procedural generation state
  private platformChunks: Map<number, Phaser.Physics.Arcade.StaticGroup> =
    new Map();
  private backgroundElements: Map<number, Phaser.GameObjects.Group> = new Map();
  private chunksGenerated: Set<number> = new Set();
  private visibleChunks: Set<number> = new Set();

  constructor(scene: Phaser.Scene, enemySystem: EnemySystem) {
    this.scene = scene;
    this.enemySystem = enemySystem;
  }

  setLevel(level: number) {
    this.currentLevel = level;
    this.isBossLevel = this.currentLevel % 5 === 0;
    console.log(
      `🌍 WorldGenerator: Level set to ${this.currentLevel}${this.isBossLevel ? " (BOSS ARENA!)" : ""}`
    );
  }

  getRightBoundary(): number {
    return this.rightBoundary;
  }

  createWorld(): Phaser.Physics.Arcade.StaticGroup {
    // Extended winter forest background for side-scrolling
    this.createScrollingBackground();

    // Initialize platforms groups
    this.platforms = this.scene.physics.add.staticGroup();
    this.movingPlatforms = this.scene.physics.add.group();

    // Set extended world bounds for side-scrolling
    this.scene.physics.world.setBounds(
      this.leftBoundary,
      0,
      this.rightBoundary - this.leftBoundary,
      this.scene.scale.height
    );

    if (this.isBossLevel) {
      // Create boss arena instead of normal level
      this.createBossArena();
    } else {
      // Generate normal level chunks around player start position
      const startChunk = Math.floor(100 / this.chunkSize); // Player starts at x=100
      for (let i = startChunk - 2; i <= startChunk + 3; i++) {
        this.generateChunk(i);
      }
    }

    // Snow particles
    this.createSnowEffect();

    return this.platforms;
  }

  private createScrollingBackground() {
    const bgImage = this.scene.textures.get("winter_bg");
    const bgOriginalWidth = bgImage.source[0].width; // 288px
    const bgOriginalHeight = bgImage.source[0].height; // 208px

    const screenHeight = this.scene.scale.height;
    const verticalScale = screenHeight / bgOriginalHeight;

    const scaledBgWidth = Math.round(bgOriginalWidth * verticalScale);
    const numBgTiles =
      Math.ceil((this.rightBoundary - this.leftBoundary) / scaledBgWidth) + 2;

    for (let i = 0; i < numBgTiles; i++) {
      const x = Math.round(this.leftBoundary + i * scaledBgWidth);
      const y = 0;
      const bg = this.scene.add.image(x, y, "winter_bg");
      bg.setOrigin(0, 0);
      bg.setScale(verticalScale, verticalScale);
      bg.setScrollFactor(0.1); // Background scrolls slowly
    }
  }

  private generateChunk(chunkIndex: number) {
    if (this.chunksGenerated.has(chunkIndex)) return;

    const chunkX = chunkIndex * this.chunkSize;
    // Generate chunk content
    const chunkPlatforms = this.scene.physics.add.staticGroup();

    this.generateGroundPlatforms(chunkX, chunkPlatforms);
    this.generateFloatingPlatforms(chunkX, chunkPlatforms);
    this.generateBackgroundElements(chunkX, chunkIndex);
    this.generateChunkEnemies(chunkX, chunkIndex);

    this.platformChunks.set(chunkIndex, chunkPlatforms);
    this.chunksGenerated.add(chunkIndex);
  }

  private createWinterTiledPlatform(
    x: number,
    y: number,
    width: number,
    height: number = 64,
    platformGroup: Phaser.Physics.Arcade.StaticGroup
  ) {
    const tileSize = 32;
    const tilesWide = Math.ceil(width / tileSize);
    const tilesHigh = Math.ceil(height / tileSize);

    for (let row = 0; row < tilesHigh; row++) {
      for (let col = 0; col < tilesWide; col++) {
        const tileX = x + col * tileSize;
        const tileY = y + row * tileSize;

        let tileTexture: string;

        if (row === 0) {
          // Top row
          if (col === 0) {
            tileTexture = "winter_ground_upper_left";
          } else if (col === tilesWide - 1) {
            tileTexture = "winter_ground_upper_right";
          } else {
            tileTexture = "winter_ground_upper_middle";
          }
        } else if (row === tilesHigh - 1) {
          // Bottom row
          if (col === 0) {
            tileTexture = "winter_ground_lower_left";
          } else if (col === tilesWide - 1) {
            tileTexture = "winter_ground_lower_right";
          } else {
            tileTexture = "winter_ground_lower_middle";
          }
        } else {
          // Middle rows
          tileTexture = "winter_ground_inner";
        }

        const tile = this.platforms.create(tileX, tileY, tileTexture);
        tile.setOrigin(0, 0);
        tile.refreshBody();
        platformGroup.add(tile);
      }
    }
  }

  private generateGroundPlatforms(
    chunkX: number,
    chunkPlatforms: Phaser.Physics.Arcade.StaticGroup
  ) {
    const groundY = 700;
    const platformWidth = 192; // 6 tiles * 32px
    const platformHeight = 64; // 2 tiles high
    const numGroundPlatforms = Math.floor(this.chunkSize / platformWidth) + 1;

    for (let i = 0; i < numGroundPlatforms; i++) {
      const x = chunkX + i * platformWidth;
      this.createWinterTiledPlatform(
        x,
        groundY,
        platformWidth,
        platformHeight,
        chunkPlatforms
      );
    }
  }

  private generateFloatingPlatforms(
    chunkX: number,
    chunkPlatforms: Phaser.Physics.Arcade.StaticGroup
  ) {
    const numPlatforms = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numPlatforms; i++) {
      const platformWidth = 96 + Math.random() * 96; // 96-192px wide
      const platformHeight = 32; // Single row for floating platforms
      const x =
        chunkX + 100 + Math.random() * (this.chunkSize - platformWidth - 100);
      const y = 300 + Math.random() * 250;

      // Avoid overlapping platforms
      const minDistance = 150;
      let validPosition = true;

      chunkPlatforms.children.entries.forEach((existingPlatform: any) => {
        if (
          Math.abs(existingPlatform.x - x) < minDistance &&
          Math.abs(existingPlatform.y - y) < 100
        ) {
          validPosition = false;
        }
      });

      if (validPosition) {
        this.createWinterTiledPlatform(
          x,
          y,
          platformWidth,
          platformHeight,
          chunkPlatforms
        );
      }
    }
  }

  private generateBackgroundElements(_chunkX: number, chunkIndex: number) {
    // Simplified background - no perspective tree layers
    // The main background image provides sufficient visual depth
    const backgroundGroup = this.scene.add.group();
    this.backgroundElements.set(chunkIndex, backgroundGroup);
  }

  private generateChunkEnemies(chunkX: number, chunkIndex: number) {
    // Don't generate regular enemies in boss levels
    if (this.isBossLevel) return;

    // Scale number of enemies with level (1-2 at level 1, up to 4-6 at higher levels)
    const baseEnemies = 1 + Math.floor(Math.random() * 2);
    const levelBonus = Math.floor((this.currentLevel - 1) / 2); // +1 enemy every 2 levels
    const numEnemies = Math.min(baseEnemies + levelBonus, 6); // Cap at 6 enemies per chunk

    console.log(
      `👹 Generating ${numEnemies} enemies for level ${this.currentLevel}, chunk ${chunkIndex}`
    );

    for (let i = 0; i < numEnemies; i++) {
      const x = chunkX + 150 + Math.random() * (this.chunkSize - 300);
      const y = 650;

      // Higher levels have more boss enemies
      const bossChance = Math.min(0.1 + (this.currentLevel - 1) * 0.05, 0.4); // 10% base, +5% per level, cap at 40%
      const enemyTypes =
        Math.random() < bossChance ? ["pink_boss"] : ["owlet", "owlet"];
      const enemyType =
        enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

      this.enemySystem.createEnemy(x, y, enemyType, chunkIndex);
    }
  }

  private createBossArena() {
    console.log(`🏛️ Creating Boss Arena for Level ${this.currentLevel}`);

    const centerX = this.scene.scale.width / 2;
    const screenHeight = this.scene.scale.height;

    // Create arena ground
    this.createWinterTiledPlatform(
      centerX - 400,
      screenHeight - 100,
      800, // Wide platform
      100, // Thick ground
      this.platforms
    );

    // Create climbing platforms on the left side
    this.createWinterTiledPlatform(
      centerX - 350,
      screenHeight - 200,
      150,
      32,
      this.platforms
    );
    this.createWinterTiledPlatform(
      centerX - 300,
      screenHeight - 300,
      150,
      32,
      this.platforms
    );
    this.createWinterTiledPlatform(
      centerX - 250,
      screenHeight - 400,
      150,
      32,
      this.platforms
    );

    // Create climbing platforms on the right side
    this.createWinterTiledPlatform(
      centerX + 200,
      screenHeight - 200,
      150,
      32,
      this.platforms
    );
    this.createWinterTiledPlatform(
      centerX + 150,
      screenHeight - 300,
      150,
      32,
      this.platforms
    );
    this.createWinterTiledPlatform(
      centerX + 100,
      screenHeight - 400,
      150,
      32,
      this.platforms
    );

    // Create moving platforms for vertical navigation
    this.createMovingPlatform(
      centerX - 100,
      screenHeight - 250,
      screenHeight - 450,
      screenHeight - 150
    );
    this.createMovingPlatform(
      centerX + 50,
      screenHeight - 350,
      screenHeight - 500,
      screenHeight - 200
    );

    // Create the tree boss in the center
    const bossY = screenHeight - 150; // Position boss on the ground
    this.enemySystem.createTreeBoss(centerX, bossY);

    // Create exit platform on the far right
    this.createWinterTiledPlatform(
      centerX + 350,
      screenHeight - 200,
      200,
      32,
      this.platforms
    );
  }

  private createMovingPlatform(
    x: number,
    startY: number,
    minY: number,
    maxY: number
  ) {
    // Create a moving platform
    const platform = this.scene.physics.add.sprite(
      x,
      startY,
      "winter_ground_upper_middle"
    );
    platform.setImmovable(true);
    platform.body.setSize(platform.width, 16); // Thin collision box
    platform.setDepth(10);

    // Disable gravity for moving platforms to prevent conflicts with tween
    platform.body.setGravityY(0);
    platform.body.setVelocity(0, 0);

    // Add to moving platforms group
    this.movingPlatforms.add(platform);

    // Create tween for up/down movement with physics body sync
    this.scene.tweens.add({
      targets: platform,
      y: { from: maxY, to: minY },
      duration: 3000,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        // Sync physics body position with tween position to prevent flickering
        if (platform.body) {
          platform.body.updateFromGameObject();
        }
      },
    });

    console.log(
      `🔧 Created moving platform at (${x}, ${startY}) moving between ${minY} and ${maxY}`
    );
  }

  private createSnowEffect() {
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, this.scene.scale.width);
      const y = Phaser.Math.Between(-100, this.scene.scale.height);
      const snowflake = this.scene.add.circle(x, y, 1, 0xffffff, 0.8);

      this.scene.tweens.add({
        targets: snowflake,
        y: snowflake.y + this.scene.scale.height + 100,
        x: snowflake.x + Phaser.Math.Between(-50, 50),
        duration: Phaser.Math.Between(3000, 8000),
        repeat: -1,
        onComplete: () => {
          snowflake.y = -10;
          snowflake.x = Phaser.Math.Between(0, this.scene.scale.width);
        },
      });
    }
  }

  updateWorldStreaming(playerX: number) {
    const currentChunk = Math.floor(playerX / this.chunkSize);
    const loadDistance = 3;

    // Generate chunks around player
    for (
      let i = currentChunk - loadDistance;
      i <= currentChunk + loadDistance;
      i++
    ) {
      if (!this.chunksGenerated.has(i)) {
        this.generateChunk(i);
      }
      this.visibleChunks.add(i);
    }

    // Cleanup distant chunks
    const unloadDistance = 5;
    const chunksToRemove: number[] = [];

    this.chunksGenerated.forEach((chunkIndex) => {
      if (Math.abs(chunkIndex - currentChunk) > unloadDistance) {
        chunksToRemove.push(chunkIndex);
      }
    });

    chunksToRemove.forEach((chunkIndex) => {
      this.unloadChunk(chunkIndex);
    });
  }

  private unloadChunk(chunkIndex: number) {
    // Remove platforms
    const chunkPlatforms = this.platformChunks.get(chunkIndex);
    if (chunkPlatforms) {
      chunkPlatforms.destroy(true);
      this.platformChunks.delete(chunkIndex);
    }

    // Remove background elements
    const backgroundElements = this.backgroundElements.get(chunkIndex);
    if (backgroundElements) {
      backgroundElements.destroy(true);
      this.backgroundElements.delete(chunkIndex);
    }

    // Remove enemies
    this.enemySystem.removeEnemiesInChunk(chunkIndex);

    this.chunksGenerated.delete(chunkIndex);
    this.visibleChunks.delete(chunkIndex);

    // Chunk unloaded
  }

  getPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    return this.platforms;
  }

  getMovingPlatforms(): Phaser.Physics.Arcade.Group {
    return this.movingPlatforms;
  }

  reset() {
    this.chunksGenerated.clear();
    this.visibleChunks.clear();
    this.platformChunks.clear();
    this.backgroundElements.clear();

    // Clear moving platforms if they exist
    if (this.movingPlatforms) {
      this.movingPlatforms.clear(true, true);
    }
  }
}
