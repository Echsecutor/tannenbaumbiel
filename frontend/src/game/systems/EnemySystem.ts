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
  private enemyStates: Map<string, string> = new Map(); // Track enemy states: idle, running, attacking, hurt, dying

  // AI behavior properties
  private playerReference: Phaser.Physics.Arcade.Sprite | null = null;
  private platformsReference: Phaser.Physics.Arcade.StaticGroup | null = null;
  private enemyAIUpdateTimer: number = 0;
  private readonly AI_UPDATE_INTERVAL: number = 500; // Update AI every 500ms
  private readonly PLAYER_DETECTION_RANGE: number = 400; // Range to detect player
  private readonly JUMP_PROBABILITY: number = 0.3; // 30% chance to jump when near edge
  // Removed unused MOVE_TOWARDS_PLAYER_PROBABILITY since we always move towards player when in range
  private readonly RANDOM_MOVEMENT_PROBABILITY: number = 0.1; // 10% chance for random movement

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Set references for AI behavior
  setPlayerReference(player: Phaser.Physics.Arcade.Sprite) {
    this.playerReference = player;
  }

  setPlatformsReference(platforms: Phaser.Physics.Arcade.StaticGroup) {
    this.platformsReference = platforms;
  }

  createEnemyGroup(): Phaser.Physics.Arcade.Group {
    // Only create if not already created
    if (!this.enemies) {
      this.enemies = this.scene.physics.add.group();
    }
    if (!this.bossStones) {
      this.bossStones = this.scene.physics.add.group();
    }
    return this.enemies;
  }

  getEnemyGroup(): Phaser.Physics.Arcade.Group {
    return this.enemies;
  }

  createEnemy(
    x: number,
    y: number,
    enemyType: string,
    chunkIndex: number
  ): Phaser.Physics.Arcade.Sprite {
    let enemy: Phaser.Physics.Arcade.Sprite;
    let enemyId = `enemy_${x}_${y}_${chunkIndex}`;

    if (enemyType === "adventurer") {
      // Small boss enemy using ADVENTURER sprites
      enemy = this.enemies.create(x, y, "adventurer_idle_000");
      enemy.setData("health", 100);
      enemy.setData("type", "adventurer");
      enemy.setScale(0.1); // Scale down to match slimes and player size
      enemy.setDepth(12);
      enemy.play("adventurer_idle");
      enemy.setVelocity(Phaser.Math.Between(-100, 100), 20);
      this.enemyStates.set(enemyId, "idle");
    } else {
      // Normal enemy using SLIME sprites
      enemy = this.enemies.create(x, y, "slime_idle_000");
      enemy.setData("health", 50);
      enemy.setData("type", "slime");
      enemy.setScale(0.1); // Scale down much smaller to match player size
      enemy.setDepth(12);
      enemy.play("slime_idle");
      enemy.setVelocity(Phaser.Math.Between(-150, 150), 20);
      this.enemyStates.set(enemyId, "idle");
    }

    enemy.setBounce(1);
    enemy.setCollideWorldBounds(true);
    enemy.setData("facingRight", true);
    enemy.setData("chunkIndex", chunkIndex);
    enemy.setData("enemyId", enemyId);

    // AI behavior data
    enemy.setData("lastAIUpdate", 0);
    enemy.setData("jumpCooldown", 0);
    enemy.setData("directionChangeCooldown", 0);
    enemy.setData("isNearEdge", false);
    enemy.setData("canJump", true);

    return enemy;
  }

  private updateEnemyAnimation(enemy: Phaser.Physics.Arcade.Sprite) {
    const enemyId = enemy.getData("enemyId");
    const currentState = this.enemyStates.get(enemyId) || "idle";
    const enemyType = enemy.getData("type");
    const velocity = enemy.body?.velocity;

    // Update facing direction based on velocity
    if (velocity && velocity.x !== 0) {
      const facingRight = velocity.x > 0;
      enemy.setData("facingRight", facingRight);

      // Handle sprite flipping - both SLIME and ADVENTURER sprites are right-facing by default
      enemy.setFlipX(facingRight);
    }

    // Determine animation based on state and movement
    if (
      currentState === "hurt" ||
      currentState === "attacking" ||
      currentState === "dying"
    ) {
      // Don't override special animations
      return;
    }

    const isMoving = velocity && Math.abs(velocity.x) > 10;

    if (enemyType === "adventurer") {
      if (isMoving) {
        enemy.play("adventurer_run", true);
        this.enemyStates.set(enemyId, "running");
      } else {
        enemy.play("adventurer_idle", true);
        this.enemyStates.set(enemyId, "idle");
      }
    } else if (enemyType === "slime") {
      if (isMoving) {
        enemy.play("slime_move", true);
        this.enemyStates.set(enemyId, "running");
      } else {
        enemy.play("slime_idle", true);
        this.enemyStates.set(enemyId, "idle");
      }
    }
  }

  private playEnemyHurtAnimation(enemy: Phaser.Physics.Arcade.Sprite) {
    const enemyId = enemy.getData("enemyId");
    const enemyType = enemy.getData("type");

    this.enemyStates.set(enemyId, "hurt");

    if (enemyType === "adventurer") {
      enemy.play("adventurer_hurt");
    } else if (enemyType === "slime") {
      enemy.play("slime_hurt");
    }

    // Return to normal animation after hurt animation completes
    this.scene.time.delayedCall(600, () => {
      if (this.enemyStates.get(enemyId) === "hurt") {
        this.enemyStates.set(enemyId, "idle");
        this.updateEnemyAnimation(enemy);
      }
    });
  }

  private playEnemyDeathAnimation(
    enemy: Phaser.Physics.Arcade.Sprite,
    callback?: () => void
  ) {
    const enemyId = enemy.getData("enemyId");
    const enemyType = enemy.getData("type");

    this.enemyStates.set(enemyId, "dying");

    // Stop movement and disable bouncing during death animation
    enemy.setVelocity(0, 0);
    enemy.setBounce(0); // Disable bouncing to prevent post-death movement
    if (enemy.body) {
      enemy.body.immovable = true; // Make enemy immovable to prevent physics interactions
    }

    if (enemyType === "adventurer") {
      enemy.play("adventurer_dead");
      // Remove enemy after death animation completes (8 frames at 8 fps = 1000ms)
      this.scene.time.delayedCall(1000, () => {
        this.enemyStates.delete(enemyId);
        enemy.destroy();
        if (callback) callback();
      });
    } else if (enemyType === "slime") {
      enemy.play("slime_dead");
      // Remove enemy after death animation completes (6 frames at 8 fps = 750ms)
      this.scene.time.delayedCall(750, () => {
        this.enemyStates.delete(enemyId);
        enemy.destroy();
        if (callback) callback();
      });
    } else if (enemyType === "tree_boss") {
      // Tree boss death - fade out and destroy
      console.log("🌲 Tree boss is dying...");

      // Clean up debug graphics
      const debugGraphics = enemy.getData("debugGraphics");
      if (debugGraphics) {
        debugGraphics.destroy();
      }

      this.scene.tweens.add({
        targets: enemy,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          console.log("🌲 Tree boss destroyed, removing from group");
          this.enemyStates.delete(enemyId);
          enemy.destroy();
          // Ensure boss is removed from enemies group
          if (this.enemies.contains(enemy)) {
            this.enemies.remove(enemy);
          }
          if (callback) callback();
        },
      });
    }
  }

  private playEnemyAttackAnimation(enemy: Phaser.Physics.Arcade.Sprite) {
    const enemyId = enemy.getData("enemyId");
    const enemyType = enemy.getData("type");

    this.enemyStates.set(enemyId, "attacking");

    if (enemyType === "adventurer") {
      enemy.play("adventurer_slash");
      // Return to normal animation after attack completes
      this.scene.time.delayedCall(530, () => {
        // 8 frames at 15 fps
        if (this.enemyStates.get(enemyId) === "attacking") {
          this.enemyStates.set(enemyId, "idle");
          this.updateEnemyAnimation(enemy);
        }
      });
    } else if (enemyType === "slime") {
      enemy.play("slime_attack");
      // Return to normal animation after attack completes
      this.scene.time.delayedCall(670, () => {
        // 8 frames at 12 fps
        if (this.enemyStates.get(enemyId) === "attacking") {
          this.enemyStates.set(enemyId, "idle");
          this.updateEnemyAnimation(enemy);
        }
      });
    }
  }

  createTreeBoss(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    // Create boss as a separate sprite to avoid group physics interference
    const boss = this.scene.physics.add.sprite(x, y, "winter_tree");

    // Add to enemies group for consistency
    this.enemies.add(boss);

    // Make the boss huge - half screen height
    const screenHeight = this.scene.scale.height;
    const targetHeight = screenHeight * 0.5; // Half screen height
    const originalHeight = boss.height;
    const scale = targetHeight / originalHeight;

    boss.setScale(scale);
    boss.setData("health", 300); // Much more health for boss
    boss.setData("type", "tree_boss");
    boss.setData("maxHealth", 300);
    boss.setData("enemyId", "tree_boss"); // Add enemyId for death handling
    boss.setDepth(15); // Higher depth than regular enemies

    // Set the boss origin to bottom center so it sits properly on the ground
    boss.setOrigin(0.5, 1.0);

    // Completely disable physics movement for the boss
    boss.body.setImmovable(true);
    boss.body.moves = false; // Disable movement entirely
    boss.body.setVelocity(0, 0);
    boss.body.setGravityY(0); // No gravity for the boss
    boss.body.allowGravity = false; // Explicitly disable gravity

    // Set custom collision bounds to match tree sprite shape
    // Since origin is (0.5, 1.0), we need to adjust collision box accordingly
    const collisionWidth = boss.width * 0.6; // 60% of sprite width for main trunk
    const collisionHeight = boss.height * 0.8; // 80% of sprite height, excluding top branches

    // Calculate offset for bottom-center origin
    const collisionOffsetX = (boss.width - collisionWidth) / 2; // Center horizontally
    const collisionOffsetY = boss.height - collisionHeight; // Align to bottom since origin is at bottom

    console.log(
      `🌲 Setting collision box: ${collisionWidth}x${collisionHeight} with offset (${collisionOffsetX}, ${collisionOffsetY})`
    );
    console.log(`🌲 Boss sprite size: ${boss.width}x${boss.height}`);

    // Force refresh the body to ensure collision box is applied
    boss.body.setSize(collisionWidth, collisionHeight);
    boss.body.setOffset(collisionOffsetX, collisionOffsetY);
    boss.body.updateBounds(); // Force update the collision bounds

    // Verify the collision box was set correctly
    console.log(
      `🌲 Actual collision box after setSize: ${boss.body.width}x${boss.body.height}`
    );
    console.log(
      `🌲 Actual collision offset after setOffset: (${boss.body.offset.x}, ${boss.body.offset.y})`
    );

    // Create debug display for collision box
    this.createBossDebugDisplay(boss);

    // Ensure the boss has proper collision bounds and stays in place
    boss.setCollideWorldBounds(true);
    boss.setBounce(0); // No bouncing

    // Initialize boss stone throwing
    this.bossStoneThrowTimer = 0;

    // Initialize boss state
    this.enemyStates.set("tree_boss", "idle");

    console.log(
      `🌲 Created Tree Boss at (${x}, ${y}) with scale ${scale.toFixed(2)}`
    );
    return boss;
  }

  updateEnemies() {
    // Update AI timer
    this.enemyAIUpdateTimer += this.scene.game.loop.delta;

    this.enemies.children.entries.forEach((enemy: any) => {
      const enemyId = enemy.getData("enemyId");
      const currentState = this.enemyStates.get(enemyId);

      // Skip AI updates for dead/dying enemies
      if (currentState === "dying") {
        return;
      }

      if (enemy.getData("type") === "tree_boss") {
        // Boss behavior: throw stones at regular intervals
        this.updateTreeBoss(enemy);
      } else {
        // Enhanced AI for regular enemies
        this.updateEnemyAI(enemy);
      }
    });

    // Update enemy animations based on movement and state
    this.updateEnemyAnimations();

    // Update boss stone projectiles
    this.updateBossStones();
  }

  private updateEnemyAI(enemy: Phaser.Physics.Arcade.Sprite) {
    const currentTime = this.scene.time.now;
    const lastAIUpdate = enemy.getData("lastAIUpdate") || 0;

    // Only update AI periodically
    if (currentTime - lastAIUpdate < this.AI_UPDATE_INTERVAL) {
      return;
    }

    enemy.setData("lastAIUpdate", currentTime);

    // Update cooldowns
    this.updateEnemyCooldowns(enemy);

    // Check if player is in range
    const playerInRange = this.isPlayerInRange(enemy);

    if (playerInRange) {
      // Move towards player with high probability
      this.moveTowardsPlayer(enemy);
    } else {
      // Random movement or edge detection
      this.handleRandomMovement(enemy);
    }

    // Handle jumping for platform navigation
    this.handleEnemyJumping(enemy);
  }

  private updateEnemyCooldowns(enemy: Phaser.Physics.Arcade.Sprite) {
    // Update jump cooldown
    const jumpCooldown = enemy.getData("jumpCooldown") || 0;
    if (jumpCooldown > 0) {
      enemy.setData(
        "jumpCooldown",
        Math.max(0, jumpCooldown - this.scene.game.loop.delta)
      );
    }

    // Update direction change cooldown
    const directionCooldown = enemy.getData("directionChangeCooldown") || 0;
    if (directionCooldown > 0) {
      enemy.setData(
        "directionChangeCooldown",
        Math.max(0, directionCooldown - this.scene.game.loop.delta)
      );
    }
  }

  private isPlayerInRange(enemy: Phaser.Physics.Arcade.Sprite): boolean {
    if (!this.playerReference) return false;

    const distance = Phaser.Math.Distance.Between(
      enemy.x,
      enemy.y,
      this.playerReference.x,
      this.playerReference.y
    );

    return distance <= this.PLAYER_DETECTION_RANGE;
  }

  private moveTowardsPlayer(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!this.playerReference) return;

    const speed = 150;
    const playerX = this.playerReference.x;
    const enemyX = enemy.x;

    // Determine direction to player
    const direction = playerX > enemyX ? 1 : -1;

    // Set velocity towards player
    enemy.setVelocityX(direction * speed);

    // Update facing direction
    enemy.setData("facingRight", direction > 0);
    enemy.setFlipX(direction > 0);
  }

  private handleRandomMovement(enemy: Phaser.Physics.Arcade.Sprite) {
    const directionCooldown = enemy.getData("directionChangeCooldown") || 0;

    // Only change direction if cooldown is finished
    if (directionCooldown <= 0) {
      const random = Math.random();

      if (random < this.RANDOM_MOVEMENT_PROBABILITY) {
        // Random direction change
        const newDirection = Phaser.Math.Between(-1, 1);
        const speed = 100;
        enemy.setVelocityX(newDirection * speed);

        // Update facing direction
        enemy.setData("facingRight", newDirection > 0);
        enemy.setFlipX(newDirection > 0);

        // Set cooldown for direction changes
        enemy.setData("directionChangeCooldown", 2000); // 2 seconds
      }
    }
  }

  private handleEnemyJumping(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!enemy.body || !enemy.body.touching.down) return;

    const jumpCooldown = enemy.getData("jumpCooldown") || 0;
    if (jumpCooldown > 0) return;

    // Check if enemy is near an edge
    const isNearEdge = this.checkIfNearEdge(enemy);
    enemy.setData("isNearEdge", isNearEdge);

    // Jump if near edge or randomly
    if (isNearEdge && Math.random() < this.JUMP_PROBABILITY) {
      this.makeEnemyJump(enemy);
    }
  }

  private checkIfNearEdge(enemy: Phaser.Physics.Arcade.Sprite): boolean {
    if (!this.platformsReference) return false;

    const checkDistance = 20; // Distance to check for edge
    const currentX = enemy.x;
    const currentY = enemy.y;
    const direction = enemy.getData("facingRight") ? 1 : -1;

    // Check if there's a platform ahead
    const checkX = currentX + direction * checkDistance;
    const checkY = currentY + 10; // Slightly below enemy

    // Raycast to check for platform ahead
    const platforms = this.platformsReference.children.entries;
    let platformAhead = false;

    for (const platform of platforms) {
      if (platform.body && this.isPointInBounds(checkX, checkY, platform)) {
        platformAhead = true;
        break;
      }
    }

    // If no platform ahead, we're near an edge
    return !platformAhead;
  }

  private isPointInBounds(x: number, y: number, sprite: any): boolean {
    if (!sprite.body) return false;

    const bounds = sprite.body;
    return (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    );
  }

  private makeEnemyJump(enemy: Phaser.Physics.Arcade.Sprite) {
    const jumpSpeed = 400; // Similar to player jump speed

    enemy.setVelocityY(-jumpSpeed);
    enemy.setData("jumpCooldown", 1500); // 1.5 second cooldown

    // Play jump animation if available
    const enemyType = enemy.getData("type");
    if (enemyType === "adventurer") {
      // Adventurer doesn't have jump animation, use run instead
      enemy.play("adventurer_run", true);
    } else if (enemyType === "slime") {
      // Slime doesn't have jump animation, use move instead
      enemy.play("slime_move", true);
    }
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

    // Create stone projectile from higher position on the boss
    const stone = this.bossStones.create(
      boss.x,
      boss.y - boss.height * 0.6, // Higher spawn position (was 0.3)
      "stone"
    );
    stone.setScale(1.5); // Make stones visible
    stone.setDepth(14);

    // Calculate trajectory with higher upward arc toward player
    const deltaX = player.x - boss.x;
    const deltaY = player.y - boss.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Use projectile motion formula for higher upward arc
    // Always throw upward first, then let gravity bring it down toward player
    const baseSpeed = 450; // Increased speed for higher arc
    const gravity = 600; // Reduced gravity for higher arc

    // Calculate angle to hit player with higher trajectory
    const angle = Math.atan2(
      deltaY + (gravity * distance * distance) / (2 * baseSpeed * baseSpeed),
      deltaX
    );

    // Apply velocity with higher upward arc
    const velocityX = Math.cos(angle) * baseSpeed;
    const velocityY = Math.sin(angle) * baseSpeed - 300; // More upward velocity (was -200)

    stone.setVelocity(velocityX, velocityY);
    stone.setBounce(0.3);
    stone.setCollideWorldBounds(true);

    console.log(
      `🪨 Tree boss threw stone in high upward arc toward player at (${player.x}, ${player.y})`
    );
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
    const enemyId = enemy.getData("enemyId");
    const currentState = this.enemyStates.get(enemyId);

    // Don't hit enemy if it's already dying
    if (currentState === "dying") {
      return { destroyed: true, health: 0 };
    }

    const health = enemy.getData("health") - damage;
    enemy.setData("health", health);

    if (health <= 0) {
      // Play death animation and remove enemy after it completes
      this.playEnemyDeathAnimation(enemy);
      return { destroyed: true, health: 0 };
    } else {
      // Play hurt animation
      this.playEnemyHurtAnimation(enemy);

      // Visual feedback with red tint
      enemy.setTint(0xff0000);
      this.scene.time.delayedCall(200, () => {
        enemy.clearTint();
      });
    }

    return { destroyed: false, health };
  }

  enemyHitPlayer(enemy: any): void {
    // Play attack animation when enemy hits player
    const enemyId = enemy.getData("enemyId");
    const currentState = this.enemyStates.get(enemyId);

    // Dead/dying enemies cannot hurt the player
    if (currentState === "dying") {
      return;
    }

    // Only play attack if not already in special state
    if (currentState === "idle" || currentState === "running") {
      this.playEnemyAttackAnimation(enemy);
    }
  }

  updateEnemyAnimations(): void {
    // Update animations for all active enemies
    this.enemies.children.entries.forEach((enemy: any) => {
      if (enemy.active) {
        const enemyId = enemy.getData("enemyId");
        const currentState = this.enemyStates.get(enemyId);

        // Only update if not in special animation state
        if (
          currentState !== "hurt" &&
          currentState !== "attacking" &&
          currentState !== "dying"
        ) {
          this.updateEnemyAnimation(enemy);
        }
      }
    });
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
          let texture: string;
          if (enemyState.enemy_type === "adventurer") {
            texture = "adventurer_idle_000";
          } else if (enemyState.enemy_type === "slime") {
            texture = "slime_idle_000";
          } else if (enemyState.enemy_type === "pink_boss") {
            texture = "pink_enemy_idle"; // Keep old boss for backwards compatibility
          } else {
            texture = "slime_idle_000"; // Default to slime
          }

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
          sprite.setData("enemyId", enemyState.enemy_id);

          if (enemyState.enemy_type === "adventurer") {
            sprite.setScale(0.1); // Scale down to match slimes and player size
            sprite.setTint(0x8a2be2); // Purple tint for network adventurers
          } else if (enemyState.enemy_type === "slime") {
            sprite.setScale(0.1); // Scale down much smaller to match player size
            sprite.setTint(0x32cd32); // Green tint for network slimes
          } else if (enemyState.enemy_type === "pink_boss") {
            sprite.setScale(1.5);
            sprite.setTint(0xff69b4);
          } else {
            sprite.setScale(0.1); // Default to slime scaling
            sprite.setTint(0x32cd32); // Default green tint
          }

          this.enemyStates.set(enemyState.enemy_id, "idle");

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

          // Check if enemy is dead (health <= 0)
          const isDead = enemyState.health <= 0;

          if (isDead) {
            // Dead enemies don't move and play death animation
            sprite.setVelocity(0, 0);
            this.enemyStates.set(enemyState.enemy_id, "dying");

            // Play death animation
            if (enemyState.enemy_type === "adventurer") {
              sprite.play("adventurer_dead", true);
            } else if (enemyState.enemy_type === "slime") {
              sprite.play("slime_dead", true);
            } else if (enemyState.enemy_type === "pink_boss") {
              sprite.play("pink_enemy_idle_anim", true); // Old boss type doesn't have death animation
            }
          } else {
            // Only update movement and animations for living enemies
            sprite.setVelocity(enemyState.velocity_x, enemyState.velocity_y);

            // Handle sprite flipping - both SLIME and ADVENTURER sprites are right-facing by default
            sprite.setFlipX(enemyState.facing_right);

            // Update animation based on enemy type and movement
            if (Math.abs(enemyState.velocity_x) > 10) {
              if (enemyState.enemy_type === "adventurer") {
                sprite.play("adventurer_run", true);
              } else if (enemyState.enemy_type === "slime") {
                sprite.play("slime_move", true);
              } else if (enemyState.enemy_type === "pink_boss") {
                sprite.play("pink_enemy_idle_anim", true); // Old boss type
              }
            } else {
              if (enemyState.enemy_type === "adventurer") {
                sprite.play("adventurer_idle", true);
              } else if (enemyState.enemy_type === "slime") {
                sprite.play("slime_idle", true);
              } else if (enemyState.enemy_type === "pink_boss") {
                sprite.play("pink_enemy_idle_anim", true); // Old boss type
              }
            }
          }

          sprite.setData("health", enemyState.health);
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
        this.enemyStates.delete(enemyId); // Clean up enemy state
      }
    }
  }

  removeEnemiesInChunk(chunkIndex: number) {
    this.enemies.children.entries.forEach((enemy: any) => {
      if (enemy.getData("chunkIndex") === chunkIndex) {
        const enemyId = enemy.getData("enemyId");
        if (enemyId) {
          this.enemyStates.delete(enemyId); // Clean up enemy state
        }
        enemy.destroy();
      }
    });
  }

  countActiveEnemies(): number {
    return this.enemies.countActive();
  }

  isBossDefeated(): boolean {
    // Check if tree boss exists and is alive
    const boss = this.enemies.children.entries.find(
      (enemy: any) => enemy.getData("type") === "tree_boss" && enemy.active
    );
    return !boss; // Return true if boss doesn't exist (is defeated)
  }

  clearNetworkEnemies() {
    for (const [enemyId, sprite] of this.networkEnemies) {
      sprite.destroy();
      this.enemyStates.delete(enemyId); // Clean up enemy state
    }
    this.networkEnemies.clear();
  }

  getEnemyStates(): Map<string, string> {
    return this.enemyStates;
  }

  private createBossDebugDisplay(boss: Phaser.Physics.Arcade.Sprite): void {
    // Create debug graphics for collision box display
    const debugGraphics = this.scene.add.graphics();
    debugGraphics.setDepth(16); // Above the boss sprite
    debugGraphics.setVisible(false); // Hidden by default

    // Create update function for debug display
    const updateDebugDisplay = () => {
      if (!boss.body) return;

      debugGraphics.clear();

      // Show the actual collision bounds (red)
      debugGraphics.lineStyle(2, 0xff0000, 1);
      const collisionX = boss.x - boss.body.width / 2;
      const collisionY = boss.y - boss.body.height;
      debugGraphics.strokeRect(
        collisionX,
        collisionY,
        boss.body.width,
        boss.body.height
      );

      // Show collision box info in console
      console.log(
        `🌲 Boss collision box: ${boss.body.width}x${boss.body.height} at (${collisionX}, ${collisionY})`
      );
    };

    // Store debug graphics reference for cleanup
    boss.setData("debugGraphics", debugGraphics);
    boss.setData("updateDebugDisplay", updateDebugDisplay);
  }

  showBossCollisionBox(): void {
    // Find the tree boss and show its collision box
    this.enemies.children.entries.forEach((enemy: any) => {
      if (enemy.getData("type") === "tree_boss" && enemy.active) {
        const debugGraphics = enemy.getData("debugGraphics");
        const updateDebugDisplay = enemy.getData("updateDebugDisplay");

        if (debugGraphics && updateDebugDisplay) {
          debugGraphics.setVisible(true);
          updateDebugDisplay();
          console.log("🔍 Boss collision box debug display enabled");
        }
      }
    });
  }
}
