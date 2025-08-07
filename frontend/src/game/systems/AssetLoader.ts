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
    this.loadAdventurerSprites();
    this.loadSlimeSprites();
    this.loadWinterAssets();
    this.loadAudioAssets();
    this.loadFireballSprites();
  }

  createAllAnimations() {
    this.createAdventurerAnimations();
    this.createSlimeAnimations();
    this.createFireballAnimations();
  }

  private loadPlayerSprites() {
    // Load all player sprite options

    // Dude Monster sprites
    this.scene.load.spritesheet(
      "dude_monster_idle",
      "/assets/sprites/dude_monster/Dude_Monster_Idle_4.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    this.scene.load.spritesheet(
      "dude_monster_run",
      "/assets/sprites/dude_monster/Dude_Monster_Run_6.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    this.scene.load.spritesheet(
      "dude_monster_jump",
      "/assets/sprites/dude_monster/Dude_Monster_Jump_8.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    // Owlet Monster sprites
    this.scene.load.spritesheet(
      "owlet_monster_idle",
      "/assets/sprites/owlet_monster/Owlet_Monster_Idle_4.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    this.scene.load.spritesheet(
      "owlet_monster_run",
      "/assets/sprites/owlet_monster/Owlet_Monster_Walk_6.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    this.scene.load.spritesheet(
      "owlet_monster_jump",
      "/assets/sprites/owlet_monster/Owlet_Monster_Jump_8.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    // Pink Monster sprites
    this.scene.load.spritesheet(
      "pink_monster_idle",
      "/assets/sprites/pink_monster/Pink_Monster_Idle_4.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    this.scene.load.spritesheet(
      "pink_monster_run",
      "/assets/sprites/pink_monster/Pink_Monster_Walk_6.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    this.scene.load.spritesheet(
      "pink_monster_jump",
      "/assets/sprites/pink_monster/Pink_Monster_Jump_8.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );
  }

  private loadEnemySprites() {
    // Load Owlet Monster sprites for enemies (kept for later use)
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

    // Load Pink Monster sprites for special enemies (kept for later use)
    this.scene.load.spritesheet(
      "pink_enemy_idle",
      "/assets/sprites/pink_monster/Pink_Monster_Idle_4.png",
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );
  }

  private loadAdventurerSprites() {
    // Load ADVENTURER sprites for small boss enemies

    // Load idle frames
    for (let i = 0; i <= 11; i++) {
      this.scene.load.image(
        `adventurer_idle_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/adventurer/FR_Adventurer_Idle_${i.toString().padStart(3, "0")}.png`
      );
    }

    // Load run frames
    for (let i = 0; i <= 9; i++) {
      this.scene.load.image(
        `adventurer_run_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/adventurer/FR_Adventurer_Run_${i.toString().padStart(3, "0")}.png`
      );
    }

    // Load slash frames
    for (let i = 0; i <= 7; i++) {
      this.scene.load.image(
        `adventurer_slash_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/adventurer/FR_Adventurer_Slash_${i.toString().padStart(3, "0")}.png`
      );
    }

    // Load hurt frames
    for (let i = 0; i <= 5; i++) {
      this.scene.load.image(
        `adventurer_hurt_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/adventurer/FR_Adventurer_Hurt_${i.toString().padStart(3, "0")}.png`
      );
    }

    // Load death frames
    for (let i = 0; i <= 8; i++) {
      this.scene.load.image(
        `adventurer_dead_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/adventurer/FR_Adventurer_Dead_${i.toString().padStart(3, "0")}.png`
      );
    }
  }

  private loadSlimeSprites() {
    // Load SLIME sprites for normal enemies

    // Load idle frames
    for (let i = 0; i <= 11; i++) {
      this.scene.load.image(
        `slime_idle_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/slime/FR_Slime4_Idle_${i.toString().padStart(3, "0")}.png`
      );
    }

    // Load move frames
    for (let i = 0; i <= 9; i++) {
      this.scene.load.image(
        `slime_move_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/slime/FR_Slime4_Move_${i.toString().padStart(3, "0")}.png`
      );
    }

    // Load attack frames
    for (let i = 0; i <= 7; i++) {
      this.scene.load.image(
        `slime_attack_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/slime/FR_Slime4_Attack_${i.toString().padStart(3, "0")}.png`
      );
    }

    // Load hurt frames
    for (let i = 0; i <= 5; i++) {
      this.scene.load.image(
        `slime_hurt_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/slime/FR_Slime4_Hurt_${i.toString().padStart(3, "0")}.png`
      );
    }

    // Load death frames
    for (let i = 0; i <= 5; i++) {
      this.scene.load.image(
        `slime_dead_${i.toString().padStart(3, "0")}`,
        `/assets/sprites/slime/FR_Slime4_Dead_${i.toString().padStart(3, "0")}.png`
      );
    }
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

  createAdventurerAnimations() {
    // Create ADVENTURER animations for small boss enemies

    // Idle animation
    if (!this.scene.anims.exists("adventurer_idle")) {
      const idleFrames = [];
      for (let i = 0; i <= 11; i++) {
        idleFrames.push({
          key: `adventurer_idle_${i.toString().padStart(3, "0")}`,
        });
      }
      this.scene.anims.create({
        key: "adventurer_idle",
        frames: idleFrames,
        frameRate: 8,
        repeat: -1,
      });
    }

    // Run animation
    if (!this.scene.anims.exists("adventurer_run")) {
      const runFrames = [];
      for (let i = 0; i <= 9; i++) {
        runFrames.push({
          key: `adventurer_run_${i.toString().padStart(3, "0")}`,
        });
      }
      this.scene.anims.create({
        key: "adventurer_run",
        frames: runFrames,
        frameRate: 12,
        repeat: -1,
      });
    }

    // Slash animation
    if (!this.scene.anims.exists("adventurer_slash")) {
      const slashFrames = [];
      for (let i = 0; i <= 7; i++) {
        slashFrames.push({
          key: `adventurer_slash_${i.toString().padStart(3, "0")}`,
        });
      }
      this.scene.anims.create({
        key: "adventurer_slash",
        frames: slashFrames,
        frameRate: 15,
        repeat: 0, // Play once
      });
    }

    // Hurt animation
    if (!this.scene.anims.exists("adventurer_hurt")) {
      const hurtFrames = [];
      for (let i = 0; i <= 5; i++) {
        hurtFrames.push({
          key: `adventurer_hurt_${i.toString().padStart(3, "0")}`,
        });
      }
      this.scene.anims.create({
        key: "adventurer_hurt",
        frames: hurtFrames,
        frameRate: 10,
        repeat: 0, // Play once
      });
    }

    // Death animation
    if (!this.scene.anims.exists("adventurer_dead")) {
      const deadFrames = [];
      for (let i = 0; i <= 8; i++) {
        deadFrames.push({
          key: `adventurer_dead_${i.toString().padStart(3, "0")}`,
        });
      }
      this.scene.anims.create({
        key: "adventurer_dead",
        frames: deadFrames,
        frameRate: 8,
        repeat: 0, // Play once
      });
    }
  }

  createSlimeAnimations() {
    // Create SLIME animations for normal enemies

    // Idle animation
    if (!this.scene.anims.exists("slime_idle")) {
      const idleFrames = [];
      for (let i = 0; i <= 11; i++) {
        idleFrames.push({ key: `slime_idle_${i.toString().padStart(3, "0")}` });
      }
      this.scene.anims.create({
        key: "slime_idle",
        frames: idleFrames,
        frameRate: 6,
        repeat: -1,
      });
    }

    // Move animation
    if (!this.scene.anims.exists("slime_move")) {
      const moveFrames = [];
      for (let i = 0; i <= 9; i++) {
        moveFrames.push({ key: `slime_move_${i.toString().padStart(3, "0")}` });
      }
      this.scene.anims.create({
        key: "slime_move",
        frames: moveFrames,
        frameRate: 8,
        repeat: -1,
      });
    }

    // Attack animation
    if (!this.scene.anims.exists("slime_attack")) {
      const attackFrames = [];
      for (let i = 0; i <= 7; i++) {
        attackFrames.push({
          key: `slime_attack_${i.toString().padStart(3, "0")}`,
        });
      }
      this.scene.anims.create({
        key: "slime_attack",
        frames: attackFrames,
        frameRate: 12,
        repeat: 0, // Play once
      });
    }

    // Hurt animation
    if (!this.scene.anims.exists("slime_hurt")) {
      const hurtFrames = [];
      for (let i = 0; i <= 5; i++) {
        hurtFrames.push({ key: `slime_hurt_${i.toString().padStart(3, "0")}` });
      }
      this.scene.anims.create({
        key: "slime_hurt",
        frames: hurtFrames,
        frameRate: 10,
        repeat: 0, // Play once
      });
    }

    // Death animation
    if (!this.scene.anims.exists("slime_dead")) {
      const deadFrames = [];
      for (let i = 0; i <= 5; i++) {
        deadFrames.push({ key: `slime_dead_${i.toString().padStart(3, "0")}` });
      }
      this.scene.anims.create({
        key: "slime_dead",
        frames: deadFrames,
        frameRate: 8,
        repeat: 0, // Play once
      });
    }
  }
}
