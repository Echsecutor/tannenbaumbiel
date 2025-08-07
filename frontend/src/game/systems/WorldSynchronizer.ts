/**
 * WorldSynchronizer - Generates world based on server-provided world state
 * Ensures all clients see the same world layout
 */
import Phaser from "phaser";
import { EnemySystem } from "./EnemySystem";

export interface ServerWorldState {
  world_seed: number;
  world_width: number;
  world_height: number;
  ground_y: number;
  left_boundary: number;
  platforms: Array<{
    platform_id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    platform_type: string;
    moving_data?: {
      min_y: number;
      max_y: number;
      speed: number;
      direction: number;
    };
  }>;
}

export class WorldSynchronizer {
  private scene: Phaser.Scene;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private movingPlatforms!: Phaser.Physics.Arcade.Group;
  private serverWorldState: ServerWorldState | null = null;
  private worldGenerated: boolean = false;

  // World configuration
  private readonly TILE_SIZE = 32;

  constructor(scene: Phaser.Scene, _enemySystem: EnemySystem) {
    this.scene = scene;
  }

  setServerWorldState(worldState: ServerWorldState) {
    this.serverWorldState = worldState;
    console.log("🌍 WorldSynchronizer: Received server world state", {
      seed: worldState.world_seed,
      platforms: worldState.platforms.length,
      worldWidth: worldState.world_width,
    });
  }

  createWorld(): Phaser.Physics.Arcade.StaticGroup {
    if (!this.serverWorldState) {
      console.error("❌ Cannot create world: No server world state received");
      // Fallback to basic ground platform
      this.platforms = this.scene.physics.add.staticGroup();
      this.createBasicGround();
      return this.platforms;
    }

    console.log("🌍 WorldSynchronizer: Creating synchronized world");

    // Create scrolling background
    this.createScrollingBackground();

    // Initialize platform groups
    this.platforms = this.scene.physics.add.staticGroup();
    this.movingPlatforms = this.scene.physics.add.group();

    // Set world bounds based on server state
    this.scene.physics.world.setBounds(
      this.serverWorldState.left_boundary,
      0,
      this.serverWorldState.world_width - this.serverWorldState.left_boundary,
      this.scene.scale.height
    );

    // Generate platforms from server state
    this.generatePlatformsFromServerState();

    // Add snow effect
    this.createSnowEffect();

    this.worldGenerated = true;
    console.log("🌍 WorldSynchronizer: World creation complete");

    return this.platforms;
  }

  private createBasicGround() {
    // Fallback ground platform when no server state
    const groundY = 700;
    const platformWidth = 192;
    const numPlatforms = 10;

    for (let i = 0; i < numPlatforms; i++) {
      const x = i * platformWidth;
      this.createTiledPlatform(x, groundY, platformWidth, 64);
    }
  }

  private createScrollingBackground() {
    if (!this.serverWorldState) return;

    const bgImage = this.scene.textures.get("winter_bg");
    const bgWidth = bgImage.source[0].width;
    const bgHeight = bgImage.source[0].height;
    const screenHeight = this.scene.scale.height;
    const scale = screenHeight / bgHeight;
    const scaledWidth = bgWidth * scale;
    const numTiles =
      Math.ceil(
        (this.serverWorldState.world_width -
          this.serverWorldState.left_boundary) /
          scaledWidth
      ) + 2;

    for (let i = 0; i < numTiles; i++) {
      const x = this.serverWorldState.left_boundary + i * scaledWidth;
      const bg = this.scene.add.image(x, 0, "winter_bg");
      bg.setOrigin(0, 0);
      bg.setScale(scale);
      bg.setScrollFactor(0.1);
    }
  }

  private generatePlatformsFromServerState() {
    if (!this.serverWorldState) return;

    for (const platformData of this.serverWorldState.platforms) {
      if (platformData.platform_type === "moving") {
        this.createMovingPlatformFromServerData(platformData);
      } else {
        this.createTiledPlatform(
          platformData.x,
          platformData.y,
          platformData.width,
          platformData.height
        );
      }
    }

    console.log(
      `🌍 Created ${this.serverWorldState.platforms.length} platforms from server state`
    );
  }

  private createMovingPlatformFromServerData(platformData: any) {
    const centerX = platformData.x + platformData.width / 2;
    const centerY = platformData.y + platformData.height / 2;
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
    const tilesWide = Math.ceil(platformData.width / this.TILE_SIZE);
    const tilesHigh = Math.ceil(platformData.height / this.TILE_SIZE);

    for (let row = 0; row < tilesHigh; row++) {
      for (let col = 0; col < tilesWide; col++) {
        const tileX = platformData.x + col * this.TILE_SIZE;
        const tileY = platformData.y + row * this.TILE_SIZE;
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
    platform.body!.setSize(platformData.width, 16);
    platform.body!.allowGravity = false;
    platform.setDepth(10);

    // Store movement data and tile group on the platform
    if (platformData.moving_data) {
      platform.setData("minY", platformData.moving_data.min_y);
      platform.setData("maxY", platformData.moving_data.max_y);
      platform.setData("speed", platformData.moving_data.speed);
      platform.setData("direction", platformData.moving_data.direction);
    }
    platform.setData("tileGroup", tileGroup);
    platform.setData("tilePositions", tilePositions);
    platform.body!.setVelocityY(-50);
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

  isWorldGenerated(): boolean {
    return this.worldGenerated;
  }

  getServerWorldState(): ServerWorldState | null {
    return this.serverWorldState;
  }

  reset() {
    if (this.movingPlatforms) {
      this.movingPlatforms.clear(true, true);
    }
    this.worldGenerated = false;
    this.serverWorldState = null;
  }
}
