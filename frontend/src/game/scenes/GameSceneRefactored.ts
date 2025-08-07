/**
 * GameScene - Main game world (Refactored)
 * Now uses modular systems for better organization and maintainability
 */
import Phaser from "phaser";
import { NetworkManager } from "../../network/NetworkManager";

// Import all systems
import { AssetLoader } from "../systems/AssetLoader";
import { CameraSystem } from "../systems/CameraSystem";
import { ControlsSystem } from "../systems/ControlsSystem";
import { EnemySystem } from "../systems/EnemySystem";
import { GameStateManager } from "../systems/GameStateManager";
import { NetworkSystem } from "../systems/NetworkSystem";
import { PhysicsSystem } from "../systems/PhysicsSystem";
import { PlayerSystem } from "../systems/PlayerSystem";
import { WorldGenerator } from "../systems/WorldGenerator";

export class GameSceneRefactored extends Phaser.Scene {
  // Core systems
  private assetLoader!: AssetLoader;
  private playerSystem!: PlayerSystem;
  private enemySystem!: EnemySystem;
  private worldGenerator!: WorldGenerator;
  private networkSystem!: NetworkSystem;
  private cameraSystem!: CameraSystem;
  private controlsSystem!: ControlsSystem;
  private physicsSystem!: PhysicsSystem;
  private gameStateManager!: GameStateManager;

  // Game state
  private isOffline = false;
  private roomData: any = null;
  private myPlayerId: string = "";
  private levelCompleted = false;
  private selectedSprite: string = "dude_monster";

  // Audio
  private backgroundMusic: Phaser.Sound.BaseSound | null = null;
  private victoryMusic: Phaser.Sound.BaseSound | null = null;

  // Input state tracking
  private inputState: Map<string, boolean> = new Map();

  constructor() {
    super({ key: "GameScene" }); // Use original key to replace old scene seamlessly
  }

  init(data: any) {
    this.isOffline = data.offline || false;
    this.roomData = data.roomData || null;
    this.selectedSprite = data.selectedSprite || "dude_monster";

    // Reset level completion flag for new level/restart
    this.levelCompleted = false;
    console.log("🔄 Level completion flag reset for new level");

    // Initialize systems
    this.initializeSystems();

    // Set the level from data
    const level = data.level || 1;
    this.gameStateManager.setLevel(level);

    // Get player ID directly from scene data
    if (data.myPlayerId) {
      this.myPlayerId = data.myPlayerId;
      console.log("🎮 GameScene: Player ID received:", this.myPlayerId);
    }

    // Handle restart/rejoin logic
    this.handleRestartLogic(data);

    console.log("GameScene initialized:", {
      offline: this.isOffline,
      roomData: this.roomData,
      myPlayerId: this.myPlayerId,
      level: level,
      selectedSprite: this.selectedSprite,
    });
  }

  private initializeSystems() {
    this.assetLoader = new AssetLoader(this);
    this.enemySystem = new EnemySystem(this);
    this.worldGenerator = new WorldGenerator(this, this.enemySystem);
    this.networkSystem = new NetworkSystem(this);
    this.cameraSystem = new CameraSystem(this);
    this.controlsSystem = new ControlsSystem(this);
    this.physicsSystem = new PhysicsSystem(this);
    this.playerSystem = new PlayerSystem(this, this.selectedSprite);
    this.gameStateManager = new GameStateManager(
      this,
      this.networkSystem,
      this.isOffline
    );
  }

  private handleRestartLogic(data: any) {
    // Store original join parameters for restart functionality
    if (data.roomData && !this.isOffline) {
      this.gameStateManager.storeOriginalJoinParameters(
        data.originalRoomName || "Winterwald",
        data.originalUsername || "Player"
      );
    }

    // Check if this is a restart that should rejoin the room
    if (this.gameStateManager.shouldAutoRejoin()) {
      this.events.once("create", () => {
        setTimeout(() => {
          this.gameStateManager.autoRejoinAfterRestart();
        }, 200);
      });
    }
  }

  preload() {
    this.assetLoader.loadAllAssets();
  }

  create() {
    const networkManager = this.registry.get("networkManager");

    // Create animations after assets are loaded
    this.assetLoader.createFireballAnimations();
    this.assetLoader.createAdventurerAnimations();
    this.assetLoader.createSlimeAnimations();

    // Initialize systems in dependency order
    this.createGameSystems(networkManager);
    this.setupPhysicsCollisions();
    this.setupNetworking(networkManager);

    // Start UI scene
    this.scene.launch("UIScene");

    // Start background music
    this.startBackgroundMusic();

    // Listen for audio toggle events from UI
    this.sound.on("mute", this.handleAudioMute, this);
    this.sound.on("unmute", this.handleAudioUnmute, this);

    // Listen for victory cheat from UI
    this.game.events.on(
      "victory-cheat-triggered",
      this.handleVictoryCheat,
      this
    );

    // Listen for scene shutdown to clean up
    this.events.once("shutdown", this.cleanupAudio, this);

    // Initialize UI with current health, score, and level
    const player = this.playerSystem.getPlayer();
    const initialScore = player.getData("score") || 0;
    console.log(`🎯 GameScene: Emitting initial score: ${initialScore}`);
    this.game.events.emit("health-changed", player.getData("health"));
    this.game.events.emit("score-changed", initialScore);
    this.game.events.emit(
      "level-changed",
      this.gameStateManager.getCurrentLevel()
    );
  }

  private createGameSystems(_networkManager: NetworkManager) {
    // Create core game objects
    this.enemySystem.createEnemyGroup();
    this.physicsSystem.createProjectileGroup();

    // Set the current level in the world generator for enemy scaling
    this.worldGenerator.setLevel(this.gameStateManager.getCurrentLevel());
    this.worldGenerator.createWorld();

    const player = this.playerSystem.createPlayer();
    const controls = this.controlsSystem.createControls();

    // Set up player controls
    this.playerSystem.setControls(controls.cursors, controls.wasd);

    // CRITICAL: Connect ControlsSystem to PlayerSystem for mobile input
    this.playerSystem.setControlsSystem(this.controlsSystem);

    // Setup camera system
    this.cameraSystem.setupSideScrollingCamera(player);

    // Initialize game state manager
    this.gameStateManager.setRoomData(this.roomData);
  }

  private setupPhysicsCollisions() {
    const player = this.playerSystem.getPlayer();
    const platforms = this.worldGenerator.getPlatforms();
    const movingPlatforms = this.worldGenerator.getMovingPlatforms();
    const enemies = this.enemySystem.getEnemyGroup();
    const bossStones = this.enemySystem.getBossStones();

    this.physicsSystem.setupCollisions(
      player,
      platforms,
      enemies,
      (p: any, e: any) => this.handlePlayerEnemyHit(p, e),
      (pr: any, e: any) => this.handleProjectileEnemyHit(pr, e),
      (pr: any, pl: any) => this.handleProjectilePlatformHit(pr, pl)
    );

    // Add collisions for moving platforms
    if (movingPlatforms) {
      this.physics.add.collider(player, movingPlatforms);
    }

    // Add collisions for boss stones
    if (bossStones) {
      this.physics.add.overlap(player, bossStones, (p: any, stone: any) => {
        this.handlePlayerStoneHit(p, stone);
      });

      this.physics.add.collider(bossStones, platforms);
      this.physics.add.collider(bossStones, movingPlatforms);
    }
  }

  private setupNetworking(networkManager: NetworkManager) {
    if (!this.isOffline && networkManager) {
      this.networkSystem.initialize(networkManager, this.myPlayerId);

      // Add platform collisions for network players
      const platforms = this.worldGenerator.getPlatforms();
      this.networkSystem.addPlatformCollisionForNetworkPlayers(platforms);
    }
  }

  update() {
    this.handleInput();
    this.updateSystems();
  }

  private handleInput() {
    // Handle player movement
    this.playerSystem.handleMovement();

    // Handle shooting
    const isShootPressed = this.playerSystem.isShootPressed();
    if (isShootPressed && !this.inputState.get("shoot")) {
      this.inputState.set("shoot", true);
      this.shootProjectile();
    } else if (!isShootPressed) {
      this.inputState.set("shoot", false);
    }

    // Send network updates if online
    if (this.networkSystem.isOnline()) {
      const currentInputs = this.playerSystem.getCurrentInputs();
      this.networkSystem.sendInputUpdates(currentInputs);
      this.broadcastGameState();
    }
  }

  private updateSystems() {
    // Update enemy AI
    this.enemySystem.updateEnemies();

    // Update moving platforms
    this.worldGenerator.updateMovingPlatforms();

    // Update side-scrolling camera and world streaming
    this.cameraSystem.updateSideScrollingCamera();
    const player = this.playerSystem.getPlayer();
    this.worldGenerator.updateWorldStreaming(player.x);

    // Check for level completion (reached the end of the world)
    this.checkLevelCompletion(player);
  }

  private checkLevelCompletion(player: Phaser.Physics.Arcade.Sprite) {
    // Prevent multiple level completion triggers
    if (this.levelCompleted) return;

    const isBossLevel = this.gameStateManager.isBossLevel();

    if (isBossLevel) {
      // Boss levels: only complete when the boss is defeated
      if (this.enemySystem.isBossDefeated()) {
        this.levelCompleted = true;
        console.log("🏁 Boss defeated! Level complete!");
        this.gameStateManager.showVictory(
          () => this.nextLevel(),
          () => this.scene.start("MenuScene")
        );
      }
    } else {
      // Regular levels: reach the end of the world OR defeat all enemies
      const rightBoundary = this.worldGenerator.getRightBoundary();
      const completionZone = rightBoundary - 200; // 200px before the end

      // Check if player reached the end of the level OR defeated all enemies
      if (
        player.x >= completionZone ||
        this.enemySystem.countActiveEnemies() === 0
      ) {
        this.levelCompleted = true;
        const completionReason =
          player.x >= completionZone
            ? "reached the end"
            : "defeated all enemies";
        console.log(`🏁 Player ${completionReason}! Level complete!`);
        this.gameStateManager.showVictory(
          () => this.nextLevel(),
          () => this.scene.start("MenuScene")
        );
      }
    }
  }

  private shootProjectile() {
    const player = this.playerSystem.getPlayer();
    const direction = player.getData("facingRight") ? 1 : -1;
    this.physicsSystem.shootProjectile(player.x, player.y, direction);
  }

  private broadcastGameState() {
    const playerState = this.playerSystem.getPlayerState();
    const enemyStates = this.enemySystem.getLocalEnemyStates();
    const projectileStates = this.physicsSystem.getProjectileStates();

    const gameState = {
      player: {
        player_id: this.myPlayerId,
        ...playerState,
      },
      enemies: enemyStates,
      projectiles: projectileStates,
    };

    this.networkSystem.broadcastGameState(gameState);
  }

  // Collision handlers
  private handlePlayerEnemyHit(player: any, enemy: any) {
    // Check if enemy is dead - dead enemies cannot hurt the player
    const enemyId = enemy.getData("enemyId");
    const enemyStates = this.enemySystem.getEnemyStates();
    const currentState = enemyStates.get(enemyId);

    if (currentState === "dying") {
      return; // Dead enemies cannot hurt the player
    }

    const health = this.playerSystem.takeDamage(25);

    // Play enemy attack animation
    this.enemySystem.enemyHitPlayer(enemy);

    // Emit health change event for UI update
    this.game.events.emit("health-changed", health);

    // Apply knockback
    const direction = player.x < enemy.x ? -1 : 1;
    this.playerSystem.applyKnockback(direction);

    if (health <= 0) {
      this.gameStateManager.showGameOver(() => this.restart());
    }
  }

  private handleProjectileEnemyHit(projectile: any, enemy: any) {
    projectile.destroy();

    const result = this.enemySystem.hitEnemy(enemy, 25);

    if (result.destroyed) {
      // Add score to player
      const newScore = this.playerSystem.addScore(10);
      console.log(`🎯 GameScene: Enemy defeated! New score: ${newScore}`);

      // Emit score changed event for UI update
      this.game.events.emit("score-changed", newScore);

      // Check if all enemies defeated
      if (this.enemySystem.countActiveEnemies() === 0) {
        this.gameStateManager.showVictory(
          () => this.nextLevel(),
          () => this.scene.start("MenuScene")
        );
      }
    }
  }

  private handleProjectilePlatformHit(projectile: any, _platform: any) {
    projectile.destroy();
  }

  private handlePlayerStoneHit(player: any, stone: any) {
    stone.destroy();

    const health = this.playerSystem.takeDamage(15); // Less damage than enemy contact
    console.log(`🪨 Player hit by boss stone! Health: ${health}`);

    // Emit health change event for UI update
    this.game.events.emit("health-changed", health);

    // Apply knockback from stone impact
    const direction = player.x < stone.x ? -1 : 1;
    this.playerSystem.applyKnockback(direction * 0.5); // Lighter knockback than enemy

    if (health <= 0) {
      this.gameStateManager.showGameOver(() => this.restart());
    }
  }

  private startBackgroundMusic() {
    // Check if audio is enabled in settings
    const audioEnabled = localStorage.getItem("tannenbaum_audio");
    const shouldPlayAudio = audioEnabled !== "disabled";

    if (shouldPlayAudio && !this.backgroundMusic) {
      this.backgroundMusic = this.sound.add("background_music", {
        volume: 0.3, // Set volume to 30%
        loop: true, // Loop the music continuously
      });

      // Check if sound system is not muted globally
      if (!this.sound.mute) {
        this.backgroundMusic.play();
        console.log("🎵 Background music started");
      }
    }
  }

  private handleAudioMute() {
    if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
      this.backgroundMusic.pause();
      console.log("🔇 Background music paused (audio muted)");
    }
  }

  private handleAudioUnmute() {
    if (this.backgroundMusic && !this.backgroundMusic.isPlaying) {
      this.backgroundMusic.resume();
      console.log("🔊 Background music resumed (audio unmuted)");
    }
  }

  private handleVictoryCheat() {
    // Prevent multiple cheat activations if level is already completed
    if (this.levelCompleted) {
      console.log("🚫 Victory cheat ignored - level already completed");
      return;
    }

    console.log("🎉 Victory cheat handler called - triggering victory!");

    // Show boss collision box debug display
    this.enemySystem.showBossCollisionBox();

    // Set level as completed to prevent normal completion logic
    this.levelCompleted = true;

    // Trigger the victory through GameStateManager
    this.gameStateManager.triggerVictoryCheat();
  }

  // Audio control methods for victory and background music
  playVictoryMusic() {
    // Check if audio is enabled in settings
    const audioEnabled = localStorage.getItem("tannenbaum_audio");
    const shouldPlayAudio = audioEnabled !== "disabled";

    if (!shouldPlayAudio) {
      console.log("🔇 Victory music disabled by user settings");
      return;
    }

    // Stop background music if playing
    if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
      this.backgroundMusic.stop();
      console.log("🎵 Background music stopped for victory");
    }

    // Play victory music
    if (!this.victoryMusic) {
      this.victoryMusic = this.sound.add("victory_music", {
        volume: 0.4, // Slightly louder than background music for celebration
        loop: false, // Don't loop victory music
      });
    }

    // Check if sound system is not muted globally
    if (!this.sound.mute) {
      this.victoryMusic.play();
      console.log("🎉 Victory music started!");
    }
  }

  restoreBackgroundMusic() {
    // Stop victory music if playing
    if (this.victoryMusic && this.victoryMusic.isPlaying) {
      this.victoryMusic.stop();
      console.log("🎵 Victory music stopped");
    }

    // Restart background music
    this.startBackgroundMusic();
    console.log("🎵 Background music restored");
  }

  private restart() {
    // Stop background music on restart
    if (this.backgroundMusic) {
      this.backgroundMusic.stop();
      this.backgroundMusic = null;
    }

    // Restart logic is handled by GameStateManager
    console.log("🔄 Game restart initiated");
  }

  private nextLevel() {
    // Next level logic is handled by GameStateManager
    console.log("🎮 Next level initiated");
  }

  private cleanupAudio() {
    // Clean up background music
    if (this.backgroundMusic) {
      this.backgroundMusic.stop();
      this.backgroundMusic = null;
    }

    // Clean up victory music
    if (this.victoryMusic) {
      this.victoryMusic.stop();
      this.victoryMusic = null;
    }

    // Remove audio event listeners
    this.sound.off("mute", this.handleAudioMute, this);
    this.sound.off("unmute", this.handleAudioUnmute, this);

    // Remove victory cheat event listener
    this.game.events.off(
      "victory-cheat-triggered",
      this.handleVictoryCheat,
      this
    );
  }
}
