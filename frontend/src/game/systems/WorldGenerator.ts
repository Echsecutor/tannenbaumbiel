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

  // Moving platform state tracking
  private platformMovementData: Map<
    string,
    {
      minY: number;
      maxY: number;
      speed: number;
      direction: number; // 1 for up, -1 for down
    }
  > = new Map();

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
    this.isBossLevel = this.currentLevel % 3 === 0;
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
    this.generateMovingPlatformsForChunk(chunkX, chunkIndex);
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
    // Generate more platforms with multiple tiers for better accessibility
    this.generateLowTierPlatforms(chunkX, chunkPlatforms);
    this.generateMidTierPlatforms(chunkX, chunkPlatforms);
    this.generateHighTierPlatforms(chunkX, chunkPlatforms);
  }

  private generateLowTierPlatforms(
    chunkX: number,
    chunkPlatforms: Phaser.Physics.Arcade.StaticGroup
  ) {
    // Low tier platforms - easily reachable from ground (jump height ~150px)
    const numLowPlatforms = 2 + Math.floor(Math.random() * 2); // 2-3 platforms
    const groundY = 700;
    const maxJumpHeight = 150; // Estimated player jump capability
    const lowTierMinY = groundY - maxJumpHeight + 20; // y=570
    const lowTierMaxY = groundY - 80; // y=620

    for (let i = 0; i < numLowPlatforms; i++) {
      const platformWidth = 96 + Math.random() * 64; // 96-160px wide
      const platformHeight = 32;
      const x =
        chunkX +
        150 +
        i * (this.chunkSize / numLowPlatforms) +
        Math.random() * 100;
      const y = lowTierMinY + Math.random() * (lowTierMaxY - lowTierMinY);

      if (this.isValidPlatformPosition(x, y, platformWidth, chunkPlatforms)) {
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

  private generateMidTierPlatforms(
    chunkX: number,
    chunkPlatforms: Phaser.Physics.Arcade.StaticGroup
  ) {
    // Mid tier platforms - reachable from low tier platforms
    const numMidPlatforms = 2 + Math.floor(Math.random() * 2); // 2-3 platforms
    const midTierMinY = 450; // Reachable from low platforms
    const midTierMaxY = 520;

    for (let i = 0; i < numMidPlatforms; i++) {
      const platformWidth = 80 + Math.random() * 80; // 80-160px wide
      const platformHeight = 32;
      const x =
        chunkX +
        200 +
        i * (this.chunkSize / numMidPlatforms) +
        Math.random() * 150;
      const y = midTierMinY + Math.random() * (midTierMaxY - midTierMinY);

      if (this.isValidPlatformPosition(x, y, platformWidth, chunkPlatforms)) {
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

  private generateHighTierPlatforms(
    chunkX: number,
    chunkPlatforms: Phaser.Physics.Arcade.StaticGroup
  ) {
    // High tier platforms - reachable from mid tier platforms
    const numHighPlatforms = 1 + Math.floor(Math.random() * 2); // 1-2 platforms
    const highTierMinY = 320;
    const highTierMaxY = 400;

    for (let i = 0; i < numHighPlatforms; i++) {
      const platformWidth = 64 + Math.random() * 96; // 64-160px wide
      const platformHeight = 32;
      const x =
        chunkX +
        300 +
        i * (this.chunkSize / (numHighPlatforms + 1)) +
        Math.random() * 200;
      const y = highTierMinY + Math.random() * (highTierMaxY - highTierMinY);

      if (this.isValidPlatformPosition(x, y, platformWidth, chunkPlatforms)) {
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

  private isValidPlatformPosition(
    x: number,
    y: number,
    _width: number,
    chunkPlatforms: Phaser.Physics.Arcade.StaticGroup
  ): boolean {
    const minHorizontalDistance = 120;
    const minVerticalDistance = 80;

    // Check against existing platforms in this chunk
    return !chunkPlatforms.children.entries.some((existingPlatform: any) => {
      const horizontalDistance = Math.abs(existingPlatform.x - x);
      const verticalDistance = Math.abs(existingPlatform.y - y);

      return (
        horizontalDistance < minHorizontalDistance &&
        verticalDistance < minVerticalDistance
      );
    });
  }

  private generateMovingPlatformsForChunk(chunkX: number, chunkIndex: number) {
    // Don't generate moving platforms in boss levels (they have their own)
    if (this.isBossLevel) return;

    // Generate 1-2 moving platforms per chunk occasionally
    const shouldGenerateMovingPlatform = Math.random() < 0.4; // 40% chance
    if (!shouldGenerateMovingPlatform) return;

    const numMovingPlatforms = Math.random() < 0.7 ? 1 : 2; // 70% chance for 1, 30% for 2

    for (let i = 0; i < numMovingPlatforms; i++) {
      // Position moving platforms in different areas of the chunk
      const xOffset = (this.chunkSize / (numMovingPlatforms + 1)) * (i + 1);
      const x = chunkX + xOffset + Math.random() * 100 - 50; // Add some randomness

      // Choose movement range for the platform
      const movementRanges = [
        { start: 600, min: 550, max: 650 }, // Low movement range
        { start: 500, min: 450, max: 550 }, // Mid movement range
        { start: 400, min: 350, max: 450 }, // High movement range
      ];

      const range =
        movementRanges[Math.floor(Math.random() * movementRanges.length)];

      // Check if there's space for this moving platform
      const hasSpace = this.isMovingPlatformSpaceFree(
        x,
        range.start,
        range.min,
        range.max
      );

      if (hasSpace) {
        this.createMovingPlatform(x, range.start, range.min, range.max);
        console.log(
          `🔧 Generated moving platform in chunk ${chunkIndex} at x=${x}`
        );
      }
    }
  }

  private isMovingPlatformSpaceFree(
    x: number,
    _startY: number,
    _minY: number,
    _maxY: number
  ): boolean {
    // Check if any existing moving platforms would conflict
    return !this.movingPlatforms.children.entries.some((platform: any) => {
      const platformX = platform.x;
      const horizontalDistance = Math.abs(platformX - x);

      // Platforms should be at least 200px apart horizontally
      return horizontalDistance < 200;
    });
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
        Math.random() < bossChance ? ["adventurer"] : ["slime", "slime"];
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

    // Create fewer climbing platforms on the left side - removed middle platform
    this.createWinterTiledPlatform(
      centerX - 350,
      screenHeight - 200,
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

    // Create fewer climbing platforms on the right side - removed middle platform
    this.createWinterTiledPlatform(
      centerX + 200,
      screenHeight - 200,
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

    // Create only one moving platform for vertical navigation - removed one to reduce blocking
    this.createMovingPlatform(
      centerX - 100,
      screenHeight - 250,
      screenHeight - 450,
      screenHeight - 150
    );

    // Create the tree boss in the center
    const bossY = screenHeight - 100; // Position boss on top of the ground platform
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
    // Create a moving platform as a kinematic body (moves but not affected by forces)
    const platform = this.scene.physics.add.sprite(
      x,
      startY,
      "winter_ground_upper_middle"
    );

    // Add to moving platforms group FIRST
    this.movingPlatforms.add(platform);

    // Configure as kinematic body - this is key for moving platforms
    platform.body.setImmovable(true); // Won't be pushed by collisions
    platform.body.moves = true; // But can move under script control
    platform.body.setSize(platform.width, 16); // Thin collision box

    // Completely disable gravity - kinematic bodies shouldn't be affected by world forces
    platform.body.allowGravity = false;
    platform.body.setGravityY(0);

    platform.setDepth(10);

    // Set initial velocity
    const speed = 50; // pixels per second
    platform.body.setVelocityY(-speed); // Start moving up

    // Store movement data for this platform
    const platformId = `platform_${x}_${startY}`;
    this.platformMovementData.set(platformId, {
      minY: minY,
      maxY: maxY,
      speed: speed,
      direction: -1, // Start moving up
    });

    // Store the ID on the platform for later reference
    platform.setData("movementId", platformId);

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

  updateMovingPlatforms() {
    // Update all moving platforms
    if (this.movingPlatforms.children.entries.length === 0) {
      return; // No debug spam when no platforms
    }

    this.movingPlatforms.children.entries.forEach((platform: any) => {
      if (!platform.active) return;

      const movementId = platform.getData("movementId");
      const movementData = this.platformMovementData.get(movementId);

      if (!movementData) {
        console.log(`⚠️ No movement data found for platform ${movementId}`);
        return;
      }

      // Check if platform has reached bounds and reverse direction
      if (platform.y <= movementData.minY && movementData.direction === -1) {
        // Hit top bound, start moving down
        movementData.direction = 1;
        platform.body.setVelocityY(movementData.speed);
        console.log(
          `🔄 Platform reversed to DOWN at y=${platform.y}, minY=${movementData.minY}`
        );
      } else if (
        platform.y >= movementData.maxY &&
        movementData.direction === 1
      ) {
        // Hit bottom bound, start moving up
        movementData.direction = -1;
        platform.body.setVelocityY(-movementData.speed);
        console.log(
          `🔄 Platform reversed to UP at y=${platform.y}, maxY=${movementData.maxY}`
        );
      }
    });
  }

  reset() {
    this.chunksGenerated.clear();
    this.visibleChunks.clear();
    this.platformChunks.clear();
    this.backgroundElements.clear();
    this.platformMovementData.clear();

    // Clear moving platforms if they exist
    if (this.movingPlatforms) {
      this.movingPlatforms.clear(true, true);
    }
  }
}
