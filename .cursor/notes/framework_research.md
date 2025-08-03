# Framework Research für Tannenbaumbiel

## Frontend JavaScript 2D Game Frameworks

### Phaser 3 (Empfehlung: ⭐⭐⭐⭐⭐)

- **Performance**: Sehr gut, WebGL + Canvas Rendering
- **Mobile Support**: Ausgezeichnet mit Touch-Gesten
- **Lernkurve**: Moderat, sehr gute Dokumentation
- **Bundle Size**: ~3-5MB (akzeptabel für Spiele)
- **Vorteile**:
  - Weit verbreitet und stabil
  - Umfangreiche Feature-Set (Physics, Audio, Input)
  - TypeScript Support
  - Starke Community
- **Nachteile**:
  - Große Bundle-Size
  - Objekt-orientierter Ansatz (weniger modular)

### Pixi.js (Empfehlung: ⭐⭐⭐⭐)

- **Performance**: Exzellent, fokussiert auf High-Performance Rendering
- **Mobile Support**: Sehr gut
- **Lernkurve**: Höher, Fokus auf Rendering
- **Vorteile**:
  - Beste 2D Rendering Performance
  - Flexibel und leichtgewichtig
  - Gute WebGL Nutzung
- **Nachteile**:
  - Weniger Game-spezifische Features
  - Benötigt zusätzliche Libraries für Physics, Audio

### Framework Vergleich Performance

Basierend auf Benchmarks (Filip Hráček 2024):

- **Startup Zeit**: Phaser/Pixi ~1s, Unity ~3s
- **Max Entities**: Phaser ~1000, Unity ~3000+ (Web)
- **Memory Usage**: Phaser effizient, aber mehr als Unity auf Web
- **CPU Usage**: Vergleichbar, abhängig von Implementation

## Backend Python Game Server Frameworks

### FastAPI + WebSockets (Empfehlung: ⭐⭐⭐⭐⭐)

- **Performance**: Sehr gut, async/await Support
- **WebSocket**: Nativ unterstützt
- **Skalierung**: Gut mit ASGI Servern (Uvicorn)
- **Vorteile**:
  - Moderne async Python Architektur
  - Automatische API Dokumentation
  - TypeScript-ähnliche Type Hints
  - Einfache Integration mit Redis für Session Management

### Django + Channels (Empfehlung: ⭐⭐⭐⭐)

- **Performance**: Gut, aber schwerer als FastAPI
- **WebSocket**: Via Django Channels
- **Skalierung**: Sehr gut mit Redis Channel Layers
- **Vorteile**:
  - Robustes Ecosystem
  - ORM und Admin Interface
  - Bewährt für große Projekte

### Sanic (Empfehlung: ⭐⭐⭐)

- **Performance**: Sehr gut, ähnlich FastAPI
- **WebSocket**: Unterstützt
- **Vorteile**: Ähnlich Flask aber async
- **Nachteile**: Kleinere Community als FastAPI/Django

## Empfohlene Tech-Stack Kombination

### Option 1: Phaser 3 + FastAPI (Empfohlen)

- **Begründung**:
  - Phaser 3 bietet komplettes Game Framework
  - FastAPI moderne, performante Backend-Lösung
  - Beide haben exzellente TypeScript/Python Type-Support
  - Schnelle Entwicklung möglich

### Option 2: Pixi.js + FastAPI (Für Performance-kritische Spiele)

- **Begründung**:
  - Maximale Rendering-Performance
  - Mehr Kontrolle über Rendering-Pipeline
  - Ideal für Spiele mit vielen beweglichen Elementen

## Browser-Kompatibilität

- **SharedArrayBuffer Requirement**:
  - Unity/Godot benötigen SharedArrayBuffer (Hosting-Einschränkungen)
  - Phaser/Pixi.js funktionieren ohne (bessere Web-Kompatibilität)
- **WebGL Support**: Alle modernen mobile Browser unterstützen WebGL
- **Touch Events**: Alle Frameworks unterstützen Touch-Gesten

## Performance Optimierung Best Practices

- Object Pooling für häufig erstellte/zerstörte Objekte
- Sprite Batching für bessere Rendering-Performance
- Lazy Loading von Assets
- Texture Packing für reduzierte Ladezeiten
- Canvas vs WebGL je nach Zielgerät testen
