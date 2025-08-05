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
    // Left movement button
    const leftArea = this.scene.add.rectangle(
      100,
      this.scene.scale.height - 100,
      150,
      150,
      0x000000,
      0.3
    );
    leftArea.setInteractive();
    leftArea.setScrollFactor(0); // Stay fixed to camera
    leftArea.on("pointerdown", () => this.setMobileInput("left", true));
    leftArea.on("pointerup", () => this.setMobileInput("left", false));
    leftArea.on("pointerout", () => this.setMobileInput("left", false));

    // Right movement button
    const rightArea = this.scene.add.rectangle(
      250,
      this.scene.scale.height - 100,
      150,
      150,
      0x000000,
      0.3
    );
    rightArea.setInteractive();
    rightArea.setScrollFactor(0);
    rightArea.on("pointerdown", () => this.setMobileInput("right", true));
    rightArea.on("pointerup", () => this.setMobileInput("right", false));
    rightArea.on("pointerout", () => this.setMobileInput("right", false));

    // Jump button
    const jumpArea = this.scene.add.rectangle(
      this.scene.scale.width - 150,
      this.scene.scale.height - 100,
      150,
      150,
      0x000000,
      0.3
    );
    jumpArea.setInteractive();
    jumpArea.setScrollFactor(0);
    jumpArea.on("pointerdown", () => this.setMobileInput("jump", true));
    jumpArea.on("pointerup", () => this.setMobileInput("jump", false));

    // Shoot button
    const shootArea = this.scene.add.rectangle(
      this.scene.scale.width - 300,
      this.scene.scale.height - 100,
      150,
      150,
      0x000000,
      0.3
    );
    shootArea.setInteractive();
    shootArea.setScrollFactor(0);
    shootArea.on("pointerdown", () => this.setMobileInput("shoot", true));
    shootArea.on("pointerup", () => this.setMobileInput("shoot", false));

    // Add control labels
    this.scene.add
      .text(100, this.scene.scale.height - 100, "←", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.scene.add
      .text(250, this.scene.scale.height - 100, "→", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.scene.add
      .text(this.scene.scale.width - 150, this.scene.scale.height - 100, "↑", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.scene.add
      .text(this.scene.scale.width - 300, this.scene.scale.height - 100, "⚡", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  private setMobileInput(action: string, pressed: boolean) {
    if (action in this.mobileInput) {
      (this.mobileInput as any)[action] = pressed;
    }
  }

  getCurrentInputs() {
    return {
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

  // Get mobile input state for external systems
  getMobileInput() {
    return { ...this.mobileInput };
  }

  // Update mobile input externally (for integration with other systems)
  updateMobileInput(action: string, pressed: boolean) {
    this.setMobileInput(action, pressed);
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
}
