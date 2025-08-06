/**
 * EnemySystem - Handles enemy creation, animations, AI, and state management
 */
import Phaser from "phaser";

export class EnemySystem {
  private scene: Phaser.Scene;
  private enemies!: Phaser.Physics.Arcade.Group;
  private networkEnemies: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();
  private bossStones!: Phaser.Physics.Arcade.Group;
  private bossStoneThrowTimer: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createEnemyGroup(): Phaser.Physics.Arcade.Group {
    this.enemies = this.scene.physics.add.group();
    this.bossStones = this.scene.physics.add.group();
    this.createEnemyAnimations();
    return this.enemies;
  }

  private createEnemyAnimations() {
    // Enemy idle animation
    if (!this.scene.anims.exists("enemy_idle_anim")) {
      this.scene.anims.create({
        key: "enemy_idle_anim",
        frames: this.scene.anims.generateFrameNumbers("enemy_idle", {
          start: 0,
          end: 3,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }

    // Enemy walk animation
    if (!this.scene.anims.exists("enemy_walk_anim")) {
      this.scene.anims.create({
        key: "enemy_walk_anim",
        frames: this.scene.anims.generateFrameNumbers("enemy_walk", {
          start: 0,
          end: 5,
        }),
        frameRate: 8,
        repeat: -1,
      });
    }

    // Pink enemy idle animation
    if (!this.scene.anims.exists("pink_enemy_idle_anim")) {
      this.scene.anims.create({
        key: "pink_enemy_idle_anim",
        frames: this.scene.anims.generateFrameNumbers("pink_enemy_idle", {
          start: 0,
          end: 3,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  createEnemy(
    x: number,
    y: number,
    enemyType: string,
    chunkIndex: number
  ): Phaser.Physics.Arcade.Sprite {
    let enemy: Phaser.Physics.Arcade.Sprite;

    if (enemyType === "pink_boss") {
      enemy = this.enemies.create(x, y, "pink_enemy_idle");
      enemy.setData("health", 100);
      enemy.setData("type", "pink_boss");
      enemy.setScale(1.5); // Make boss bigger
      enemy.setDepth(12);
      enemy.play("pink_enemy_idle_anim");
      enemy.setVelocity(Phaser.Math.Between(-100, 100), 20);
    } else {
      enemy = this.enemies.create(x, y, "enemy_idle");
      enemy.setData("health", 50);
      enemy.setData("type", "owlet");
      enemy.setDepth(12);
      enemy.play("enemy_idle_anim");
      enemy.setVelocity(Phaser.Math.Between(-200, 200), 20);
    }

    enemy.setBounce(1);
    enemy.setCollideWorldBounds(true);
    enemy.setData("facingRight", true);
    enemy.setData("chunkIndex", chunkIndex);

    return enemy;
  }

  createTreeBoss(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const boss = this.enemies.create(x, y, "winter_tree");

    // Make the boss huge - half screen height
    const screenHeight = this.scene.scale.height;
    const targetHeight = screenHeight * 0.5; // Half screen height
    const originalHeight = boss.height;
    const scale = targetHeight / originalHeight;

    boss.setScale(scale);
    boss.setData("health", 300); // Much more health for boss
    boss.setData("type", "tree_boss");
    boss.setData("maxHealth", 300);
    boss.setDepth(15); // Higher depth than regular enemies

    // Boss doesn't move
    boss.body.immovable = true;
    boss.setVelocity(0, 0);

    // Initialize boss stone throwing
    this.bossStoneThrowTimer = 0;

    console.log(
      `🌲 Created Tree Boss at (${x}, ${y}) with scale ${scale.toFixed(2)}`
    );
    return boss;
  }

  updateEnemies() {
    this.enemies.children.entries.forEach((enemy: any) => {
      if (enemy.getData("type") === "tree_boss") {
        // Boss behavior: throw stones at regular intervals
        this.updateTreeBoss(enemy);
      } else {
        // Regular enemy AI: Change direction randomly
        if (Phaser.Math.Between(0, 100) < 2) {
          enemy.setVelocityX(Phaser.Math.Between(-200, 200));
        }
      }
    });

    // Update boss stone projectiles
    this.updateBossStones();
  }

  private updateTreeBoss(boss: any) {
    // Tree boss throws stones every 2-3 seconds
    this.bossStoneThrowTimer += this.scene.game.loop.delta;

    if (this.bossStoneThrowTimer >= 2000 + Math.random() * 1000) {
      // 2-3 seconds
      this.throwStone(boss);
      this.bossStoneThrowTimer = 0;
    }
  }

  private throwStone(boss: any) {
    // Get player position for targeting
    const gameScene = this.scene as any;
    const player = gameScene.playerSystem?.getPlayer();

    if (!player) return;

    // Create stone projectile
    const stone = this.bossStones.create(
      boss.x,
      boss.y - boss.height * 0.3,
      "stone"
    );
    stone.setScale(1.5); // Make stones visible
    stone.setDepth(14);

    // Calculate trajectory toward player
    const deltaX = player.x - boss.x;
    const deltaY = player.y - boss.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Normalize and apply velocity
    const speed = 300;
    const velocityX = (deltaX / distance) * speed;
    const velocityY = (deltaY / distance) * speed + 100; // Add some arc

    stone.setVelocity(velocityX, velocityY);
    stone.setBounce(0.3);
    stone.setCollideWorldBounds(true);

    console.log(`🪨 Tree boss threw stone at player`);
  }

  private updateBossStones() {
    // Remove stones that are too old or off-screen
    this.bossStones.children.entries.forEach((stone: any) => {
      if (stone.y > this.scene.scale.height + 100) {
        stone.destroy();
      }
    });
  }

  hitEnemy(
    enemy: any,
    damage: number = 25
  ): { destroyed: boolean; health: number } {
    const health = enemy.getData("health") - damage;
    enemy.setData("health", health);

    // Visual feedback
    enemy.setTint(0xff0000);
    this.scene.time.delayedCall(200, () => {
      enemy.setTint(0xe74c3c);
    });

    if (health <= 0) {
      enemy.destroy();
      return { destroyed: true, health: 0 };
    }

    return { destroyed: false, health };
  }

  getEnemyGroup(): Phaser.Physics.Arcade.Group {
    return this.enemies;
  }

  getBossStones(): Phaser.Physics.Arcade.Group {
    return this.bossStones;
  }

  getLocalEnemyStates(): any[] {
    const enemyStates: any[] = [];

    this.enemies.children.entries.forEach((enemy: any, index: number) => {
      if (enemy.active) {
        enemyStates.push({
          enemy_id: `enemy_${index + 1}`,
          enemy_type: enemy.getData("type"),
          x: enemy.x,
          y: enemy.y,
          velocity_x: enemy.body.velocity.x,
          velocity_y: enemy.body.velocity.y,
          facing_right: enemy.getData("facingRight") !== false,
          health: enemy.getData("health") || 50,
        });
      }
    });

    return enemyStates;
  }

  updateNetworkEnemies(
    enemyStates: any[],
    platforms: Phaser.Physics.Arcade.StaticGroup,
    player: Phaser.Physics.Arcade.Sprite,
    projectiles: Phaser.Physics.Arcade.Group
  ) {
    const activeEnemyIds = new Set<string>();

    for (const enemyState of enemyStates) {
      activeEnemyIds.add(enemyState.enemy_id);
      let sprite = this.networkEnemies.get(enemyState.enemy_id);

      if (!sprite) {
        try {
          const texture =
            enemyState.enemy_type === "pink_boss"
              ? "pink_enemy_idle"
              : "enemy_idle";
          sprite = this.scene.physics.add.sprite(
            enemyState.x,
            enemyState.y,
            texture
          );
          sprite.setDepth(12);

          if (!sprite || !sprite.body) {
            console.error(
              `❌ Failed to create enemy sprite ${enemyState.enemy_id}`
            );
            continue;
          }

          sprite.setData("health", enemyState.health);
          sprite.setData("type", enemyState.enemy_type);
          sprite.setData("facingRight", enemyState.facing_right);

          if (enemyState.enemy_type === "pink_boss") {
            sprite.setScale(1.5);
            sprite.setTint(0xff69b4);
          } else {
            sprite.setTint(0xffa500);
          }

          sprite.setBounce(0);
          sprite.setCollideWorldBounds(true);

          // Add collisions
          this.scene.physics.add.collider(sprite, platforms);
          this.scene.physics.add.overlap(
            player,
            sprite,
            (_p: any, e: any) => this.hitEnemy(e),
            undefined,
            this.scene
          );
          this.scene.physics.add.overlap(
            projectiles,
            sprite,
            (_pr: any, e: any) => this.hitEnemy(e),
            undefined,
            this.scene
          );

          this.networkEnemies.set(enemyState.enemy_id, sprite);
          console.log(`🦴 Created network enemy: ${enemyState.enemy_id}`);
        } catch (error) {
          console.error(`❌ Error creating network enemy:`, error);
          continue;
        }
      }

      if (sprite && sprite.body) {
        try {
          sprite.setPosition(enemyState.x, enemyState.y);
          sprite.setVelocity(enemyState.velocity_x, enemyState.velocity_y);
          sprite.setFlipX(!enemyState.facing_right);
          sprite.setData("health", enemyState.health);

          // Update animation
          if (Math.abs(enemyState.velocity_x) > 10) {
            const walkAnim =
              enemyState.enemy_type === "pink_boss"
                ? "pink_enemy_walk_anim"
                : "enemy_walk_anim";
            sprite.play(walkAnim, true);
          } else {
            const idleAnim =
              enemyState.enemy_type === "pink_boss"
                ? "pink_enemy_idle_anim"
                : "enemy_idle_anim";
            sprite.play(idleAnim, true);
          }
        } catch (error) {
          console.error(
            `❌ Error updating enemy ${enemyState.enemy_id}:`,
            error
          );
        }
      }
    }

    // Remove enemies that no longer exist
    for (const [enemyId, sprite] of this.networkEnemies) {
      if (!activeEnemyIds.has(enemyId)) {
        sprite.destroy();
        this.networkEnemies.delete(enemyId);
      }
    }
  }

  removeEnemiesInChunk(chunkIndex: number) {
    this.enemies.children.entries.forEach((enemy: any) => {
      if (enemy.getData("chunkIndex") === chunkIndex) {
        enemy.destroy();
      }
    });
  }

  countActiveEnemies(): number {
    return this.enemies.countActive();
  }

  clearNetworkEnemies() {
    for (const [_enemyId, sprite] of this.networkEnemies) {
      sprite.destroy();
    }
    this.networkEnemies.clear();
  }
}
