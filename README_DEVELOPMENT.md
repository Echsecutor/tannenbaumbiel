# Tannenbaumbiel - Development Setup

Dieses Dokument beschreibt die Einrichtung der Entwicklungsumgebung für Tannenbaumbiel.

## Schnellstart

### Voraussetzungen

- Docker und Docker Compose
- Git
- Optional: Node.js 18+ und Python 3.11+ für native Entwicklung

### 1. Repository klonen

```bash
git clone <repository-url>
cd tannenbaumbiel
```

### 2. Entwicklungsumgebung starten

```bash
# Alle Services mit Docker Compose starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f
```

### 3. Zugriff auf Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Dokumentation**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432 (tannenbaum/password)
- **Redis**: localhost:6379

## Entwicklungsworkflow

### Backend Development

```bash
# Backend separat starten
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# oder: .\venv\Scripts\activate  # Windows
pip install -r requirements.txt
python app/main.py
```

### Frontend Development

```bash
# Frontend separat starten
cd frontend
npm install
npm run dev
```

### Mit Docker Development

```bash
# Services neu starten
docker-compose restart

# Logs eines einzelnen Service anzeigen
docker-compose logs -f backend
docker-compose logs -f frontend

# In Container einloggen
docker-compose exec backend bash
docker-compose exec frontend sh

# Services stoppen
docker-compose down

# Volumes löschen (Datenbank reset)
docker-compose down -v
```

## Projekt Struktur

```
tannenbaumbiel/
├── backend/              # Python FastAPI Game Server
│   ├── app/
│   │   ├── api/         # WebSocket & REST APIs
│   │   ├── game/        # Game Logic
│   │   ├── network/     # Session & Room Management
│   │   └── config/      # Configuration
│   ├── tests/           # Unit Tests
│   └── requirements.txt
├── frontend/            # TypeScript Phaser 3 Client
│   ├── src/
│   │   ├── game/        # Game Scenes & Logic
│   │   ├── network/     # WebSocket Client
│   │   └── main.ts      # Entry Point
│   ├── assets/          # Game Assets
│   └── package.json
├── shared/              # Shared Types & Constants
├── deployment/          # Docker & Deployment Config
└── .cursor/notes/       # Project Documentation
```

## Game Architecture

### Client-Server Communication

- **WebSocket**: Real-time game communication
- **REST API**: Meta-data, room listing, statistics
- **Protocol**: JSON messages (siehe `shared/protocol.py`)

### Multiplayer Flow

1. Client verbindet zu WebSocket
2. Player joined room (erstellt oder beitritt)
3. Real-time game state synchronisation
4. Input von Client → Server validation → Broadcast

### Offline Mode

- Spiel funktioniert auch ohne Server-Verbindung
- Lokale Simulation der Game Logic

## Development Features

### Hot Reload

- **Frontend**: Vite Hot Module Replacement
- **Backend**: uvicorn --reload für automatische Neustarts

### Debugging

- **Frontend**: Browser DevTools, Source Maps
- **Backend**: Python Debugger, FastAPI debug mode
- **Network**: WebSocket message logging

### Testing

```bash
# Backend Tests
cd backend
pytest

# Frontend Linting
cd frontend
npm run lint
```

## Environment Variables

### Backend (.env)

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/tannenbaumbiel_dev
REDIS_URL=redis://localhost:6379
DEBUG=True
SECRET_KEY=dev-secret-key
ALLOWED_ORIGINS=http://localhost:3000
MAX_PLAYERS_PER_ROOM=4
GAME_TICK_RATE=60
```

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

## Game Development

### Adding New Features

1. **Protocol**: Definiere Message Types in `shared/protocol.py`
2. **Backend**: Implementiere Server Logic in `backend/app/`
3. **Frontend**: Implementiere Client Logic in `frontend/src/`
4. **Testing**: Teste mit beiden Clients (online/offline)

### Asset Integration

1. Sprites → `frontend/assets/sprites/`
2. Audio → `frontend/assets/audio/`
3. Phaser Asset Loading in Scene `preload()`

### Performance Optimization

- **Object Pooling**: Für häufige Entities (Projectiles, Enemies)
- **Delta Updates**: Nur Änderungen übertragen
- **Client Prediction**: Responsive Controls
- **Asset Compression**: Optimierte Assets für Web

## Common Issues

### Docker Problems

```bash
# Port bereits belegt
docker-compose down
sudo lsof -i :8000  # Prüfe welcher Prozess Port verwendet

# Permission Errors
sudo chown -R $(whoami) .

# Container rebuild
docker-compose build --no-cache
```

### Database Issues

```bash
# Database reset
docker-compose down -v
docker-compose up -d postgres
# Warte bis postgres ready, dann:
docker-compose up -d
```

### Network Connectivity

- WebSocket Connection Fails → Prüfe CORS Settings
- API Calls Fail → Prüfe Backend Health Endpoint: http://localhost:8000/

## Production Deployment

### Environment Variables

- Setze `DEBUG=False`
- Ändere `SECRET_KEY`
- Nutze sichere Database Credentials
- Konfiguriere HTTPS/WSS für WebSockets

### Docker Production

```bash
# Production Build
docker-compose -f docker-compose.prod.yml up -d

# SSL/TLS Setup mit Nginx
# Siehe deployment/nginx/nginx.conf
```

## Contributing

1. Feature Branch erstellen: `git checkout -b feature/xyz`
2. Änderungen committen: `git commit -m "feat: add xyz"`
3. Tests durchführen: Backend + Frontend
4. Pull Request erstellen

## Troubleshooting

### Logs analysieren

```bash
# Alle Logs
docker-compose logs

# Spezifische Services
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
docker-compose logs redis
```

### Network Debugging

```bash
# WebSocket Verbindung testen
wscat -c ws://localhost:8000/ws/game

# API Health Check
curl http://localhost:8000/
curl http://localhost:8000/api/v1/health
```
