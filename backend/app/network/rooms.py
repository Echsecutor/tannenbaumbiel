"""
Room management for multiplayer games using PostgreSQL
"""
from typing import Dict, Set, Optional, List
from datetime import datetime
from uuid import UUID

from app.config.settings import settings
from app.database.repository import GameRepository
from app.database.models import GameRoom as DbGameRoom, GameSession, Player


class GameRoom:
    """Represents a multiplayer game room with database backing"""

    def __init__(self, db_room: DbGameRoom, active_sessions: List[GameSession] = None):
        self.room_id = str(db_room.id)
        self.name = db_room.name
        self.max_players = db_room.max_players
        self.created_at = db_room.created_at
        self.is_active = db_room.is_active
        self.db_id = db_room.id

        # Active connections (connection_id -> session info)
        self._active_connections: Dict[str, GameSession] = {}
        if active_sessions:
            for session in active_sessions:
                # We'll need connection_id mapping elsewhere
                pass

    def add_player(self, connection_id: str, player: Player) -> bool:
        """Add player to room"""
        if len(self._active_connections) >= self.max_players:
            return False

        with GameRepository() as repo:
            # Create game session
            session = repo.create_game_session(
                room_id=self.db_id,
                player_id=player.id,
                character_type="hero1"
            )

            self._active_connections[connection_id] = session
            return True

    def remove_player(self, connection_id: str) -> bool:
        """Remove player from room"""
        if connection_id not in self._active_connections:
            return False

        session = self._active_connections[connection_id]

        with GameRepository() as repo:
            # End the game session
            repo.end_game_session(session.id)

        del self._active_connections[connection_id]
        return True

    def is_empty(self) -> bool:
        """Check if room is empty"""
        return len(self._active_connections) == 0

    def is_full(self) -> bool:
        """Check if room is full"""
        return len(self._active_connections) >= self.max_players

    def get_player_list(self) -> list:
        """Get list of players with usernames"""
        players = []
        with GameRepository() as repo:
            for connection_id, session in self._active_connections.items():
                player = repo.get_player_by_id(session.player_id)
                players.append({
                    "connection_id": connection_id,
                    "username": player.username if player else "Unknown",
                    "character_type": session.character_type
                })
        return players

    def get_active_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self._active_connections)

    def has_connection(self, connection_id: str) -> bool:
        """Check if connection is in this room"""
        return connection_id in self._active_connections

    def get_session_for_connection(self, connection_id: str) -> Optional[GameSession]:
        """Get game session for connection"""
        return self._active_connections.get(connection_id)


class RoomManager:
    """Manages game rooms using PostgreSQL backend"""

    def __init__(self):
        # In-memory cache of active rooms for performance
        self._room_cache: Dict[str, GameRoom] = {}
        self._connection_rooms: Dict[str, str] = {}  # connection_id -> room_id

    def create_room(self, name: str, creator_connection_id: str, player: Player) -> GameRoom:
        """Create a new room"""
        with GameRepository() as repo:
            # Create database room
            db_room = repo.create_room(name=name, max_players=settings.max_players_per_room)

            # Create room object
            room = GameRoom(db_room)

            # Add creator to room
            if room.add_player(creator_connection_id, player):
                self._room_cache[room.room_id] = room
                self._connection_rooms[creator_connection_id] = room.room_id
                print(f"Created room {room.room_id} '{name}' by {player.username}")
                return room
            else:
                # This shouldn't happen for a new room, but handle it
                repo.deactivate_room(db_room.id)
                raise RuntimeError("Failed to add creator to new room")

    def join_room(self, room_name: str, connection_id: str, player: Player) -> Optional[GameRoom]:
        """Join or create room by name"""
        # Check if player is already in a room
        if connection_id in self._connection_rooms:
            return None

        with GameRepository() as repo:
            # Check if player already has an active session
            active_session = repo.get_active_session_for_player(player.id)
            if active_session:
                return None

            # Find existing room by name
            db_room = repo.get_room_by_name(room_name)

            if db_room:
                # Load room from cache or create cache entry
                room = self._get_or_load_room(db_room)

                if not room.is_full():
                    # Join existing room
                    if room.add_player(connection_id, player):
                        self._connection_rooms[connection_id] = room.room_id
                        print(f"Player {player.username} joined room {room.room_id}")
                        return room
                    else:
                        return None
                else:
                    return None  # Room is full
            else:
                # Create new room
                return self.create_room(room_name, connection_id, player)

    def leave_room(self, room_id: str, connection_id: str) -> Optional[GameRoom]:
        """Leave a room"""
        if connection_id not in self._connection_rooms:
            return None

        room = self._room_cache.get(room_id)
        if not room:
            return None

        if room.remove_player(connection_id):
            # Remove from connection mapping
            del self._connection_rooms[connection_id]
            print(f"Player {connection_id} left room {room_id}")

            # Clean up empty rooms
            if room.is_empty():
                self._remove_room_from_cache(room_id)
                # Deactivate room in database
                with GameRepository() as repo:
                    repo.deactivate_room(room.db_id)
                print(f"Deactivated empty room {room_id}")

            return room

        return None

    def get_room(self, room_id: str) -> Optional[GameRoom]:
        """Get room by ID"""
        return self._room_cache.get(room_id)

    def get_player_room(self, connection_id: str) -> Optional[GameRoom]:
        """Get room that player is in"""
        room_id = self._connection_rooms.get(connection_id)
        if room_id:
            return self.get_room(room_id)
        return None

    def list_rooms(self) -> list:
        """List all active rooms"""
        rooms = []
        for room in self._room_cache.values():
            rooms.append({
                "room_id": room.room_id,
                "name": room.name,
                "player_count": room.get_active_connection_count(),
                "max_players": room.max_players,
                "is_full": room.is_full(),
                "created_at": room.created_at.isoformat()
            })
        return rooms

    def cleanup_empty_rooms(self) -> int:
        """Remove empty rooms"""
        empty_room_ids = [
            room_id for room_id, room in self._room_cache.items()
            if room.is_empty()
        ]

        for room_id in empty_room_ids:
            room = self._room_cache[room_id]
            self._remove_room_from_cache(room_id)

            # Deactivate in database
            with GameRepository() as repo:
                repo.deactivate_room(room.db_id)

        return len(empty_room_ids)

    def _get_or_load_room(self, db_room: DbGameRoom) -> GameRoom:
        """Get room from cache or load from database"""
        room_id = str(db_room.id)

        if room_id in self._room_cache:
            return self._room_cache[room_id]

        # Load active sessions for the room
        with GameRepository() as repo:
            active_sessions = repo.get_active_sessions_for_room(db_room.id)

        room = GameRoom(db_room, active_sessions)
        self._room_cache[room_id] = room
        return room

    def _remove_room_from_cache(self, room_id: str):
        """Remove room from cache and clean up connections"""
        if room_id in self._room_cache:
            # Remove all connection mappings for this room
            connections_to_remove = [
                conn_id for conn_id, r_id in self._connection_rooms.items()
                if r_id == room_id
            ]
            for conn_id in connections_to_remove:
                del self._connection_rooms[conn_id]

            # Remove room from cache
            del self._room_cache[room_id]

    def disconnect_player(self, connection_id: str) -> Optional[str]:
        """Handle player disconnection, return room_id if they were in a room"""
        room_id = self._connection_rooms.get(connection_id)
        if room_id:
            self.leave_room(room_id, connection_id)
            return room_id
        return None
