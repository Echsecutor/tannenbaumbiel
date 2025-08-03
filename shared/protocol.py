"""
Shared protocol definitions for client-server communication
"""
from enum import Enum
from typing import Any, Dict, Union, Optional
from pydantic import BaseModel
from datetime import datetime


class MessageType(str, Enum):
    # Client to Server
    JOIN_ROOM = "join_room"
    LEAVE_ROOM = "leave_room"
    PLAYER_INPUT = "player_input"
    GAME_STATE_UPDATE = "game_state_update"
    PING = "ping"

    # Server to Client
    ROOM_JOINED = "room_joined"
    ROOM_LEFT = "room_left"
    GAME_STATE = "game_state"
    PLAYER_JOINED = "player_joined"
    PLAYER_LEFT = "player_left"
    PONG = "pong"
    ERROR = "error"


class InputAction(str, Enum):
    MOVE_LEFT = "move_left"
    MOVE_RIGHT = "move_right"
    JUMP = "jump"
    SHOOT = "shoot"
    STOP_MOVE = "stop_move"


class GameMessage(BaseModel):
    """Base message structure for all WebSocket communication"""
    type: MessageType
    timestamp: float
    data: Optional[Dict[str, Any]] = None


class PlayerInputData(BaseModel):
    """Data structure for player input messages"""
    action: InputAction
    player_id: str
    pressed: bool = True  # True for key down, False for key up


class PlayerState(BaseModel):
    """Player state data"""
    player_id: str
    username: str
    x: float
    y: float
    velocity_x: float = 0.0
    velocity_y: float = 0.0
    health: int = 100
    facing_right: bool = True
    is_grounded: bool = False
    is_jumping: bool = False
    is_shooting: bool = False


class ProjectileState(BaseModel):
    """Projectile state data"""
    projectile_id: str
    x: float
    y: float
    velocity_x: float
    velocity_y: float
    owner_id: str
    damage: int = 25


class EnemyState(BaseModel):
    """Enemy state data"""
    enemy_id: str
    enemy_type: str
    x: float
    y: float
    velocity_x: float = 0.0
    velocity_y: float = 0.0
    health: int = 100
    facing_right: bool = True


class GameStateData(BaseModel):
    """Complete game state data"""
    room_id: str
    tick: int
    players: list[PlayerState]
    enemies: list[EnemyState]
    projectiles: list[ProjectileState]


class JoinRoomData(BaseModel):
    """Data for joining a room"""
    room_name: str
    username: str
    character_type: str = "hero1"  # Reference to sprite set


class ErrorData(BaseModel):
    """Error message data"""
    error_code: str
    message: str


# Message type mapping for easier validation
MESSAGE_DATA_TYPES = {
    MessageType.JOIN_ROOM: JoinRoomData,
    MessageType.PLAYER_INPUT: PlayerInputData,
    MessageType.GAME_STATE: GameStateData,
    MessageType.ERROR: ErrorData,
}
