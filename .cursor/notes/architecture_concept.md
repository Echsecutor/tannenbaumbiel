# Tannenbaumbiel - System Architektur

## Überblick

Browser-basiertes 2D Multiplayer Platformer Game mit Python Backend und JavaScript Frontend.

## High-Level Architektur

```
[Mobile Browser Client] ←→ WebSocket ←→ [Python Game Server] ←→ [PostgreSQL Database]
```

## Frontend Architektur

### Technologie-Stack

- **Game Engine**: Phaser 3 (empfohlen) oder Pixi.js
- **Build Tool**: Vite oder Webpack
- **Package Manager**: npm/yarn
- **Sprache**: TypeScript für Type Safety

### Komponenten

```
Frontend/
├── src/
│   ├── game/
│   │   ├── scenes/           # Game Scenes (Menu, World, UI)
│   │   ├── entities/         # Spieler, Gegner, Projektile
│   │   ├── systems/          # Input, Physics, Rendering
│   │   └── assets/           # Sprites, Audio, Daten
│   ├── network/
│   │   ├── websocket.ts      # WebSocket Client
│   │   └── protocol.ts       # Message Protocol
│   └── utils/
├── assets/
│   ├── sprites/              # PNG/SVG Grafiken
│   ├── audio/                # Audio Files
│   └── data/                 # JSON Config Files
└── dist/                     # Build Output
```

### Client-Side Game Loop

1. **Input Processing**: Touch/Keyboard Events → Input Commands
2. **State Prediction**: Lokale Bewegungsvorhersage für responsive Steuerung
3. **Network Sync**: Regelmäßige Synchronisation mit Server
4. **Rendering**: 60fps Game Loop mit interpolation

## Backend Architektur

### Technologie-Stack

- **Framework**: FastAPI mit WebSocket Support
- **ASGI Server**: Uvicorn (Production)
- **Database**: PostgreSQL (Sessions, Spieler, Statistiken, Welten)
- **ORM**: SQLAlchemy mit Alembic Migrations
- **Containerization**: Docker

### Komponenten

```
Backend/
├── app/
│   ├── api/
│   │   ├── websocket.py      # WebSocket Endpoints
│   │   └── rest.py           # REST API (Auth, Stats)
│   ├── game/
│   │   ├── world.py          # Spielwelt Logik
│   │   ├── entities/         # Server-Side Game Objects
│   │   ├── physics.py        # Kollision, Movement
│   │   └── events.py         # Game Events System
│   ├── network/
│   │   ├── protocol.py       # Message Protocol
│   │   ├── session.py        # Session Management
│   │   └── rooms.py          # Multiplayer Rooms
│   ├── database/
│   │   ├── models.py         # SQLAlchemy Models
│   │   └── repository.py     # Data Access Layer
│   └── utils/
├── tests/
└── docker/
```

### Server Game Loop

1. **Input Processing**: WebSocket Messages von Clients
2. **Game Simulation**: Authoritative Game State Update (60fps)
3. **State Broadcast**: Delta Updates an alle Clients
4. **Persistence**: Wichtige Events in Database speichern

## Kommunikations-Protokoll

### WebSocket Message Format

```typescript
interface GameMessage {
  type: 'input' | 'state' | 'event' | 'error';
  timestamp: number;
  data: any;
}

// Beispiel Input Message
{
  type: 'input',
  timestamp: 1703123456789,
  data: {
    action: 'move',
    direction: 'right',
    playerId: 'uuid-123'
  }
}

// Beispiel State Update
{
  type: 'state',
  timestamp: 1703123456789,
  data: {
    players: [{id: 'uuid-123', x: 100, y: 200, ...}],
    enemies: [{id: 'enemy-1', x: 300, y: 150, ...}],
    projectiles: [...]
  }
}
```

### Message Types

- **Input**: Spieler-Aktionen (move, jump, shoot)
- **State**: Game State Updates (Positionen, Health, etc.)
- **Event**: Special Events (player_joined, enemy_defeated)
- **Error**: Fehlerbehandlung

## Multiplayer Design

### Room System

- **Room Creation**: Spieler erstellt Welt mit Name
- **Room Joining**: Andere Spieler joinen über Weltname
- **Max Players**: 2-4 Spieler pro Welt (konfigurierbar)
- **Room Lifecycle**: Auto-cleanup nach inaktivity

### State Synchronization

- **Authority**: Server hat authoritative Game State
- **Client Prediction**: Client simuliert Input für Responsiveness
- **Lag Compensation**: Server-side Rollback für fair Play
- **Delta Updates**: Nur Änderungen übertragen für Effizienz

## Deployment Architektur

### Development

```
Local Machine:
├── Frontend Dev Server (Vite) :3000
├── Backend Dev Server (FastAPI) :8000
└── PostgreSQL :5432
```

### Production

```
Cloud Infrastructure:
├── Frontend: Static Files (CDN)
├── Backend: Container Service (Docker)
├── Database: Managed PostgreSQL
└── Load Balancer: WebSocket Sticky Sessions
```

## Performance Considerations

### Frontend

- **Asset Loading**: Progressive loading, Texture Atlases
- **Memory Management**: Object Pooling für Entities
- **Rendering**: Sprite Batching, Culling
- **Network**: Message Batching, Delta Compression

### Backend

- **Concurrency**: Async/await für WebSocket Handling
- **Scaling**: Horizontal Scaling mit Shared PostgreSQL
- **Database**: Connection Pooling, Read Replicas
- **Caching**: PostgreSQL Query Optimization, Indexes

## Security

### Client-Server Validation

- Server validiert alle Client Inputs
- Rate Limiting für Actions/Messages
- Cheat Detection (impossible movements, etc.)

### Authentication

- JWT Token für Session Management
- Optional: OAuth Integration (Google, Discord)
- Anonymous Play möglich

## Monitoring & Analytics

- Real-time Performance Metrics
- Player Behavior Analytics
- Error Tracking und Logging
- Game Balance Datensammlung
