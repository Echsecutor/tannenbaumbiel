/**
 * PhysicsSystem - Handles collision detection and physics management
 */
import Phaser from "phaser";

export class PhysicsSystem {
  private scene: Phaser.Scene;
  private projectiles!: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createProjectileGroup(): Phaser.Physics.Arcade.Group {
    this.projectiles = this.scene.physics.add.group();
    return this.projectiles;
  }

  setupCollisions(
    player: Phaser.Physics.Arcade.Sprite,
    platforms: Phaser.Physics.Arcade.StaticGroup,
    enemies: Phaser.Physics.Arcade.Group,
    onPlayerEnemyHit: (player: any, enemy: any) => void,
    onProjectileEnemyHit: (projectile: any, enemy: any) => void,
    onProjectilePlatformHit: (projectile: any, platform: any) => void
  ) {
    // Player-platform collisions
    this.scene.physics.add.collider(player, platforms);

    // Enemy-platform collisions
    this.scene.physics.add.collider(enemies, platforms);

    // Player-enemy collisions
    this.scene.physics.add.overlap(
      player,
      enemies,
      onPlayerEnemyHit,
      undefined,
      this.scene
    );

    // Projectile-enemy collisions
    this.scene.physics.add.overlap(
      this.projectiles,
      enemies,
      onProjectileEnemyHit,
      undefined,
      this.scene
    );

    // Projectile-platform collisions
    this.scene.physics.add.collider(
      this.projectiles,
      platforms,
      onProjectilePlatformHit,
      undefined,
      this.scene
    );
  }

  shootProjectile(
    startX: number,
    startY: number,
    direction: number,
    speed: number = 400,
    verticalSpeed: number = -120
  ): Phaser.Physics.Arcade.Sprite {
    // Create fireball with first frame as default texture
    const projectile = this.projectiles.create(startX, startY, "fireball_1");
    projectile.setVelocityX(direction * speed);
    projectile.setVelocityY(verticalSpeed);
    projectile.setDepth(15); // Projectiles in front of everything

    // Scale fireball to be smaller than player (player is 32px, make fireball ~3px height)
    projectile.setScale(0.1);

    // Set appropriate animation based on direction
    const animationKey = direction > 0 ? "fireball_right" : "fireball_left";
    projectile.play(animationKey);

    // Handle direction mirroring for right-facing fireballs
    if (direction > 0) {
      projectile.setFlipX(true);
    }

    // Auto-destroy projectile after 3 seconds
    this.scene.time.delayedCall(3000, () => {
      if (projectile.active) {
        projectile.destroy();
      }
    });

    return projectile;
  }

  getProjectileStates(): any[] {
    const projectileStates: any[] = [];

    this.projectiles.children.entries.forEach(
      (projectile: any, index: number) => {
        if (projectile.active) {
          projectileStates.push({
            projectile_id: `projectile_local_${index}`,
            x: projectile.x,
            y: projectile.y,
            velocity_x: projectile.body.velocity.x,
            velocity_y: projectile.body.velocity.y,
            owner_id: "local",
          });
        }
      }
    );

    return projectileStates;
  }

  getProjectileGroup(): Phaser.Physics.Arcade.Group {
    return this.projectiles;
  }

  // Utility methods for common physics operations
  setWorldBounds(x: number, y: number, width: number, height: number) {
    this.scene.physics.world.setBounds(x, y, width, height);
  }

  enablePhysics(
    gameObject: Phaser.GameObjects.GameObject
  ): Phaser.Physics.Arcade.Body | null {
    this.scene.physics.world.enable(gameObject);
    return (gameObject as any).body || null;
  }

  disablePhysics(gameObject: Phaser.GameObjects.GameObject) {
    this.scene.physics.world.disable(gameObject);
  }

  pausePhysics() {
    this.scene.physics.pause();
  }

  resumePhysics() {
    this.scene.physics.resume();
  }

  // Add collision between two objects/groups
  addCollider(
    object1: any,
    object2: any,
    collideCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
    processCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
    callbackContext?: any
  ): Phaser.Physics.Arcade.Collider {
    return this.scene.physics.add.collider(
      object1,
      object2,
      collideCallback,
      processCallback,
      callbackContext
    );
  }

  // Add overlap detection between two objects/groups
  addOverlap(
    object1: any,
    object2: any,
    overlapCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
    processCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
    callbackContext?: any
  ): Phaser.Physics.Arcade.Collider {
    return this.scene.physics.add.overlap(
      object1,
      object2,
      overlapCallback,
      processCallback,
      callbackContext
    );
  }

  // Check if two objects are overlapping
  checkOverlap(object1: any, object2: any): boolean {
    return this.scene.physics.overlap(object1, object2);
  }

  // Apply force to an object
  applyForce(gameObject: any, forceX: number, forceY: number) {
    if (gameObject.body) {
      gameObject.body.velocity.x += forceX;
      gameObject.body.velocity.y += forceY;
    }
  }

  // Set velocity for an object
  setVelocity(gameObject: any, velocityX: number, velocityY: number) {
    if (gameObject.body) {
      gameObject.setVelocity(velocityX, velocityY);
    }
  }

  // Get distance between two objects
  getDistance(object1: any, object2: any): number {
    return Phaser.Math.Distance.Between(
      object1.x,
      object1.y,
      object2.x,
      object2.y
    );
  }

  // Get angle between two objects
  getAngle(object1: any, object2: any): number {
    return Phaser.Math.Angle.Between(
      object1.x,
      object1.y,
      object2.x,
      object2.y
    );
  }

  // Clean up projectiles that are off-screen or too old
  cleanupProjectiles(worldBounds: Phaser.Geom.Rectangle) {
    this.projectiles.children.entries.forEach((projectile: any) => {
      if (
        projectile.active &&
        !worldBounds.contains(projectile.x, projectile.y)
      ) {
        projectile.destroy();
      }
    });
  }
}
