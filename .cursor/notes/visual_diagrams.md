# Visual Diagrams and Flowcharts

This file contains Mermaid diagram code for visualizing game systems and workflows.

## Boss Arena System Flow

Shows how boss levels work every 5th level with tree boss mechanics:

```mermaid
graph TD
    A["🎮 Level Starts"] --> B{"Level % 5 = 0?"}

    B -->|No| C["🌍 Regular Level<br/>- Procedural chunks<br/>- Scaled enemies<br/>- Reach end OR defeat all"]

    B -->|Yes| D["🏛️ Boss Arena<br/>- Special layout<br/>- Single Tree Boss<br/>- Moving platforms"]

    C --> E["🏁 Victory<br/>Continue to next level"]

    D --> F["🌲 Tree Boss Fight<br/>- Half screen height<br/>- 300 HP<br/>- Throws stone projectiles"]

    F --> G{"Boss defeated?"}
    G -->|No| H["💀 Take damage<br/>Dodge stones<br/>Climb platforms"]
    H --> F
    G -->|Yes| E

    E --> I["📈 Level +1<br/>Check for next boss"]
```

## Level Progression Fix Flow

Shows the corrected level advancement logic after fixing the double increment bug:

```mermaid
graph TD
    A["🎮 Player on Level 1"] --> B["🏁 Victory Condition Met"]

    B --> C["Victory Screen Shows:<br/>'Weiter zum Level 2'"]

    C --> D{"User clicks button?"}

    D -->|Yes| E["startNextLevel() called"]
    D -->|No| F["Wait for user action"]
    F --> D

    E --> G["nextLevel() increments:<br/>currentLevel = 1 → 2"]

    G --> H["Scene restarts with:<br/>level: 2"]

    H --> I["UI displays:<br/>'Level 2'"]

    I --> J["✅ Correct level progression"]

    style A fill:#3498db
    style C fill:#27ae60
    style I fill:#27ae60
    style J fill:#2ecc71
```

## Audio System Flow

Shows how background and victory music are managed:

```mermaid
graph TD
    A["🎮 Game Scene Starts"] --> B["🎵 Start Background Music"]

    B --> C{"Audio enabled in settings?"}
    C -->|No| D["🔇 Skip audio"]
    C -->|Yes| E["🎵 Play background music (loop)"]

    E --> F["🎮 Gameplay continues"]

    F --> G{"Victory achieved?"}
    G -->|No| F
    G -->|Yes| H["🎉 Stop background music"]

    H --> I["🎵 Play victory music (once)"]

    I --> J{"Next level or restart?"}
    J -->|Next Level| K["🔄 Restore background music"]
    J -->|Restart| L["🔄 Clean up all audio"]

    K --> B
    L --> A
```

## Game Architecture Overview

High-level system architecture with modular systems:

```mermaid
graph TB
    GS["GameSceneRefactored<br/>🎮 Main Game Scene"]

    GS --> AS["AssetLoader<br/>📦 Assets"]
    GS --> PS["PlayerSystem<br/>🏃 Player"]
    GS --> ES["EnemySystem<br/>👹 Enemies & Boss"]
    GS --> WG["WorldGenerator<br/>🌍 World & Platforms"]
    GS --> CS["CameraSystem<br/>📷 Camera"]
    GS --> CO["ControlsSystem<br/>🎮 Input"]
    GS --> PH["PhysicsSystem<br/>⚛️ Physics"]
    GS --> NS["NetworkSystem<br/>🌐 Multiplayer"]
    GS --> GM["GameStateManager<br/>🏆 Victory & Levels"]

    UI["UIScene<br/>🖥️ UI Overlay"]

    GS -.-> UI

    style GS fill:#3498db
    style UI fill:#e74c3c
```

## Usage

To render these diagrams:

1. Copy the Mermaid code from the code blocks
2. Use any Mermaid renderer (GitHub, VS Code extensions, online tools)
3. Or use the `create_diagram` tool in development conversations

## References

- Boss Arena System: Implemented in `WorldGenerator.ts` and `EnemySystem.ts`
- Level Progression: Managed by `GameStateManager.ts`
- Audio System: Implemented in `GameSceneRefactored.ts`
- Architecture: Modular system design across all game systems
