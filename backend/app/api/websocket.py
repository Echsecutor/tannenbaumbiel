"""
WebSocket endpoints for real-time game communication
"""
import json
import asyncio
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from app.config.settings import settings
from app.network.session import SessionManager
from app.network.rooms import RoomManager
from shared.protocol import GameMessage, MessageType, JoinRoomData, PlayerInputData


router = APIRouter()

# Global managers
session_manager = SessionManager()
room_manager = RoomManager()


class ConnectionManager:
    """Manages WebSocket connections"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_rooms: Dict[str, str] = {}  # connection_id -> room_id

    async def connect(self, websocket: WebSocket, connection_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        print(f"Connection {connection_id} established")

    def disconnect(self, connection_id: str):
        """Remove connection and clean up"""
        if connection_id in self.active_connections:
            # Leave room if in one
            if connection_id in self.connection_rooms:
                room_id = self.connection_rooms[connection_id]
                room_manager.leave_room(room_id, connection_id)
                del self.connection_rooms[connection_id]

            del self.active_connections[connection_id]
            print(f"Connection {connection_id} disconnected")

    async def send_message(self, connection_id: str, message: GameMessage):
        """Send message to specific connection"""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(message.model_dump_json())

    async def broadcast_to_room(self, room_id: str, message: GameMessage, exclude: Set[str] = None):
        """Broadcast message to all connections in a room"""
        if exclude is None:
            exclude = set()

        room = room_manager.get_room(room_id)
        if room:
            for connection_id in room.players:
                if connection_id not in exclude:
                    await self.send_message(connection_id, message)


# Global connection manager
connection_manager = ConnectionManager()


@router.websocket("/game")
async def websocket_game_endpoint(websocket: WebSocket):
    """Main game WebSocket endpoint"""

    # Generate unique connection ID
    connection_id = session_manager.generate_session_id()

    await connection_manager.connect(websocket, connection_id)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()

            try:
                # Parse message
                message_dict = json.loads(data)
                message = GameMessage(**message_dict)

                # Handle message based on type
                await handle_message(connection_id, message)

            except json.JSONDecodeError:
                await send_error(connection_id, "INVALID_JSON", "Invalid JSON format")
            except Exception as e:
                await send_error(connection_id, "MESSAGE_ERROR", str(e))

    except WebSocketDisconnect:
        # Handle disconnect - clean up room if player was in one
        room_id = room_manager.disconnect_player(connection_id)
        connection_manager.disconnect(connection_id)
        if room_id:
            print(f"Player {connection_id} disconnected from room {room_id}")
    except Exception as e:
        print(f"WebSocket error for {connection_id}: {e}")
        room_manager.disconnect_player(connection_id)
        connection_manager.disconnect(connection_id)


async def handle_message(connection_id: str, message: GameMessage):
    """Handle incoming WebSocket message"""

    if message.type == MessageType.JOIN_ROOM:
        await handle_join_room(connection_id, message)

    elif message.type == MessageType.LEAVE_ROOM:
        await handle_leave_room(connection_id, message)

    elif message.type == MessageType.PLAYER_INPUT:
        await handle_player_input(connection_id, message)

    elif message.type == MessageType.PING:
        await handle_ping(connection_id, message)

    else:
        await send_error(connection_id, "UNKNOWN_MESSAGE_TYPE", f"Unknown message type: {message.type}")


async def handle_join_room(connection_id: str, message: GameMessage):
    """Handle room join request"""
    try:
        join_data = JoinRoomData(**message.data)

        # Create session for player (this creates or updates player in database)
        session_id = session_manager.create_session(join_data.username)

        # Get player from database
        player = session_manager.get_player_by_session(session_id)
        if not player:
            await send_error(connection_id, "SESSION_ERROR", "Failed to create player session")
            return

        # Create or join room
        room = room_manager.join_room(join_data.room_name, connection_id, player)

        if room:
            # Track connection-room mapping
            connection_manager.connection_rooms[connection_id] = room.room_id

            # Send confirmation to joining player
            response = GameMessage(
                type=MessageType.ROOM_JOINED,
                timestamp=message.timestamp,
                data={
                    "room_id": room.room_id,
                    "player_count": room.get_active_connection_count(),
                    "max_players": settings.max_players_per_room,
                    "player_list": room.get_player_list()
                }
            )
            await connection_manager.send_message(connection_id, response)

            # Notify other players
            if room.get_active_connection_count() > 1:
                broadcast_message = GameMessage(
                    type=MessageType.PLAYER_JOINED,
                    timestamp=message.timestamp,
                    data={
                        "username": join_data.username,
                        "player_count": room.get_active_connection_count()
                    }
                )
                await connection_manager.broadcast_to_room(
                    room.room_id,
                    broadcast_message,
                    exclude={connection_id}
                )
        else:
            await send_error(connection_id, "ROOM_JOIN_FAILED", "Failed to join room (may be full or player already in another room)")

    except Exception as e:
        await send_error(connection_id, "JOIN_ROOM_ERROR", str(e))


async def handle_leave_room(connection_id: str, message: GameMessage):
    """Handle room leave request"""
    if connection_id in connection_manager.connection_rooms:
        room_id = connection_manager.connection_rooms[connection_id]
        room = room_manager.leave_room(room_id, connection_id)

        if room:
            # Remove from tracking
            del connection_manager.connection_rooms[connection_id]

            # Send confirmation
            response = GameMessage(
                type=MessageType.ROOM_LEFT,
                timestamp=message.timestamp,
                data={"room_id": room_id}
            )
            await connection_manager.send_message(connection_id, response)

            # Notify other players
            if room.get_active_connection_count() > 0:
                broadcast_message = GameMessage(
                    type=MessageType.PLAYER_LEFT,
                    timestamp=message.timestamp,
                    data={"player_count": room.get_active_connection_count()}
                )
                await connection_manager.broadcast_to_room(room_id, broadcast_message)


async def handle_player_input(connection_id: str, message: GameMessage):
    """Handle player input"""
    try:
        input_data = PlayerInputData(**message.data)

        # Validate player is in a room
        if connection_id not in connection_manager.connection_rooms:
            await send_error(connection_id, "NOT_IN_ROOM", "Player not in a room")
            return

        room_id = connection_manager.connection_rooms[connection_id]

        # Process input (this would integrate with game logic)
        print(f"Player {input_data.player_id} action: {input_data.action} in room {room_id}")

        # TODO: Integrate with game world simulation
        # For now, just acknowledge input

    except Exception as e:
        await send_error(connection_id, "INPUT_ERROR", str(e))


async def handle_ping(connection_id: str, message: GameMessage):
    """Handle ping for connection health check"""
    response = GameMessage(
        type=MessageType.PONG,
        timestamp=message.timestamp,
        data={"server_time": asyncio.get_event_loop().time()}
    )
    await connection_manager.send_message(connection_id, response)


async def send_error(connection_id: str, error_code: str, error_message: str):
    """Send error message to client"""
    error_msg = GameMessage(
        type=MessageType.ERROR,
        timestamp=asyncio.get_event_loop().time(),
        data={
            "error_code": error_code,
            "message": error_message
        }
    )
    await connection_manager.send_message(connection_id, error_msg)
