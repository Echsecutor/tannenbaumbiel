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
from app.game.world import world_manager
from shared.protocol import GameMessage, MessageType, JoinRoomData, PlayerInputData, InputAction


router = APIRouter()

# Global managers
session_manager = SessionManager()
room_manager = RoomManager()

# Start world manager


async def startup_event():
    """Initialize world manager"""
    await world_manager.start()


async def shutdown_event():
    """Cleanup world manager"""
    await world_manager.stop()


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
            for connection_id in room._active_connections.keys():
                if connection_id not in exclude:
                    await self.send_message(connection_id, message)

    async def broadcast_game_state(self, room_id: str):
        """Broadcast current game state to all players in room"""
        world = world_manager.get_world(room_id)
        if world:
            game_state = world.get_game_state()
            message = GameMessage(
                type=MessageType.GAME_STATE,
                timestamp=asyncio.get_event_loop().time(),
                data=game_state.model_dump()
            )
            await self.broadcast_to_room(room_id, message)


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
        # Handle disconnect - clean up room and game world
        room_id = room_manager.disconnect_player(connection_id)
        connection_manager.disconnect(connection_id)

        if room_id:
            # Remove player from game world
            world = world_manager.get_world(room_id)
            if world:
                world.remove_player(connection_id)

                # Remove world if no players left
                if not world.has_players():
                    world_manager.remove_world(room_id)
                else:
                    # Broadcast updated game state to remaining players
                    await connection_manager.broadcast_game_state(room_id)

            print(f"Player {connection_id} disconnected from room {room_id}")
    except Exception as e:
        print(f"WebSocket error for {connection_id}: {e}")

        # Clean up on error
        room_id = room_manager.disconnect_player(connection_id)
        connection_manager.disconnect(connection_id)

        if room_id:
            world = world_manager.get_world(room_id)
            if world:
                world.remove_player(connection_id)
                if not world.has_players():
                    world_manager.remove_world(room_id)


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

    elif message.type == MessageType.GAME_STATE_UPDATE:
        await handle_game_state_update(connection_id, message)

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

            # Create or get game world for this room
            world = world_manager.get_world(room.room_id)
            if not world:
                world = world_manager.create_world(room.room_id)

            # Add player to game world
            player_state = world.add_player(
                player_id=connection_id,  # Use connection_id as player_id for now
                username=join_data.username,
                x=100 + (room.get_active_connection_count() - 1) * 50,  # Spread players out
                y=650  # Start above ground level
            )

            # Send confirmation to joining player
            response = GameMessage(
                type=MessageType.ROOM_JOINED,
                timestamp=message.timestamp,
                data={
                    "room_id": room.room_id,
                    "player_count": room.get_active_connection_count(),
                    "max_players": settings.max_players_per_room,
                    "player_list": room.get_player_list(),
                    "your_player_id": connection_id
                }
            )
            await connection_manager.send_message(connection_id, response)

            # CRITICAL FIX: Send complete world state to joining player
            initial_state = world.get_game_state()
            state_message = GameMessage(
                type=MessageType.GAME_STATE,
                timestamp=message.timestamp,
                data=initial_state.model_dump()
            )
            await connection_manager.send_message(connection_id, state_message)
            print(f"🌍 Sent initial world state to joining player {connection_id}: {len(initial_state.enemies)} enemies, {len(initial_state.projectiles)} projectiles")

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
            # Remove player from game world
            world = world_manager.get_world(room_id)
            if world:
                world.remove_player(connection_id)

                # Remove world if no players left
                if not world.has_players():
                    world_manager.remove_world(room_id)

            # Remove from tracking
            del connection_manager.connection_rooms[connection_id]

            # Send confirmation
            response = GameMessage(
                type=MessageType.ROOM_LEFT,
                timestamp=message.timestamp,
                data={"room_id": room_id}
            )
            await connection_manager.send_message(connection_id, response)

            # Notify other players and broadcast updated game state
            if room.get_active_connection_count() > 0:
                broadcast_message = GameMessage(
                    type=MessageType.PLAYER_LEFT,
                    timestamp=message.timestamp,
                    data={"player_count": room.get_active_connection_count()}
                )
                await connection_manager.broadcast_to_room(room_id, broadcast_message)

                # Broadcast updated game state
                await connection_manager.broadcast_game_state(room_id)


async def handle_player_input(connection_id: str, message: GameMessage):
    """Handle player input"""
    try:
        input_data = PlayerInputData(**message.data)

        # Validate player is in a room
        if connection_id not in connection_manager.connection_rooms:
            await send_error(connection_id, "NOT_IN_ROOM", "Player not in a room")
            return

        room_id = connection_manager.connection_rooms[connection_id]

        # Get game world and forward input
        world = world_manager.get_world(room_id)
        if world:
            # Debug: Check if the player_id from input matches connection_id
            if input_data.player_id != connection_id:
                print(f"⚠️ Player ID mismatch! Input from: {input_data.player_id}, Connection: {connection_id}")

            # Use connection_id as player_id (matching what we used when adding player)
            world.handle_player_input(connection_id, input_data.action, input_data.pressed)
            print(f"🎮 Input processed: {connection_id} -> {input_data.action} ({input_data.pressed})")

            # Broadcast updated game state to all players in room
            await connection_manager.broadcast_game_state(room_id)
        else:
            await send_error(connection_id, "WORLD_NOT_FOUND", "Game world not found for room")

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


async def handle_game_state_update(connection_id: str, message: GameMessage):
    """Handle client game state update with conflict resolution"""
    try:
        # Validate player is in a room
        if connection_id not in connection_manager.connection_rooms:
            await send_error(connection_id, "NOT_IN_ROOM", "Player not in a room")
            return

        room_id = connection_manager.connection_rooms[connection_id]
        world = world_manager.get_world(room_id)
        if not world:
            await send_error(connection_id, "WORLD_NOT_FOUND", "Game world not found for room")
            return

        client_state = message.data
        print(f"🔄 Processing game state update from {connection_id}")

        # Update player state (player always has authority over themselves)
        if client_state.get('player'):
            player_data = client_state['player']
            if player_data['player_id'] == connection_id:
                world.update_player_from_client(connection_id, player_data)

        # Resolve enemy state conflicts using distance-based authority
        if client_state.get('enemies'):
            for enemy_data in client_state['enemies']:
                enemy_id = enemy_data['enemy_id']
                enemy_pos = (enemy_data['x'], enemy_data['y'])

                # Check if this client has authority over this enemy
                if world.player_has_authority(connection_id, enemy_id):
                    world.update_enemy_from_client(enemy_id, enemy_data)
                    print(f"✅ {connection_id} has authority over {enemy_id}")
                else:
                    print(f"❌ {connection_id} denied authority over {enemy_id}")

        # Resolve projectile state conflicts (owner always has authority)
        if client_state.get('projectiles'):
            for projectile_data in client_state['projectiles']:
                projectile_id = projectile_data['projectile_id']
                owner_id = projectile_data['owner_id']

                # Only the owner can update their projectiles
                if owner_id == connection_id:
                    world.update_projectile_from_client(projectile_id, projectile_data)

        # Don't broadcast here - let the main update loop handle it at 30fps

    except Exception as e:
        await send_error(connection_id, "STATE_UPDATE_ERROR", str(e))


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
