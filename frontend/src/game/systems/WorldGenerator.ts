/**
 * WorldGenerator - Simplified platform generation for the winter-themed game
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
  private readonly TILE_SIZE = 32;
  private readonly GROUND_Y = 700;
  private readonly WORLD_WIDTH = 12000;
  private readonly LEFT_BOUNDARY = -2000;

  constructor(scene: Phaser.Scene, enemySystem: EnemySystem) {
    this.scene = scene;
    this.enemySystem = enemySystem;
  }

  setLevel(level: number) {
    this.currentLevel = level;
    this.isBossLevel = this.currentLevel % 3 === 0;
    console.log(
      `🌍 WorldGenerator: Level ${this.currentLevel}${this.isBossLevel ? " (BOSS)" : ""}`
    );
  }

  getRightBoundary(): number {
    return this.WORLD_WIDTH;
  }

  createWorld(): Phaser.Physics.Arcade.StaticGroup {
    // Create scrolling background
    this.createScrollingBackground();

    // Initialize platform groups
    this.platforms = this.scene.physics.add.staticGroup();
    this.movingPlatforms = this.scene.physics.add.group();

    // Set world bounds
    this.scene.physics.world.setBounds(
      this.LEFT_BOUNDARY,
      0,
      this.WORLD_WIDTH - this.LEFT_BOUNDARY,
      this.scene.scale.height
    );

    if (this.isBossLevel) {
      this.createBossArena();
    } else {
      this.generateNormalLevel();
    }

    // Add snow effect
    this.createSnowEffect();

    return this.platforms;
  }

  private createScrollingBackground() {
    const bgImage = this.scene.textures.get("winter_bg");
    const bgWidth = bgImage.source[0].width;
    const bgHeight = bgImage.source[0].height;
    const screenHeight = this.scene.scale.height;
    const scale = screenHeight / bgHeight;
    const scaledWidth = bgWidth * scale;
    const numTiles =
      Math.ceil((this.WORLD_WIDTH - this.LEFT_BOUNDARY) / scaledWidth) + 2;

    for (let i = 0; i < numTiles; i++) {
      const x = this.LEFT_BOUNDARY + i * scaledWidth;
      const bg = this.scene.add.image(x, 0, "winter_bg");
      bg.setOrigin(0, 0);
      bg.setScale(scale);
      bg.setScrollFactor(0.1);
    }
  }

  private generateNormalLevel() {
    // Generate ground platforms
    this.generateGroundPlatforms();

    // Generate floating platforms
    this.generateFloatingPlatforms();

    // Generate moving platforms
    this.generateMovingPlatforms();

    // Generate enemies
    this.generateEnemies();
  }

  private generateGroundPlatforms() {
    const platformWidth = 192; // 6 tiles
    const platformHeight = 64; // 2 tiles
    const totalWorldWidth = this.WORLD_WIDTH - this.LEFT_BOUNDARY;
    const numPlatforms = Math.ceil(totalWorldWidth / platformWidth) + 2;

    for (let i = 0; i < numPlatforms; i++) {
      const x = this.LEFT_BOUNDARY + i * platformWidth;
      this.createTiledPlatform(x, this.GROUND_Y, platformWidth, platformHeight);
    }
  }

  private generateFloatingPlatforms() {
    // Generate more platforms with focus on low, accessible platforms
    const basePlatformCount = 25 + this.currentLevel * 3; // Increased base count
    const lowPlatformCount = Math.floor(basePlatformCount * 0.6); // 60% low platforms
    const midPlatformCount = Math.floor(basePlatformCount * 0.3); // 30% mid platforms
    const highPlatformCount = Math.floor(basePlatformCount * 0.1); // 10% high platforms

    // Generate low platforms (easily reachable by jumping)
    for (let i = 0; i < lowPlatformCount; i++) {
      const x =
        this.LEFT_BOUNDARY + 150 + Math.random() * (this.WORLD_WIDTH - 300);
      const y = this.GROUND_Y - 200 + Math.random() * 150; // 500-650px (reachable by jump)
      const width = 80 + Math.random() * 160; // 80-240px wide

      if (this.isValidPlatformPosition(x, y, width)) {
        this.createTiledPlatform(x, y, width, 32);
      }
    }

    // Generate mid platforms (reachable from low platforms)
    for (let i = 0; i < midPlatformCount; i++) {
      const x =
        this.LEFT_BOUNDARY + 200 + Math.random() * (this.WORLD_WIDTH - 400);
      const y = 350 + Math.random() * 150; // 350-500px
      const width = 64 + Math.random() * 128; // 64-192px wide

      if (this.isValidPlatformPosition(x, y, width)) {
        this.createTiledPlatform(x, y, width, 32);
      }
    }

    // Generate high platforms (challenging to reach)
    for (let i = 0; i < highPlatformCount; i++) {
      const x =
        this.LEFT_BOUNDARY + 250 + Math.random() * (this.WORLD_WIDTH - 500);
      const y = 200 + Math.random() * 150; // 200-350px
      const width = 64 + Math.random() * 96; // 64-160px wide

      if (this.isValidPlatformPosition(x, y, width)) {
        this.createTiledPlatform(x, y, width, 32);
      }
    }
  }

  private generateMovingPlatforms() {
    const movingPlatformCount = Math.min(5 + this.currentLevel * 2, 12); // Increased count

    for (let i = 0; i < movingPlatformCount; i++) {
      const x =
        this.LEFT_BOUNDARY + 200 + Math.random() * (this.WORLD_WIDTH - 400);

      // Create moving platforms at different heights for better accessibility
      let startY, minY, maxY;

      if (i < movingPlatformCount * 0.6) {
        // Low moving platforms (easily reachable)
        startY = this.GROUND_Y - 150 + Math.random() * 100; // 550-650px
        minY = startY - 80;
        maxY = startY + 80;
      } else if (i < movingPlatformCount * 0.9) {
        // Mid moving platforms
        startY = 400 + Math.random() * 150; // 400-550px
        minY = startY - 100;
        maxY = startY + 100;
      } else {
        // High moving platforms
        startY = 300 + Math.random() * 100; // 300-400px
        minY = startY - 120;
        maxY = startY + 120;
      }

      this.createMovingPlatform(x, startY, minY, maxY);
    }
  }

  private generateEnemies() {
    const enemyCount = 5 + this.currentLevel * 2;

    for (let i = 0; i < enemyCount; i++) {
      const x =
        this.LEFT_BOUNDARY + 200 + Math.random() * (this.WORLD_WIDTH - 400);
      const y = this.GROUND_Y - 50;

      const bossChance = Math.min(0.1 + (this.currentLevel - 1) * 0.05, 0.4);
      const enemyType = Math.random() < bossChance ? "adventurer" : "slime";

      this.enemySystem.createEnemy(x, y, enemyType, 0);
    }
  }

  private createTiledPlatform(
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const tilesWide = Math.ceil(width / this.TILE_SIZE);
    const tilesHigh = Math.ceil(height / this.TILE_SIZE);

    for (let row = 0; row < tilesHigh; row++) {
      for (let col = 0; col < tilesWide; col++) {
        const tileX = x + col * this.TILE_SIZE;
        const tileY = y + row * this.TILE_SIZE;
        const tileTexture = this.getTileTexture(row, col, tilesWide, tilesHigh);

        const tile = this.platforms.create(tileX, tileY, tileTexture);
        tile.setOrigin(0, 0);
        tile.refreshBody();
      }
    }
  }

  private getTileTexture(
    row: number,
    col: number,
    tilesWide: number,
    tilesHigh: number
  ): string {
    if (row === 0) {
      // Top row
      if (col === 0) return "winter_ground_upper_left";
      if (col === tilesWide - 1) return "winter_ground_upper_right";
      return "winter_ground_upper_middle";
    } else if (row === tilesHigh - 1) {
      // Bottom row
      if (col === 0) return "winter_ground_lower_left";
      if (col === tilesWide - 1) return "winter_ground_lower_right";
      return "winter_ground_lower_middle";
    } else {
      // Middle rows
      return "winter_ground_inner";
    }
  }

  private isValidPlatformPosition(
    x: number,
    y: number,
    _width: number
  ): boolean {
    const minDistance = 120;

    return !this.platforms.children.entries.some((platform: any) => {
      const horizontalDistance = Math.abs(platform.x - x);
      const verticalDistance = Math.abs(platform.y - y);
      return horizontalDistance < minDistance && verticalDistance < 80;
    });
  }

  private createMovingPlatform(
    x: number,
    startY: number,
    minY: number,
    maxY: number
  ) {
    // Create a tiled platform with random width
    const width = 96 + Math.random() * 128; // 96-224px wide
    const height = 32;

    // Create individual tiles for the moving platform
    const tilesWide = Math.ceil(width / this.TILE_SIZE);
    const tilesHigh = Math.ceil(height / this.TILE_SIZE);

    // Create the main platform sprite at the center of the platform
    const centerX = x + width / 2;
    const centerY = startY + height / 2;
    const platform = this.scene.physics.add.sprite(
      centerX,
      centerY,
      "winter_ground_upper_middle"
    );

    // Create a group for all tiles and store their relative positions
    const tileGroup = this.scene.add.group();
    const tilePositions: { tile: any; relativeX: number; relativeY: number }[] =
      [];

    // Add all tiles to the group and store their relative positions
    for (let row = 0; row < tilesHigh; row++) {
      for (let col = 0; col < tilesWide; col++) {
        const tileX = x + col * this.TILE_SIZE;
        const tileY = startY + row * this.TILE_SIZE;
        const tileTexture = this.getTileTexture(row, col, tilesWide, tilesHigh);

        const tile = this.scene.add.image(tileX, tileY, tileTexture);
        tile.setOrigin(0, 0);
        tileGroup.add(tile);

        // Store relative position from platform center
        tilePositions.push({
          tile: tile,
          relativeX: tileX - centerX,
          relativeY: tileY - centerY,
        });
      }
    }

    this.movingPlatforms.add(platform);

    // Configure as moving platform
    platform.body!.setImmovable(true);
    platform.body!.setSize(width, 16);
    platform.body!.allowGravity = false;
    platform.setDepth(10);

    // Store movement data and tile group on the platform
    platform.setData("minY", minY);
    platform.setData("maxY", maxY);
    platform.setData("speed", 50);
    platform.setData("direction", -1); // Start moving up
    platform.setData("tileGroup", tileGroup);
    platform.setData("tilePositions", tilePositions);
    platform.body!.setVelocityY(-50);
  }

  private createBossArena() {
    const centerX = this.scene.scale.width / 2;
    const groundY = this.scene.scale.height - 100;

    // Create full ground coverage like normal levels
    this.generateGroundPlatforms();

    // Create elevated platform for the boss
    const bossPlatformWidth = 400;
    const bossPlatformHeight = 64;
    const bossPlatformY = groundY - 100; // Elevated above the ground
    const startX = centerX - bossPlatformWidth / 2;
    this.createTiledPlatform(
      startX,
      bossPlatformY,
      bossPlatformWidth,
      bossPlatformHeight
    );

    // Create boss on the elevated platform
    const boss = this.enemySystem.createTreeBoss(centerX, bossPlatformY);

    // Create platforms around boss
    this.generateBossArenaPlatforms(boss);
  }

  private generateBossArenaPlatforms(boss: Phaser.Physics.Arcade.Sprite) {
    const bossX = boss.x;
    const bossY = boss.y;
    const exclusionRadius = 200;

    // Generate 4-6 platforms outside boss area
    const platformCount = 4 + Math.floor(Math.random() * 3);

    for (let i = 0; i < platformCount; i++) {
      let attempts = 0;
      const maxAttempts = 20;

      while (attempts < maxAttempts) {
        const x = 100 + Math.random() * (this.scene.scale.width - 200);
        const y = 200 + Math.random() * 400;
        const width = 80 + Math.random() * 120;

        // Check distance from boss
        const distanceFromBoss = Math.sqrt((x - bossX) ** 2 + (y - bossY) ** 2);

        if (
          distanceFromBoss > exclusionRadius &&
          this.isValidPlatformPosition(x, y, width)
        ) {
          this.createTiledPlatform(x, y, width, 32);
          break;
        }
        attempts++;
      }
    }
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

  updateMovingPlatforms() {
    this.movingPlatforms.children.entries.forEach((platform: any) => {
      if (!platform.active) return;

      const minY = platform.getData("minY");
      const maxY = platform.getData("maxY");
      const speed = platform.getData("speed");
      const direction = platform.getData("direction");

      if (platform.y <= minY && direction === -1) {
        platform.setData("direction", 1);
        platform.body!.setVelocityY(speed);
      } else if (platform.y >= maxY && direction === 1) {
        platform.setData("direction", -1);
        platform.body!.setVelocityY(-speed);
      }

      // Move the tile group with the platform
      const tilePositions = platform.getData("tilePositions");
      if (tilePositions) {
        tilePositions.forEach((tileData: any) => {
          tileData.tile.x = platform.x + tileData.relativeX;
          tileData.tile.y = platform.y + tileData.relativeY;
        });
      }
    });
  }

  getPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    return this.platforms;
  }

  getMovingPlatforms(): Phaser.Physics.Arcade.Group {
    return this.movingPlatforms;
  }

  reset() {
    if (this.movingPlatforms) {
      this.movingPlatforms.clear(true, true);
    }
  }
}
