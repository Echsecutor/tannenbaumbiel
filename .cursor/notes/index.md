# Tannenbaumbiel - Projekt Notes Index

## Projektübersicht

Tannenbaumbiel ist ein Browser-Spiel für mobile Endgeräte - ein 2D Platformer/Shooter im Disney-Stil der 1930er Jahre.

## Notes Struktur

### [Framework Research](framework_research.md)

- Frontend JavaScript 2D Game Frameworks Vergleich
- Backend Python Game Server Frameworks
- Performance und Kompatibilitätsanalyse

### [Architecture Concept](architecture_concept.md)

- System-Architektur für Browser-Spiel mit Python Backend
- Client-Server Kommunikation über WebSockets
- Multiplayer-Support Design

### [Multiplayer Architecture](multiplayer_architecture.md)

- Hybrid Client-Server Konfliktlösung
- Distance-Based Authority System
- Client-Side Physics mit Server Reconciliation
- Network Efficiency und Performance Optimization

### [Repository Structure](repository_structure.md)

- Projektordner-Organisation
- Frontend/Backend Trennung
- Development Environment Setup

### [Game Development Status](game_development_status.md)

- Implementierungsfortschritt
- Aktuelle Features und Funktionalität
- Phaser 3 Spiel-Engine Integration
- Sprite-Animation System

## Quick Start Links

- Hauptdokument: [README.md](../README.md)
- Grafische Assets: `/free-pixel-art-tiny-hero-sprites`
- **Frontend**: http://localhost:3000 (Phaser Game)
- **Backend**: http://localhost:8000 (FastAPI Server)
- **Testing**: `cd tools && ./run_test.sh` (Selenium Integration Tests)

## Technische Hauptentscheidungen

- **Frontend**: Phaser 3 mit TypeScript
- **Backend**: Python FastAPI mit WebSocket Support
- **Database**: PostgreSQL (Single Database)
- **Development**: Docker Compose Environment
- **Testing**: Selenium Integration Tests mit Chrome WebDriver
- **Zielplattform**: Primär mobile Browser, später native Apps
- **Grafik-Stil**: Pixel Art Monster/Character Sprites
