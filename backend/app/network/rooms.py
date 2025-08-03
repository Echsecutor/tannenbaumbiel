"""
Room management for multiplayer games
"""
from typing import Dict, Set, Optional
from datetime import datetime
from app.config.settings import settings


class GameRoom:
    """Represents a multiplayer game room"""

    def __init__(self, room_id: str, name: str, max_players: int = None):
        self.room_id = room_id
        self.name = name
        self.max_players = max_players or settings.max_players_per_room
        self.players: Set[str] = set()  # connection IDs
        self.player_usernames: Dict[str, str] = {}  # connection_id -> username
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.is_game_active = False

    def add_player(self, connection_id: str, username: str) -> bool:
        """Add player to room"""
        if len(self.players) >= self.max_players:
            return False

        self.players.add(connection_id)
        self.player_usernames[connection_id] = username
        self.last_activity = datetime.utcnow()
        return True

    def remove_player(self, connection_id: str) -> bool:
        """Remove player from room"""
        if connection_id in self.players:
            self.players.remove(connection_id)
            if connection_id in self.player_usernames:
                del self.player_usernames[connection_id]
            self.last_activity = datetime.utcnow()
            return True
        return False

    def is_empty(self) -> bool:
        """Check if room is empty"""
        return len(self.players) == 0

    def is_full(self) -> bool:
        """Check if room is full"""
        return len(self.players) >= self.max_players

    def get_player_list(self) -> list:
        """Get list of players with usernames"""
        return [
            {"connection_id": conn_id,
                "username": self.player_usernames.get(conn_id, "Unknown")}
            for conn_id in self.players
        ]


class RoomManager:
    """Manages game rooms"""

    def __init__(self):
        self.rooms: Dict[str, GameRoom] = {}
        self.player_rooms: Dict[str, str] = {}  # connection_id -> room_id

    def create_room(self, name: str, creator_id: str, creator_username: str) -> GameRoom:
        """Create a new room"""
        room_id = f"room_{len(self.rooms)}_{int(datetime.utcnow().timestamp())}"
        room = GameRoom(room_id, name)

        # Add creator to room
        room.add_player(creator_id, creator_username)

        self.rooms[room_id] = room
        self.player_rooms[creator_id] = room_id

        print(f"Created room {room_id} '{name}' by {creator_username}")
        return room

    def join_room(self, room_name: str, connection_id: str, username: str) -> Optional[GameRoom]:
        """Join or create room by name"""
        # Check if player is already in a room
        if connection_id in self.player_rooms:
            return None

        # Find existing room by name
        room = None
        for r in self.rooms.values():
            if r.name == room_name and not r.is_full():
                room = r
                break

        # Create new room if none exists
        if room is None:
            room = self.create_room(room_name, connection_id, username)
        else:
            # Join existing room
            if room.add_player(connection_id, username):
                self.player_rooms[connection_id] = room.room_id
                print(f"Player {username} joined room {room.room_id}")
            else:
                return None

        return room

    def leave_room(self, room_id: str, connection_id: str) -> Optional[GameRoom]:
        """Leave a room"""
        if room_id not in self.rooms:
            return None

        room = self.rooms[room_id]

        if room.remove_player(connection_id):
            # Remove from player-room mapping
            if connection_id in self.player_rooms:
                del self.player_rooms[connection_id]

            print(f"Player {connection_id} left room {room_id}")

            # Clean up empty rooms
            if room.is_empty():
                del self.rooms[room_id]
                print(f"Removed empty room {room_id}")

            return room

        return None

    def get_room(self, room_id: str) -> Optional[GameRoom]:
        """Get room by ID"""
        return self.rooms.get(room_id)

    def get_player_room(self, connection_id: str) -> Optional[GameRoom]:
        """Get room that player is in"""
        room_id = self.player_rooms.get(connection_id)
        if room_id:
            return self.get_room(room_id)
        return None

    def list_rooms(self) -> list:
        """List all active rooms"""
        return [
            {
                "room_id": room.room_id,
                "name": room.name,
                "player_count": len(room.players),
                "max_players": room.max_players,
                "is_full": room.is_full(),
                "created_at": room.created_at.isoformat()
            }
            for room in self.rooms.values()
        ]

    def cleanup_empty_rooms(self) -> int:
        """Remove empty rooms"""
        empty_rooms = [room_id for room_id,
                       room in self.rooms.items() if room.is_empty()]

        for room_id in empty_rooms:
            del self.rooms[room_id]

        return len(empty_rooms)
