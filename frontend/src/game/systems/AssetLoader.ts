/**
 * AssetLoader - Handles loading and management of game assets
 */
import Phaser from "phaser";

export class AssetLoader {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  loadAllAssets() {
    this.loadPlayerSprites();
    this.loadEnemySprites();
    this.loadWinterAssets();
    this.loadAudioAssets();
    this.loadFireballSprites();
  }

  private loadPlayerSprites() {
    // Load Dude Monster sprites for player
    this.scene.load.spritesheet(
      "player_idle",
      "/assets/sprites/dude_monster/Dude_Monster_Idle_4.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    this.scene.load.spritesheet(
      "player_run",
      "/assets/sprites/dude_monster/Dude_Monster_Run_6.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    this.scene.load.spritesheet(
      "player_jump",
      "/assets/sprites/dude_monster/Dude_Monster_Jump_8.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );
  }

  private loadEnemySprites() {
    // Load Owlet Monster sprites for enemies
    this.scene.load.spritesheet(
      "enemy_idle",
      "/assets/sprites/owlet_monster/Owlet_Monster_Idle_4.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    this.scene.load.spritesheet(
      "enemy_walk",
      "/assets/sprites/owlet_monster/Owlet_Monster_Walk_6.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    // Load Pink Monster sprites for special enemies
    this.scene.load.spritesheet(
      "pink_enemy_idle",
      "/assets/sprites/pink_monster/Pink_Monster_Idle_4.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );
  }

  private loadWinterAssets() {
    // Load winter-themed assets
    this.scene.load.image("winter_bg", "/assets/winter/winter_bg.png");

    // Load all winter ground tile variants for intelligent tiling
    this.scene.load.image(
      "winter_ground_upper_left",
      "/assets/winter/winter_ground_upper_left.png"
    );
    this.scene.load.image(
      "winter_ground_upper_middle",
      "/assets/winter/winter_ground_upper_middle.png"
    );
    this.scene.load.image(
      "winter_ground_upper_right",
      "/assets/winter/winter_ground_upper_right.png"
    );
    this.scene.load.image(
      "winter_ground_inner",
      "/assets/winter/winter_ground_inner.png"
    );
    this.scene.load.image(
      "winter_ground_lower_left",
      "/assets/winter/winter_ground_lower_left.png"
    );
    this.scene.load.image(
      "winter_ground_lower_middle",
      "/assets/winter/winter_ground_lower_middle.png"
    );
    this.scene.load.image(
      "winter_ground_lower_right",
      "/assets/winter/winter_ground_lower_right.png"
    );

    // Boss assets for tree boss and stone projectiles
    this.scene.load.image("winter_tree", "/assets/winter/winter_tree.png");
    this.scene.load.image("tree", "/assets/winter/tree.png");
    this.scene.load.image("stone", "/assets/winter/stone.png");
  }

  private loadAudioAssets() {
    // Load background music
    this.scene.load.audio(
      "background_music",
      "/assets/sounds/chicken-run-music/Run Game 2.mp3"
    );

    // Load victory music
    this.scene.load.audio(
      "victory_music",
      "/assets/sounds/Viktor Kraus - Victory!.mp3"
    );
  }

  private loadFireballSprites() {
    // Load fireball animation frames
    for (let i = 1; i <= 6; i++) {
      this.scene.load.image(
        `fireball_${i}`,
        `/assets/sprites/fireball/${i}.png`
      );
    }
  }

  createFireballAnimations() {
    // Create fireball animation facing left (original direction of sprites)
    if (!this.scene.anims.exists("fireball_left")) {
      this.scene.anims.create({
        key: "fireball_left",
        frames: [
          { key: "fireball_1" },
          { key: "fireball_2" },
          { key: "fireball_3" },
          { key: "fireball_4" },
          { key: "fireball_5" },
          { key: "fireball_6" },
        ],
        frameRate: 12,
        repeat: -1,
      });
    }

    // Create fireball animation facing right (flipped)
    if (!this.scene.anims.exists("fireball_right")) {
      this.scene.anims.create({
        key: "fireball_right",
        frames: [
          { key: "fireball_1" },
          { key: "fireball_2" },
          { key: "fireball_3" },
          { key: "fireball_4" },
          { key: "fireball_5" },
          { key: "fireball_6" },
        ],
        frameRate: 12,
        repeat: -1,
      });
    }
  }
}
