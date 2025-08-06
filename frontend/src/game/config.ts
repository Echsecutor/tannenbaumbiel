/**
 * Phaser Game Configuration
 */
import { Types } from "phaser";
import { GameSceneRefactored as GameScene } from "./scenes/GameSceneRefactored";
import { MenuScene } from "./scenes/MenuScene";
import { UIScene } from "./scenes/UIScene";

export const GameConfig: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: "#2c3e50",

  // Mobile optimizations for landscape orientation
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: "game-container",
    width: 1280,
    height: 720,
    min: {
      width: 480,
      height: 320,
    },
    max: {
      width: 2560,
      height: 1440,
    },
    // Enhanced scaling for different screen orientations
    expandParent: true,
    fullscreenTarget: "game-container",
  },

  // Physics configuration
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false, // Set to true for development
    },
  },

  // Input configuration
  input: {
    activePointers: 2, // Support for multi-touch
    keyboard: true,
    mouse: true,
    touch: true,
  },

  // Audio configuration
  audio: {
    disableWebAudio: false,
  },

  // DOM element support for embedded HTML forms
  dom: {
    createContainer: true,
  },

  // Scene configuration
  scene: [MenuScene, GameScene, UIScene],

  // Performance settings
  render: {
    antialias: false,
    pixelArt: true, // For pixel art graphics
    roundPixels: true,
    batchSize: 2000,
  },

  // Development settings
  banner: {
    hidePhaser: false,
    text: "#2c3e50",
    background: ["#ffffff", "#2c3e50", "#ffffff", "#2c3e50"],
  },
};
