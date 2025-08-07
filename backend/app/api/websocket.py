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
from app.network.protocol import (
    GameMessage, MessageType, JoinRoomData, PlayerInputData, InputAction,
    ConnectionState, ReadyForWorldData, WorldReadyData, ClientReadyData
)


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
        self.connection_states: Dict[str, ConnectionState] = {}  # connection_id -> state

    async def connect(self, websocket: WebSocket, connection_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        self.connection_states[connection_id] = ConnectionState.CONNECTED
        print(f"Connection {connection_id} established with state {ConnectionState.CONNECTED}")

    def disconnect(self, connection_id: str):
        """Remove connection and clean up"""
        if connection_id in self.active_connections:
            # Leave room if in one
            if connection_id in self.connection_rooms:
                room_id = self.connection_rooms[connection_id]
                room_manager.leave_room(room_id, connection_id)
                del self.connection_rooms[connection_id]

            # Clean up state tracking
            if connection_id in self.connection_states:
                del self.connection_states[connection_id]

            del self.active_connections[connection_id]
            print(f"Connection {connection_id} disconnected")

    def get_connection_state(self, connection_id: str) -> ConnectionState:
        """Get current connection state"""
        return self.connection_states.get(connection_id, ConnectionState.DISCONNECTED)

    def set_connection_state(self, connection_id: str, state: ConnectionState):
        """Set connection state"""
        old_state = self.connection_states.get(connection_id, ConnectionState.DISCONNECTED)
        self.connection_states[connection_id] = state
        print(f"🔄 Connection {connection_id} state: {old_state} → {state}")

    def validate_state_transition(self, connection_id: str, required_state: ConnectionState) -> bool:
        """Validate that connection is in required state"""
        current_state = self.get_connection_state(connection_id)
        return current_state == required_state

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
    print(f"🔧 Backend: Received message type '{message.type}' from {connection_id}")

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

    elif message.type == MessageType.REQUEST_WORLD_STATE:
        await handle_request_world_state(connection_id, message)

    elif message.type == MessageType.READY_FOR_WORLD:
        await handle_ready_for_world(connection_id, message)

    elif message.type == MessageType.WORLD_READY:
        await handle_world_ready(connection_id, message)

    elif message.type == MessageType.CLIENT_READY:
        await handle_client_ready(connection_id, message)

    else:
        await send_error(connection_id, "UNKNOWN_MESSAGE_TYPE", f"Unknown message type: {message.type}")


async def handle_join_room(connection_id: str, message: GameMessage):
    """Handle room join request"""
    try:
        print(f"🔧 Backend: Handling join room request for {connection_id}")
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
            print(f"🔧 Backend: Player {connection_id} joined room {room.room_id}")
            # Track connection-room mapping
            connection_manager.connection_rooms[connection_id] = room.room_id

            # Create or get game world for this room
            world = world_manager.get_world(room.room_id)
            if not world:
                world = world_manager.create_world(room.room_id)
                print(f"🔧 Backend: Created new world for room {room.room_id}")

            # Add player to game world
            player_state = world.add_player(
                player_id=connection_id,  # Use connection_id as player_id for now
                username=join_data.username,
                x=100 + (room.get_active_connection_count() - 1) * 50,  # Spread players out
                y=650  # Start above ground level
            )

            # Update connection state
            connection_manager.set_connection_state(connection_id, ConnectionState.ROOM_JOINED)

            # Send ONLY room_joined confirmation - wait for client acknowledgment before sending world state
            response = GameMessage(
                type=MessageType.ROOM_JOINED,
                timestamp=message.timestamp,
                connection_state=ConnectionState.ROOM_JOINED,
                data={
                    "room_id": room.room_id,
                    "player_count": room.get_active_connection_count(),
                    "max_players": settings.max_players_per_room,
                    "player_list": room.get_player_list(),
                    "your_player_id": connection_id
                }
            )
            await connection_manager.send_message(connection_id, response)
            print(f"🔧 Backend: Sent room_joined message to {connection_id}, waiting for ready_for_world acknowledgment")

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
        print(f"🔧 Backend: Error in handle_join_room for {connection_id}: {e}")
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


async def handle_request_world_state(connection_id: str, message: GameMessage):
    """Handle client request for world state"""
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

        world_state = world.get_world_state()
        response = GameMessage(
            type=MessageType.WORLD_STATE,
            timestamp=message.timestamp,
            data=world_state.model_dump()
        )
        await connection_manager.send_message(connection_id, response)
        print(f"🌍 Sent world state to {connection_id} for room {room_id}")

    except Exception as e:
        await send_error(connection_id, "REQUEST_WORLD_STATE_ERROR", str(e))


async def handle_ready_for_world(connection_id: str, message: GameMessage):
    """Handle client ready for world state"""
    try:
        # Validate state transition
        if not connection_manager.validate_state_transition(connection_id, ConnectionState.ROOM_JOINED):
            await send_error(connection_id, "INVALID_STATE", f"Expected state ROOM_JOINED, got {connection_manager.get_connection_state(connection_id)}")
            return

        ready_data = ReadyForWorldData(**message.data)
        print(f"🌍 Backend: Client {connection_id} ready for world state")

        # Get room and world
        room_id = connection_manager.connection_rooms.get(connection_id)
        if not room_id or room_id != ready_data.room_id:
            await send_error(connection_id, "ROOM_MISMATCH", "Room ID doesn't match")
            return

        world = world_manager.get_world(room_id)
        if not world:
            await send_error(connection_id, "WORLD_NOT_FOUND", "Game world not found")
            return

        # Send world state
        world_state = world.get_world_state()
        world_message = GameMessage(
            type=MessageType.WORLD_STATE,
            timestamp=message.timestamp,
            connection_state=ConnectionState.WORLD_SENT,
            data=world_state.model_dump()
        )
        await connection_manager.send_message(connection_id, world_message)
        
        # Update connection state
        connection_manager.set_connection_state(connection_id, ConnectionState.WORLD_SENT)
        print(f"🌍 Sent world state to {connection_id}: {len(world_state.platforms)} platforms, seed {world_state.world_seed}")

    except Exception as e:
        await send_error(connection_id, "READY_FOR_WORLD_ERROR", str(e))


async def handle_world_ready(connection_id: str, message: GameMessage):
    """Handle client acknowledgment of world state received"""
    try:
        # Validate state transition
        if not connection_manager.validate_state_transition(connection_id, ConnectionState.WORLD_SENT):
            await send_error(connection_id, "INVALID_STATE", f"Expected state WORLD_SENT, got {connection_manager.get_connection_state(connection_id)}")
            return

        world_ready_data = WorldReadyData(**message.data)
        print(f"🌍 Backend: Client {connection_id} confirmed world state received (seed: {world_ready_data.world_seed})")

        # Get room and world
        room_id = connection_manager.connection_rooms.get(connection_id)
        if not room_id or room_id != world_ready_data.room_id:
            await send_error(connection_id, "ROOM_MISMATCH", "Room ID doesn't match")
            return

        world = world_manager.get_world(room_id)
        if not world:
            await send_error(connection_id, "WORLD_NOT_FOUND", "Game world not found")
            return

        # Validate world seed matches
        if world.world_seed != world_ready_data.world_seed:
            await send_error(connection_id, "WORLD_SEED_MISMATCH", f"Expected seed {world.world_seed}, got {world_ready_data.world_seed}")
            return

        # Send initial game state
        initial_state = world.get_game_state()
        state_message = GameMessage(
            type=MessageType.GAME_STATE,
            timestamp=message.timestamp,
            connection_state=ConnectionState.GAME_READY,
            data=initial_state.model_dump()
        )
        await connection_manager.send_message(connection_id, state_message)
        
        # Update connection state
        connection_manager.set_connection_state(connection_id, ConnectionState.GAME_READY)
        print(f"🌍 Sent initial game state to {connection_id}: {len(initial_state.enemies)} enemies, {len(initial_state.projectiles)} projectiles")

    except Exception as e:
        await send_error(connection_id, "WORLD_READY_ERROR", str(e))


async def handle_client_ready(connection_id: str, message: GameMessage):
    """Handle client acknowledgment that initialization is complete"""
    try:
        # Validate state transition
        if not connection_manager.validate_state_transition(connection_id, ConnectionState.GAME_READY):
            await send_error(connection_id, "INVALID_STATE", f"Expected state GAME_READY, got {connection_manager.get_connection_state(connection_id)}")
            return

        client_ready_data = ClientReadyData(**message.data)
        print(f"🎮 Backend: Client {connection_id} initialization complete and ready for gameplay")

        # Client is now fully ready for gameplay - no state change needed, GAME_READY is final state
        # From this point on, normal game state updates can proceed

    except Exception as e:
        await send_error(connection_id, "CLIENT_READY_ERROR", str(e))


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
