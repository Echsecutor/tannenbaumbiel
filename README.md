# Tannenbaumbiel 🎄

Ein Browser-basiertes 2D-Plattformspiel im Stil der Disney-Filme der 1930er Jahre, entwickelt für mobile Endgeräte mit Multiplayer-Unterstützung.

## 🎮 Über das Spiel

Tannenbaumbiel ist ein **2D-Platformer/Shooter** in einem verzauberten Winterwald. Spieler wählen aus verschiedenen Pixelart-Charakteren und kämpfen gegen Schneemänner, die Schneebälle werfen. Das Ziel ist es, ein übermäßig mit Girlanden und Lichtern dekoriertes Haus zu erreichen und den Endgegner zu besiegen: einen riesigen Tannenbaum, der kleine Tannenbaumkugeln abschießt.

### ✨ Features

- **🕹️ Vollständiges Multiplayer-System** mit Real-time Synchronisation
- **📱 Mobile-optimierte Steuerung** mit Touch-Controls
- **🎨 Pixelart-Grafiken** im klassischen Disney-Stil
- **⚡ Responsive Gameplay** mit client-seitiger Physik
- **🌐 WebSocket-basierte** Client-Server-Kommunikation
- **🎯 Kampfsystem** mit Projektilen und Gegnern
- **🏃 Charakteranimationen** (Idle, Laufen, Springen, Schießen)

### 🎲 Aktuelle Spielmechaniken

- **Bewegung**: Links/rechts laufen, springen, fallen
- **Kampf**: Magische Kugelblitze aus dem Zauberstab schießen
- **Gegner**: Owlet Monster und Pink Monster Boss
- **Multiplayer**: Bis zu 4 Spieler pro Welt mit Live-Synchronisation

## 🚀 Schnellstart

### Voraussetzungen

- Docker und Docker Compose
- Git

### Setup

```bash
# Repository klonen
git clone <repository-url>
cd tannenbaumbiel

# Alle Services starten
docker-compose up -d

# Logs anzeigen (optional)
docker-compose logs -f
```

### Zugriff

- **🎮 Spiel**: http://localhost:3000
- **🔧 API**: http://localhost:8000
- **📚 API Docs**: http://localhost:8000/docs

### Testen

```bash
cd tools && ./run_test.sh
```

## 🛠️ Entwicklung

### Lokale Entwicklung (ohne Docker)

```bash
# Backend (Python FastAPI)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt && python app/main.py

# Frontend (Phaser 3 + TypeScript)
cd frontend
npm install && npm run dev
```

### Docker Commands

```bash
docker-compose restart           # Services neu starten
docker-compose logs -f backend   # Logs anzeigen
docker-compose down -v           # Reset mit Datenbank
docker-compose run --rm test     # Tests ausführen
```

## 📁 Architektur

### Tech Stack

- **Frontend**: Phaser 3 + TypeScript + Vite
- **Backend**: Python FastAPI + WebSockets
- **Database**: PostgreSQL + Redis
- **Deployment**: Docker Compose

### Projekt Struktur

```
├── backend/         # Python Game Server (FastAPI)
├── frontend/        # Game Client (Phaser 3 + TypeScript)
├── shared/          # Gemeinsame Protokoll-Definitionen
├── deployment/      # Docker & DB Setup
└── tools/          # Test-Scripts (Selenium)
```

### Multiplayer Architektur

1. **WebSocket-Verbindung** zwischen Client und Server
2. **Client-seitige Physik** für responsive Steuerung
3. **State-Relay System** - Server synchronisiert Spielzustände
4. **Room-basierte Welten** mit bis zu 4 Spielern

## 🔧 Debugging & Troubleshooting

### Häufige Probleme

```bash
# Port bereits belegt
docker-compose down && sudo lsof -i :8000

# Container neu bauen
docker-compose build --no-cache

# Datenbank zurücksetzen
docker-compose down -v && docker-compose up -d

# WebSocket testen
wscat -c ws://localhost:8000/ws/game

# API Health Check
curl http://localhost:8000/api/v1/health
```

### Logs & Monitoring

```bash
docker-compose logs                    # Alle Services
docker-compose logs -f backend         # Backend spezifisch
docker-compose logs -f frontend        # Frontend spezifisch
```

## 🚀 Game Development

### Neue Features hinzufügen

1. **Protocol** definieren in `shared/protocol.py`
2. **Backend** Logic in `backend/app/`
3. **Frontend** Client in `frontend/src/`
4. Mit Integration Tests validieren

### Assets

- **Sprites**: `frontend/assets/sprites/` (Pixel Art Characters)
- **Audio**: `frontend/assets/audio/` (noch nicht implementiert)
- **Loading**: Phaser Scene `preload()` Methode

## 📚 Weitere Dokumentation

- **Detaillierte Notes**: `.cursor/notes/` Ordner
- **Changelogs**: `backend/Changelog.md`, `frontend/Changelog.md`
- **API Docs**: http://localhost:8000/docs (FastAPI Swagger)

## 🤝 Contributing

1. Feature Branch: `git checkout -b feature/xyz`
2. Tests durchführen: `cd tools && ./run_test.sh`
3. Commit: `git commit -m "feat: add xyz"`
4. Pull Request erstellen
