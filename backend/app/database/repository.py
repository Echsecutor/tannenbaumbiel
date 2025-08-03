"""
Database repository layer for game entities
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.database.models import GameRoom, Player, GameSession, GameStat
from app.database.connection import get_db_session


class GameRepository:
    """Repository for game-related database operations"""

    def __init__(self, db: Session = None):
        self.db = db or get_db_session()
        self._should_close = db is None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._should_close:
            self.db.close()

    # Room operations
    def create_room(self, name: str, max_players: int = 4) -> GameRoom:
        """Create a new game room"""
        room = GameRoom(name=name, max_players=max_players)
        self.db.add(room)
        self.db.commit()
        self.db.refresh(room)
        return room

    def get_room_by_id(self, room_id: UUID) -> Optional[GameRoom]:
        """Get room by ID"""
        return self.db.query(GameRoom).filter(GameRoom.id == room_id).first()

    def get_room_by_name(self, name: str) -> Optional[GameRoom]:
        """Get room by name"""
        return self.db.query(GameRoom).filter(
            and_(GameRoom.name == name, GameRoom.is_active == True)
        ).first()

    def get_active_rooms(self) -> List[GameRoom]:
        """Get all active rooms"""
        return self.db.query(GameRoom).filter(GameRoom.is_active == True).all()

    def deactivate_room(self, room_id: UUID) -> bool:
        """Deactivate a room"""
        room = self.get_room_by_id(room_id)
        if room:
            room.is_active = False
            room.updated_at = datetime.utcnow()
            self.db.commit()
            return True
        return False

    # Player operations
    def create_player(self, username: str, session_id: str = None) -> Player:
        """Create a new player"""
        player = Player(username=username, session_id=session_id)
        self.db.add(player)
        self.db.commit()
        self.db.refresh(player)
        return player

    def get_player_by_id(self, player_id: UUID) -> Optional[Player]:
        """Get player by ID"""
        return self.db.query(Player).filter(Player.id == player_id).first()

    def get_player_by_session_id(self, session_id: str) -> Optional[Player]:
        """Get player by session ID"""
        return self.db.query(Player).filter(Player.session_id == session_id).first()

    def get_player_by_username(self, username: str) -> Optional[Player]:
        """Get player by username"""
        return self.db.query(Player).filter(Player.username == username).first()

    def update_player_last_seen(self, player_id: UUID):
        """Update player's last seen timestamp"""
        player = self.get_player_by_id(player_id)
        if player:
            player.last_seen = datetime.utcnow()
            self.db.commit()

    def update_player_session(self, player_id: UUID, session_id: str):
        """Update player's session ID"""
        player = self.get_player_by_id(player_id)
        if player:
            player.session_id = session_id
            player.last_seen = datetime.utcnow()
            self.db.commit()

    # Game session operations
    def create_game_session(self, room_id: UUID, player_id: UUID, character_type: str = "hero1") -> GameSession:
        """Create a new game session"""
        session = GameSession(
            room_id=room_id,
            player_id=player_id,
            character_type=character_type
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_game_session_by_id(self, session_id: UUID) -> Optional[GameSession]:
        """Get game session by ID"""
        return self.db.query(GameSession).filter(GameSession.id == session_id).first()

    def get_active_sessions_for_room(self, room_id: UUID) -> List[GameSession]:
        """Get all active sessions for a room"""
        return self.db.query(GameSession).filter(
            and_(GameSession.room_id == room_id, GameSession.left_at.is_(None))
        ).all()

    def get_active_session_for_player(self, player_id: UUID) -> Optional[GameSession]:
        """Get active session for a player"""
        return self.db.query(GameSession).filter(
            and_(GameSession.player_id == player_id, GameSession.left_at.is_(None))
        ).first()

    def end_game_session(self, session_id: UUID, final_score: int = None) -> bool:
        """End a game session"""
        session = self.get_game_session_by_id(session_id)
        if session and session.is_active:
            session.left_at = datetime.utcnow()
            if final_score is not None:
                session.score = final_score
            self.db.commit()
            return True
        return False

    def update_session_score(self, session_id: UUID, score: int):
        """Update session score"""
        session = self.get_game_session_by_id(session_id)
        if session:
            session.score = score
            self.db.commit()

    # Game statistics operations
    def record_stat(self, player_id: UUID, session_id: UUID, stat_type: str, stat_value: int) -> GameStat:
        """Record a game statistic"""
        stat = GameStat(
            player_id=player_id,
            session_id=session_id,
            stat_type=stat_type,
            stat_value=stat_value
        )
        self.db.add(stat)
        self.db.commit()
        self.db.refresh(stat)
        return stat

    def get_player_stats(self, player_id: UUID, stat_type: str = None) -> List[GameStat]:
        """Get player statistics"""
        query = self.db.query(GameStat).filter(GameStat.player_id == player_id)
        if stat_type:
            query = query.filter(GameStat.stat_type == stat_type)
        return query.order_by(GameStat.recorded_at.desc()).all()

    # Cleanup operations
    def cleanup_old_sessions(self, hours_ago: int = 24) -> int:
        """Clean up old inactive sessions"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_ago)

        # Find sessions that are either:
        # - Explicitly ended more than X hours ago
        # - Never ended but created more than X hours ago
        old_sessions = self.db.query(GameSession).filter(
            or_(
                and_(GameSession.left_at.isnot(None), GameSession.left_at < cutoff_time),
                and_(GameSession.left_at.is_(None), GameSession.joined_at < cutoff_time)
            )
        ).all()

        count = len(old_sessions)
        for session in old_sessions:
            if session.left_at is None:
                session.left_at = session.joined_at  # Mark as ended

        self.db.commit()
        return count

    def cleanup_inactive_rooms(self, hours_ago: int = 48) -> int:
        """Clean up rooms with no recent activity"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_ago)

        # Find rooms with no active sessions and no recent activity
        inactive_rooms = self.db.query(GameRoom).filter(
            and_(
                GameRoom.is_active == True,
                GameRoom.updated_at < cutoff_time,
                ~GameRoom.game_sessions.any(GameSession.left_at.is_(None))
            )
        ).all()

        count = len(inactive_rooms)
        for room in inactive_rooms:
            room.is_active = False
            room.updated_at = datetime.utcnow()

        self.db.commit()
        return count
