"""
REST API endpoints for game management
"""
from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel

from app.network.rooms import RoomManager
from app.config.settings import settings


router = APIRouter()

# Room manager instance (in real app, this would be dependency injected)
room_manager = RoomManager()


class RoomInfo(BaseModel):
    """Room information response model"""
    room_id: str
    name: str
    player_count: int
    max_players: int
    is_full: bool
    created_at: str


class GameStats(BaseModel):
    """Game statistics response model"""
    total_rooms: int
    total_players: int
    active_games: int


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "tannenbaumbiel-backend"}


@router.get("/rooms", response_model=List[RoomInfo])
async def list_rooms():
    """List all active game rooms"""
    rooms = room_manager.list_rooms()
    return [RoomInfo(**room) for room in rooms]


@router.get("/stats", response_model=GameStats)
async def get_game_stats():
    """Get current game statistics"""
    rooms = room_manager.list_rooms()
    total_players = sum(room["player_count"] for room in rooms)
    active_games = sum(1 for room in rooms if room["player_count"] > 1)

    return GameStats(
        total_rooms=len(rooms),
        total_players=total_players,
        active_games=active_games
    )


@router.get("/config")
async def get_game_config():
    """Get game configuration"""
    return {
        "max_players_per_room": settings.max_players_per_room,
        "game_tick_rate": settings.game_tick_rate,
        "physics_update_rate": settings.physics_update_rate
    }
