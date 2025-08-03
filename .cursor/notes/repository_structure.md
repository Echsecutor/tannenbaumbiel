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
REDIS_URL=redis://localhost:6379
DEBUG=True

# Frontend .env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

### Production

```bash
# Environment Variables über Docker/K8s
DATABASE_URL=postgresql://prod-db-url
REDIS_URL=redis://prod-redis-url
JWT_SECRET_KEY=secure-random-key
DEBUG=False
```
