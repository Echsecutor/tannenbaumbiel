/**
 * ControlsSystem - Handles input management and touch controls
 */
import Phaser from "phaser";

export class ControlsSystem {
  private scene: Phaser.Scene;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private wasd!: any;

  // Mobile touch input state
  private mobileInput = {
    left: false,
    right: false,
    jump: false,
    shoot: false,
  };

  // Mobile control elements for show/hide functionality
  private mobileControls: (
    | Phaser.GameObjects.Rectangle
    | Phaser.GameObjects.Text
  )[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createControls() {
    // Keyboard controls
    this.cursors = this.scene.input.keyboard?.createCursorKeys()!;
    this.wasd = this.scene.input.keyboard?.addKeys("W,S,A,D,SPACE")!;

    // Touch controls for mobile
    this.createTouchControls();

    return { cursors: this.cursors, wasd: this.wasd };
  }

  private createTouchControls() {
    // High depth to ensure mobile buttons appear above all other UI elements
    const MOBILE_BUTTON_DEPTH = 1000;

    // Adjust positions to avoid conflicts with UIScene elements
    // Left movement button - moved right to avoid menu button conflict
    const leftArea = this.scene.add.rectangle(
      120,
      this.scene.scale.height - 120,
      120,
      120,
      0x000000,
      0.4
    );
    leftArea.setInteractive({
      useHandCursor: true,
      pixelPerfect: false,
      alphaTolerance: 1,
    });
    leftArea.setScrollFactor(0); // Stay fixed to camera
    leftArea.setDepth(MOBILE_BUTTON_DEPTH);
    leftArea.on("pointerdown", () => this.setMobileInput("left", true));
    leftArea.on("pointerup", () => this.setMobileInput("left", false));
    leftArea.on("pointerout", () => this.setMobileInput("left", false));

    // Right movement button
    const rightArea = this.scene.add.rectangle(
      260,
      this.scene.scale.height - 120,
      120,
      120,
      0x000000,
      0.4
    );
    rightArea.setInteractive({
      useHandCursor: true,
      pixelPerfect: false,
      alphaTolerance: 1,
    });
    rightArea.setScrollFactor(0);
    rightArea.setDepth(MOBILE_BUTTON_DEPTH);
    rightArea.on("pointerdown", () => this.setMobileInput("right", true));
    rightArea.on("pointerup", () => this.setMobileInput("right", false));
    rightArea.on("pointerout", () => this.setMobileInput("right", false));

    // Jump button - moved left to avoid audio button conflict
    const jumpArea = this.scene.add.rectangle(
      this.scene.scale.width - 120,
      this.scene.scale.height - 120,
      120,
      120,
      0x000000,
      0.4
    );
    jumpArea.setInteractive({
      useHandCursor: true,
      pixelPerfect: false,
      alphaTolerance: 1,
    });
    jumpArea.setScrollFactor(0);
    jumpArea.setDepth(MOBILE_BUTTON_DEPTH);
    jumpArea.on("pointerdown", () => this.setMobileInput("jump", true));
    jumpArea.on("pointerup", () => this.setMobileInput("jump", false));
    jumpArea.on("pointerout", () => this.setMobileInput("jump", false));

    // Shoot button - positioned to not conflict with other UI
    const shootArea = this.scene.add.rectangle(
      this.scene.scale.width - 260,
      this.scene.scale.height - 120,
      120,
      120,
      0x000000,
      0.4
    );
    shootArea.setInteractive({
      useHandCursor: true,
      pixelPerfect: false,
      alphaTolerance: 1,
    });
    shootArea.setScrollFactor(0);
    shootArea.setDepth(MOBILE_BUTTON_DEPTH);
    shootArea.on("pointerdown", () => this.setMobileInput("shoot", true));
    shootArea.on("pointerup", () => this.setMobileInput("shoot", false));
    shootArea.on("pointerout", () => this.setMobileInput("shoot", false));

    // Add visual feedback borders
    const borderStyle = { lineWidth: 2, strokeStyle: 0xffffff, alpha: 0.6 };

    leftArea.setStrokeStyle(
      borderStyle.lineWidth,
      borderStyle.strokeStyle,
      borderStyle.alpha
    );
    rightArea.setStrokeStyle(
      borderStyle.lineWidth,
      borderStyle.strokeStyle,
      borderStyle.alpha
    );
    jumpArea.setStrokeStyle(
      borderStyle.lineWidth,
      borderStyle.strokeStyle,
      borderStyle.alpha
    );
    shootArea.setStrokeStyle(
      borderStyle.lineWidth,
      borderStyle.strokeStyle,
      borderStyle.alpha
    );

    // Add control labels with higher depth
    const leftLabel = this.scene.add
      .text(120, this.scene.scale.height - 120, "←", {
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(MOBILE_BUTTON_DEPTH + 1);

    const rightLabel = this.scene.add
      .text(260, this.scene.scale.height - 120, "→", {
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(MOBILE_BUTTON_DEPTH + 1);

    const jumpLabel = this.scene.add
      .text(this.scene.scale.width - 120, this.scene.scale.height - 120, "↑", {
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(MOBILE_BUTTON_DEPTH + 1);

    const shootLabel = this.scene.add
      .text(this.scene.scale.width - 260, this.scene.scale.height - 120, "⚡", {
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(MOBILE_BUTTON_DEPTH + 1);

    // Store all mobile control elements for show/hide functionality
    this.mobileControls = [
      leftArea,
      rightArea,
      jumpArea,
      shootArea,
      leftLabel,
      rightLabel,
      jumpLabel,
      shootLabel,
    ];

    // Add mobile detection and show/hide controls accordingly
    this.adjustControlsForDevice();
  }

  private setMobileInput(action: string, pressed: boolean) {
    if (action in this.mobileInput) {
      (this.mobileInput as any)[action] = pressed;
    }
  }

  getCurrentInputs() {
    const inputs = {
      left:
        this.cursors?.left.isDown ||
        this.wasd?.A.isDown ||
        this.mobileInput.left,
      right:
        this.cursors?.right.isDown ||
        this.wasd?.D.isDown ||
        this.mobileInput.right,
      jump:
        this.cursors?.up.isDown || this.wasd?.W.isDown || this.mobileInput.jump,
      shoot:
        (this.scene.input.activePointer.isDown &&
          !this.scene.input.activePointer.wasTouch) ||
        this.wasd?.SPACE.isDown ||
        this.mobileInput.shoot,
    };

    return inputs;
  }

  isShootPressed(): boolean {
    return (
      (this.scene.input.activePointer.isDown &&
        !this.scene.input.activePointer.wasTouch) ||
      this.wasd.SPACE.isDown ||
      this.mobileInput.shoot
    );
  }

  // Reset mobile input to prevent stuck inputs
  resetMobileInput() {
    this.mobileInput.left = false;
    this.mobileInput.right = false;
    this.mobileInput.jump = false;
    this.mobileInput.shoot = false;
  }

  // Reset mobile jump to prevent continuous jumping
  resetMobileJump() {
    this.mobileInput.jump = false;
  }

  // Check if any input is currently active
  hasActiveInput(): boolean {
    return (
      this.cursors?.left.isDown ||
      this.cursors?.right.isDown ||
      this.cursors?.up.isDown ||
      this.cursors?.down.isDown ||
      this.wasd?.A.isDown ||
      this.wasd?.D.isDown ||
      this.wasd?.W.isDown ||
      this.wasd?.S.isDown ||
      this.wasd?.SPACE.isDown ||
      this.mobileInput.left ||
      this.mobileInput.right ||
      this.mobileInput.jump ||
      this.mobileInput.shoot
    );
  }

  // Disable all controls (useful for game over, pause, etc.)
  disableControls() {
    this.resetMobileInput();
    // Note: Keyboard controls are automatically handled by Phaser when scene is paused
  }

  // Detect device type and adjust controls visibility
  private adjustControlsForDevice() {
    const isMobile = this.isMobileDevice();

    if (!isMobile) {
      this.hideMobileControls();
    } else {
      this.showMobileControls();
    }
  }

  // Simple mobile device detection
  private isMobileDevice(): boolean {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    );
  }

  // Hide mobile controls (for desktop users)
  private hideMobileControls() {
    this.mobileControls.forEach((control) => {
      control.setVisible(false);
    });
  }

  // Show mobile controls (for mobile users)
  private showMobileControls() {
    this.mobileControls.forEach((control) => {
      control.setVisible(true);
    });
  }
}
