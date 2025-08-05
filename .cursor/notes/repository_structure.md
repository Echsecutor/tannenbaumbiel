# Repository Structure - Tannenbaumbiel

## Aktuelle Projektstruktur

```
tannenbaumbiel/
├── README.md
├── .gitignore
├── .cursor/
│   ├── notes/                    # AI Notes (dieses Verzeichnis)
│   └── rules/                    # Cursor Rules
# docs/ - Planned documentation directory (not yet created)
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
# Note: frontend/assets/ at root level removed, assets are in src/assets/
│   ├── dist/                     # Build Output (generated)
│   ├── package.json
│   ├── vite.config.ts            # Build Configuration
│   ├── tsconfig.json
│   ├── Dockerfile.dev            # Development Dockerfile
│   ├── Dockerfile                # Production Dockerfile (multi-stage)
│   └── nginx.conf                # Production nginx configuration
├── backend/                      # Python Game Server
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI App Entry
│   │   ├── api/
│   │   │   ├── websocket.py      # WebSocket Endpoints
│   │   │   └── rest.py           # REST API
│   │   ├── game/
│   │   │   ├── world.py          # Game World Logic
# Note: backend entities/, physics.py, events.py not yet implemented
│   │   ├── network/
│   │   │   ├── protocol.py       # Message Protocol
│   │   │   ├── session.py        # Session Management
│   │   │   └── rooms.py          # Multiplayer Rooms
│   │   ├── database/
│   │   │   ├── models.py         # SQLAlchemy Models
│   │   │   ├── connection.py     # DB Connection
│   │   │   └── repository.py     # Data Access
│   │   ├── config/
│   │   │   └── settings.py       # App Configuration
# Note: logging.py not yet implemented
│   │   └── utils/
# Note: Removed empty shared/ directories (no longer needed)
│   ├── tests/                    # Unit Tests (empty directory)
│   ├── requirements.txt          # Python Dependencies
│   ├── Dockerfile.dev            # Development Dockerfile
│   └── Dockerfile                # Production Dockerfile
# Note: .env.example not yet created

├── deployment/                   # Deployment Configuration
│   ├── postgres/                 # Database initialization
│   └── README.md                 # Production deployment guide
# Note: docker-compose.yml is at project root (development)
# Production files: docker-compose.prod.yml (root), frontend/nginx.conf
├── tiles/                        # Game Assets & Tilesets
│   ├── free-pixel-art-tiny-hero-sprites/  # Character Sprites
│   ├── winter/                   # Winter Theme Assets
│   └── Season_collection.png     # Main Tileset
└── tools/                        # Development Tools
    ├── image_analysis/           # Computer Vision Asset Tools
    ├── selenium_test.py          # Integration Tests
    ├── run_test.sh              # Test Runner Script
    └── venv/                     # Python Virtual Environment (gitignored)
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

### `/deployment` - Infrastructure as Code

- Docker Container Definitionen
- Development Environment (docker-compose.yml at root)
- Production Deployment Configs (docker-compose.prod.yml at root)
- Production deployment guide and environment setup
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
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## Asset Management

### Asset Workflow and Directory Structure

- **Source Assets**: Stored in `/tiles/` directory (organized by theme/type)
  - `/tiles/winter/` - Winter-themed tiles (32x32 pixels)
  - `/tiles/free-pixel-art-tiny-hero-sprites/` - Character sprites
- **Deployed Assets**: Copied to `/frontend/src/assets/` for game usage
  - `/frontend/src/assets/winter/` - Winter tiles used by game
  - `/frontend/src/assets/sprites/` - Character sprites used by game
- **Synchronization**: When updating source assets, manually copy to frontend assets directory
  - Example: `cp tiles/winter/*.png frontend/src/assets/winter/`
  - Browser refresh (Ctrl+F5) may be needed to clear asset cache

### Grafische Assets

- **Sprites**: PNG/SVG in `/frontend/src/assets/sprites/`
- **Spritesheets**: Optimiert für Phaser Atlas Loading
- **Character Assets**: Von `/tiles/free-pixel-art-tiny-hero-sprites/` übernehmen
- **Winter Tiles**: 32x32 pixel tiles with intelligent naming (upper_left, upper_middle, upper_right, etc.)

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
# Environment Variables in .env.prod file
POSTGRES_PASSWORD=secure_password_change_me
SECRET_KEY=your_very_long_random_secret_key_here
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
API_URL=https://api.yourdomain.com
WS_URL=wss://api.yourdomain.com/ws
```

**Production Features:**

- Multi-stage Docker builds (frontend: build + nginx, backend: optimized)
- No source code mounting (production security)
- Nginx serving static frontend files with caching and compression
- Multi-worker backend (4 uvicorn workers)
- Production database with secure credentials
- PostgreSQL for all data and session storage
- Health checks for all services
- Security headers and CORS restrictions

## Implementierte Datenbank-Architektur

**PostgreSQL Single-Database Ansatz:**

- **Sessions**: Player-Sessions in `players` Tabelle mit `session_id`
- **Game State**: Rooms in `game_rooms`, aktive Teilnahme in `game_sessions`
- **Statistics**: Spielstatistiken in `game_stats` Tabelle
- **Repository Pattern**: Clean separation zwischen Business Logic und Database
- **SQLAlchemy ORM**: Type-safe database operations mit automatischen Migrations
