# Repository Structure - Tannenbaumbiel

## Empfohlene Projektstruktur

```
tannenbaumbiel/
├── README.md
├── .gitignore
├── .cursor/
│   ├── notes/                    # AI Notes (dieses Verzeichnis)
│   └── rules/                    # Cursor Rules
├── docs/                         # Projektdokumentation
│   ├── api.md                    # API Dokumentation
│   ├── game-design.md            # Game Design Document
│   └── deployment.md             # Deployment Guide
├── frontend/                     # JavaScript Game Client
│   ├── src/
│   │   ├── game/
│   │   │   ├── scenes/           # Phaser Scenes
│   │   │   ├── entities/         # Game Objects
│   │   │   ├── systems/          # Game Systems
│   │   │   └── utils/
│   │   ├── network/              # WebSocket Client
│   │   ├── ui/                   # UI Components
│   │   └── main.ts               # Entry Point
│   ├── assets/
│   │   ├── sprites/              # Game Graphics
│   │   ├── audio/                # Sound Effects/Music
│   │   └── data/                 # JSON Configuration
│   ├── public/                   # Static Assets
│   ├── dist/                     # Build Output
│   ├── package.json
│   ├── vite.config.ts            # Build Configuration
│   └── tsconfig.json
├── backend/                      # Python Game Server
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI App Entry
│   │   ├── api/
│   │   │   ├── websocket.py      # WebSocket Endpoints
│   │   │   └── rest.py           # REST API
│   │   ├── game/
│   │   │   ├── world.py          # Game World Logic
│   │   │   ├── entities/         # Server Game Objects
│   │   │   ├── physics.py        # Physics Engine
│   │   │   └── events.py         # Event System
│   │   ├── network/
│   │   │   ├── protocol.py       # Message Protocol
│   │   │   ├── session.py        # Session Management
│   │   │   └── rooms.py          # Multiplayer Rooms
│   │   ├── database/
│   │   │   ├── models.py         # SQLAlchemy Models
│   │   │   ├── connection.py     # DB Connection
│   │   │   └── repository.py     # Data Access
│   │   ├── config/
│   │   │   ├── settings.py       # App Configuration
│   │   │   └── logging.py        # Logging Setup
│   │   └── utils/
│   ├── tests/                    # Unit Tests
│   ├── requirements.txt          # Python Dependencies
│   ├── Dockerfile
│   └── .env.example
├── shared/                       # Geteilte Typen/Konstanten
│   ├── protocol.ts               # TypeScript Message Types
│   └── constants.py              # Python Konstanten
├── deployment/                   # Deployment Configuration
│   ├── docker-compose.yml        # Local Development
│   ├── docker-compose.prod.yml   # Production Setup
│   ├── nginx.conf                # Reverse Proxy Config
│   └── scripts/                  # Deployment Scripts
├── free-pixel-art-tiny-hero-sprites/  # Existing Assets
└── tools/                        # Development Tools
    ├── asset-pipeline/           # Asset Processing
    └── scripts/                  # Build/Dev Scripts
```

## Verzeichnis-Beschreibungen

### `/frontend` - Game Client

**Technologie**: TypeScript + Phaser 3 + Vite

- Enthält den gesamten Browser-Client
- Asset Management und Loading
- Responsive Design für Mobile
- Build-System für optimierte Auslieferung

### `/backend` - Game Server

**Technologie**: Python + FastAPI + SQLAlchemy

- Authoritative Game Server
- WebSocket Communication
- Database Integration
- REST API für Metadaten

### `/shared` - Gemeinsame Definitionen

- Message Protocol Definitionen
- Gemeinsame Konstanten (Spielregeln, etc.)
- TypeScript + Python Kompatibilität

### `/deployment` - Infrastructure as Code

- Docker Container Definitionen
- Development Environment (docker-compose)
- Production Deployment Configs
- CI/CD Pipeline Definitionen

## Development Workflow

### Initial Setup

```bash
# Repository clonen
git clone <repo-url>
cd tannenbaumbiel

# Backend Setup
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# Frontend Setup
cd ../frontend
npm install

# Development mit Docker (Alternative)
cd ..
docker-compose up -d
```

### Development Commands

```bash
# Backend Development
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend Development
cd frontend
npm run dev  # Startet Vite Dev Server auf :3000

# Full Stack Development
docker-compose up  # Startet beide Services
```

### Development Workflow Notes

**Container Restart Behavior:**

- **Frontend**: Runs in development mode with auto-reload (Vite hot-reload)
  - Code changes are automatically detected and applied
  - **No container restart needed** for frontend changes
- **Backend**: Requires container restart for code changes to take effect
  - Use `docker-compose restart backend` after backend code changes
  - Database schema changes may require full `docker-compose down && docker-compose up`

**Typical Development Flow:**

```bash
# Make frontend changes -> Auto-reload, no action needed
# Make backend changes -> Run: docker-compose restart backend
# Make database changes -> Run: docker-compose down && docker-compose up
```

## Multiplayer Architecture (Client-Side Authoritative)

**Design Philosophy:**

- **Client Physics**: Use proven Phaser engine for responsive, consistent gameplay
- **Server as Relay**: Simple state synchronization instead of complex physics simulation
- **Host System**: First player manages shared entities (enemies, projectiles)

**Game State Flow:**

```
Client Phaser Physics -> Complete Game State -> WebSocket -> Server Relay -> Other Clients -> Visual Update
```

**Key Components:**

- **Local Physics**: All clients run full Phaser physics simulation locally
- **State Broadcasting**: Clients broadcast complete game state (player, enemies, projectiles)
- **Server Relay**: Server simply forwards game state between clients (no physics)
- **Host Management**: Lexicographically first player ID manages shared entities
- **Collision Detection**: Native Phaser collisions work perfectly (player-enemy, projectile-enemy)

**Critical Design Decisions - CORRECTED HYBRID ARCHITECTURE:**

- **Client-Side Physics**: All clients run full Phaser physics for immediate responsiveness
- **Client State Broadcasting**: Clients send complete game state (30fps) for conflict resolution
- **Server Conflict Resolution**: Server uses distance-based authority to resolve state conflicts
- **Distance-Based Authority**: Closest player to an object has authority over that object
- **Player Self-Authority**: Players always have authority over their own character
- **Projectile Owner Authority**: Projectile owners always have authority over their projectiles
- **Server State Broadcasting**: Server broadcasts resolved state (30fps) back to all clients
- **Client Reconciliation**: Clients apply server corrections only for significant deviations
- **Initial World Sync**: Joining players receive complete world state (enemies, projectiles)
- **Hybrid Responsiveness**: Local physics for immediate feel + server conflict resolution for consistency

### Build & Deploy

```bash
# Frontend Build
cd frontend
npm run build  # Output in dist/

# Backend Build
cd backend
docker build -t tannenbaumbiel-backend .

# Full Production Deploy
docker-compose -f deployment/docker-compose.prod.yml up -d
```

## Asset Management

### Grafische Assets

- **Sprites**: PNG/SVG in `/frontend/assets/sprites/`
- **Spritesheets**: Optimiert für Phaser Atlas Loading
- **Character Assets**: Von `/free-pixel-art-tiny-hero-sprites/` übernehmen

### Audio Assets

- **Format**: OGG + MP3 für Browser-Kompatibilität
- **Kompression**: Optimiert für Web Delivery
- **Loading**: Lazy Loading für bessere Performance

### Asset Pipeline

- Automatische Kompression/Optimierung
- Sprite Atlas Generation
- Asset Versioning für Caching

## Git Workflow

### Branch Strategy

```
main                    # Production-ready Code
├── develop             # Integration Branch
├── feature/xyz         # Feature Development
├── hotfix/abc          # Production Fixes
└── release/v1.x        # Release Preparation
```

### Commit Convention

```
feat: add player movement system
fix: websocket connection stability
docs: update API documentation
style: format code with prettier
refactor: reorganize game entities
test: add unit tests for physics
```

## Environment Configuration

### Development

```bash
# Backend .env
DATABASE_URL=postgresql://user:pass@localhost:5432/tannenbaumbiel_dev
DEBUG=True

# Frontend .env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

### Production

```bash
# Environment Variables über Docker/K8s
DATABASE_URL=postgresql://prod-db-url
JWT_SECRET_KEY=secure-random-key
DEBUG=False
```

## Implementierte Datenbank-Architektur

**PostgreSQL Single-Database Ansatz:**

- **Sessions**: Player-Sessions in `players` Tabelle mit `session_id`
- **Game State**: Rooms in `game_rooms`, aktive Teilnahme in `game_sessions`
- **Statistics**: Spielstatistiken in `game_stats` Tabelle
- **Repository Pattern**: Clean separation zwischen Business Logic und Database
- **SQLAlchemy ORM**: Type-safe database operations mit automatischen Migrations
