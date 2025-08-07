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
import { WorldSynchronizer } from "../systems/WorldSynchronizer";

export class GameSceneRefactored extends Phaser.Scene {
  // Core systems
  private assetLoader!: AssetLoader;
  private playerSystem!: PlayerSystem;
  private enemySystem!: EnemySystem;
  private worldGenerator!: WorldGenerator;
  private worldSynchronizer!: WorldSynchronizer;
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

  // Loading screen for online mode
  private loadingScreen: Phaser.GameObjects.Container | null = null;
  private loadingTimeout: number | null = null;

  // Network enemy collision setup function
  private setupNetworkEnemyCollisions: (() => void) | null = null;

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

    // Store flag for later processing after networking is set up
    if (data.roomJoined && this.roomData) {
      this.registry.set("needsReadyForWorld", true);
      this.registry.set("roomAlreadyJoined", true);
    }

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
    this.worldSynchronizer = new WorldSynchronizer(this, this.enemySystem);
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
    if (data.roomName && data.username) {
      this.gameStateManager.storeOriginalJoinParameters(
        data.roomName,
        data.username
      );
    }

    // Check if this is a restart that should rejoin the room
    if (this.gameStateManager.shouldAutoRejoin()) {
      console.log("🔄 Auto-rejoin detected, will attempt to rejoin room");
    }
  }

  preload() {
    this.assetLoader.loadAllAssets();
  }

  create() {
    console.log("🎮 GameScene: Creating game world...");

    // Create animations after assets are loaded
    this.assetLoader.createAllAnimations();

    // Show loading screen for online mode
    if (!this.isOffline) {
      this.showLoadingScreen();
    }

    // Set up networking FIRST if online (before creating game systems)
    if (!this.isOffline) {
      this.setupNetworking();
    }

    // Create game systems
    this.createGameSystems();

    // Physics collisions are handled by setupSystemsForWorld() for offline mode
    // and by the world state callback for online mode

    // Start background music
    this.startBackgroundMusic();

    // Set up audio controls
    this.handleAudioMute();
    this.handleAudioUnmute();

    // Set up victory cheat
    this.handleVictoryCheat();

    console.log("🎮 GameScene: Game world creation complete");
  }

  private createGameSystems(_networkManager?: NetworkManager) {
    // Create world based on mode
    let platforms: Phaser.Physics.Arcade.StaticGroup;

    if (this.isOffline) {
      // Offline mode: Use WorldGenerator for local world generation
      console.log("🌍 Creating offline world with WorldGenerator");
      
      // Initialize enemy system before world generation (needed for enemy creation)
      this.enemySystem.createEnemyGroup();
      
      this.worldGenerator.setLevel(this.gameStateManager.getCurrentLevel());
      platforms = this.worldGenerator.createWorld();

      // Set up systems for offline mode
      this.setupSystemsForWorld(platforms);
    } else {
      // Online mode: Use WorldSynchronizer for server-synchronized world
      console.log("🌍 Creating online world with WorldSynchronizer");

      // For online mode, we don't create the world immediately
      // We wait for the server to send the world state automatically when joining a room
      // World state callback was already set up in setupNetworking()
      console.log("🌍 Waiting for server world state (sent automatically on room join)...");
      return; // Exit early, world will be created when server state arrives
    }
  }

  private setupSystemsForWorld(platforms: Phaser.Physics.Arcade.StaticGroup) {
    // Ensure physics system is ready
    if (!this.physics || !this.physics.world) {
      console.warn("⚠️ Physics system not ready, deferring setup");
      this.time.delayedCall(100, () => this.setupSystemsForWorld(platforms));
      return;
    }

    // Create core game objects
    this.enemySystem.createEnemyGroup();
    this.physicsSystem.createProjectileGroup();

    // Set up player system FIRST
    const player = this.playerSystem.createPlayer();
    const controls = this.controlsSystem.createControls();
    this.playerSystem.setControls(controls.cursors, controls.wasd);
    this.playerSystem.setControlsSystem(this.controlsSystem);

    // Set up physics system (now that player exists)
    this.physicsSystem.setupCollisions(
      player,
      platforms,
      this.enemySystem.getEnemyGroup(),
      this.handlePlayerEnemyHit.bind(this),
      this.handleProjectileEnemyHit.bind(this),
      this.handleProjectilePlatformHit.bind(this)
    );

    // Set up moving platform collisions (for offline mode)
    if (this.isOffline) {
      this.setupMovingPlatformCollisions(player);
    }

    // Set up enemy system
    this.enemySystem.setPlayerReference(player);
    this.enemySystem.setPlatformsReference(platforms);

    // Set up camera system
    this.cameraSystem.setupSideScrollingCamera(player);

    // Set up network entity collisions (for online mode)
    if (!this.isOffline) {
      this.networkSystem.addPlatformCollisionForNetworkPlayers(platforms);
      
      // Set up enemy collisions when enemies are created
      // This will be called each time enemies are updated
      this.setupNetworkEnemyCollisions = () => {
        this.networkSystem.addPlatformCollisionForNetworkEnemies(platforms);
        this.setupNetworkEnemyPlayerCollisions();
      };
    }

    // Set up additional physics collisions
    this.setupAdditionalPhysicsCollisions(platforms);
  }

  private setupAdditionalPhysicsCollisions(
    platforms: Phaser.Physics.Arcade.StaticGroup
  ) {
    // Ensure physics system is ready
    if (!this.physics || !this.physics.add) {
      console.warn("⚠️ Physics system not ready for additional collisions, deferring setup");
      this.time.delayedCall(100, () => this.setupAdditionalPhysicsCollisions(platforms));
      return;
    }

    // Player-enemy collisions
    this.physics.add.overlap(
      this.playerSystem.getPlayer(),
      this.enemySystem.getEnemyGroup(),
      this.handlePlayerEnemyHit.bind(this),
      undefined,
      this
    );

    // Projectile-enemy collisions
    this.physics.add.overlap(
      this.physicsSystem.getProjectileGroup(),
      this.enemySystem.getEnemyGroup(),
      this.handleProjectileEnemyHit.bind(this),
      undefined,
      this
    );

    // Projectile-platform collisions
    this.physics.add.collider(
      this.physicsSystem.getProjectileGroup(),
      platforms,
      this.handleProjectilePlatformHit.bind(this),
      undefined,
      this
    );

    // Player-stone collisions (for boss attacks)
    this.physics.add.overlap(
      this.playerSystem.getPlayer(),
      this.enemySystem.getBossStones(),
      this.handlePlayerStoneHit.bind(this),
      undefined,
      this
    );
  }

  private setupNetworkEnemyPlayerCollisions() {
    if (!this.physics || !this.physics.add) return;

    // Set up collisions between player and network enemies
    const networkEnemies = this.networkSystem.getNetworkEnemies();
    const player = this.playerSystem.getPlayer();
    
    if (player && networkEnemies.size > 0) {
      for (const [_enemyId, enemySprite] of networkEnemies) {
        this.physics.add.overlap(
          player,
          enemySprite,
          this.handlePlayerEnemyHit.bind(this),
          undefined,
          this
        );
      }
    }
  }

  private setupMovingPlatformCollisions(player: Phaser.Physics.Arcade.Sprite) {
    if (!this.physics || !this.physics.add) return;

    const movingPlatforms = this.worldGenerator.getMovingPlatforms();
    if (movingPlatforms) {
      // Player-moving platform collisions
      this.physics.add.collider(player, movingPlatforms);

      // Enemy-moving platform collisions
      this.physics.add.collider(this.enemySystem.getEnemyGroup(), movingPlatforms);

      // Projectile-moving platform collisions
      this.physics.add.collider(
        this.physicsSystem.getProjectileGroup(),
        movingPlatforms,
        this.handleProjectilePlatformHit.bind(this),
        undefined,
        this
      );

      console.log("🔧 Moving platform collisions set up");
    }
  }

  private setupPhysicsCollisions() {
    // For online mode, physics collisions will be set up when the world is created
    // after receiving the server world state
    if (!this.isOffline) {
      console.log("🌍 Physics collisions will be set up after world creation");
      return;
    }

    // Player-enemy collisions
    (this.scene as any).physics.add.overlap(
      this.playerSystem.getPlayer(),
      this.enemySystem.getEnemyGroup(),
      this.handlePlayerEnemyHit.bind(this),
      undefined,
      this
    );

    // Projectile-enemy collisions
    (this.scene as any).physics.add.overlap(
      this.physicsSystem.getProjectileGroup(),
      this.enemySystem.getEnemyGroup(),
      this.handleProjectileEnemyHit.bind(this),
      undefined,
      this
    );

    // Projectile-platform collisions
    (this.scene as any).physics.add.collider(
      this.physicsSystem.getProjectileGroup(),
      this.worldGenerator.getPlatforms(),
      this.handleProjectilePlatformHit.bind(this),
      undefined,
      this
    );

    // Player-stone collisions (for boss attacks)
    (this.scene as any).physics.add.overlap(
      this.playerSystem.getPlayer(),
      this.enemySystem.getBossStones(),
      this.handlePlayerStoneHit.bind(this),
      undefined,
      this
    );
  }

  private setupNetworking(networkManager?: NetworkManager) {
    const manager = networkManager || this.registry.get("networkManager");

    if (manager) {
      // Pass room data if already joined
      const roomData = this.registry.get("roomAlreadyJoined") ? this.roomData : null;
      this.networkSystem.initialize(manager, this.myPlayerId, roomData);
      
      // Set up world state callback immediately after NetworkSystem initialization
      this.networkSystem.setWorldStateCallback((worldState) => {
        console.log("🌍 GameScene: World state callback triggered", {
          world_seed: worldState.world_seed,
          platforms_count: worldState.platforms?.length || 0,
        });
        this.worldSynchronizer.setServerWorldState(worldState);

        // Defer world setup until physics is ready
        this.setupWorldWhenReady(worldState);
      });

      // Set up enemy collision callback
      this.networkSystem.setEnemiesUpdatedCallback(() => {
        if (this.setupNetworkEnemyCollisions) {
          this.setupNetworkEnemyCollisions();
        }
      });

      // Check if we need to send ready_for_world acknowledgment
      if (this.registry.get("needsReadyForWorld")) {
        console.log("🏠 GameScene: Room already joined by MenuScene, sending ready_for_world acknowledgment");
        this.sendReadyForWorldFromGameScene();
        this.registry.set("needsReadyForWorld", false);
      }
    } else {
      console.warn("⚠️ No network manager available for online mode");
    }
  }

  update() {
    this.handleInput();
    this.updateSystems();
  }

  private handleInput() {
    // For online mode, don't handle input until world and player are created
    if (!this.isOffline && !this.worldSynchronizer.isWorldGenerated()) {
      return;
    }

    const currentInputs = this.controlsSystem.getCurrentInputs();

    // Update local player
    this.playerSystem.handleMovement();

    // Send input updates to server (online mode)
    if (!this.isOffline && this.networkSystem.isOnline()) {
      this.networkSystem.sendInputUpdates(currentInputs);
    }

    // Handle shooting
    if (currentInputs.shoot && !this.inputState.get("shoot")) {
      this.shootProjectile();
    }

    // Update input state
    this.inputState.clear();
    Object.entries(currentInputs).forEach(([key, value]) => {
      this.inputState.set(key, value);
    });
  }

  private updateSystems() {
    // For online mode, don't update systems until world is created
    if (!this.isOffline && !this.worldSynchronizer.isWorldGenerated()) {
      return;
    }

    // Update enemy AI
    this.enemySystem.updateEnemies();

    // Update moving platforms
    if (this.isOffline) {
      this.worldGenerator.updateMovingPlatforms();
    } else {
      this.worldSynchronizer.updateMovingPlatforms();
    }

    // Update camera
    this.cameraSystem.updateSideScrollingCamera();

    // Update network projectiles (online mode)
    if (!this.isOffline && this.networkSystem.isOnline()) {
      // Get projectile states from physics system for network sync
      const projectileStates = this.physicsSystem.getProjectileStates();
      this.networkSystem.updateNetworkProjectiles(
        projectileStates,
        this.worldSynchronizer.getPlatforms(),
        this.enemySystem.getEnemyGroup()
      );
    }

    // Broadcast game state (online mode)
    if (!this.isOffline && this.networkSystem.isOnline()) {
      this.broadcastGameState();
    }

    // Check level completion
    this.checkLevelCompletion(this.playerSystem.getPlayer());
  }

  private checkLevelCompletion(_player: Phaser.Physics.Arcade.Sprite) {
    if (this.levelCompleted) return;

    // Check if all enemies are defeated
    if (this.enemySystem.countActiveEnemies() === 0) {
      this.levelCompleted = true;
      console.log("🎉 Level completed!");

      this.gameStateManager.showVictory(
        () => this.nextLevel(),
        () => this.scene.start("MenuScene")
      );
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

    if (shouldPlayAudio) {
      try {
        this.backgroundMusic = this.sound.add("background_music", {
          volume: 0.3,
          loop: true,
        });
        this.backgroundMusic.play();
        console.log("🎵 Background music started");
      } catch (error) {
        console.warn("Could not start background music:", error);
      }
    }
  }

  private handleAudioMute() {
    this.input.keyboard?.on("keydown-M", () => {
      if (this.backgroundMusic) {
        this.backgroundMusic.stop();
        console.log("🔇 Audio muted");
      }
    });
  }

  private handleAudioUnmute() {
    this.input.keyboard?.on("keydown-U", () => {
      if (this.backgroundMusic && !this.backgroundMusic.isPlaying) {
        this.backgroundMusic.play();
        console.log("🔊 Audio unmuted");
      }
    });
  }

  private handleVictoryCheat() {
    this.input.keyboard?.on("keydown-V", () => {
      console.log("🎉 Victory cheat activated!");
      this.gameStateManager.triggerVictoryCheat();
    });
  }

  playVictoryMusic() {
    // Stop background music
    if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
      this.backgroundMusic.stop();
    }

    // Play victory music
    try {
      this.victoryMusic = this.sound.add("victory_music", {
        volume: 0.4,
        loop: false,
      });
      this.victoryMusic.play();
      console.log("🎵 Victory music started");
    } catch (error) {
      console.warn("Could not play victory music:", error);
    }
  }

  restoreBackgroundMusic() {
    // Stop victory music if playing
    if (this.victoryMusic && this.victoryMusic.isPlaying) {
      this.victoryMusic.stop();
    }

    // Restart background music
    if (this.backgroundMusic && !this.backgroundMusic.isPlaying) {
      this.backgroundMusic.play();
      console.log("🎵 Background music restored");
    }
  }

  private restart() {
    console.log("🔄 Restarting game...");
    this.cleanupAudio();
    this.scene.restart();
  }

  private nextLevel() {
    console.log("🎮 Moving to next level...");
    this.cleanupAudio();
    this.gameStateManager.nextLevel();
    this.scene.restart({ level: this.gameStateManager.getCurrentLevel() });
  }

  private cleanupAudio() {
    if (this.backgroundMusic) {
      this.backgroundMusic.destroy();
    }
    if (this.victoryMusic) {
      this.victoryMusic.destroy();
    }
  }

  private cleanupLoadingScreen() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
    if (this.loadingScreen) {
      this.loadingScreen.destroy();
      this.loadingScreen = null;
    }
  }

  shutdown() {
    // Clean up resources when scene is shut down
    this.cleanupAudio();
    this.cleanupLoadingScreen();
  }

  private createLoadingScreen() {
    // Create a container for the loading screen
    this.loadingScreen = this.add.container(0, 0);

    // Create a semi-transparent background
    const background = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.8
    );

    // Create loading text with better styling
    const loadingText = this.add
      .text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 - 60,
        "Welt wird mit dem Server synchronisiert...",
        {
          fontSize: "28px",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 2,
        }
      )
      .setOrigin(0.5);

    // Create a subtitle
    const subtitleText = this.add
      .text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 - 20,
        "Bitte warten...",
        {
          fontSize: "18px",
          color: "#cccccc",
          fontFamily: "Arial, sans-serif",
        }
      )
      .setOrigin(0.5);

    // Create a loading spinner (rotating dots)
    const spinnerContainer = this.add.container(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 40
    );

    // Create three dots for the spinner
    const dots = [];
    for (let i = 0; i < 3; i++) {
      const dot = this.add.circle(i * 30 - 30, 0, 8, 0xffffff);
      dots.push(dot);
      spinnerContainer.add(dot);
    }

    // Add pulsing animation to dots
    this.tweens.add({
      targets: dots,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 600,
      yoyo: true,
      repeat: -1,
      stagger: 200,
      ease: "Sine.easeInOut",
    });

    // Add all elements to the container
    this.loadingScreen.add([
      background,
      loadingText,
      subtitleText,
      spinnerContainer,
    ]);

    // Make sure the loading screen is on top
    this.loadingScreen.setDepth(1000);
  }

  private showLoadingScreen() {
    if (!this.loadingScreen) {
      this.createLoadingScreen();
    }
    this.loadingScreen?.setVisible(true);

    // Set a timeout in case the server doesn't respond
    this.loadingTimeout = window.setTimeout(() => {
      console.warn("⚠️ Loading timeout reached - server may not be responding");
      this.showLoadingError();
    }, 10000); // 10 second timeout
  }

  private hideLoadingScreen() {
    if (this.loadingScreen) {
      this.loadingScreen.setVisible(false);
    }

    // Clear timeout
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }

  private showLoadingError() {
    if (!this.loadingScreen) return;

    // Clear existing content
    this.loadingScreen.removeAll();

    // Create error background
    const background = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.8
    );

    // Create error text
    const errorText = this.add
      .text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 - 30,
        "Verbindung zum Server fehlgeschlagen",
        {
          fontSize: "24px",
          color: "#ff6b6b",
          fontFamily: "Arial, sans-serif",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 2,
        }
      )
      .setOrigin(0.5);

    const retryText = this.add
      .text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 + 10,
        "Bitte versuchen Sie es erneut",
        {
          fontSize: "18px",
          color: "#cccccc",
          fontFamily: "Arial, sans-serif",
        }
      )
      .setOrigin(0.5);

    // Add retry button
    const retryButton = this.add
      .text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 + 50,
        "Erneut versuchen",
        {
          fontSize: "20px",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#4a90e2",
          padding: { x: 20, y: 10 },
        }
      )
      .setOrigin(0.5);

    // Make button interactive
    retryButton.setInteractive({ useHandCursor: true });
    retryButton.on("pointerdown", () => {
      console.log("🔄 Retrying connection...");
      this.restart();
    });

    // Add hover effect
    retryButton.on("pointerover", () => {
      retryButton.setStyle({ backgroundColor: "#357abd" });
    });
    retryButton.on("pointerout", () => {
      retryButton.setStyle({ backgroundColor: "#4a90e2" });
    });

    this.loadingScreen.add([background, errorText, retryText, retryButton]);
  }

  private setupWorldWhenReady(worldState: any) {
    // Check if physics is ready
    if (!this.physics || !this.physics.world || !this.physics.add) {
      console.log("⏳ Physics not ready, waiting 100ms...");
      this.time.delayedCall(100, () => this.setupWorldWhenReady(worldState));
      return;
    }

    console.log("🌍 Physics ready, setting up synchronized world");
    
    // Create world from server state
    const syncedPlatforms = this.worldSynchronizer.createWorld();

    // Set up systems with synchronized world
    this.setupSystemsForWorld(syncedPlatforms);

    // Hide loading screen now that world is synchronized
    this.hideLoadingScreen();

    console.log("🌍 Synchronized world setup complete");
  }

  private sendReadyForWorldFromGameScene() {
    const networkManager = this.registry.get("networkManager");
    if (!networkManager || !this.roomData || !this.myPlayerId) {
      console.error("🌍 GameScene: Cannot send ready_for_world - missing required data");
      return;
    }

    console.log("🌍 GameScene: Sending ready_for_world acknowledgment");
    networkManager.sendMessage({
      type: "ready_for_world",
      timestamp: Date.now(),
      data: {
        room_id: this.roomData.room_id,
        player_id: this.myPlayerId,
      },
    });
  }
}
